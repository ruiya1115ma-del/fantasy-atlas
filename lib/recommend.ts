import type {
  LibraryState,
  Movie,
  ReasonPart,
  RecommendationHit,
  TagBucket,
  UserPreferences,
} from "./types";
import { editorialScore, ratingOnTen } from "./filter";
import { tagLabel } from "./vocabulary";

/**
 * 可解释推荐引擎。
 *
 * 设计原则（写进文档、也写在推荐页上）：
 * 1. 只做标签维度的加权匹配，不用外部评分当主排序 —— 评分只做极小的同分参考。
 * 2. 每一条推荐都必须能说出「为什么」和「哪里不一样」，且理由与权重可核算。
 * 3. 用户可以在页面上改权重，结果随之变化 —— 不是黑箱。
 */

export const DEFAULT_WEIGHTS: UserPreferences["weights"] = {
  type: 1,
  world: 3,
  aesthetic: 3,
  element: 2,
  mood: 2,
  similar: 2,
};

export const DEFAULT_PREFERENCES: UserPreferences = {
  likedMovieIds: [],
  dislikedMovieIds: [],
  likedTags: { type: [], world: [], aesthetic: [], element: [], mood: [], exclude: [] },
  avoidTags: [],
  excludeWatched: false,
  excludeFavorite: false,
  weights: DEFAULT_WEIGHTS,
  avoidMode: "penalize",
  updatedAt: new Date(0).toISOString(),
};

type WeightBucket = Exclude<TagBucket, "exclude">;
const TAG_WEIGHT_BUCKETS: WeightBucket[] = ["type", "world", "aesthetic", "element", "mood"];

function bucketOf(tag: string, m: Movie): TagBucket | null {
  for (const b of TAG_WEIGHT_BUCKETS) if (m.tags[b].includes(tag)) return b;
  return null;
}

export interface RecommendationResult {
  hits: RecommendationHit[];
  /** 因为偏好为空而没有结果时的提示 */
  empty: "no-preference" | "no-catalog" | "filtered-out" | null;
  /** 有多少作品被硬过滤 */
  filteredCount: number;
  totalConsidered: number;
}

export function recommend(
  movies: Movie[],
  prefs: UserPreferences,
  lib?: LibraryState,
  limit = 12,
): RecommendationResult {
  const likedTagsByBucket = new Map<WeightBucket, string[]>();
  for (const b of TAG_WEIGHT_BUCKETS) {
    const tags = prefs.likedTags[b] ?? [];
    if (tags.length) likedTagsByBucket.set(b, tags);
  }
  const hasTagPrefs = likedTagsByBucket.size > 0;
  const liked = new Set(prefs.likedMovieIds);
  const disliked = new Set(prefs.dislikedMovieIds);
  const validLiked = movies.filter((m) => liked.has(m.id));

  if (movies.length === 0) return { hits: [], empty: "no-catalog", filteredCount: 0, totalConsidered: 0 };
  if (!hasTagPrefs && validLiked.length === 0)
    return { hits: [], empty: "no-preference", filteredCount: 0, totalConsidered: movies.length };

  const watched = new Set(lib?.watched ?? []);
  const favorites = new Set(lib?.favorites ?? []);
  const avoid = new Set(prefs.avoidTags);

  let filteredCount = 0;
  const candidates = movies.filter((m) => {
    if (liked.has(m.id)) return false;
    if (disliked.has(m.id)) return false;
    if (prefs.excludeWatched && watched.has(m.id)) return false;
    if (prefs.excludeFavorite && favorites.has(m.id)) return false;
    if (prefs.avoidMode === "filter" && m.tags.exclude.some((t) => avoid.has(t))) return false;
    return true;
  });
  filteredCount = movies.length - candidates.length;

  const maxPoints = computeMaxPoints(prefs, validLiked.length);

  const hits: RecommendationHit[] = [];
  for (const m of candidates) {
    const reasons: ReasonPart[] = [];
    const matchedTags: RecommendationHit["matchedTags"] = [];
    const caution: string[] = [];
    let points = 0;

    for (const [bucket, tags] of likedTagsByBucket) {
      const hit = tokens(m, bucket).filter((t) => tags.includes(t));
      if (hit.length) {
        const weight = prefs.weights[bucket] ?? 0;
        const gained = weight * hit.length;
        points += gained;
        for (const t of hit) matchedTags.push({ tag: t, category: bucket, weight });
        reasons.push({
          kind: "tag",
          text: `${labelOf(bucket)}相近：${hit.map(tagLabel).join("、")}`,
          weight,
        });
      }
    }
    // 用户明确不喜欢的作品，若标签仍高度重合，只降权不消失 —— 保留但不推上去
    for (const d of movies.filter((x) => disliked.has(x.id))) {
      const shared = TAG_WEIGHT_BUCKETS.flatMap((b) => m.tags[b].filter((t) => d.tags[b].includes(t)));
      if (shared.length >= 3) {
        reasons.push({
          kind: "penalty",
          text: `与你明确排斥的《${d.chineseTitle}》有 ${shared.length} 个标签重合`,
          weight: -1,
        });
        points -= 1;
      }
    }

    // 相似作品
    const similarTo: RecommendationHit["similarTo"] = [];
    for (const ref of validLiked) {
      const sharedByBucket = TAG_WEIGHT_BUCKETS.map((b) => ({
        b,
        shared: m.tags[b].filter((t) => ref.tags[b].includes(t)),
      })).filter((x) => x.shared.length > 0);
      if (sharedByBucket.length === 0) continue;
      const sharedCount = sharedByBucket.reduce((n, x) => n + x.shared.length, 0);
      // 跨维度重合才算"像"：只在单一维度重合很容易误导
      if (sharedByBucket.length < 2 && sharedCount < 3) continue;
      const gained = prefs.weights.similar * Math.min(3, sharedCount);
      points += gained;
      similarTo.push({
        id: ref.id,
        title: ref.chineseTitle,
        sharedTags: sharedByBucket.flatMap((x) => x.shared),
      });
      reasons.push({
        kind: "similar",
        text: `和《${ref.chineseTitle}》共享 ${sharedCount} 个标签`,
        weight: prefs.weights.similar,
      });
    }

    // 同系列加成（很弱，只是排序微调）
    const inLikedFranchise = validLiked.some((r) => m.franchise && r.franchise === m.franchise);
    if (inLikedFranchise && m.franchiseName) {
      reasons.push({ kind: "series", text: `与你喜欢的作品同属「${m.franchiseName}」系列`, weight: 1 });
      points += 1;
    }

    // 避开标签（默认降权而非过滤，保留透明度）
    const avoidedHit = m.tags.exclude.filter((t) => avoid.has(t));
    if (avoidedHit.length && prefs.avoidMode === "penalize") {
      points -= 2 * avoidedHit.length;
      caution.push(`含有你想避开的：${avoidedHit.map(tagLabel).join("、")}`);
    }

    if (points <= 0) continue;

    // 外部评分只做 ±1 的极小同分参考
    const r = ratingOnTen(m);
    if (r !== null) {
      points += (r - 7) * 0.2;
      if (r >= 7.5 && matchedTags.length > 0) {
        reasons.push({ kind: "rating", text: `外部评分 ${r.toFixed(1)}/10（仅作参考，不参与主排序）`, weight: 0.2 });
      }
    }

    const strength = maxPoints > 0 ? Math.round((points / maxPoints) * 100) : 0;
    hits.push({
      movie: m,
      score: Math.round(points * 100) / 100,
      strength: Math.max(0, Math.min(100, strength)),
      reasons,
      matchedTags,
      similarTo,
      caution: buildCaution(m, prefs, caution),
    });
  }

  hits.sort((a, b) => b.score - a.score || editorialScore(b.movie) - editorialScore(a.movie));

  const result = hits.slice(0, limit);
  return {
    hits: result,
    empty: result.length === 0 ? "filtered-out" : null,
    filteredCount,
    totalConsidered: candidates.length,
  };
}

