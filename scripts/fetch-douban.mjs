/**
 * 从豆瓣抓取真实资料：评分、导演、主演、类型、地区、片长、剧情简介、海报、剧照。
 *
 * 口径：
 *   - 只抓公开页面上可见的字段；串行 + 节流（默认每部约 2.2 秒），不做并发轰炸。
 *   - 仅用于个人非商业站点；海报 / 剧照版权归发行方，页面逐条标注来源与条目链接。
 *   - 抓不到就留空并计入失败清单，绝不编造。
 *
 * 用法：
 *   node scripts/fetch-douban.mjs                # 补缺（已有记录的跳过，可反复续跑）
 *   node scripts/fetch-douban.mjs --force        # 全量重抓
 *   node scripts/fetch-douban.mjs --limit=5      # 先试 5 部
 *   node scripts/fetch-douban.mjs --stills=3     # 每部下载 3 张剧照（默认 2）
 *   node scripts/fetch-douban.mjs --gap=2500     # 放慢请求间隔
 *   node scripts/fetch-douban.mjs --of=3 --shard=1   # 分片并行（多进程各跑一片）
 *
 * 产物：
 *   data/derived/douban.json        记录（rating / facts / poster / stills / intro）
 *   public/posters-douban/<id>.jpg  海报
 *   public/stills/<id>-1.jpg …      剧照
 *   data/cache/douban/              原始响应缓存（7 天有效）
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const UA_DESKTOP =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

const args = process.argv.slice(2);
const FORCE = args.includes("--force");
const LIMIT = Number((args.find((a) => a.startsWith("--limit=")) || "").split("=")[1] || 0);
const STILL_COUNT = Number((args.find((a) => a.startsWith("--stills=")) || "").split("=")[1] || 2);
const GAP_MS = Number((args.find((a) => a.startsWith("--gap=")) || "").split("=")[1] || 2200);
const SHARD_OF = Number((args.find((a) => a.startsWith("--of=")) || "").split("=")[1] || 1);
const SHARD_IDX = Number((args.find((a) => a.startsWith("--shard=")) || "").split("=")[1] || 0);

const OUT_POSTER = path.join(ROOT, "public", "posters-douban");
const OUT_STILL = path.join(ROOT, "public", "stills");
const CACHE = path.join(ROOT, "data", "cache", "douban");
const STORE = path.join(ROOT, "data", "derived", "douban.json");
const HINTS_PATH = path.join(ROOT, "data", "raw", "douban-hints.json");

for (const d of [OUT_POSTER, OUT_STILL, CACHE]) fs.mkdirSync(d, { recursive: true });

const store = fs.existsSync(STORE) ? JSON.parse(fs.readFileSync(STORE, "utf8")) : { records: {}, failures: {} };
store.records ??= {};
store.failures ??= {};

const HINTS = fs.existsSync(HINTS_PATH) ? JSON.parse(fs.readFileSync(HINTS_PATH, "utf8")) : {};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const TTL = 7 * 24 * 3600 * 1000;

/** 并发安全落盘：先读磁盘最新版本，合并自己的记录再原子写入 */
function saveStore() {
  let disk = { records: {}, failures: {} };
  if (fs.existsSync(STORE)) {
    try {
      disk = JSON.parse(fs.readFileSync(STORE, "utf8"));
      disk.records ??= {};
      disk.failures ??= {};
    } catch {
      /* 另一个进程正在写，忽略 */
    }
  }
  const merged = {
    generatedAt: new Date().toISOString(),
    records: { ...disk.records, ...store.records },
    failures: { ...disk.failures, ...store.failures },
  };
  const tmp = `${STORE}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, JSON.stringify(merged, null, 2), "utf8");
  fs.renameSync(tmp, STORE);
}

function cacheGet(key) {
  const f = path.join(CACHE, `${key}.json`);
  if (!fs.existsSync(f)) return null;
  if (Date.now() - fs.statSync(f).mtimeMs > TTL) return null;
  try {
    return JSON.parse(fs.readFileSync(f, "utf8"));
  } catch {
    return null;
  }
}

function cacheSet(key, value) {
  fs.writeFileSync(path.join(CACHE, `${key}.json`), JSON.stringify(value), "utf8");
}

async function fetchJson(url, { referer, cacheKey, tries = 4 } = {}) {
  if (cacheKey) {
    const hit = cacheGet(cacheKey);
    if (hit) return hit;
  }
  for (let i = 0; i < tries; i++) {
    let res;
    try {
      res = await fetch(url, {
        headers: {
          "User-Agent": UA,
          Accept: "application/json, text/plain, */*",
          "Accept-Language": "zh-CN,zh;q=0.9",
          ...(referer ? { Referer: referer } : {}),
        },
      });
    } catch (e) {
      if (i === tries - 1) throw e;
      await sleep(3000 * (i + 1));
      continue;
    }
    if (res.status === 403 || res.status === 418 || res.status === 429) {
      const wait = Math.min(90000, 8000 * Math.pow(2, i));
      process.stdout.write(`    ${res.status} backoff ${Math.round(wait / 1000)}s\n`);
      await sleep(wait);
      continue;
    }
    if (res.status === 400) {
      // 豆瓣的「单条目 IP 限流」返回 400 + code 1309，等一会儿再试
      let body = "";
      try {
        body = await res.text();
      } catch {
        /* ignore */
      }
      if (body.includes("subject_ip_rate_limit") || body.includes("1309")) {
        const wait = Math.min(120000, 45000 * (i + 1));
        process.stdout.write(`    subject rate limit, wait ${Math.round(wait / 1000)}s\n`);
        await sleep(wait);
        continue;
      }
      throw new Error(`HTTP 400 ${url} :: ${body.slice(0, 120)}`);
    }
    if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
    const json = await res.json();
    if (cacheKey) cacheSet(cacheKey, json);
    return json;
  }
  throw new Error("retries exhausted (douban rate limit / anti-bot)");
}

async function download(url, dest, referer) {
  for (let i = 0; i < 4; i++) {
    let res;
    try {
      res = await fetch(url, {
        headers: { "User-Agent": UA, Referer: referer ?? "https://movie.douban.com/", Accept: "image/*,*/*" },
      });
    } catch (e) {
      if (i === 3) throw e;
      await sleep(2000 * (i + 1));
      continue;
    }
    if (res.status === 403 || res.status === 418 || res.status === 429) {
      await sleep(6000 * (i + 1));
      continue;
    }
    if (!res.ok) throw new Error(`image HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(dest, buf);
    return buf.length;
  }
  throw new Error("image download failed");
}

