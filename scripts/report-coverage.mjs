/**
 * 覆盖率体检：海报 / 剧照 / 豆瓣评分 / 简介 到底补到多少，还差哪些。
 * 用法：node scripts/report-coverage.mjs [--md]
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const MD = process.argv.includes("--md");
const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "catalog.json"), "utf8"));
const doubanPath = path.join(ROOT, "data", "derived", "douban.json");
const douban = fs.existsSync(doubanPath) ? JSON.parse(fs.readFileSync(doubanPath, "utf8")) : { records: {}, failures: {} };
const movies = catalog.movies;

const withDoubanRating = movies.filter((m) => m.ratings.some((r) => r.source === "豆瓣电影")).length;
const withAnyRating = movies.filter((m) => m.ratings.length > 0).length;
const posterDouban = movies.filter((m) => m.poster?.source?.includes("douban")).length;
const posterWiki = movies.filter((m) => m.poster && !m.poster.source?.includes("douban")).length;
const noPoster = movies.filter((m) => !m.poster);
const withStills = movies.filter((m) => (m.stills?.length ?? 0) > 0).length;
const withIntro = movies.filter((m) => Boolean(m.doubanIntro)).length;

const pct = (n, d) => `${n}/${d}（${Math.round((n / d) * 100)}%）`;
const lines = [];
lines.push(`作品总数        ${movies.length}`);
lines.push(`豆瓣评分        ${pct(withDoubanRating, movies.length)}`);
lines.push(`任意评分        ${pct(withAnyRating, movies.length)}`);
lines.push(`真实海报        ${pct(posterDouban + posterWiki, movies.length)}  （豆瓣 ${posterDouban} / 维基 ${posterWiki}）`);
lines.push(`真实剧照        ${pct(withStills, movies.length)}`);
lines.push(`豆瓣剧情简介    ${pct(withIntro, movies.length)}`);
lines.push(`仍无海报        ${noPoster.length} 部`);
lines.push(`抓取失败记录    ${Object.keys(douban.failures ?? {}).length} 条`);

if (noPoster.length) {
  lines.push("");
  lines.push("缺海报的作品（仍可用程序化封面兜底）：");
  for (const m of noPoster.slice(0, 60)) {
    const f = douban.failures?.[m.id]?.reason;
    lines.push(`  - ${m.id} | ${m.chineseTitle}（${m.releaseYear}）${f ? ` ← ${f}` : ""}`);
  }
  if (noPoster.length > 60) lines.push(`  … 其余 ${noPoster.length - 60} 部`);
}

const failures = Object.entries(douban.failures ?? {});
if (failures.length) {
  lines.push("");
  lines.push("豆瓣抓取失败明细：");
  for (const [id, f] of failures.slice(0, 40)) lines.push(`  - ${id}: ${f.reason}`);
  if (failures.length > 40) lines.push(`  … 其余 ${failures.length - 40} 条`);
}

const out = lines.join("\n");
console.log(out);
fs.writeFileSync(path.join(ROOT, "data", "reports", "coverage.txt"), out + "\n", "utf8");
if (MD) {
  fs.writeFileSync(
    path.join(ROOT, "data", "reports", "coverage.md"),
    `# 图片与数据覆盖率\n\n生成时间：${new Date().toISOString()}\n\n\`\`\`\n${out}\n\`\`\`\n`,
    "utf8"
  );
}
