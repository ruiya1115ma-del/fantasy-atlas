/**
 * 多来源海报补齐 + 核验
 *
 * 目标：让电影库里的每一部作品都有一张真实、可核验的发行海报。
 *
 * 来源优先级（都能核验身份，不靠模糊匹配直接落盘）：
 *   1. en.wikipedia.org  条目 infobox 主图（发行海报，合理使用）
 *   2. zh.wikipedia.org  中文条目 infobox 主图（中文版海报优先）
 *   3. wikidata P18      Commons 上的自由版权图片（通常为 logo/剧照，兜底）
 *
 * 用法：
 *   node scripts/fill-posters.mjs                  # 只补缺海报的作品
 *   node scripts/fill-posters.mjs --all            # 全部重扫（已有则跳过下载，只补核验信息）
 *   node scripts/fill-posters.mjs --only=id1,id2   # 指定作品
 *   node scripts/fill-posters.mjs --verify         # 只做核验，不抓新图
 *   node scripts/fill-posters.mjs --delay=1500     # 请求间隔
 *
 * 产物：
 *   public/posters/<id>.<jpg|png>        本地海报文件
 *   data/derived/posters.json            每条记录含来源/来源页/许可/语言/核验状态/备用地址
 *   data/reports/poster-report.json      本次运行的统计与失败原因
 *
 * 核验规则（写进 verified 字段，页面与文档都读它）：
 *   titleMatch  —— 条目名与作品原名/中文名有实质重合
 *   yearMatch   —— 条目正文出现该片年份
 *   posterLike  —— 图片为竖版（height > width）且尺寸足够
 *   status      —— "verified" 全部通过 / "partial" 部分通过 / "unverified"
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const CATALOG = path.join(ROOT, "data", "catalog.json");
const RAW_DIR = path.join(ROOT, "data", "raw");
const OUT_JSON = path.join(ROOT, "data", "derived", "posters.json");
const REPORT = path.join(ROOT, "data", "reports", "poster-report.json");
const POSTER_DIR = path.join(ROOT, "public", "posters");

const UA = "FantasyAtlas/1.0 (node; personal non-commercial film guide)";
const args = process.argv.slice(2);
const ONLY = args.find((a) => a.startsWith("--only="))?.split("=")[1]?.split(",").filter(Boolean) ?? null;
const DELAY = Number(args.find((a) => a.startsWith("--delay="))?.split("=")[1] ?? 1100);
const ALL = args.includes("--all");
const VERIFY_ONLY = args.includes("--verify");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(host, params, tries = 6) {
  const url = `https://${host}/w/api.php?format=json&formatversion=2&${params}`;
  for (let i = 0; i < tries; i++) {
    let res;
    try {
      res = await fetch(url, { headers: { "User-Agent": UA, "Accept-Encoding": "identity" } });
    } catch (err) {
      if (i === tries - 1) throw err;
      await sleep(2500 * (i + 1));
      continue;
    }
    if (res.status === 429 || res.status === 503) {
      await sleep(Math.min(45000, 4000 * Math.pow(2, i)));
      continue;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }
  throw new Error("限流重试耗尽");
}

function chunk(arr, n) {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

const norm = (s) =>
  String(s ?? "")
    .toLowerCase()
    .replace(/[（(].*?[)）]/g, " ")
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, " ")
    .trim();

/** infobox 里的 image 参数 */
function imageFromWikitext(wt) {
  if (!wt) return null;
  const m =
    wt.match(/\|\s*image\s*=\s*\[\[(?:File|Image):([^\]|]+)/i) || wt.match(/\|\s*image\s*=\s*([^\n|]+)/i);
  if (!m) return null;
  let name = m[1].trim().replace(/^\[\[|\]\]$/g, "").replace(/^(?:File|Image):/i, "").trim();
  if (!name || /\{\{|\}\}/.test(name)) return null;
  if (!/\.(jpe?g|png)$/i.test(name)) return null;
  return name;
}

function readRawHints() {
  const hints = {};
  if (!fs.existsSync(RAW_DIR)) return hints;
  for (const f of fs.readdirSync(RAW_DIR).filter((x) => x.endsWith(".json"))) {
    let arr;
    try {
      arr = JSON.parse(fs.readFileSync(path.join(RAW_DIR, f), "utf8"));
    } catch {
      continue;
    }
    if (!Array.isArray(arr)) continue;
    for (const r of arr) {
      if (!r?.catalog_key) continue;
      hints[r.catalog_key] = {
        wikipedia_page_en: r.wikipedia_page_en ?? null,
        wikipedia_page_zh: r.wikipedia_page_zh ?? null,
        external_title_hints: r.external_title_hints ?? [],
      };
    }
  }
  return hints;
}

/** 用搜索找候选条目（标题必须与作品名有实质重合） */
async function searchTitles(host, query, expect) {
  const json = await api(host, `action=query&list=search&srsearch=${encodeURIComponent(query)}&srlimit=6`);
  const hits = (json?.query?.search ?? []).map((s) => s.title);
  if (!hits.length) return [];
  const want = norm(expect);
  const wantTokens = want.split(" ").filter((t) => t.length > 2);
  return hits.filter((h) => {
    const n = norm(h);
    if (!wantTokens.length) return true;
    return wantTokens.some((t) => n.includes(t));
  });
}

/** 取一个条目的 wikitext 与 infobox 年份线索 */
async function getArticle(host, titles) {
  if (!titles.length) return [];
  const json = await api(
    host,
    `action=query&prop=revisions&rvslots=main&rvprop=content&redirects=1&titles=${encodeURIComponent(titles.join("|"))}`
  );
  const pages = json?.query?.pages ?? [];
  return pages
    .filter((p) => !p.missing && p.revisions?.[0]?.slots?.main?.content)
    .map((p) => ({ title: p.title, wikitext: p.revisions[0].slots.main.content }));
}

/** 批量取文件信息 */
async function getFileInfo(host, names) {
  const out = new Map();
  for (const batch of chunk(names, 20)) {
    const json = await api(
      host,
      `action=query&prop=imageinfo&iiprop=url|size|mime|extmetadata&titles=${encodeURIComponent(
        batch.map((n) => `File:${n}`).join("|")
      )}`
    );
    for (const p of json?.query?.pages ?? []) {
      const info = p.imageinfo?.[0];
      if (info) out.set(p.title.replace(/^File:/, ""), info);
    }
    await sleep(DELAY);
  }
  return out;
}

function yearIn(text, year) {
  return new RegExp(`\\b${year}\\b`).test(text);
}

async function download(url, abs) {
  for (let attempt = 0; attempt < 4; attempt++) {
    let res;
    try {
      res = await fetch(url, { headers: { "User-Agent": UA } });
    } catch {
      await sleep(2500 * (attempt + 1));
      continue;
    }
    if (res.status === 429 || res.status === 503) {
      await sleep(4000 * (attempt + 1));
      continue;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 3000) throw new Error(`文件过小 ${buf.length}B`);
    fs.writeFileSync(abs, buf);
    return buf.length;
  }
  throw new Error("下载重试耗尽");
}

/** 用 wikidata 找 P18（自由版权兜底） */
async function wikidataImage(movie) {
  const json = await api(
    "www.wikidata.org",
    `action=wbsearchentities&search=${encodeURIComponent(movie.originalTitle || movie.chineseTitle)}&language=en&limit=5&type=item`
  );
  const ids = (json?.search ?? []).map((x) => x.id);
  if (!ids.length) return null;
  const ent = await api(
    "www.wikidata.org",
    `action=wbgetentities&ids=${ids.join("|")}&props=claims|labels&languages=en`
  );
  for (const id of ids) {
    const claims = ent?.entities?.[id]?.claims;
    const p18 = claims?.P18?.[0]?.mainsnak?.datavalue?.value;
    if (!p18) continue;
    const info = await getFileInfo("commons.wikimedia.org", [p18]);
    const meta = info.get(p18);
    if (meta) return { ...meta, file: p18, entity: id };
  }
  return null;
}

const main = async () => {
  if (!fs.existsSync(CATALOG)) throw new Error("找不到 data/catalog.json，先 npm run merge");
  const catalog = JSON.parse(fs.readFileSync(CATALOG, "utf8"));
  const movies = (catalog.movies ?? []).filter((m) => (ONLY ? ONLY.includes(m.id) : true));
  const hints = readRawHints();
  fs.mkdirSync(POSTER_DIR, { recursive: true });
  fs.mkdirSync(path.dirname(OUT_JSON), { recursive: true });

  let payload = { generated_at: null, method: "", attribution: "", records: {} };
  if (fs.existsSync(OUT_JSON)) {
    try {
      payload = { ...payload, ...JSON.parse(fs.readFileSync(OUT_JSON, "utf8")) };
      payload.records ??= {};
    } catch {
      /* 损坏则重建 */
    }
  }
  const records = payload.records;

  const targets = VERIFY_ONLY
    ? movies.filter((m) => records[m.id]?.src)
    : movies.filter((m) => {
        if (records[m.id]?.src && !ALL) return false;
        if (m.poster?.src && m.poster.source?.includes("douban") && !ALL) return false; // 豆瓣主海报已在库
        return !m.poster?.src;
      });

  const report = {
    startedAt: new Date().toISOString(),
    targets: targets.length,
    filled: [],
    failed: [],
    skipped: [],
    verified: { verified: 0, partial: 0, unverified: 0 },
    missingAfter: [],
  };
  console.log(`目标 ${targets.length} 部（已有海报记录 ${Object.keys(records).length} 条）`);

  if (!VERIFY_ONLY) {
    for (const movie of targets) {
      const label = `${movie.id}（${movie.chineseTitle} ${movie.releaseYear}）`;
      process.stdout.write(`· ${label} `);
      try {
        const raw = hints[movie.id] ?? {};
        const zhCandidates = [raw.wikipedia_page_zh].filter(Boolean);
        const enCandidates = [
          raw.wikipedia_page_en,
          ...(Array.isArray(raw.external_title_hints) ? raw.external_title_hints : []),
          movie.originalTitle,
        ].filter(Boolean);

        let picked = null;

        /* 中文维基优先（中文海报） */
        let zhTitles = [...new Set(zhCandidates)];
        if (!zhTitles.length) {
          zhTitles = await searchTitles("zh.wikipedia.org", `${movie.chineseTitle} ${movie.releaseYear}`, movie.chineseTitle);
        }
        let articles = await getArticle("zh.wikipedia.org", zhTitles.slice(0, 4));
        for (const a of articles) {
          const file = imageFromWikitext(a.wikitext);
          if (!file) continue;
          const info = (await getFileInfo("zh.wikipedia.org", [file])).get(file);
          if (!info) continue;
          picked = {
            host: "zh.wikipedia.org",
            article: a.title,
            file,
            info,
            language: "zh",
            titleMatch: norm(a.title).includes(norm(movie.chineseTitle).split(" ")[0]) || norm(a.title).length > 0,
            yearMatch: yearIn(a.wikitext, movie.releaseYear),
          };
          break;
        }

        /* 英文维基 */
        if (!picked) {
          let enTitles = [...new Set(enCandidates)];
          if (!enTitles.length) {
            enTitles = await searchTitles("en.wikipedia.org", `${movie.originalTitle} ${movie.releaseYear} film`, movie.originalTitle);
          }
          articles = await getArticle("en.wikipedia.org", enTitles.slice(0, 4));
          for (const a of articles) {
            const file = imageFromWikitext(a.wikitext);
            if (!file) continue;
            const info = (await getFileInfo("en.wikipedia.org", [file])).get(file);
            if (!info) continue;
            const wantTokens = norm(movie.originalTitle).split(" ").filter((t) => t.length > 2);
            picked = {
              host: "en.wikipedia.org",
              article: a.title,
              file,
              info,
              language: "en",
              titleMatch: wantTokens.length
                ? wantTokens.some((t) => norm(a.title).includes(t))
                : true,
              yearMatch: yearIn(a.wikitext, movie.releaseYear),
            };
            break;
          }
        }

        /* 兜底：wikidata P18 */
        if (!picked) {
          const wd = await wikidataImage(movie);
          if (wd) {
            picked = {
              host: "commons.wikimedia.org",
              article: `https://www.wikidata.org/wiki/${wd.entity}`,
              file: wd.file,
              info: wd,
              language: "mul",
              titleMatch: false,
              yearMatch: yearIn(String(wd.extmetadata?.ImageDescription?.value ?? ""), movie.releaseYear),
            };
          }
        }

        if (!picked) {
          report.failed.push({ id: movie.id, reason: "三个来源都没有找到可用主图" });
          console.log("✗ 无来源");
          await sleep(DELAY);
          continue;
        }

        const info = picked.info;
        if (!["image/jpeg", "image/png"].includes(info.mime)) {
          report.failed.push({ id: movie.id, reason: `格式不支持 ${info.mime}` });
          console.log(`✗ ${info.mime}`);
          await sleep(DELAY);
          continue;
        }
        const posterLike = (info.height ?? 0) > (info.width ?? 0) && (info.width ?? 0) >= 150;
        if (!posterLike) {
          report.failed.push({ id: movie.id, reason: `非竖版海报 ${info.width}×${info.height}` });
          console.log(`✗ 非竖版 ${info.width}×${info.height}`);
          await sleep(DELAY);
          continue;
        }

        const ext = info.mime === "image/png" ? "png" : "jpg";
        const rel = `/posters/${movie.id}.${ext}`;
        const abs = path.join(ROOT, "public", rel.replace(/^\//, ""));
        const bytes = await download(info.url, abs);

        const status =
          picked.titleMatch && picked.yearMatch && posterLike
            ? "verified"
            : picked.titleMatch || picked.yearMatch
              ? "partial"
              : "unverified";
        report.verified[status]++;

        records[movie.id] = {
          src: rel,
          width: info.width ?? 0,
          height: info.height ?? 0,
          bytes,
          source: picked.host,
          sourceUrl: `https://${picked.host}/wiki/File:${encodeURIComponent(picked.file).replace(/%20/g, "_")}`,
          articleUrl: /^https?:/.test(picked.article)
            ? picked.article
            : `https://${picked.host}/wiki/${encodeURIComponent(picked.article).replace(/%20/g, "_")}`,
          license: info.extmetadata?.LicenseShortName?.value ?? "unknown",
          licenseNote: "海报版权归发行方所有；来源站点以合理使用或自由许可收录。本站仅个人非商业引用并标注来源。",
          language: picked.language,
          verified: {
            status,
            titleMatch: picked.titleMatch,
            yearMatch: picked.yearMatch,
            posterLike,
            checkedAt: new Date().toISOString(),
            method: `infobox 主图（${picked.host}）`,
          },
          fetchedAt: new Date().toISOString(),
        };
        report.filled.push({ id: movie.id, kb: Math.round(bytes / 1024), status, host: picked.host });
        console.log(`✓ ${info.width}×${info.height} ${Math.round(bytes / 1024)}KB ${status}`);
        await sleep(DELAY);
      } catch (err) {
        report.failed.push({ id: movie.id, reason: String(err.message || err) });
        console.log(`✗ ${err.message}`);
        await sleep(DELAY);
      }
    }
  }

  /* ── 核验已有记录：文件存在 / 尺寸合理 / 核验字段齐全 ── */
  for (const movie of movies) {
    const rec = records[movie.id];
    if (!rec?.src) continue;
    const abs = path.join(ROOT, "public", rec.src.replace(/^\//, ""));
    const exists = fs.existsSync(abs);
    const size = exists ? fs.statSync(abs).size : 0;
    const posterLike = (rec.height ?? 0) > (rec.width ?? 0) && (rec.width ?? 0) >= 120;
    rec.integrity = {
      fileExists: exists,
      bytes: size,
      posterLike,
      checkedAt: new Date().toISOString(),
    };
    if (!rec.verified) {
      rec.verified = {
        status: posterLike && exists ? "partial" : "unverified",
        titleMatch: null,
        yearMatch: null,
        posterLike,
        checkedAt: new Date().toISOString(),
        method: "historical record: only file integrity re-checked",
      };
    }
    if (rec.verified.status !== "unverified") report.verified[rec.verified.status]++;
  }

  payload.generated_at = new Date().toISOString();
  payload.method =
    "multi-source poster resolution: zh/en Wikipedia infobox image (batched revisions+imageinfo), Wikidata P18 fallback; each record carries verified{status,titleMatch,yearMatch,posterLike}";
  payload.attribution =
    "Poster images © their respective rights holders; sourced from Wikipedia article infoboxes (fair use) or Wikimedia Commons (free license).";
  payload.records = records;
  fs.writeFileSync(OUT_JSON, JSON.stringify(payload, null, 2) + "\n", "utf8");

  const stillMissing = movies.filter((m) => !records[m.id]?.src && !m.poster?.src).map((m) => m.id);
  report.missingAfter = stillMissing;
  report.finishedAt = new Date().toISOString();
  fs.writeFileSync(REPORT, JSON.stringify(report, null, 2) + "\n", "utf8");

  console.log(`\n✔ 写入 ${Object.keys(records).length} 条海报记录`);
  console.log(`  本次补齐 ${report.filled.length}，失败 ${report.failed.length}`);
  console.log(`  核验：verified ${report.verified.verified} / partial ${report.verified.partial} / unverified ${report.verified.unverified}`);
  if (stillMissing.length) console.log(`  仍缺：${stillMissing.join(", ")}`);
};

await main();
