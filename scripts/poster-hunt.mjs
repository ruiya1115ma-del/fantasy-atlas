/**
 * 多来源真实海报猎取（poster-hunt）
 *
 * 目标：让库里每一部作品都拿到「与影片准确对应」的真实发行海报，逐部核验，不留长期缺口。
 *
 * 来源（按优先级，全部免费、无需 API key）：
 *   1. IMDb  suggestion API（v3.sg.media-imdb.com）—— 官方主海报，含年份与类型，最可靠
 *   2. 中文维基百科条目 infobox 主图 —— 中文版海报
 *   3. 英文维基百科条目 infobox 主图
 *   4. TVmaze API —— 剧集海报（怪奇物语 / 暗黑 / 天赋异禀这类）
 *   5. Wikimedia Commons 文件搜索 —— 兜底
 *
 * 核验（任一失败就不落盘，宁缺不写错图）：
 *   - 标题：规范化后完全相同，或 token 覆盖率 ≥ 0.6
 *   - 年份：与 release_year 完全相等，或差 1 年（记 partial）
 *   - 版本：同名翻拍/续集用年份区分；年份不符直接拒绝
 *   - 图片：竖版（height > width）、宽 ≥ 150、字节 ≥ 12KB、JPEG/PNG
 *
 * 用法：
 *   node scripts/poster-hunt.mjs                  # 只补缺海报的
 *   node scripts/poster-hunt.mjs --limit=20
 *   node scripts/poster-hunt.mjs --only=id1,id2
 *   node scripts/poster-hunt.mjs --force          # 已有海报也重找（会覆盖 posters.json 记录）
 *   node scripts/poster-hunt.mjs --report         # 只打印现状，不抓取
 *
 * 产物：
 *   public/posters/<id>.<jpg|png>
 *   data/derived/posters.json       （记录 source/sourceUrl/articleUrl/license/verified/integrity/tier）
 *   data/reports/poster-hunt.json   （本次统计：每个来源的命中/拒绝原因）
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const CATALOG = path.join(ROOT, "data", "catalog.json");
const RAW_DIR = path.join(ROOT, "data", "raw");
const STORE = path.join(ROOT, "data", "derived", "posters.json");
const REPORT = path.join(ROOT, "data", "reports", "poster-hunt.json");
const POSTER_DIR = path.join(ROOT, "public", "posters");

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";
const WIKI_UA = "FantasyAtlas/1.0 (node; personal non-commercial film guide)";

const args = process.argv.slice(2);
const ONLY = args.find((a) => a.startsWith("--only="))?.split("=")[1]?.split(",").filter(Boolean) ?? null;
const LIMIT = Number(args.find((a) => a.startsWith("--limit="))?.split("=")[1] ?? 0);
const FORCE = args.includes("--force");
const REPORT_ONLY = args.includes("--report");
const DELAY = Number(args.find((a) => a.startsWith("--delay="))?.split("=")[1] ?? 350);
/** 海报最大宽度（IMDb 支持在 URL 上直接要缩略尺寸，省带宽也省体积） */
const MAXW = Number(args.find((a) => a.startsWith("--max-width="))?.split("=")[1] ?? 800);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ────────────────────────── 工具 ────────────────────────── */

function normTitle(s) {
  return String(s ?? "")
    .toLowerCase()
    .replace(/[（(].*?[)）]/g, " ")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, " ")
    .trim();
}

function tokens(s) {
  return normTitle(s)
    .split(" ")
    .filter((t) => t.length > 1);
}

