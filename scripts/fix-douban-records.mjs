/**
 * 体检 data/derived/douban.json：剔除明显匹配错的条目，好让 fetch-douban 重抓。
 *
 * 判定为"错配"的条件（任一命中即剔除该条记录，连同已下载的图片）：
 *   1. 评分缺失或为 0（同名重映/其他条目）
 *   2. 年份与片单相差 >= 3 年
 *   3. 标题与中文名/原名完全对不上，且年份也不一致
 *
 * 用法：node scripts/fix-douban-records.mjs [--dry]
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const DRY = process.argv.includes("--dry");
const storePath = path.join(ROOT, "data", "derived", "douban.json");
const store = JSON.parse(fs.readFileSync(storePath, "utf8"));
const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "catalog.json"), "utf8"));
const byId = new Map(catalog.movies.map((m) => [m.id, m]));

const norm = (s) =>
  String(s ?? "")
    .toLowerCase()
    .replace(/[\s·:：\-—–_,，。！!？?（）()《》「」"'"'·]/g, "");

const drop = [];
for (const [id, rec] of Object.entries(store.records ?? {})) {
  const movie = byId.get(id);
  const reasons = [];
  if (!rec.rating || !(rec.rating.value > 0)) reasons.push("no-rating");
  if (movie && rec.year && Math.abs(Number(rec.year) - movie.releaseYear) >= 3) reasons.push(`year ${rec.year}≠${movie.releaseYear}`);
  if (movie) {
    const want = [movie.chineseTitle, movie.originalTitle].map(norm).filter(Boolean);
    const got = [norm(rec.title), norm(rec.originalTitle)].filter(Boolean);
    const overlap = want.some((w) => got.some((g) => g && (g.includes(w) || w.includes(g))));
    if (!overlap && movie.releaseYear !== Number(rec.year)) reasons.push("title-mismatch");
  }
  if (reasons.length) drop.push({ id, reasons, title: rec.title, year: rec.year, rating: rec.rating?.value });
}

console.log(`检查 ${Object.keys(store.records ?? {}).length} 条，判定可疑 ${drop.length} 条`);
for (const d of drop) console.log(`  ✗ ${d.id} — ${d.reasons.join(", ")}（豆瓣：${d.title} ${d.year} ★${d.rating ?? "-"}）`);

if (!DRY) {
  for (const d of drop) {
    const rec = store.records[d.id];
    for (const img of [rec.poster, ...(rec.stills ?? [])]) {
      if (!img?.src) continue;
      const p = path.join(ROOT, "public", img.src.replace(/^\//, ""));
      if (fs.existsSync(p)) fs.unlinkSync(p);
    }
    store.failures[d.id] = { reason: `pruned: ${d.reasons.join(",")}`, at: new Date().toISOString() };
    delete store.records[d.id];
  }
  fs.writeFileSync(storePath, JSON.stringify(store, null, 2), "utf8");
  console.log(`已剔除 ${drop.length} 条（图片一并删除），重新运行 node scripts/fetch-douban.mjs 即可补抓`);
} else {
  console.log("（--dry：未改动任何文件）");
}
