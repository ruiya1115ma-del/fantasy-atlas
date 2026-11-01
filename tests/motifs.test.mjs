/**
 * 八个叙事主题（motifs）的规则测试：
 *   - 每个主题都必须匹配到作品（数量动态算出，不能为 0）
 *   - 允许交叉：至少存在同时命中两个主题的作品
 *   - 规则必须确定性（同一部作品每次判定一致）
 *   - 不得与五个视觉风格分类混淆：两套 slug 集合必须互不相交
 */
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";

const require = createRequire(import.meta.url);
const ROOT = path.resolve(import.meta.dirname, "..");
const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "catalog.json"), "utf8"));
const { MOTIFS, MOTIF_BY_SLUG, matchesMotif, motifsOf } = require("../.test-build/motifs.js");
const { CATEGORIES } = require("../.test-build/curation.js");

test("八个叙事主题齐全，且与五个视觉风格 slug 不冲突", () => {
  assert.equal(MOTIFS.length, 8, "主题数量应为 8");
  const motifSlugs = new Set(MOTIFS.map((m) => m.slug));
  const catSlugs = new Set(CATEGORIES.map((c) => c.slug));
  for (const s of motifSlugs) assert.ok(!catSlugs.has(s), `slug 冲突：${s}`);
  assert.equal(Object.keys(MOTIF_BY_SLUG).length, 8);
});

test("每个主题都能匹配到真实作品（数量 > 0）", () => {
  for (const motif of MOTIFS) {
    const n = catalog.movies.filter((m) => matchesMotif(m, motif)).length;
    assert.ok(n > 0, `${motif.zh}（${motif.slug}）匹配数为 0`);
  }
});

test("主题允许交叉：存在同时命中多个主题的作品", () => {
  const multi = catalog.movies.filter((m) => motifsOf(m).length >= 2);
  assert.ok(multi.length > 10, `交叉命中作品太少：${multi.length}`);
});

test("判定是确定性的（同一作品两次结果一致）", () => {
  for (const motif of MOTIFS) {
    const a = catalog.movies.filter((m) => matchesMotif(m, motif)).length;
    const b = catalog.movies.filter((m) => matchesMotif(m, motif)).length;
    assert.equal(a, b);
  }
});

test("不同主题给出的作品集合不完全相同", () => {
  const sets = MOTIFS.map((motif) => catalog.movies.filter((m) => matchesMotif(m, motif)).map((m) => m.id).join(","));
  const unique = new Set(sets);
  assert.equal(unique.size, MOTIFS.length, "存在两个主题命中了完全相同的作品集合");
});

test("标签命中优先于关键词：带『巨龙』标签的作品一定进异兽图鉴", () => {
  const bestiary = MOTIF_BY_SLUG.bestiary;
  const dragons = catalog.movies.filter((m) => (m.tags.element ?? []).includes("巨龙"));
  assert.ok(dragons.length > 0, "数据里应该有带『巨龙』标签的作品");
  for (const m of dragons) assert.ok(matchesMotif(m, bestiary), `${m.chineseTitle} 未进异兽图鉴`);
});