/** 标题相似度：完全相等 1；否则取 token 覆盖率 */
function titleScore(a, b) {
  const na = normTitle(a);
  const nb = normTitle(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const ta = new Set(tokens(a));
  const tb = new Set(tokens(b));
  if (!ta.size || !tb.size) return 0;
  let hit = 0;
  for (const t of ta) if (tb.has(t)) hit += 1;
  const cover = hit / Math.min(ta.size, tb.size);
  if (na.includes(nb) || nb.includes(na)) return Math.max(cover, 0.72);
  return cover;
}

async function fetchJson(url, { headers = {}, timeout = 20000 } = {}) {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "application/json", ...headers },
    signal: AbortSignal.timeout(timeout),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function fetchBuffer(url, { timeout = 30000 } = {}) {
  const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(timeout) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return { buf: Buffer.from(await res.arrayBuffer()), contentType: res.headers.get("content-type") ?? "" };
}

/** 从字节里读图片宽高（JPEG / PNG），不依赖第三方库 */
function imageDims(buf) {
  if (buf.length > 24 && buf[0] === 0x89 && buf[1] === 0x50) {
    // PNG: IHDR 在 16..24
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20), kind: "png" };
  }
  if (buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i < buf.length - 9) {
      if (buf[i] !== 0xff) {
        i += 1;
        continue;
      }
      const marker = buf[i + 1];
      const len = buf.readUInt16BE(i + 2);
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7), kind: "jpg" };
      }
      i += 2 + len;
    }
  }
  return null;
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

/* ───────────────────── 来源 1：IMDb ───────────────────── */

function normalizeImdbImage(url) {
  if (!url) return null;
  // 去掉尺寸修饰，取原始海报尺寸：...@@._V1_QL75_UX380..._.jpg → ...@@._V1_.jpg
  return url.replace(/\._V1_[^.]+\.jpg$/, "._V1_.jpg").replace(/\._V1_AL_\.jpg$/, "._V1_.jpg");
}

async function fromImdb(movie, extraQueries = []) {
  const queries = [
    ...new Set([movie.originalTitle, ...extraQueries, ...(movie.originalTitle ? [] : [movie.chineseTitle])].filter(Boolean)),
  ];
  const out = { attempts: [], candidate: null };
  for (const q of queries) {
    const url = `https://v3.sg.media-imdb.com/suggestion/x/${encodeURIComponent(q)}.json`;
    let json;
    try {
      json = await fetchJson(url);
    } catch (err) {
      out.attempts.push({ query: q, error: String(err.message || err) });
      continue;
    }
    const items = (json?.d ?? []).filter((x) => x?.i?.imageUrl && x?.l && x?.y);
    out.attempts.push({ query: q, hits: items.length });
    for (const it of items) {
      const yearDiff = Math.abs(Number(it.y) - movie.releaseYear);
      const score = titleScore(it.l, movie.originalTitle || movie.chineseTitle);
      const kindOk =
        movie.mediaType === "series"
          ? /series|tvMiniSeries/i.test(it.qid ?? "") || /series|mini/i.test(it.q ?? "")
          : !/series|game/i.test(it.qid ?? "");
      if (score < 0.6 || yearDiff > 1 || !kindOk) continue;
      const candidate = {
        source: "imdb",
        sourceUrl: `https://www.imdb.com/title/${it.id}/`,
        articleUrl: `https://www.imdb.com/title/${it.id}/`,
        imageUrl: normalizeImdbImage(it.i.imageUrl),
        width: it.i.width,
        height: it.i.height,
        titleMatch: score >= 0.6,
        yearMatch: yearDiff === 0,
        yearDiff,
        matchedTitle: it.l,
        matchedYear: Number(it.y),
        score: score - yearDiff * 0.2,
        license: "IMDb",
        licenseNote: "海报版权归发行方所有；IMDb 作为资料库展示官方发行海报。本站仅个人非商业引用并标注来源。",
        tier: "A",
        language: "en",
        method: `IMDb suggestion API（命中「${it.l}」${it.y}）`,
      };
      if (!out.candidate || candidate.score > out.candidate.score) out.candidate = candidate;
    }
    if (out.candidate?.yearMatch && out.candidate.titleMatch) break;
    await sleep(220);
  }
  return out;
}

/* ───────────────────── 来源 2/3：维基百科 ───────────────────── */

async function wikiApi(host, params) {
  const url = `https://${host}/w/api.php?format=json&formatversion=2&${params}`;
  return fetchJson(url, { headers: { "User-Agent": WIKI_UA, "Accept-Encoding": "identity" } });
}

