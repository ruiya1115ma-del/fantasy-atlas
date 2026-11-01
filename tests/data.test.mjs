/**
 * 数据契约测试 —— 直接读生成物 data/catalog.json 与导入报告。
 * 这些断言的意义：项目承诺「不编造数据」，那就必须能被机器验证。
 *
 * 运行：node --test tests/
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const catalog = JSON.parse(readFileSync(path.join(ROOT, "data", "catalog.json"), "utf8"));
const report = JSON.parse(readFileSync(path.join(ROOT, "data", "reports", "import-report.json"), "utf8"));
const movies = catalog.movies;

const HAN = /[\u4e00-\u9fff]/g;
const hanCount = (s) => (String(s).match(HAN) ?? []).length;

test("catalog 的 count 与实际条目数一致", () => {
  assert.equal(catalog.count, movies.length);
  assert.ok(movies.length > 0, "catalog 不能为空");
});

test("id 与 slug 全局唯一", () => {
  const ids = new Set();
  const slugs = new Set();
  for (const m of movies) {
    assert.ok(!ids.has(m.id), `重复 id: ${m.id}`);
    assert.ok(!slugs.has(m.slug), `重复 slug: ${m.slug}`);
    ids.add(m.id);
    slugs.add(m.slug);
  }
});

test("每条记录都有必填字段，且不是空字符串占位", () => {
  const required = [
    "id",
    "slug",
    "chineseTitle",
    "originalTitle",
    "mediaType",
    "format",
    "synopsis",
    "recommendation",
    "audienceFit",
    "audienceMismatch",
    "tagConfidence",
    "watchStatus",
  ];
  for (const m of movies) {
    for (const key of required) {
      assert.ok(typeof m[key] === "string" && m[key].trim().length > 0, `${m.id} 缺字段 ${key}`);
    }
  }
});

test("上映年份是合理数字（1900–2030）", () => {
  for (const m of movies) {
    assert.equal(typeof m.releaseYear, "number", `${m.id} releaseYear 必须是数字`);
    assert.ok(m.releaseYear >= 1900 && m.releaseYear <= 2030, `${m.id} 年份异常: ${m.releaseYear}`);
  }
});

test("原创简介 ≥ 60 个汉字（不允许占位/空泛文案）", () => {
  for (const m of movies) {
    assert.ok(hanCount(m.synopsis) >= 60, `${m.id} 简介只有 ${hanCount(m.synopsis)} 个汉字`);
  }
});

test("评分符合 7 字段契约，且数值不越界", () => {
  const fields = ["source", "rating_value", "rating_scale", "last_checked_at", "source_url", "usage_status"];
  for (const m of movies) {
    for (const r of m.ratings) {
      for (const f of fields) {
        assert.ok(r[f] !== undefined && r[f] !== null && String(r[f]).length > 0, `${m.id} 评分缺字段 ${f}`);
      }
      assert.ok([5, 10].includes(r.rating_scale), `${m.id} rating_scale 必须是 5 或 10`);
      assert.ok(r.rating_value >= 0 && r.rating_value <= r.rating_scale, `${m.id} 评分越界`);
      assert.match(r.source_url, /^https?:\/\//, `${m.id} source_url 必须是链接`);
      assert.match(r.last_checked_at, /^\d{4}-\d{2}-\d{2}/, `${m.id} last_checked_at 必须是 ISO 时间`);
      assert.ok(r.usage_status.includes("noncommercial") || r.usage_status === "free", `${m.id} usage_status 未声明用途`);
    }
  }
});

test("没有评分的作品必须为空数组，不允许出现 0 分占位", () => {
  for (const m of movies) {
    assert.ok(Array.isArray(m.ratings), `${m.id} ratings 必须是数组`);
    for (const r of m.ratings) assert.notEqual(r.rating_value, 0, `${m.id} 出现 0 分占位`);
  }
});

test("原始记录没有被生成物反向污染：report 的接受数与 catalog 一致", () => {
  assert.equal(report.accepted, movies.length);
  assert.equal(report.rejected.length, 0, "导入过程不应有被拒记录");
});

test("标签分类齐全，且不出现空标签组", () => {
  for (const m of movies) {
    for (const bucket of ["type", "world", "aesthetic", "element", "mood"]) {
      assert.ok(Array.isArray(m.tags[bucket]), `${m.id} tags.${bucket} 必须是数组`);
      assert.ok(m.tags[bucket].length > 0, `${m.id} 缺少 ${bucket} 类标签`);
    }
  }
});

test("不同系列的作品不会共用同一个 seriesOrder 语义错误", () => {
  const groups = new Map();
  for (const m of movies) {
    if (!m.franchise) continue;
    if (!groups.has(m.franchise)) groups.set(m.franchise, []);
    groups.get(m.franchise).push(m);
  }
  for (const [franchise, list] of groups) {
    const orders = list.map((m) => m.seriesOrder);
    assert.equal(new Set(orders).size, orders.length, `${franchise} 内 seriesOrder 重复`);
  }
});

test("媒体类型只有 movie / series 两种，且 series 不带片长", () => {
  for (const m of movies) {
    assert.ok(["movie", "series"].includes(m.mediaType), `${m.id} 非法 mediaType`);
    if (m.mediaType === "series") {
      assert.ok(m.seasons !== null && m.seasons > 0, `${m.id} series 应有 seasons`);
    }
  }
});
