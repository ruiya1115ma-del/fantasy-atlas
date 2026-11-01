/**
 * 校验 data/raw/*.json 里的 wikipedia_page_en 是否真实存在，并给出建议标题。
 *
 * 用法：
 *   node scripts/verify-pages.mjs data/raw/catalog-f.json
 *   node scripts/verify-pages.mjs data/raw/catalog-f.json --fix-search
 *
 * 只读校验，不修改文件；输出可直接照着改。
 */
import fs from "node:fs";

const UA = "FantasyAtlas/1.0 (node; personal non-commercial film guide)";
const file = process.argv[2];
const doSearch = process.argv.includes("--fix-search");
if (!file) {
  console.error("用法: node scripts/verify-pages.mjs data/raw/catalog-X.json [--fix-search]");
  process.exit(1);
}
const records = JSON.parse(fs.readFileSync(file, "utf8"));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function query(params, tries = 4) {
  const url = `https://en.wikipedia.org/w/api.php?format=json&formatversion=2&${params}`;
  for (let i = 0; i < tries; i++) {
    const res = await fetch(url, { headers: { "User-Agent": UA, "Accept-Encoding": "identity" } });
    if (res.status === 429) {
      await sleep(4000 * (i + 1));
      continue;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }
  throw new Error("限流重试失败");
}

async function checkBatch(batch) {
  const titles = batch.map((r) => r.wikipedia_page_en ?? r.original_title);
  const json = await query(
    `action=query&prop=info&redirects=1&titles=${encodeURIComponent(titles.join("|"))}`
  );
  const q = json.query ?? {};
  const normalized = new Map((q.normalized ?? []).map((n) => [n.from, n.to]));
  const redirects = new Map((q.redirects ?? []).map((r) => [r.from, r.to]));
  const pages = new Map((q.pages ?? []).map((p) => [p.title, p]));
  const out = [];
  for (const rec of batch) {
    const raw = rec.wikipedia_page_en ?? rec.original_title;
    let t = normalized.get(raw) ?? raw;
    t = redirects.get(t) ?? t;
    const page = pages.get(t);
    out.push({ rec, ok: Boolean(page && !page.missing), resolved: page && !page.missing ? page.title : null });
  }
  return out;
}

const results = [];
for (let i = 0; i < records.length; i += 20) {
  const batch = records.slice(i, i + 20);
  const res = await checkBatch(batch);
  results.push(...res);
  await sleep(1200);
}

const missing = results.filter((r) => !r.ok);
console.log(`共 ${results.length} 条，✅ 命中 ${results.length - missing.length}，❌ 缺失 ${missing.length}`);
for (const r of results) {
  if (!r.ok) console.log(`  ✗ ${r.rec.catalog_key} | ${r.rec.chinese_title} → "${r.rec.wikipedia_page_en ?? r.rec.original_title}"`);
  else if (r.resolved && r.resolved !== (r.rec.wikipedia_page_en ?? r.rec.original_title)) {
    console.log(`  ~ ${r.rec.catalog_key}: 重定向为 "${r.resolved}"（建议改成它）`);
  }
}

if (doSearch && missing.length) {
  console.log("\n搜索建议：");
  for (const r of missing.slice(0, 40)) {
    const q = `${r.rec.original_title} film`;
    try {
      const json = await query(`action=query&list=search&srlimit=3&srsearch=${encodeURIComponent(q)}`);
      const hits = (json.query?.search ?? []).map((h) => h.title);
      console.log(`  ${r.rec.catalog_key}: ${hits.join(" | ") || "（无结果）"}`);
    } catch (e) {
      console.log(`  ${r.rec.catalog_key}: 搜索失败 ${e.message}`);
    }
    await sleep(1200);
  }
}