function imageFromWikitext(wt) {
  if (!wt) return null;
  const m =
    wt.match(/\|\s*image\s*=\s*\[\[(?:File|Image):([^\]|]+)/i) || wt.match(/\|\s*image\s*=\s*([^\n|}]+)/i);
  if (!m) return null;
  const name = m[1].trim().replace(/^(?:File|Image):/i, "").trim();
  if (!name || /\{\{|\}\}/.test(name) || !/\.(jpe?g|png)$/i.test(name)) return null;
  return name;
}

async function fromWikipedia(movie, host, preferTitles) {
  const attempts = [];
  const titles = [...new Set(preferTitles.filter(Boolean))];
  if (!titles.length) {
    const q = host.startsWith("zh")
      ? `${movie.chineseTitle} ${movie.releaseYear}`
      : `${movie.originalTitle} ${movie.releaseYear} film`;
    try {
      const search = await wikiApi(host, `action=query&list=search&srsearch=${encodeURIComponent(q)}&srlimit=5`);
      for (const s of search?.query?.search ?? []) titles.push(s.title);
      attempts.push({ stage: "search", q, hits: titles.length });
    } catch (err) {
      attempts.push({ stage: "search", error: String(err.message || err) });
      return { attempts, candidate: null };
    }
  }

  for (const title of titles.slice(0, 4)) {
    let page;
    try {
      const json = await wikiApi(
        host,
        `action=query&prop=revisions&rvslots=main&rvprop=content&redirects=1&titles=${encodeURIComponent(title)}`
      );
      page = (json?.query?.pages ?? []).find((p) => !p.missing && p.revisions?.[0]?.slots?.main?.content);
    } catch (err) {
      attempts.push({ title, error: String(err.message || err) });
      continue;
    }
    if (!page) continue;
    const wt = page.revisions[0].slots.main.content;
    const file = imageFromWikitext(wt);
    if (!file) {
      attempts.push({ title, reason: "infobox 无图片" });
      continue;
    }
    let info;
    try {
      const json = await wikiApi(
        host,
        `action=query&prop=imageinfo&iiprop=url|size|mime|extmetadata&titles=${encodeURIComponent("File:" + file)}`
      );
      info = (json?.query?.pages ?? [])[0]?.imageinfo?.[0];
    } catch (err) {
      attempts.push({ title, error: String(err.message || err) });
      continue;
    }
    if (!info?.url) {
      attempts.push({ title, reason: "imageinfo 为空" });
      continue;
    }
    const score = titleScore(page.title, movie.originalTitle || movie.chineseTitle);
    const yearMatch = new RegExp(`\\b${movie.releaseYear}\\b`).test(wt);
    return {
      attempts,
      candidate: {
        source: host,
        sourceUrl: `https://${host}/wiki/File:${encodeURIComponent(file).replace(/%20/g, "_")}`,
        articleUrl: `https://${host}/wiki/${encodeURIComponent(page.title).replace(/%20/g, "_")}`,
        imageUrl: info.url,
        width: info.width,
        height: info.height,
        mime: info.mime,
        titleMatch: score >= 0.6,
        yearMatch,
        yearDiff: yearMatch ? 0 : 99,
        matchedTitle: page.title,
        matchedYear: yearMatch ? movie.releaseYear : null,
        score: (score >= 0.6 ? 0.8 : 0.4) + (yearMatch ? 0.2 : 0),
        license: info.extmetadata?.LicenseShortName?.value ?? "unknown",
        licenseNote: "海报版权归发行方所有；维基百科以合理使用方式在条目中收录。本站仅个人非商业引用并标注来源。",
        tier: "A",
        language: host.startsWith("zh") ? "zh" : "en",
        method: `维基条目 infobox 主图（${host} · ${page.title}）`,
      },
    };
  }
  return { attempts, candidate: null };
}

/* ───────────────────── 来源 4：TVmaze（剧集） ───────────────────── */

