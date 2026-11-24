/**
 * 六个叙事主题（motifs）的规则测试：
 *   - 主题名称与 slug 固定，且与五个视觉风格 slug 不冲突
 *   - 每部作品最多属于一个主题（禁止重复归类）
 *   - 每个主题都必须有作品，且六个主题的集合互不相同
 *   - 归类表里的 id 必须真实存在于 catalog
 *   - 六个主题都没有收录的作品确实存在（不强行分类）
 *   - 判定是确定性的
 */
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";

const require = createRequire(import.meta.url);
const ROOT = path.resolve(import.meta.dirname, "..");
const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "catalog.json"), "utf8"));
const { MOTIFS, MOTIF_BY_SLUG, matchesMotif, classifyMovie, motifsOf } = require("../.test-build/motifs.js");
const { THEME_ASSIGNMENTS } = require("../.test-build/theme-assignments.js");
const { CATEGORIES } = require("../.test-build/curation.js");

const EXPECTED = [
  ["time-rift", "时空裂隙"],
  ["magic-world", "魔法世界"],
  ["strange-everyday", "怪奇日常"],
  ["fantasy-creatures", "奇幻生物"],
  ["dark-fairytale", "暗黑童话"],
  ["epic-quest", "史诗远征"],
];

test("六个叙事主题的名称、顺序固定，且与五个视觉风格 slug 不冲突", () => {
  assert.deepEqual(
    MOTIFS.map((m) => [m.slug, m.zh]),
    EXPECTED,
    "主题列表与需求不一致",
  );
  const catSlugs = new Set(CATEGORIES.map((c) => c.slug));
  for (const motif of MOTIFS) assert.ok(!catSlugs.has(motif.slug), `slug 冲突：${motif.slug}`);
  assert.equal(Object.keys(MOTIF_BY_SLUG).length, 6);
});

test("每部作品最多属于一个主题（禁止重复归类）", () => {
  const seen = new Map();
  for (const [slug, ids] of Object.entries(THEME_ASSIGNMENTS)) {
    for (const id of ids) {
      assert.ok(!seen.has(id), `${id} 同时出现在 ${seen.get(id)} 与 ${slug}`);
      seen.set(id, slug);
    }
  }
});

test("归类表里的作品都必须真实存在", () => {
  const ids = new Set(catalog.movies.map((m) => m.id));
  for (const [slug, list] of Object.entries(THEME_ASSIGNMENTS)) {
    for (const id of list) assert.ok(ids.has(id), `${slug} 里有不存在的 id：${id}`);
  }
});

test("每个主题都有作品，且六个主题的集合互不相同", () => {
  const signatures = new Set();
  for (const motif of MOTIFS) {
    const list = catalog.movies.filter((m) => matchesMotif(m, motif));
    assert.ok(list.length > 0, `${motif.zh} 作品数为 0`);
    signatures.add(list.map((m) => m.id).sort().join(","));
  }
  assert.equal(signatures.size, MOTIFS.length, "存在两个主题收录了完全相同的作品集合");
});

test("存在不归入任何主题的作品（不强行分类）", () => {
  const none = catalog.movies.filter((m) => classifyMovie(m) === null);
  assert.ok(none.length > 0, "所有作品都被强行归类了，与需求不符");
});

test("一部作品最多命中一个主题，判定具有确定性", () => {
  for (const m of catalog.movies) {
    assert.ok(motifsOf(m).length <= 1, `${m.chineseTitle} 命中多个主题`);
    assert.equal(classifyMovie(m), classifyMovie(m));
  }
});
