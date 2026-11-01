import type { Movie } from "./types";

/**
 * 相似作品：纯标签重合度，逻辑可复核。
 * 权重：美学 2 + 世界观 2 + 元素 1 + 氛围 1（元素/氛围本身噪音更大，因此权重更低）。
 * 至少要跨两个维度重合才算"相似"，避免只因为都是"宏大"就凑在一起。
 */
export interface SimilarHit {
  movie: Movie;
  score: number;
  shared: { bucket: string; tags: string[] }[];
}

const WEIGHTS: Record<"aesthetic" | "world" | "element" | "mood", number> = {
  aesthetic: 2,
  world: 2,
  element: 1,
  mood: 1,
};

export function similarMovies(target: Movie, all: Movie[], limit = 6): SimilarHit[] {
  const hits: SimilarHit[] = [];
  for (const m of all) {
    if (m.id === target.id) continue;
    const shared: SimilarHit["shared"] = [];
    let score = 0;
    let buckets = 0;
    for (const bucket of ["aesthetic", "world", "element", "mood"] as const) {
      const tags = m.tags[bucket].filter((t) => target.tags[bucket].includes(t));
      if (tags.length) {
        shared.push({ bucket, tags });
        score += WEIGHTS[bucket] * tags.length;
        buckets += 1;
      }
    }
    if (buckets < 2 || score < 4) continue;
    // 同系列不再是"相似"，是"同系列"，别混在一起
    if (target.franchise && m.franchise === target.franchise) continue;
    hits.push({ movie: m, score, shared });
  }
  return hits.sort((a, b) => b.score - a.score).slice(0, limit);
}