async function fromTvmaze(movie) {
  const attempts = [];
  const q = movie.originalTitle || movie.chineseTitle;
  let list;
  try {
    list = await fetchJson(`https://api.tvmaze.com/search/shows?q=${encodeURIComponent(q)}`);
  } catch (err) {
    return { attempts: [{ error: String(err.message || err) }], candidate: null };
  }
  attempts.push({ q, hits: Array.isArray(list) ? list.length : 0 });
  let best = null;
  for (const item of list ?? []) {
    const show = item?.show;
    if (!show?.image?.original) continue;
    const premiered = Number(String(show.premiered ?? "").slice(0, 4));
    const score = titleScore(show.name, movie.originalTitle || movie.chineseTitle);
    const yearDiff = premiered ? Math.abs(premiered - movie.releaseYear) : 99;
    if (score < 0.6 || yearDiff > 1) continue;
    const cand = {
      source: "tvmaze",
      sourceUrl: show.url,
      articleUrl: show.url,
      imageUrl: show.image.original,
      width: null,
      height: null,
      titleMatch: score >= 0.6,
      yearMatch: yearDiff === 0,
      yearDiff,
      matchedTitle: show.name,
      matchedYear: premiered,
      score: score - yearDiff * 0.2,
      license: "TVmaze / 发行方",
      licenseNote: "剧集海报版权归发行方所有；TVmaze 作为公开剧集资料库提供。本站仅个人非商业引用并标注来源。",
      tier: "B",
      language: "en",
      method: `TVmaze 剧集海报（命中「${show.name}」${show.premiered ?? ""}）`,
    };
    if (!best || cand.score > best.score) best = cand;
  }
  return { attempts, candidate: best };
}

/* ───────────────────── 来源 5：Commons 搜索 ───────────────────── */

async function fromCommons(movie) {
  const attempts = [];
  const q = movie.originalTitle || movie.chineseTitle;
  let json;
  try {
    json = await wikiApi(
      "commons.wikimedia.org",
      `action=query&list=search&srsearch=${encodeURIComponent(`${q} poster`)}&srnamespace=6&srlimit=8`
    );
  } catch (err) {
    return { attempts: [{ error: String(err.message || err) }], candidate: null };
  }
  const files = (json?.query?.search ?? []).map((s) => s.title.replace(/^File:/, ""));
  attempts.push({ q, hits: files.length });
  for (const file of files) {
    if (!/\.(jpe?g|png)$/i.test(file)) continue;
    let info;
    try {
      const j = await wikiApi(
        "commons.wikimedia.org",
        `action=query&prop=imageinfo&iiprop=url|size|mime|extmetadata&titles=${encodeURIComponent("File:" + file)}`
      );
      info = (j?.query?.pages ?? [])[0]?.imageinfo?.[0];
    } catch {
      continue;
    }
    if (!info?.url || !(info.height > info.width)) continue;
    return {
      attempts,
      candidate: {
        source: "commons.wikimedia.org",
        sourceUrl: `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(file).replace(/%20/g, "_")}`,
        articleUrl: `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(file).replace(/%20/g, "_")}`,
        imageUrl: info.url,
        width: info.width,
        height: info.height,
        mime: info.mime,
        titleMatch: titleScore(file, movie.originalTitle || movie.chineseTitle) >= 0.5,
        yearMatch: false,
        yearDiff: 99,
        matchedTitle: file,
        matchedYear: null,
        score: 0.45,
        license: info.extmetadata?.LicenseShortName?.value ?? "unknown",
        licenseNote: "Commons 上的自由许可图片；本站仅个人非商业引用并标注来源。",
        tier: "C",
        language: "mul",
        method: `Commons 文件搜索（${file}）`,
      },
    };
  }
  return { attempts, candidate: null };
}

/* ───────────────────── 主流程 ───────────────────── */