const norm = (s) =>
  String(s ?? "")
    .toLowerCase()
    .replace(/[\s·:：\-—–_,，。！!？?（）()《》「」"'"'·・]/g, "");

function jaccard(a, b) {
  const A = new Set([...a]);
  const B = new Set([...b]);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const c of A) if (B.has(c)) inter++;
  return inter / (A.size + B.size - inter);
}

/** 网页搜索兜底：suggest 对部分片名返回空数组时使用 */
async function htmlSearch(q) {
  const url = `https://www.douban.com/search?cat=1002&q=${encodeURIComponent(q)}`;
  const cacheKey = `htmlsearch-${Buffer.from(q).toString("hex").slice(0, 40)}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;
  const res = await fetch(url, {
    headers: { "User-Agent": UA_DESKTOP, "Accept-Language": "zh-CN,zh;q=0.9", Accept: "text/html" },
  });
  if (!res.ok) throw new Error(`HTML search HTTP ${res.status}`);
  const html = await res.text();
  const out = [];
  const re = /href="(https:\/\/www\.douban\.com\/link2\/\?url=([^"&]+)[^"]*)"[^>]*>([\s\S]{0,200}?)<\/a>/g;
  for (const m of html.matchAll(re)) {
    let target;
    try {
      target = decodeURIComponent(m[2]);
    } catch {
      continue;
    }
    const idm = /\/subject\/(\d+)/.exec(target);
    if (!idm) continue;
    const title = m[3]
      .replace(/<[^>]+>/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (!title) continue;
    if (out.some((o) => o.id === idm[1])) continue;
    out.push({ id: idm[1], title, sub_title: "", year: "", type: "movie", img: "" });
  }
  cacheSet(cacheKey, out);
  return out;
}

/** 在候选里挑最像的一条；宁可不选，也不选错 */
function pickBest(cands, movie) {
  if (!cands?.length) return null;
  const want = [movie.chineseTitle, movie.originalTitle].map(norm).filter(Boolean);
  const scored = cands.map((c) => {
    const t = norm(c.title);
    const sub = norm(c.sub_title);
    const cy = Number(String(c.year ?? "").slice(0, 4));
    const hasYear = Number.isFinite(cy) && cy > 0;
    const dy = hasYear ? Math.abs(cy - movie.releaseYear) : null;

    let s = 0;
    if (want.includes(t)) s += 60;
    if (want.includes(sub)) s += 30;

    const fuzzy = Math.max(0, ...want.map((w) => Math.max(jaccard(w, t), jaccard(w, sub))));
    s += Math.round(fuzzy * 34);

    if (hasYear) {
      if (dy === 0) s += 40;
      else if (dy <= 1) s += 12;
      else if (dy >= 3) s -= 60;
    }

    const wantTv = movie.mediaType === "series";
    if ((c.type === "tv" || c.type === "show") === wantTv) s += 6;

    return { c, s, fuzzy, titleExact: want.includes(t) || want.includes(sub), yearly: hasYear && dy <= 1 };
  });
  scored.sort((a, b) => b.s - a.s);
  for (const top of scored) {
    const ok =
      top.titleExact ||
      top.fuzzy >= 0.8 ||
      (top.fuzzy >= 0.72 && (top.yearly || !top.s || top.s >= 45)) ||
      (top.fuzzy >= 0.62 && top.yearly) ||
      (top.fuzzy >= 0.55 && top.yearly && top.s >= 70);
    if (ok) return top.c;
  }
  return null;
}

const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "catalog.json"), "utf8"));
let movies = catalog.movies;
if (!FORCE) movies = movies.filter((m) => !store.records[m.id]?.subjectId);
if (SHARD_OF > 1) movies = movies.filter((_, i) => i % SHARD_OF === SHARD_IDX);
if (LIMIT) movies = movies.slice(0, LIMIT);

console.log(
  `target ${movies.length} films, stills ${STILL_COUNT}/film, gap ${GAP_MS}ms${
    SHARD_OF > 1 ? `, shard ${SHARD_IDX}/${SHARD_OF}` : ""
  }${FORCE ? " (force)" : ""}`
);

let ok = 0;
let bad = 0;

for (const m of movies) {
  const label = `${m.id} (${m.chineseTitle})`;
  try {
    const queries = [
      m.chineseTitle,
      String(m.chineseTitle).replace(/[：:·・]/g, " ").replace(/\s+/g, " ").trim(),
      String(m.chineseTitle).split(/[：:]/)[0].trim(),
      m.originalTitle,
    ].filter((v, i, arr) => v && arr.indexOf(v) === i);

    const hinted = HINTS[m.id]
      ? [{ id: String(HINTS[m.id]), title: m.chineseTitle, sub_title: "", year: String(m.releaseYear), type: "movie" }]
      : null;

    let pool = hinted ?? [];
    if (!pool.length) {
      for (const q of queries) {
        const key = `suggest-${Buffer.from(q).toString("hex").slice(0, 40)}`;
        const cands = await fetchJson(`https://movie.douban.com/j/subject_suggest?q=${encodeURIComponent(q)}`, {
          cacheKey: key,
        });
        await sleep(Math.round(GAP_MS * 0.4));
        if (Array.isArray(cands) && cands.length) {
          pool = cands;
          break;
        }
      }
    }
    if (!pool.length) {
      for (const q of queries.slice(0, 3)) {
        try {
          const found = await htmlSearch(q);
          await sleep(Math.round(GAP_MS * 0.5));
          if (found.length) {
            pool = found;
            break;
          }
        } catch (e) {
          console.log(`    (html search failed: ${e.message})`);
        }
      }
    }

    let best = pickBest(pool, m);
    // suggest 没给出可信结果 → 用网页搜索按英文原名再找一次（老片/系列片常在这里得救）
    if (!best && m.originalTitle) {
      try {
        const found = await htmlSearch(m.originalTitle);
        await sleep(Math.round(GAP_MS * 0.6));
        if (found.length) {
          const second = pickBest(found, m);
          if (second) {
            best = second;
            pool = found;
          }
        }
      } catch (e) {
        console.log(`    (html search fallback failed: ${e.message})`);
      }
    }
    if (!best) {
      console.log(`  x ${label}: no match (${pool.length} candidates)`);
      store.failures[m.id] = {
        reason: "no-suggest-match",
        candidates: pool.slice(0, 6).map((c) => `${c.id}|${c.title}|${c.year ?? ""}`),
        queries,
        at: new Date().toISOString(),
      };
      bad++;
      await sleep(GAP_MS);
      continue;
    }

    const sid = best.id;
    const referer = `https://m.douban.com/movie/subject/${sid}/`;
    const detail = await fetchJson(`https://m.douban.com/rexxar/api/v2/movie/${sid}`, {
      referer,
      cacheKey: `detail-${sid}`,
    });
    await sleep(GAP_MS);

    let photos = null;
    try {
      photos = await fetchJson(
        `https://m.douban.com/rexxar/api/v2/movie/${sid}/photos?count=${Math.max(6, STILL_COUNT + 2)}&start=0`,
        { referer, cacheKey: `photos-${sid}` }
      );
      await sleep(Math.round(GAP_MS * 0.6));
    } catch (e) {
      console.log(`    (photos failed: ${e.message})`);
    }

    const now = new Date().toISOString();
    const rec = {
      subjectId: sid,
      url: `https://movie.douban.com/subject/${sid}/`,
      title: detail.title ?? best.title,
      originalTitle: detail.original_title ?? best.sub_title ?? "",
      year: Number(String(detail.year ?? best.year ?? "").slice(0, 4)) || null,
      isTv: Boolean(detail.is_tv),
      genres: detail.genres ?? [],
      countries: detail.countries ?? [],
      languages: detail.languages ?? [],
      durations: detail.durations ?? [],
      pubdate: detail.pubdate ?? [],
      directors: (detail.directors ?? []).map((x) => x.name).filter(Boolean),
      actors: (detail.actors ?? []).map((x) => x.name).filter(Boolean),
      aka: detail.aka ?? [],
      intro: String(detail.intro ?? "").trim(),
      rating:
        detail.rating && typeof detail.rating.value === "number"
          ? {
              value: detail.rating.value,
              scale: detail.rating.max ?? 10,
              count: detail.rating.count ?? null,
              starCount: detail.rating.star_count ?? null,
            }
          : null,
      poster: null,
      stills: [],
      fetchMethod: "m.douban.com rexxar api v2 (subject_suggest to locate subject)",
      license:
        "Poster/still copyright belongs to the distributor; this site references them for personal non-commercial use only. Rating values come from Douban public pages.",
      fetchedAt: now,
    };

    const posterUrl = detail.pic?.large || detail.cover_url || best.img;
    if (posterUrl) {
      const rel = `/posters-douban/${m.id}.jpg`;
      try {
        await download(posterUrl, path.join(ROOT, "public", rel), referer);
        rec.poster = {
          src: rel,
          width: 0,
          height: 0,
          source: "douban.com",
          sourceUrl: `https://movie.douban.com/subject/${sid}/photos?type=R`,
          articleUrl: `https://movie.douban.com/subject/${sid}/`,
          license: "Copyright of the distributor; referenced from Douban for personal non-commercial use",
          licenseNote: "Poster copyright belongs to the distributor. Shown for personal non-commercial use with source link.",
          fetchedAt: now,
        };
        await sleep(600);
      } catch (e) {
        console.log(`    (poster download failed: ${e.message})`);
      }
    }

    const photoList = photos?.photos ?? [];
    for (let i = 0; i < Math.min(STILL_COUNT, photoList.length); i++) {
      const p = photoList[i];
      const url = p?.image?.large?.url || p?.image?.normal?.url;
      if (!url) continue;
      const rel = `/stills/${m.id}-${i + 1}.jpg`;
      try {
        await download(url, path.join(ROOT, "public", rel), referer);
        rec.stills.push({
          src: rel,
          width: p.image.large?.width ?? 0,
          height: p.image.large?.height ?? 0,
          source: "douban.com",
          sourceUrl: `https://movie.douban.com/subject/${sid}/photos?type=S`,
          articleUrl: `https://movie.douban.com/subject/${sid}/`,
          license: "Still copyright of the distributor; referenced from Douban for personal non-commercial use",
          licenseNote: "Still copyright belongs to the distributor.",
          fetchedAt: now,
        });
        await sleep(600);
      } catch (e) {
        console.log(`    (still ${i + 1} download failed: ${e.message})`);
      }
    }

    store.records[m.id] = rec;
    delete store.failures[m.id];
    ok++;
    console.log(
      `  ok ${label} -> douban ${sid} rating=${rec.rating?.value ?? "-"} (${rec.rating?.count ?? "-"})` +
        ` poster=${rec.poster ? "y" : "n"} stills=${rec.stills.length}`
    );
    if (ok % 3 === 0) saveStore();
  } catch (e) {
    bad++;
    store.failures[m.id] = { reason: e.message, at: new Date().toISOString() };
    console.log(`  x ${label}: ${e.message}`);
    await sleep(Math.min(30000, GAP_MS * 3));
  }
  await sleep(GAP_MS);
}

saveStore();
console.log(`\ndone: ok ${ok}, failed ${bad}`);
console.log(`records total: ${Object.keys(store.records).length}`);
console.log("next: node scripts/merge-catalog.mjs");
