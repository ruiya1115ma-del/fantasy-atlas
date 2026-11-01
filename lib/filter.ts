import type { LibraryState, MediaCard, TagBucket } from "./types";
import { EDITORIAL_LISTS } from "./curation";

/** 纯函数筛选层：服务端与客户端共用，不依赖 fs。 */

export type SortKey = "recommendation" | "year_desc" | "year_asc" | "title" | "rating";

export interface FilterState {
  q: string;
  type: string[];
  world: string[];
  aesthetic: string[];
  element: string[];
  mood: string[];
  media: "all" | "movie" | "series";
  format: "all" | "live_action" | "animation";
  yearFrom: number | null;
  yearTo: number | null;
  country: string[];
  franchise: "all" | "series" | "standalone";
  ratingMin: number | null;
  ratingMax: number | null;
  /** 基于本地收藏库的状态 */
  library: "all" | "watched" | "unwatched" | "favorite";
  moodEntry: string | null;
  category: string | null;
  sort: SortKey;
}

export const DEFAULT_FILTERS: FilterState = {
  q: "",
  type: [],
  world: [],
  aesthetic: [],
  element: [],
  mood: [],
  media: "all",
  format: "all",
  yearFrom: null,
  yearTo: null,
  country: [],
  franchise: "all",
  ratingMin: null,
  ratingMax: null,
  library: "all",
  moodEntry: null,
  category: null,
  sort: "recommendation",
};

/** 可筛选的标签维度（exclude 是"劝退"标记，不作为筛选条件） */
export type FilterTagBucket = Exclude<TagBucket, "exclude">;

export const TAG_BUCKETS: FilterTagBucket[] = ["type", "world", "aesthetic", "element", "mood"];

/** 外部评分统一换算到 10 分制，仅用于筛选，不做跨源平均 */
export function ratingOnTen(m: MediaCard): number | null {
  const pref = m.ratings.find((r) => r.source === "IMDb") ?? m.ratings[0];
  if (!pref) return null;
  return Math.round((pref.rating_value / pref.rating_scale) * 10 * 10) / 10;
}

export interface ScorableMovie extends MediaCard {
  synopsis?: string;
  recommendation?: string;
  audienceFit?: string;
}

/**
 * 编辑推荐度（0–100）：
 * 不是"网站评分"，而是编辑视角的权重 —— 标签完整度 + 是否入选编辑片单 + 外部评分的参考加分。
 * 页面必须如实说明这一点，避免伪装成客观评分。
 */
export function editorialScore(m: ScorableMovie): number {
  let score = 0;
  // 标签密度（编辑劳动的直接体现）
  score += Math.min(24, m.tags.element.length * 4 + m.tags.aesthetic.length * 4 + m.tags.mood.length * 2);
  if (m.tags.type.length > 0) score += 6;
  // 词条完整度
  if ((m.synopsis ?? "").length >= 80) score += 6;
  if ((m.recommendation ?? "").length >= 40) score += 6;
  if (m.audienceFit) score += 4;
  if (m.provenance?.enrichment?.reviewStatus === "matched") score += 10;
  // 编辑片单入选
  const inLists = m.slug === undefined ? 0 : EDITORIAL_LISTS.filter((l) => {
    try {
      return l.pick([m]).some((x) => x.id === m.id);
    } catch {
      return false;
    }
  }).length;
  score += Math.min(18, inLists * 6);
  // 外部评分只做参考加分，不做主排序依据
  const r = ratingOnTen(m);
  if (r !== null) score += Math.min(20, Math.max(0, (r - 5) * 2.5));
  return Math.round(Math.min(100, score));
}