function tokens(m: Movie, bucket: TagBucket): string[] {
  return m.tags[bucket] ?? [];
}

function labelOf(bucket: TagBucket): string {
  switch (bucket) {
    case "world":
      return "世界观";
    case "aesthetic":
      return "美学";
    case "element":
      return "元素";
    case "mood":
      return "氛围";
    default:
      return "类型";
  }
}

function computeMaxPoints(prefs: UserPreferences, likedCount: number): number {
  let max = 0;
  for (const b of TAG_WEIGHT_BUCKETS) {
    const n = (prefs.likedTags[b] ?? []).length;
    if (n) max += (prefs.weights[b] ?? 0) * n;
  }
  if (likedCount > 0) max += prefs.weights.similar * Math.min(3, 6) + 1;
  return max;
}

/** 差异提示：候选身上有、而用户的偏好里没有的东西 —— 让人看到"不一样在哪" */
function buildCaution(m: Movie, prefs: UserPreferences, extra: string[]): string[] {
  const out = [...extra];
  const wanted = new Set(TAG_WEIGHT_BUCKETS.flatMap((b) => prefs.likedTags[b] ?? []));
  const missing = m.tags.element.filter((t) => !wanted.has(t));
  if (missing.length >= 3) out.push(`元素比你选的更杂：多了${missing.slice(0, 3).map(tagLabel).join("、")}`);
  if (m.tagConfidence === "low") out.push("标签置信度较低，建议人工复核");
  if (m.provenance.needsReview && m.provenance.reviewReasons.length)
    out.push(`待核对：${m.provenance.reviewReasons[0]}`);
  return out;
}

/** 偏好摘要：推荐页顶部要展示"你在按什么找" */
export function summarizePreferences(prefs: UserPreferences, movies: Movie[]): string[] {
  const out: string[] = [];
  for (const b of TAG_WEIGHT_BUCKETS) {
    const tags = prefs.likedTags[b] ?? [];
    if (tags.length) out.push(`${labelOf(b)}：${tags.map(tagLabel).join("、")}`);
  }
  const liked = movies.filter((m) => prefs.likedMovieIds.includes(m.id));
  if (liked.length) out.push(`喜欢的作品：${liked.map((m) => `《${m.chineseTitle}》`).join("、")}`);
  if (prefs.avoidTags.length) out.push(`避开：${prefs.avoidTags.map(tagLabel).join("、")}`);
  return out;
}

export { bucketOf };
