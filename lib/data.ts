import fs from "node:fs";
import path from "node:path";
import type { CatalogFile, Franchise, Movie } from "./types";
import { CATEGORIES, EDITORIAL_LISTS, MOODS } from "./curation";
import { assignStyle } from "./style-assignments";

/**
 * 数据加载层（仅服务端）。
 * 站点唯一数据源是 data/catalog.json —— 由 scripts/merge-catalog.mjs 生成。
 * 读取失败时返回空目录而不是崩溃，页面负责显示"数据尚未就绪"的空状态。
 */

const CATALOG_PATH = path.join(process.cwd(), "data", "catalog.json");

let cache: CatalogFile | null = null;
let cacheMtime = 0;

export function loadCatalog(): CatalogFile {
  try {
    const stat = fs.statSync(CATALOG_PATH);
    if (cache && stat.mtimeMs === cacheMtime) return cache;
    const parsed = JSON.parse(fs.readFileSync(CATALOG_PATH, "utf8")) as CatalogFile;
    cache = {
      generatedAt: parsed.generatedAt ?? new Date().toISOString(),
      count: Array.isArray(parsed.movies) ? parsed.movies.length : 0,
      movies: Array.isArray(parsed.movies) ? parsed.movies : [],
    };
    cacheMtime = stat.mtimeMs;
    return cache;
  } catch {
    return { generatedAt: new Date().toISOString(), count: 0, movies: [] };
  }
}

export function getMovies(): Movie[] {
  return loadCatalog().movies;
}

export function getMovieBySlug(slug: string): Movie | undefined {
  return getMovies().find((m) => m.slug === slug || m.id === slug);
}

export function getMoviesByIds(ids: string[]): Movie[] {
  const set = new Set(ids);
  return getMovies().filter((m) => set.has(m.id));
}

export function getFranchises(): Franchise[] {
  const map = new Map<string, Movie[]>();
  for (const m of getMovies()) {
    if (!m.franchise) continue;
    if (!map.has(m.franchise)) map.set(m.franchise, []);
    map.get(m.franchise)!.push(m);
  }
  return [...map.entries()]
    .map(([id, movies]) => ({
      id,
      name: movies[0].franchiseName ?? id,
      movies: movies.slice().sort((a, b) => (a.seriesOrder ?? 0) - (b.seriesOrder ?? 0)),
    }))
    .sort((a, b) => b.movies.length - a.movies.length);
}

/**
 * 五个视觉风格的封面偏好（按顺序取第一部还没被别的分类用掉的作品）。
 * 只影响首页画廊与分类页头图，不影响分类成员。
 */
const CATEGORY_COVER_PREF: Record<string, string[]> = {
  "enchanted-worlds": ["the-nutcracker-and-the-four-realms-2018", "narnia", "the-neverending-story"],
  "dark-gothic": ["twilight", "crimson-peak", "sleepy-hollow-1999", "the-brothers-grimm-2005"],
  "epic-fantasy": [
    "the-lord-of-the-rings-the-fellowship-of-the-ring",
    "the-hobbit-an-unexpected-journey",
    "the-lord-of-the-rings-the-two-towers",
  ],
  "surreal-dreams": ["alice-in-wonderland-2010", "big-fish-2003", "coraline"],
  "whimsical-tales": ["coraline", "spirited-away", "my-neighbor-totoro-1988"],
};

/** 首页「按奇幻世界探索」：每部作品只归入一个分类（互斥），人工归属表见 lib/style-overrides.ts */
export function getCategoryBuckets() {
  const movies = getMovies();
  const assigned = new Map<string, string>();
  for (const m of movies) {
    const slug = assignStyle(m);
    if (slug) assigned.set(m.id, slug);
  }

  const byRating = (a: Movie, b: Movie) => (b.ratings[0]?.rating_count ?? 0) - (a.ratings[0]?.rating_count ?? 0);

  return CATEGORIES.map((cat) => {
    const matched = movies.filter((m) => assigned.get(m.id) === cat.slug);
    const sorted = matched.slice().sort(byRating);
    const coverCandidates = [...(CATEGORY_COVER_PREF[cat.slug] ?? []).map((id) => movies.find((m) => m.id === id)).filter(Boolean) as Movie[]];
    return {
      category: cat,
      count: matched.length,
      movies: sorted,
      coverCandidates: [...coverCandidates, ...sorted.filter((m) => !coverCandidates.some((c) => c.id === m.id))],
      representatives: sorted.slice(0, 3),
    };
  });
}

export function getMoodBuckets() {
  const movies = getMovies();
  return MOODS.map((mood) => ({ mood, count: movies.filter(mood.match).length }));
}

export function getEditorialPicks() {
  const movies = getMovies();
  return EDITORIAL_LISTS.map((list) => {
    const picked = list.pick(movies).slice(0, list.limit);
    return { list, movies: picked };
  });
}

/**
 * 「最近收录」：本批次导入的作品按上映年份从新到旧。
 * 数据里没有逐条的入库时间（同一批次导入），所以这里如实按年份排序，
 * 页面文案写「本批次收录」而不是伪造成逐日新增。
 */
export function getRecentAdditions(limit = 8): Movie[] {
  return getMovies()
    .slice()
    .sort((a, b) => b.releaseYear - a.releaseYear || a.chineseTitle.localeCompare(b.chineseTitle))
    .slice(0, limit);
}

export function getStats() {
  const movies = getMovies();
  const withRating = movies.filter((m) => m.ratings.length > 0).length;
  const franchises = getFranchises();
  const candidates = movies.reduce((acc, m) => acc + m.provenance.reviewReasons.length > 0 ? acc + 1 : acc, 0);
  return {
    total: movies.length,
    movies: movies.filter((m) => m.mediaType === "movie").length,
    series: movies.filter((m) => m.mediaType !== "movie").length,
    animation: movies.filter((m) => m.format === "animation").length,
    franchises: franchises.length,
    withRating,
    needsReview: movies.filter((m) => m.provenance.needsReview).length,
    candidates,
    generatedAt: loadCatalog().generatedAt,
  };
}