export function matchesQuery(m: MediaCard, q: string): boolean {
  if (!q.trim()) return true;
  const needle = q.trim().toLowerCase();
  const haystack = [
    m.chineseTitle,
    m.originalTitle,
    String(m.releaseYear),
    m.franchiseName ?? "",
    ...(m.directors ?? []),
    ...(m.cast ?? []),
    ...TAG_BUCKETS.flatMap((b) => m.tags[b]),
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(needle);
}

const andTagMatch = (movieTags: string[], selected: string[]) =>
  selected.every((s) => movieTags.includes(s));

export function applyFilters(
  movies: MediaCard[],
  f: FilterState,
  lib?: LibraryState,
  moodMatcher?: (m: MediaCard) => boolean,
  categoryMatcher?: (m: MediaCard) => boolean,
): MediaCard[] {
  const favorites = new Set(lib?.favorites ?? []);
  const watched = new Set(lib?.watched ?? []);

  let out = movies.filter((m) => {
    if (!matchesQuery(m, f.q)) return false;
    // 同一类标签之间是"或"，不同类之间是"与"：选多个类型时要能同时看到它们的全部结果
    if (f.type.length && !f.type.some((t) => m.tags.type.includes(t))) return false;
    if (f.world.length && !f.world.some((t) => m.tags.world.includes(t))) return false;
    if (f.aesthetic.length && !f.aesthetic.some((t) => m.tags.aesthetic.includes(t))) return false;
    if (f.element.length && !f.element.some((t) => m.tags.element.includes(t))) return false;
    if (f.mood.length && !f.mood.some((t) => m.tags.mood.includes(t))) return false;

    if (f.media !== "all") {
      if (f.media === "movie" && m.mediaType !== "movie") return false;
      if (f.media === "series" && m.mediaType === "movie") return false;
    }
    if (f.format !== "all" && m.format !== f.format) return false;

    if (f.yearFrom !== null && m.releaseYear < f.yearFrom) return false;
    if (f.yearTo !== null && m.releaseYear > f.yearTo) return false;

    if (f.country.length && !f.country.some((c) => m.country.includes(c))) return false;

    if (f.franchise === "series" && !m.franchise) return false;
    if (f.franchise === "standalone" && m.franchise) return false;

    if (f.ratingMin !== null || f.ratingMax !== null) {
      const r = ratingOnTen(m);
      if (r === null) return false;
      if (f.ratingMin !== null && r < f.ratingMin) return false;
      if (f.ratingMax !== null && r > f.ratingMax) return false;
    }

    if (f.library === "watched" && !watched.has(m.id)) return false;
    if (f.library === "unwatched" && watched.has(m.id)) return false;
    if (f.library === "favorite" && !favorites.has(m.id)) return false;

    if (f.moodEntry && moodMatcher && !moodMatcher(m)) return false;
    if (f.category && categoryMatcher && !categoryMatcher(m)) return false;

    return true;
  });

  out = out.slice().sort(sortComparator(f.sort));
  return out;
}

function sortComparator(sort: SortKey) {
  switch (sort) {
    case "year_desc":
      return (a: MediaCard, b: MediaCard) => b.releaseYear - a.releaseYear;
    case "year_asc":
      return (a: MediaCard, b: MediaCard) => a.releaseYear - b.releaseYear;
    case "title":
      return (a: MediaCard, b: MediaCard) => a.chineseTitle.localeCompare(b.chineseTitle, "zh-Hans-CN");
    case "rating":
      return (a: MediaCard, b: MediaCard) => (ratingOnTen(b) ?? -1) - (ratingOnTen(a) ?? -1);
    case "recommendation":
    default:
      return (a: MediaCard, b: MediaCard) => editorialScore(b) - editorialScore(a);
  }
}

/** 当前筛选条件的可读摘要 —— 用于结果页顶部 */
export function describeFilters(f: FilterState): { label: string; kind: string }[] {
  const out: { label: string; kind: string }[] = [];
  if (f.q) out.push({ label: `搜索「${f.q}」`, kind: "q" });
  if (f.type.length) out.push({ label: `类型：${f.type.join(" / ")}`, kind: "type" });
  if (f.world.length) out.push({ label: `世界观：${f.world.join(" / ")}`, kind: "world" });
  if (f.aesthetic.length) out.push({ label: `美学：${f.aesthetic.join(" / ")}`, kind: "aesthetic" });
  if (f.element.length) out.push({ label: `元素：${f.element.join(" / ")}`, kind: "element" });
  if (f.mood.length) out.push({ label: `氛围：${f.mood.join(" / ")}`, kind: "mood" });
  if (f.media !== "all") out.push({ label: f.media === "movie" ? "只看电影" : "只看剧集", kind: "media" });
  if (f.format !== "all") out.push({ label: f.format === "animation" ? "只看动画" : "只看真人", kind: "format" });
  if (f.yearFrom !== null || f.yearTo !== null)
    out.push({ label: `年份：${f.yearFrom ?? "不限"} – ${f.yearTo ?? "不限"}`, kind: "year" });
  if (f.country.length) out.push({ label: `地区：${f.country.join(" / ")}`, kind: "country" });
  if (f.franchise !== "all") out.push({ label: f.franchise === "series" ? "系列作品" : "独立作品", kind: "franchise" });
  if (f.ratingMin !== null || f.ratingMax !== null)
    out.push({ label: `外部评分：${f.ratingMin ?? "不限"} – ${f.ratingMax ?? "不限"}`, kind: "rating" });
  if (f.library !== "all") {
    const map = { watched: "只看已看", unwatched: "只看未看", favorite: "只看收藏" } as const;
    out.push({ label: map[f.library], kind: "library" });
  }
  return out;
}

/** URL 序列化：可分享、可刷新保持状态 */
export function filtersToQuery(f: FilterState): string {
  const p = new URLSearchParams();
  if (f.q) p.set("q", f.q);
  for (const b of TAG_BUCKETS) {
    const v = f[b];
    if (Array.isArray(v) && v.length) p.set(b, v.join(","));
  }
  if (f.media !== "all") p.set("media", f.media);
  if (f.format !== "all") p.set("format", f.format);
  if (f.yearFrom !== null) p.set("from", String(f.yearFrom));
  if (f.yearTo !== null) p.set("to", String(f.yearTo));
  if (f.country.length) p.set("country", f.country.join(","));
  if (f.franchise !== "all") p.set("franchise", f.franchise);
  if (f.ratingMin !== null) p.set("rmin", String(f.ratingMin));
  if (f.ratingMax !== null) p.set("rmax", String(f.ratingMax));
  if (f.library !== "all") p.set("library", f.library);
  if (f.moodEntry) p.set("mood", f.moodEntry);
  if (f.category) p.set("category", f.category);
  if (f.sort !== "recommendation") p.set("sort", f.sort);
  return p.toString();
}

export function filtersFromQuery(params: URLSearchParams): FilterState {
  const list = (k: string) => {
    const v = params.get(k);
    return v ? v.split(",").map((s) => s.trim()).filter(Boolean) : [];
  };
  const num = (k: string) => {
    const v = params.get(k);
    if (v === null || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  const one = <T extends string>(k: string, allowed: readonly T[], fallback: T): T => {
    const v = params.get(k) as T | null;
    return v && allowed.includes(v) ? v : fallback;
  };
  return {
    q: params.get("q") ?? "",
    type: list("type"),
    world: list("world"),
    aesthetic: list("aesthetic"),
    element: list("element"),
    mood: list("mood"),
    media: one("media", ["all", "movie", "series"] as const, "all"),
    format: one("format", ["all", "live_action", "animation"] as const, "all"),
    yearFrom: num("from"),
    yearTo: num("to"),
    country: list("country"),
    franchise: one("franchise", ["all", "series", "standalone"] as const, "all"),
    ratingMin: num("rmin"),
    ratingMax: num("rmax"),
    library: one("library", ["all", "watched", "unwatched", "favorite"] as const, "all"),
    moodEntry: params.get("mood"),
    category: params.get("category"),
    sort: one("sort", ["recommendation", "year_desc", "year_asc", "title", "rating"] as const, "recommendation"),
  };
}

export function activeFilterCount(f: FilterState): number {
  return describeFilters(f).length;
}

export const TAG_MATCH_ALL = andTagMatch;

/** 把完整 Movie 投影成客户端需要的轻量结构 */
export function toMediaCard(m: MediaCard): MediaCard {
  return {
    id: m.id,
    slug: m.slug,
    chineseTitle: m.chineseTitle,
    originalTitle: m.originalTitle,
    releaseYear: m.releaseYear,
    mediaType: m.mediaType,
    format: m.format,
    franchise: m.franchise,
    franchiseName: m.franchiseName,
    seriesOrder: m.seriesOrder,
    country: m.country,
    tags: m.tags,
    tagConfidence: m.tagConfidence,
    ratings: m.ratings,
    poster: m.poster ?? null,
    backdrop: m.backdrop ?? null,
    provenance: m.provenance
      ? {
          needsReview: m.provenance.needsReview,
          reviewReasons: m.provenance.reviewReasons,
          enrichment: m.provenance.enrichment
            ? { reviewStatus: m.provenance.enrichment.reviewStatus }
            : null,
        }
      : undefined,
  };
}
