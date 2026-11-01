/**
 * 抓取真实海报（来自维基百科条目主图 = 发行方海报，维基以「合理使用」收录）
 *
 * 用法：
 *   node scripts/fetch-posters.mjs                 # 全量（已有文件跳过）
 *   node scripts/fetch-posters.mjs --limit=10      # 先试 10 部
 *   node scripts/fetch-posters.mjs --force         # 重新抓已有文件
 *   node scripts/fetch-posters.mjs --only=a,b      # 只处理指定 id
 *
 * 产物：
 *   public/posters/<id>.<jpg|png>   本地图片
 *   data/derived/posters.json       元数据（来源、许可、条目链接、抓取时间）
 *
 * 设计要点：
 * - 先用 action=query 批量取 wikitext（20 个条目一次），从 infobox 的 |image= 取文件名，
 *   再用 batch 的 imageinfo 拿真实 URL 与许可，最后逐个下载 —— 比逐页 parse 少一个数量级的请求。
 * - 遇到 429 指数退避；不伪造任何图片，抓不到就留空（页面自动回退到程序化封面）。
 * - 只接受 image/jpeg、image/png，且宽度 ≥ 120px；SVG（多见于剧集 logo）跳过。
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const CATALOG = path.join(ROOT, "data", "catalog.json");
const RAW_DIR = path.join(ROOT, "data", "raw");
const OUT_JSON = path.join(ROOT, "data", "derived", "posters.json");
const POSTER_DIR = path.join(ROOT, "public", "posters");

const UA = "FantasyAtlas/1.0 (node; personal non-commercial film guide)";
const args = process.argv.slice(2);
const LIMIT = Number(args.find((a) => a.startsWith("--limit="))?.split("=")[1] ?? 0);
const FORCE = args.includes("--force");
const ONLY = args.find((a) => a.startsWith("--only="))?.split("=")[1]?.split(",").filter(Boolean) ?? null;
const DELAY = Number(args.find((a) => a.startsWith("--delay="))?.split("=")[1] ?? 1200);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(host, params, tries = 8) {
  const url = `https://${host}/w/api.php?format=json&formatversion=2&${params}`;
  for (let i = 0; i < tries; i++) {
    let res;
    try {
      res = await fetch(url, { headers: { "User-Agent": UA, "Accept-Encoding": "identity" } });
    } catch (err) {
      if (i === tries - 1) throw err;
      await sleep(3000 * (i + 1));
      continue;
    }
    if (res.status === 429 || res.status === 503) {
      const wait = Math.min(60000, 5000 * Math.pow(2, i));
      process.stdout.write(`    ${res.status} 退避 ${wait}ms\n`);
      await sleep(wait);
      continue;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status} ${url.slice(0, 120)}`);
    return res.json();
  }
  throw new Error("重试耗尽（限流）：稍后再跑，已下载的海报不会重复下载");
}

function chunk(arr, n) {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

/** 从 wikitext 里取 infobox 的 image 参数 */
function imageFromWikitext(wt) {
  if (!wt) return null;
  const m =
    wt.match(/\|\s*image\s*=\s*\[\[(?:File|Image):([^\]|]+)/i) ||
    wt.match(/\|\s*image\s*=\s*([^\n|]+)/i);
  if (!m) return null;
  let name = m[1].trim();
  name = name.replace(/^\[\[|\]\]$/g, "").replace(/^(?:File|Image):/i, "").trim();
  if (!name || /\{\{|\}\}/.test(name)) return null;
  if (!/\.(jpe?g|png)$/i.test(name)) return null; // 跳过 svg/gif/webp
  return name;
}

/** 收集条目候选标题 */
function buildTargets(movies, rawHints) {
  const targets = [];
  for (const m of movies) {
    if (ONLY && !ONLY.includes(m.id)) continue;
    const hint = rawHints[m.id] ?? {};
    const en = [
      hint.wikipedia_page_en,
      ...(Array.isArray(hint.external_title_hints) ? hint.external_title_hints : []),
      m.originalTitle,
    ].filter((s) => typeof s === "string" && s.trim().length > 1);
    const zh = [hint.wikipedia_page_zh].filter((s) => typeof s === "string" && s.trim().length > 1);
    targets.push({ id: m.id, en: [...new Set(en)].slice(0, 3), zh: [...new Set(zh)].slice(0, 1) });
  }
  return LIMIT ? targets.slice(0, LIMIT) : targets;
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

const main = async () => {
  if (!fs.existsSync(CATALOG)) throw new Error("找不到 data/catalog.json，先跑 npm run merge");
  const catalog = JSON.parse(fs.readFileSync(CATALOG, "utf8"));
  const movies = (catalog.movies ?? []).filter((m) => !m.poster?.src && !m.poster);
  const rawHints = readRawHints();
  const targets = buildTargets(movies, rawHints);
  fs.mkdirSync(POSTER_DIR, { recursive: true });
  fs.mkdirSync(path.dirname(OUT_JSON), { recursive: true });

  // 已存在的结果（可续跑）
  let existing = { generated_at: null, records: {} };
  if (fs.existsSync(OUT_JSON)) {
    try {
      existing = JSON.parse(fs.readFileSync(OUT_JSON, "utf8"));
      existing.records ??= {};
    } catch {
      /* 忽略损坏文件 */
    }
  }

  console.log(`目标 ${targets.length} 部（已有海报记录 ${Object.keys(existing.records).length} 条）`);

  /* ── 1. 批量取 wikitext，定位 infobox 海报文件名 ── */
  const fileByName = new Map(); // 条目标题 → 文件名
  const articleByFile = new Map(); // 文件名 → 条目信息

  const enTargets = targets.filter((t) => t.en.length);
  const batches = chunk(enTargets, 20);
  let bi = 0;
  for (const batch of batches) {
    bi++;
    const titles = batch.map((t) => t.en[0]);
    process.stdout.write(`  [wikitext ${bi}/${batches.length}] ${titles.length} 个条目…`);
    const json = await api(
      "en.wikipedia.org",
      `action=query&prop=revisions&rvslots=main&rvprop=content&redirects=1&titles=${encodeURIComponent(titles.join("|"))}`
    );
    const pages = json?.query?.pages ?? [];
    const redirects = new Map((json?.query?.redirects ?? []).map((r) => [r.from, r.to]));
    const normalized = new Map((json?.query?.normalized ?? []).map((r) => [r.from, r.to]));
    const byTitle = new Map(pages.map((p) => [p.title, p]));
    let hit = 0;
    for (const t of batch) {
      let title = t.en[0];
      title = normalized.get(title) ?? title;
      title = redirects.get(title) ?? title;
      const page = byTitle.get(title);
      if (!page || page.missing) continue;
      const wt = page.revisions?.[0]?.slots?.main?.content ?? "";
      const name = imageFromWikitext(wt);
      if (name) {
        fileByName.set(t.id, name);
        articleByFile.set(name, { id: t.id, articleTitle: page.title, lang: "en" });
        hit++;
      }
    }
    console.log(` 命中 ${hit}`);
    await sleep(DELAY);
  }

  /* ── 2. 批量 imageinfo：拿真实 URL / 尺寸 / 许可 ── */
  const infoByName = new Map();
  const infoBatches = chunk([...fileByName.values()], 20);
  let ii = 0;
  for (const batch of infoBatches) {
    ii++;
    const titles = batch.map((n) => `File:${n}`);
    process.stdout.write(`  [imageinfo ${ii}/${infoBatches.length}] ${titles.length} 个文件…`);
    const json = await api(
      "en.wikipedia.org",
      `action=query&prop=imageinfo&iiprop=url|size|mime|extmetadata&titles=${encodeURIComponent(titles.join("|"))}`
    );
    const pages = json?.query?.pages ?? [];
    let ok = 0;
    for (const p of pages) {
      const info = p.imageinfo?.[0];
      if (!info) continue;
      const name = p.title.replace(/^File:/, "");
      infoByName.set(name, info);
      ok++;
    }
    console.log(` 拿到 ${ok}`);
    await sleep(DELAY);
  }

  /* ── 3. 逐个下载 ── */
  const records = { ...existing.records };
  let downloaded = 0;
  let skipped = 0;
  let failed = 0;
  const order = [...fileByName.entries()];
  let di = 0;
  for (const [id, name] of order) {
    di++;
    const info = infoByName.get(name);
    const article = articleByFile.get(name);
    if (!info || !article) {
      skipped++;
      continue;
    }
    if (!["image/jpeg", "image/png"].includes(info.mime) || (info.width ?? 0) < 120) {
      skipped++;
      continue;
    }
    const ext = info.mime === "image/png" ? "png" : "jpg";
    const rel = `/posters/${id}.${ext}`;
    const abs = path.join(ROOT, "public", rel.replace(/^\//, ""));
    const already = fs.existsSync(abs) && !FORCE && records[id]?.src === rel;
    if (!already) {
      try {
        let res = null;
        for (let attempt = 0; attempt < 5; attempt++) {
          res = await fetch(info.url, { headers: { "User-Agent": UA } });
          if (res.status === 429 || res.status === 503) {
            await sleep(5000 * (attempt + 1));
            continue;
          }
          break;
        }
        if (!res || !res.ok) throw new Error(`HTTP ${res?.status ?? "?"}`);
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.length < 2000) throw new Error(`文件过小 ${buf.length}B`);
        fs.writeFileSync(abs, buf);
        await sleep(DELAY);
        downloaded++;
      } catch (err) {
        failed++;
        console.log(`  ✗ ${id}: ${err.message}`);
        continue;
      }
    }
    records[id] = {
      src: rel,
      width: info.width ?? 0,
      height: info.height ?? 0,
      source: "en.wikipedia.org",
      sourceUrl: `https://en.wikipedia.org/wiki/File:${encodeURIComponent(name).replace(/%20/g, "_")}`,
      articleUrl: `https://en.wikipedia.org/wiki/${encodeURIComponent(article.articleTitle).replace(/%20/g, "_")}`,
      license: info.extmetadata?.LicenseShortName?.value ?? "unknown",
      licenseNote:
        "海报版权归发行方所有；维基百科条目以合理使用方式收录。本站仅在个人非商业场景引用，并标注来源与条目链接。",
      fetchedAt: new Date().toISOString(),
    };
    if (di % 20 === 0 || di === order.length) {
      console.log(`  下载进度 ${di}/${order.length}（新下载 ${downloaded}，跳过 ${skipped}，失败 ${failed}）`);
    }
  }

  const payload = {
    generated_at: new Date().toISOString(),
    method: "en.wikipedia.org infobox image via action=query (revisions + imageinfo)",
    attribution: "Poster images © their respective rights holders; sourced from Wikipedia article infoboxes (fair use).",
    records,
  };
  fs.writeFileSync(OUT_JSON, JSON.stringify(payload, null, 2) + "\n", "utf8");

  console.log(`\n✔ 完成：记录 ${Object.keys(records).length} 条 → data/derived/posters.json`);
  console.log(`  本次新下载 ${downloaded}，跳过 ${skipped}，失败 ${failed}`);
  console.log(`  本地图片目录 public/posters/`);
};

await main();
