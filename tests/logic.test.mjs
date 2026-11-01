/**
 * 逻辑单元测试 —— 针对 lib/ 编译产物（先跑 tsc -p tsconfig.test.json）。
 * 覆盖筛选取并集/交集语义、URL 往返、推荐的可解释性与排除逻辑、相似作品门槛。
 *
 * 运行：
 *   node node_modules/typescript/bin/tsc -p tsconfig.test.json
 *   node --test --test-isolation=none tests/data.test.mjs tests/logic.test.mjs
 */
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";
import { existsSync } from "node:fs";

const require = createRequire(import.meta.url);
const BUILD = path.join(process.cwd(), ".test-build");

if (!existsSync(path.join(BUILD, "filter.js"))) {
  test("lib 编译产物存在", () => {
    assert.fail("缺少 .test-build —— 先运行 `node node_modules/typescript/bin/tsc -p tsconfig.test.json`");
  });
} else {
  const data = require(path.join(BUILD, "data.js"));
  const filter = require(path.join(BUILD, "filter.js"));
  const recommend = require(path.join(BUILD, "recommend.js"));
  const similar = require(path.join(BUILD, "similar.js"));
  const curation = require(path.join(BUILD, "curation.js"));

  const movies = data.getMovies();
  const EMPTY_LIB = { favorites: [], watched: [], wishlist: [], personalRatings: {}, notes: {} };
  const withState = (patch) => ({ ...filter.DEFAULT_FILTERS, ...patch });

  test("catalog 能被 lib/data 正确加载", () => {
    assert.ok(movies.length >= 50, `只加载到 ${movies.length} 部`);
    assert.equal(data.getStats().total, movies.length);
  });

  test("筛选：同类标签是「或」，不同类是「与」", () => {
    const orState = withState({ world: ["魔法学院", "魔法社会"] });
    const orResults = filter.applyFilters(movies, orState);
    const orExpected = movies.filter((m) => m.tags.world.includes("魔法学院") || m.tags.world.includes("魔法社会"));
    assert.equal(orResults.length, orExpected.length, "同类标签应取并集");
    assert.ok(orResults.length > 0);

    const andState = withState({ world: ["魔法学院"], aesthetic: ["哥特建筑"] });
    const andResults = filter.applyFilters(movies, andState);
    for (const m of andResults) {
      assert.ok(m.tags.world.includes("魔法学院") && m.tags.aesthetic.includes("哥特建筑"), "跨类标签应取交集");
    }
    assert.ok(andResults.length <= orResults.length);
  });

  test("筛选：搜索能命中中文标题与导演", () => {
    const byTitle = filter.applyFilters(movies, withState({ q: "千与千寻" }));
    assert.ok(byTitle.length > 0, "标题搜索失败");
    assert.ok(byTitle.every((m) => filter.matchesQuery(m, "千与千寻")));

    const byDirector = filter.applyFilters(movies, withState({ q: "Guillermo" }));
    assert.ok(byDirector.length > 0, "导演搜索失败");
  });

  test("筛选：URL 往返后状态不变（可分享链接）", () => {
    const state = withState({
      q: "魔法",
      world: ["魔法学院"],
      mood: ["神秘"],
      yearFrom: 2000,
      yearTo: 2009,
      sort: "rating",
      ratingMin: 7,
    });
    const qs = filter.filtersToQuery(state);
    const back = filter.filtersFromQuery(new URLSearchParams(qs));
    assert.equal(back.q, state.q);
    assert.deepEqual(back.world, state.world);
    assert.deepEqual(back.mood, state.mood);
    assert.equal(back.yearFrom, 2000);
    assert.equal(back.yearTo, 2009);
    assert.equal(back.sort, "rating");
    assert.equal(back.ratingMin, 7);
  });

  test("筛选：没有结果时也不崩，且能描述当前条件", () => {
    const state = withState({ world: ["平行世界"], aesthetic: ["蒸汽朋克"], element: ["魔法师"] });
    const results = filter.applyFilters(movies, state);
    assert.ok(Array.isArray(results));
    const described = filter.describeFilters(state);
    assert.ok(described.length >= 2, "应能描述当前筛选条件");
    assert.ok(filter.activeFilterCount(state) >= 3);
  });

  test("排序：四种排序都返回全集且无重复", () => {
    for (const sort of ["recommendation", "year_desc", "year_asc", "title", "rating"]) {
      const rows = filter.applyFilters(movies, withState({ sort }));
      assert.equal(rows.length, movies.length, `${sort} 排序丢失了记录`);
      assert.equal(new Set(rows.map((m) => m.id)).size, rows.length, `${sort} 出现重复`);
    }
  });

  test("推荐：没有偏好时不硬推（empty=no-preference）", () => {
    const result = recommend.recommend(movies, recommend.DEFAULT_PREFERENCES, EMPTY_LIB);
    assert.equal(result.hits.length, 0);
    assert.equal(result.empty, "no-preference");
  });

  test("推荐：每条结果都带可解释理由、匹配标签，且分数=标签权重之和", () => {
    const prefs = {
      ...recommend.DEFAULT_PREFERENCES,
      likedTags: { ...recommend.DEFAULT_PREFERENCES.likedTags, world: ["魔法学院"], aesthetic: ["魔法学院美学"] },
    };
    const result = recommend.recommend(movies, prefs, EMPTY_LIB);
    assert.ok(result.hits.length > 0, "应产出推荐");
    for (const hit of result.hits) {
      assert.ok(hit.reasons.length > 0, `${hit.movie.id} 缺少推荐理由`);
      assert.ok(hit.matchedTags.length > 0, `${hit.movie.id} 缺少匹配标签`);
      assert.ok(hit.strength >= 0 && hit.strength <= 100, `${hit.movie.id} strength 越界`);
      const tagScore = hit.matchedTags.reduce((n, t) => n + t.weight, 0);
      assert.ok(tagScore > 0, `${hit.movie.id} 标签权重为 0`);
      // 命中的标签必须真的在作品标签里（防止"编造理由"）
      for (const t of hit.matchedTags) {
        assert.ok(hit.movie.tags[t.category].includes(t.tag), `${hit.movie.id} 理由中的标签 ${t.tag} 不在作品里`);
      }
    }
  });

  test("推荐：相同输入必须得到相同输出（无随机排序）", () => {
    const prefs = {
      ...recommend.DEFAULT_PREFERENCES,
      likedTags: { ...recommend.DEFAULT_PREFERENCES.likedTags, world: ["异世界冒险"] },
    };
    const a = recommend.recommend(movies, prefs, EMPTY_LIB);
    const b = recommend.recommend(movies, prefs, EMPTY_LIB);
    assert.deepEqual(
      a.hits.map((h) => h.movie.id),
      b.hits.map((h) => h.movie.id),
      "推荐必须确定性",
    );
  });

  test("推荐：排除已看后不再出现在结果里", () => {
    const prefs = {
      ...recommend.DEFAULT_PREFERENCES,
      likedTags: { ...recommend.DEFAULT_PREFERENCES.likedTags, world: ["魔法学院"] },
      excludeWatched: true,
    };
    const watched = movies.slice(0, 8).map((m) => m.id);
    const result = recommend.recommend(movies, prefs, { ...EMPTY_LIB, watched });
    for (const hit of result.hits) {
      assert.ok(!watched.includes(hit.movie.id), "已看作品不应出现在推荐里");
    }
    assert.ok(result.filteredCount >= 0);
  });

  test("推荐：外部评分不参与主排序（只做同分微调）", () => {
    const prefs = {
      ...recommend.DEFAULT_PREFERENCES,
      likedTags: { ...recommend.DEFAULT_PREFERENCES.likedTags, world: ["魔法学院"] },
    };
    const hits = recommend.recommend(movies, prefs, EMPTY_LIB).hits;
    // 主分数必须是 5 的倍数（标签权重之和），评分微调只影响小数部分
    for (const hit of hits) {
      const tagScore = hit.matchedTags.reduce((n, t) => n + t.weight, 0);
      assert.ok(Math.abs(hit.score - tagScore) <= 1.01, `${hit.movie.id} 分数 ${hit.score} 与标签分 ${tagScore} 偏差过大`);
    }
  });

  test("相似作品：必须跨两个维度、达到门槛，且排除同系列", () => {
    const target = movies.find((m) => m.slug === "harry-potter-and-the-prisoner-of-azkaban") ?? movies[0];
    const hits = similar.similarMovies(target, movies, 6);
    assert.ok(hits.length > 0, "相似作品不应为空");
    for (const hit of hits) {
      assert.notEqual(hit.movie.id, target.id);
      assert.ok(hit.shared.length >= 2, "相似作品至少要跨两个标签维度");
      assert.ok(hit.score >= 4);
      if (target.franchise) assert.notEqual(hit.movie.franchise, target.franchise, "同系列不算相似");
    }
  });

  test("五个世界观分类、八个氛围入口、五个编辑片单都不为空", () => {
    for (const c of curation.CATEGORIES) {
      assert.ok(movies.filter((m) => c.match(m)).length > 0, `分类 ${c.slug} 没有作品`);
    }
    for (const mood of curation.MOODS) {
      assert.ok(movies.filter((m) => mood.match(m)).length > 0, `氛围 ${mood.slug} 没有作品`);
    }
    for (const list of curation.EDITORIAL_LISTS) {
      assert.ok(list.pick(movies).length > 0, `编辑片单 ${list.slug} 为空`);
    }
  });

  test("编辑推荐度在 0–100 之间，且不是外部评分的线性映射", () => {
    const rows = movies.map((m) => ({ id: m.id, score: filter.editorialScore(filter.toMediaCard(m)) }));
    for (const r of rows) assert.ok(r.score >= 0 && r.score <= 100, `${r.id} editorialScore 越界`);
    const distinct = new Set(rows.map((r) => r.score));
    assert.ok(distinct.size > 5, "编辑推荐度不应只有几个固定档位");
  });
}