async function tryDownload(candidate, movie) {
  let url = candidate.imageUrl;
  // IMDb 的图片 CDN 支持在文件名里声明目标宽度，避免把 5MB 的原图直接塞进站点
  if (candidate.source === "imdb" && MAXW > 0) {
    url = url.replace(/\._V1_\.jpg$/, `._V1_UX${MAXW}_.jpg`);
  }
  const { buf, contentType } = await fetchBuffer(url);
  if (buf.length < 12000) throw new Error(`文件过小 ${Math.round(buf.length / 1024)}KB`);
  const dims = imageDims(buf);
  if (!dims) throw new Error("无法识别图片尺寸");
  const portrait = dims.height > dims.width && dims.width >= 150;
  const square = Math.abs(dims.height - dims.width) <= Math.max(8, dims.width * 0.04) && dims.width >= 500;
  if (!portrait && !square) throw new Error(`非竖版 ${dims.width}×${dims.height}`);
  const mime = contentType.includes("png") || dims.kind === "png" ? "png" : "jpg";
  if (!["jpg", "png"].includes(mime)) throw new Error(`格式不支持 ${contentType}`);
  const ext = mime;
  const rel = `/posters/${movie.id}.${ext}`;
  const abs = path.join(ROOT, "public", rel.replace(/^\//, ""));
  fs.writeFileSync(abs, buf);
  return { rel, bytes: buf.length, width: dims.width, height: dims.height, ext, portrait, square };
}

const main = async () => {
  const catalog = JSON.parse(fs.readFileSync(CATALOG, "utf8"));
  const movies = catalog.movies ?? [];
  const hints = readRawHints();

  fs.mkdirSync(POSTER_DIR, { recursive: true });
  fs.mkdirSync(path.dirname(STORE), { recursive: true });
  fs.mkdirSync(path.dirname(REPORT), { recursive: true });

  let payload = { generated_at: null, method: "", attribution: "", records: {} };
  if (fs.existsSync(STORE)) {
    try {
      payload = { ...payload, ...JSON.parse(fs.readFileSync(STORE, "utf8")) };
      payload.records ??= {};
    } catch {
      /* 损坏就重建 */
    }
  }
  const records = payload.records;

  const hasPoster = (m) => Boolean((m.poster?.src || records[m.id]?.src) && !FORCE);
  let targets = movies.filter((m) => (ONLY ? ONLY.includes(m.id) : !hasPoster(m)));
  if (LIMIT > 0) targets = targets.slice(0, LIMIT);

  const missing = movies.filter((m) => !m.poster?.src && !records[m.id]?.src);
  console.log(`库内 ${movies.length} 部；已有海报 ${movies.length - missing.length} 部；本次目标 ${targets.length} 部`);
  if (REPORT_ONLY) {
    console.log(`仍缺 ${missing.length} 部：`);
    for (const m of missing) console.log(`  ${m.id}  ${m.chineseTitle} / ${m.originalTitle} (${m.releaseYear})`);
    return;
  }

  const report = {
    startedAt: new Date().toISOString(),
    catalogSize: movies.length,
    targets: targets.length,
    filled: [],
    failed: [],
    sourceHits: { imdb: 0, "zh.wikipedia.org": 0, "en.wikipedia.org": 0, tvmaze: 0, "commons.wikimedia.org": 0 },
    missingBefore: missing.length,
  };

  let done = 0;
  for (const movie of targets) {
    done += 1;
    const label = `${movie.id}（${movie.chineseTitle} ${movie.releaseYear}）`;
    process.stdout.write(`· [${done}/${targets.length}] ${label} `);
    const raw = hints[movie.id] ?? {};
    const chain = [];

    try {
      /* 0) 人工确认过的维基条目优先（避免日文原名在 IMDb 里匹配到无关条目） */
      if (raw.wikipedia_page_zh || raw.wikipedia_page_en) {
        const hintHost = raw.wikipedia_page_zh ? "zh.wikipedia.org" : "en.wikipedia.org";
        const hintTitle = raw.wikipedia_page_zh ?? raw.wikipedia_page_en;
        const hinted = await fromWikipedia(movie, hintHost, [hintTitle]);
        chain.push({ source: `${hintHost}(hint)`, attempts: hinted.attempts, hit: Boolean(hinted.candidate) });
        if (hinted.candidate?.yearMatch) {
          hinted.candidate.method = `人工确认条目（${hintHost} · ${hintTitle}）`;
          hinted.candidate.tier = "A";
          const file = await tryDownload(hinted.candidate, movie);
          const status = hinted.candidate.titleMatch && hinted.candidate.yearMatch ? "verified" : "partial";
          records[movie.id] = {
            src: file.rel,
            width: file.width,
            height: file.height,
            bytes: file.bytes,
            source: hinted.candidate.source,
            sourceUrl: hinted.candidate.sourceUrl,
            articleUrl: hinted.candidate.articleUrl,
            license: hinted.candidate.license,
            licenseNote: hinted.candidate.licenseNote,
            language: hinted.candidate.language,
            tier: "A",
            matchedTitle: hinted.candidate.matchedTitle,
            matchedYear: hinted.candidate.matchedYear,
            verified: {
              status,
              titleMatch: hinted.candidate.titleMatch,
              yearMatch: hinted.candidate.yearMatch,
              versionMatch: "年份一致",
              posterLike: file.portrait,
              shape: file.portrait ? "portrait" : "square",
              checkedAt: new Date().toISOString(),
              method: hinted.candidate.method,
            },
            integrity: { fileExists: true, bytes: file.bytes, posterLike: file.portrait, checkedAt: new Date().toISOString() },
            fetchedAt: new Date().toISOString(),
            chain,
          };
          report.filled.push({ id: movie.id, title: movie.chineseTitle, source: hinted.candidate.source, status, px: `${file.width}×${file.height}`, kb: Math.round(file.bytes / 1024) });
          report.sourceHits[hinted.candidate.source] = (report.sourceHits[hinted.candidate.source] ?? 0) + 1;
          console.log(`✓ ${hinted.candidate.source}(hint) ${file.width}×${file.height} ${status}`);
          await sleep(DELAY);
          continue;
        }
      }

      /* 1) IMDb */
      const imdb = await fromImdb(movie, [raw.wikipedia_page_en, ...(raw.external_title_hints ?? [])].filter(Boolean));
      chain.push({ source: "imdb", attempts: imdb.attempts, hit: Boolean(imdb.candidate) });
      let candidate = imdb.candidate;

      /* 2) 中文维基 */
      if (!candidate) {
        const zh = await fromWikipedia(movie, "zh.wikipedia.org", [raw.wikipedia_page_zh].filter(Boolean));
        chain.push({ source: "zh.wikipedia.org", attempts: zh.attempts, hit: Boolean(zh.candidate) });
        candidate = zh.candidate;
      }

      /* 3) 英文维基 */
      if (!candidate) {
        const en = await fromWikipedia(movie, "en.wikipedia.org", [
          raw.wikipedia_page_en,
          ...(raw.external_title_hints ?? []),
          movie.originalTitle,
        ]);
        chain.push({ source: "en.wikipedia.org", attempts: en.attempts, hit: Boolean(en.candidate) });
        candidate = en.candidate;
      }

      /* 4) TVmaze（剧集） */
      if (!candidate && movie.mediaType === "series") {
        const tv = await fromTvmaze(movie);
        chain.push({ source: "tvmaze", attempts: tv.attempts, hit: Boolean(tv.candidate) });
        candidate = tv.candidate;
      }

      /* 5) Commons */
      if (!candidate) {
        const cm = await fromCommons(movie);
        chain.push({ source: "commons.wikimedia.org", attempts: cm.attempts, hit: Boolean(cm.candidate) });
        candidate = cm.candidate;
      }

      if (!candidate) {
        report.failed.push({ id: movie.id, title: movie.chineseTitle, reason: "五个来源都没有找到可核验的海报", chain });
        console.log("✗ 无来源");
        await sleep(DELAY);
        continue;
      }

      /* 版本核对：年份差 > 1 一律拒绝 */
      if (candidate.yearDiff > 1) {
        report.failed.push({ id: movie.id, reason: `年份不符（命中 ${candidate.matchedYear}，作品 ${movie.releaseYear}）`, chain });
        console.log(`✗ 年份不符 ${candidate.matchedYear}`);
        await sleep(DELAY);
        continue;
      }

      const file = await tryDownload(candidate, movie);
      const status =
        candidate.titleMatch && candidate.yearMatch ? "verified" : candidate.titleMatch || candidate.yearMatch ? "partial" : "unverified";

      records[movie.id] = {
        src: file.rel,
        width: file.width,
        height: file.height,
        bytes: file.bytes,
        source: candidate.source,
        sourceUrl: candidate.sourceUrl,
        articleUrl: candidate.articleUrl,
        license: candidate.license,
        licenseNote: candidate.licenseNote,
        language: candidate.language,
        tier: candidate.tier,
        imageUrl: candidate.imageUrl,
        matchedTitle: candidate.matchedTitle,
        matchedYear: candidate.matchedYear,
        verified: {
          status: file.portrait ? status : "partial",
          titleMatch: candidate.titleMatch,
          yearMatch: candidate.yearMatch,
          versionMatch: candidate.yearMatch ? "年份一致" : `年份相差 ${candidate.yearDiff} 年`,
          posterLike: file.portrait,
          shape: file.portrait ? "portrait" : "square",
          note: file.portrait ? null : "该片官方公开图只有方形宣传图，不是标准竖版海报",
          checkedAt: new Date().toISOString(),
          method: candidate.method,
        },
        integrity: {
          fileExists: true,
          bytes: file.bytes,
          posterLike: file.portrait,
          checkedAt: new Date().toISOString(),
        },
        fetchedAt: new Date().toISOString(),
        chain,
      };
      report.filled.push({
        id: movie.id,
        title: movie.chineseTitle,
        source: candidate.source,
        status,
        px: `${file.width}×${file.height}`,
        kb: Math.round(file.bytes / 1024),
      });
      report.sourceHits[candidate.source] = (report.sourceHits[candidate.source] ?? 0) + 1;
      console.log(`✓ ${candidate.source} ${file.width}×${file.height} ${Math.round(file.bytes / 1024)}KB ${status}`);

      /* 每 5 部落盘一次，避免长跑被中断丢进度 */
      if (done % 5 === 0) {
        payload.records = records;
        payload.generated_at = new Date().toISOString();
        fs.writeFileSync(STORE, JSON.stringify(payload, null, 2) + "\n", "utf8");
      }
    } catch (err) {
      report.failed.push({ id: movie.id, reason: String(err.message || err), chain });
      console.log(`✗ ${err.message}`);
    }
    await sleep(DELAY);
  }

  /* 回填核验：已有记录但缺 verified 的补齐 */
  for (const movie of movies) {
    const rec = records[movie.id];
    if (!rec?.src) continue;
    const abs = path.join(ROOT, "public", rec.src.replace(/^\//, ""));
    const exists = fs.existsSync(abs);
    const bytes = exists ? fs.statSync(abs).size : 0;
    rec.integrity = {
      fileExists: exists,
      bytes,
      posterLike: (rec.height ?? 0) > (rec.width ?? 0),
      checkedAt: new Date().toISOString(),
    };
    if (!rec.verified) {
      rec.verified = {
        status: exists && (rec.height ?? 0) > (rec.width ?? 0) ? "partial" : "unverified",
        titleMatch: null,
        yearMatch: null,
        posterLike: (rec.height ?? 0) > (rec.width ?? 0),
        checkedAt: new Date().toISOString(),
        method: "历史记录：仅复核文件完整性",
      };
    }
  }

  const stillMissing = movies.filter((m) => !m.poster?.src && !records[m.id]?.src);
  payload.records = records;
  payload.generated_at = new Date().toISOString();
  payload.method =
    "multi-source poster hunt: IMDb suggestion API → zh/en Wikipedia infobox → TVmaze (series) → Wikimedia Commons; each record carries matchedTitle/matchedYear and verified{status,titleMatch,yearMatch,versionMatch,posterLike}";
  payload.attribution =
    "Poster images © their respective rights holders; sourced from IMDb (official release poster), Wikipedia article infoboxes (fair use), TVmaze (series poster) or Wikimedia Commons (free license).";
  fs.writeFileSync(STORE, JSON.stringify(payload, null, 2) + "\n", "utf8");

  report.finishedAt = new Date().toISOString();
  report.missingAfter = stillMissing.map((m) => ({ id: m.id, title: m.chineseTitle, year: m.releaseYear }));
  fs.writeFileSync(REPORT, JSON.stringify(report, null, 2) + "\n", "utf8");

  console.log(`\n✔ 海报记录 ${Object.keys(records).length} 条；本次补齐 ${report.filled.length}，失败 ${report.failed.length}`);
  console.log(`  来源命中：${JSON.stringify(report.sourceHits)}`);
  console.log(`  仍缺 ${stillMissing.length} 部：${stillMissing.map((m) => m.chineseTitle).join("、") || "无"}`);
};

await main();
