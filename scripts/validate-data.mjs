#!/usr/bin/env node
/**
 * 数据体检脚本 —— 不依赖 TypeScript 编译，直接读生成物。
 * 用途：改完 data/raw/*.json 或跑完 enrich 之后，用一条命令确认数据仍然合格。
 *
 * 用法：node scripts/validate-data.mjs
 * 退出码：0 = 全部通过；1 = 有阻断问题
 */
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const CATALOG = path.join(ROOT, "data", "catalog.json");
const REPORT = path.join(ROOT, "data", "reports", "import-report.json");
const HAN = /[\u4e00-\u9fff]/g;
const hanCount = (s) => (String(s ?? "").match(HAN) ?? []).length;

const problems = [];
const warnings = [];
const fail = (msg) => problems.push(msg);
const warn = (msg) => warnings.push(msg);

if (!existsSync(CATALOG)) {
  console.error("✖ 找不到 data/catalog.json —— 先运行 npm run merge");
  process.exit(1);
}

const catalog = JSON.parse(readFileSync(CATALOG, "utf8"));
const movies = catalog.movies ?? [];
const report = existsSync(REPORT) ? JSON.parse(readFileSync(REPORT, "utf8")) : null;

// 1. 基本结构
if (catalog.count !== movies.length) fail(`catalog.count (${catalog.count}) 与条目数 (${movies.length}) 不一致`);
if (movies.length === 0) fail("catalog 为空");
if (report && report.accepted !== movies.length) fail(`导入报告 accepted=${report.accepted} 与 catalog ${movies.length} 不一致`);

// 2. 唯一性
const seenId = new Set();
const seenSlug = new Set();
for (const m of movies) {
  if (seenId.has(m.id)) fail(`重复 id: ${m.id}`);
  if (seenSlug.has(m.slug)) fail(`重复 slug: ${m.slug}`);
  seenId.add(m.id);
  seenSlug.add(m.slug);
}

// 3. 字段与内容
const REQUIRED = ["id", "slug", "chineseTitle", "originalTitle", "synopsis", "recommendation", "audienceFit", "audienceMismatch"];
for (const m of movies) {
  for (const key of REQUIRED) {
    if (typeof m[key] !== "string" || !m[key].trim()) fail(`${m.id} 缺字段 ${key}`);
  }
  if (typeof m.releaseYear !== "number") fail(`${m.id} releaseYear 不是数字`);
  else if (m.releaseYear < 1900 || m.releaseYear > 2030) warn(`${m.id} 年份可疑: ${m.releaseYear}`);
  const h = hanCount(m.synopsis);
  if (h < 60) fail(`${m.id} 简介只有 ${h} 个汉字（要求 ≥60）`);
  for (const bucket of ["type", "world", "aesthetic", "element", "mood"]) {
    if (!Array.isArray(m.tags?.[bucket]) || m.tags[bucket].length === 0) fail(`${m.id} 缺少 ${bucket} 类标签`);
  }
  if (!["high", "medium", "low"].includes(m.tagConfidence)) fail(`${m.id} tagConfidence 非法`);
}

// 4. 评分契约
let rated = 0;
for (const m of movies) {
  if (!Array.isArray(m.ratings)) {
    fail(`${m.id} ratings 不是数组`);
    continue;
  }
  if (m.ratings.length) rated += 1;
  for (const r of m.ratings) {
    for (const f of ["source", "rating_value", "rating_scale", "last_checked_at", "source_url", "usage_status"]) {
      if (r[f] === undefined || r[f] === null || String(r[f]).length === 0) fail(`${m.id} 评分缺字段 ${f}`);
    }
    if (![5, 10].includes(r.rating_scale)) fail(`${m.id} rating_scale 非法`);
    if (!(r.rating_value > 0 && r.rating_value <= r.rating_scale)) fail(`${m.id} 评分越界 ${r.rating_value}`);
    if (!/^https?:\/\//.test(String(r.source_url))) fail(`${m.id} source_url 不是绝对链接`);
    if (!r.usage_status.includes("noncommercial") && r.usage_status !== "free") fail(`${m.id} usage_status 未声明用途`);
  }
}

// 5. 待人工复核清单（不阻断，但必须能被看到）
const needsReview = movies.filter((m) => m.provenance?.needsReview);
const noCast = movies.filter((m) => m.cast.length === 0);
const noDirector = movies.filter((m) => m.directors.length === 0);
for (const m of noDirector) warn(`${m.id} 没有导演信息（未编造，留空）`);
if (noCast.length) warn(`${noCast.length} 部作品没有演员信息（多为动画/剧集，Wikidata 无 P161）`);

// 6. 统计
const stats = {
  作品数: movies.length,
  有评分: `${rated}/${movies.length}`,
  系列数: new Set(movies.map((m) => m.franchise).filter(Boolean)).size,
  待复核: needsReview.length,
  无导演: noDirector.length,
  无演员: noCast.length,
  媒体类型: movies.reduce((acc, m) => ({ ...acc, [m.mediaType]: (acc[m.mediaType] ?? 0) + 1 }), {}),
};

console.log("── Fantasy Atlas 数据体检 ──");
for (const [k, v] of Object.entries(stats)) console.log(`  ${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`);
if (warnings.length) {
  console.log(`\n⚠ 警告 ${warnings.length} 条：`);
  for (const w of warnings) console.log("  -", w);
}
if (problems.length) {
  console.log(`\n✖ 阻断问题 ${problems.length} 条：`);
  for (const p of problems) console.log("  -", p);
  process.exit(1);
}
console.log("\n✔ 数据体检通过（没有编造字段、没有占位评分、标签分类齐全）");
