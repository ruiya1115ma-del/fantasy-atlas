import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const { pickHeroMovies } = require("../.test-build/hero-picks.js");

/** 造一批可控的假作品，专门测抽取规则 */
function makeMovie({ id, year, franchise = null, type = "Fantasy Adventure", world = "神话世界", poster = true }) {
  return {
    id,
    slug: id,
    chineseTitle: id,
    originalTitle: id,
    releaseYear: year,
    format: "live_action",
    franchise,
    franchiseName: franchise,
    poster: poster ? { src: `/posters/${id}.jpg` } : null,
    tags: { type: [type], world: [world], aesthetic: ["哥特建筑"], element: ["魔法"], mood: ["阴森"] },
  };
}

/** 5 个系列，每系列 6 部；另有 12 部单片 */
function makeLibrary() {
  const movies = [];
  for (let f = 0; f < 5; f += 1) {
    for (let i = 0; i < 6; i += 1) {
      movies.push(
        makeMovie({
          id: `series-${f}-${i}`,
          year: 1980 + f * 8 + i,
          franchise: `franchise-${f}`,
          type: ["Epic Fantasy", "Dark Fantasy", "Fairy Tale", "Fantasy Animation", "Surreal Fantasy"][f],
          world: ["神话世界", "童话王国", "超自然现代社会", "梦境世界", "古代王国"][f],
        }),
      );
    }
  }
  for (let i = 0; i < 12; i += 1) {
    movies.push(makeMovie({ id: `solo-${i}`, year: 1990 + i * 2 }));
  }
  return movies;
}

test("hero picks：数量正确且不使用固定候选", () => {
  const library = makeLibrary();
  const picks = pickHeroMovies(library, { count: 10, rng: () => 0.42 });
  assert.equal(picks.length, 10, "应抽出 10 部");
  // 不同随机源应得到不同组合（不是写死的列表）
  const a = pickHeroMovies(library, { count: 10, rng: () => 0.1 }).map((m) => m.id).join(",");
  const b = pickHeroMovies(library, { count: 10, rng: () => 0.9 }).map((m) => m.id).join(",");
  assert.notEqual(a, b, "换随机源应换结果");
});

test("hero picks：同一部作品不重复", () => {
  const picks = pickHeroMovies(makeLibrary(), { count: 10, rng: Math.random });
  const ids = picks.map((m) => m.id);
  assert.equal(new Set(ids).size, ids.length);
});

test("hero picks：同一系列最多一部", () => {
  for (let round = 0; round < 20; round += 1) {
    const picks = pickHeroMovies(makeLibrary(), { count: 10, rng: Math.random });
    const franchises = picks.map((m) => m.franchise).filter(Boolean);
    assert.equal(new Set(franchises).size, franchises.length, "系列不可重复");
  }
});

test("hero picks：类型与年代尽量分散", () => {
  const picks = pickHeroMovies(makeLibrary(), { count: 10, rng: () => 0.33 });
  const types = new Set(picks.map((m) => m.tags.type[0]));
  const decades = new Set(picks.map((m) => `${Math.floor(m.releaseYear / 10) * 10}s`));
  assert.ok(types.size >= 3, `类型应至少 3 种，实际 ${types.size}`);
  assert.ok(decades.size >= 3, `年代应至少 3 个，实际 ${decades.size}`);
});

test("hero picks：没有海报的作品不参与", () => {
  const library = makeLibrary();
  library.push(makeMovie({ id: "no-poster", year: 2001, poster: false }));
  for (let round = 0; round < 10; round += 1) {
    const picks = pickHeroMovies(library, { count: 10, rng: Math.random });
    assert.ok(!picks.some((m) => m.id === "no-poster"));
  }
});

test("hero picks：数量超过库容量时不会死循环", () => {
  const small = [makeMovie({ id: "a", year: 2001 }), makeMovie({ id: "b", year: 2002 })];
  const picks = pickHeroMovies(small, { count: 10, rng: Math.random });
  assert.equal(picks.length, 2);
});
