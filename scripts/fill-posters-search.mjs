/**
 * 最后一道补图：给「维基没有条目 / 豆瓣限流」的作品，用维基搜索接口定位条目再抓 infobox 主图。
 *
 * 用法：node scripts/fill-posters-search.mjs [--limit=20] [--dry]
 * 产物：追加进 data/derived/posters.json（与 fetch-posters.mjs 同一格式）
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const DRY = process.argv.includes("--dry");
const LIMIT = Number((process.argv.find((a) => a.startsWith("--limit=")) || "").split("=")[1] || 40);
const UA = "FantasyAtlas/1.0 (node; personal non-commercial film atlas)";

const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "catalog.json"), "utf8"));
const postersPath = path.join(ROOT, "data", "derived", "posters.json");
const posters = fs.existsSync(postersPath) ? JSON.parse(fs.readFileSync(postersPath, "utf8")) : { records: {} };
posters.records ??= {};

const missing = (catalog.movies ?? []).filter((m) => !m.poster?.src && !posters.records[m.id]).slice(0, LIMIT);
console.log(`需要补图 ${missing.length} 部`);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const API = "https://en.wikipedia.org/w/api.php";
const ZH_API = "https://zh.wikipedia.org/w/api.php";

async function api(base, params) {
  const url = `${base}?${new URLSearchParams({ format: "json", origin: "*", ...params })}`;
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${base}`);
  return res.json();
}

async function searchArticle(base, term) {
  try {
    const json = await api(base, { action: "query", list: "search", srsearch: term, srlimit: "5" });
    const hits = json?.query?.search ?? [];
    return hits.map((h) => h.title);
  } catch {
    return [];
  }
}

async function infoboxImage(base, title) {
  try {
    const json = await api(base, {
      action: "parse",
      page: title,
      prop: "text",
      section: "0",
      redirects: "1",
      disableeditsection: "1",
    });
    const html = json?.parse?.text?.["*"] ?? "";
    const m = /<img[^>]+src="([^"]+)"/.exec(html);
    if (!m) return null;
    const raw = m[1].startsWith("//") ? `https:${m[1]}` : m[1];
    // 取 URL 最后一段作为文件名，去掉 250px- 之类的缩略前缀
    let file = decodeURIComponent((raw.split("?")[0].split("/").pop() ?? "").replace(/^\d+px-/, ""));
    if (!file) return null;
    const info = await api(base, {
      action: "query",
      titles: `File:${file}`,
      prop: "imageinfo",
      iiprop: "url|size|extmetadata",
    });
    const pages = info?.query?.pages ?? {};
    const first = Object.values(pages)[0];
    const ii = first?.imageinfo?.[0];
    if (!ii?.url) return null;
    const license = ii.extmetadata?.LicenseShortName?.value ?? "unknown";
    return { url: ii.url, width: ii.width, height: ii.height, license, file, article: title };
  } catch {
    return null;
  }
}

async function download(url, dest) {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`image HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(dest, buf);
  return buf.length;
}

const OUT = path.join(ROOT, "public", "posters");
fs.mkdirSync(OUT, { recursive: true });

const norm = (s) =>
  String(s ?? "")
    .toLowerCase()
    .replace(/[\s·:：\-—–_,，。！!？?（）()《》「」"'·・]/g, "");

function titleMatches(article, wanted) {
  if (!article || !wanted) return false;
  if (/^list of|^category:|^file:/i.test(article)) return false;
  const a = norm(article.replace(/\s*\([^)]*\)\s*$/, ""));
  const b = norm(wanted);
  if (!a || !b) return false;
  if (a === b || a.startsWith(b) || b.startsWith(a)) return true;
  const A = new Set([...a]);
  const B = new Set([...b]);
  let inter = 0;
  for (const c of A) if (B.has(c)) inter++;
  return inter / (A.size + B.size - inter) >= 0.72;
}

let ok = 0;
for (const m of missing) {
  const plans = [
    { base: API, term: `${m.originalTitle} film`, want: m.originalTitle },
    { base: API, term: m.originalTitle, want: m.originalTitle },
    { base: ZH_API, term: m.chineseTitle, want: m.chineseTitle },
  ].filter((p) => p.term);

  let found = null;
  for (const plan of plans) {
    const titles = await searchArticle(plan.base, plan.term);
    await sleep(700);
    for (const t of titles.slice(0, 4)) {
      if (!titleMatches(t, plan.want)) continue;
      const img = await infoboxImage(plan.base, t);
      await sleep(700);
      if (img) {
        found = { ...img, wikiBase: plan.base };
        break;
      }
    }
    if (found) break;
  }

  if (!found) {
    console.log(`  x ${m.id} (${m.chineseTitle}): 维基搜索也没有可用主图`);
    continue;
  }

  const dest = path.join(OUT, `${m.id}.jpg`);
  if (DRY) {
    console.log(`  · ${m.id} -> ${found.article} (${found.license}) [dry]`);
    continue;
  }
  try {
    await download(found.url, dest);
    posters.records[m.id] = {
      src: `/posters/${m.id}.jpg`,
      width: found.width,
      height: found.height,
      source: found.wikiBase.includes("zh") ? "zh.wikipedia.org" : "en.wikipedia.org",
      sourceUrl: `${found.wikiBase.replace("/w/api.php", "")}/wiki/${encodeURIComponent(found.article)}`,
      articleUrl: `${found.wikiBase.replace("/w/api.php", "")}/wiki/${encodeURIComponent(found.article)}`,
      license: found.license,
      licenseNote:
        found.license.toLowerCase().includes("fair")
          ? "Fair use on Wikipedia; referenced here for personal non-commercial use with source link"
          : `${found.license}; via Wikipedia`,
      fetchedAt: new Date().toISOString(),
      matchedBy: "wikipedia-search",
    };
    ok++;
    console.log(`  ok ${m.id} -> ${found.article} (${found.license})`);
  } catch (e) {
    console.log(`  x ${m.id}: 下载失败 ${e.message}`);
  }
  await sleep(900);
}

if (!DRY) {
  fs.writeFileSync(postersPath, JSON.stringify(posters, null, 2), "utf8");
  console.log(`\n补图完成：新增 ${ok} 条 → data/derived/posters.json（共 ${Object.keys(posters.records).length} 条）`);
}
