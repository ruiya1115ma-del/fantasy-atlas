import type { Movie } from "./types";

/**
 * 探索页顶部轮播的「本轮推荐」抽取逻辑。
 *
 * 目标（每次进入 / 刷新都会重新抽取，不再固定）：
 * 1. 从完整电影库抽取，不用任何固定候选列表；
 * 2. 同一部作品只出现一次；
 * 3. 同一系列最多出现一部（系列内随机选一部）；
 * 4. 尽量分散类型、年代与世界观，避免推荐结果扎堆在同一年代或同一题材。
 *
 * 算法：先按系列分组并打乱，再逐轮做「贪心 + 随机」——
 * 每一轮只从「能带来最多新维度」的系列里挑一个，从而保证前后差异最大化。
 */

export interface HeroPickOptions {
  /** 需要几部，默认 10 */
  count?: number;
  /** 注入随机源，便于测试；默认 Math.random */
  rng?: () => number;
}

/** 系列键：有 franchise 用 franchise，单片用自身 id（每部单片独占一组） */
export function franchiseKeyOf(movie: Movie): string {
  return movie.franchise ? `franchise:${movie.franchise}` : `solo:${movie.id}`;
}

function shuffle<T>(items: T[], rng: () => number): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function decadeOf(year: number): string {
  return `${Math.floor(year / 10) * 10}s`;
}

/** 一部作品能代表的几个「维度」，用于衡量推荐结果的分散程度 */
function dimensionsOf(movie: Movie): string[] {
  return [
    `type:${movie.tags.type[0] ?? "unknown"}`,
    `world:${movie.tags.world[0] ?? "unknown"}`,
    `aesthetic:${movie.tags.aesthetic[0] ?? "unknown"}`,
    `decade:${decadeOf(movie.releaseYear)}`,
    `format:${movie.format}`,
  ];
}

/**
 * 从完整电影库中抽取本轮推荐作品。
 * 只排除「没有任何海报、无法正常展示」的条目，其余全部参与。
 */
export function pickHeroMovies(movies: Movie[], options: HeroPickOptions = {}): Movie[] {
  const { count = 10, rng = Math.random } = options;
  const candidates = movies.filter((m) => Boolean(m.slug && m.poster?.src));
  if (candidates.length === 0) return [];

  // 1. 按系列分组；组内先打乱，保证「系列内随机」
  const groups = new Map<string, Movie[]>();
  for (const movie of candidates) {
    const key = franchiseKeyOf(movie);
    const bucket = groups.get(key);
    if (bucket) bucket.push(movie);
    else groups.set(key, [movie]);
  }

  const available = shuffle(
    [...groups.entries()].map(([key, members]) => ({ key, members: shuffle(members, rng) })),
    rng,
  );

  // 2. 逐轮挑「能带来最多新维度」的系列
  const picked: Movie[] = [];
  const seenDimensions = new Set<string>();
  const usedSeries = new Set<string>();

  while (picked.length < count && available.length > 0) {
    let bestScore = -1;
    const bestIndexes: number[] = [];

    for (let i = 0; i < available.length; i += 1) {
      const group = available[i];
      if (usedSeries.has(group.key)) continue;
      const movie = group.members[0];
      const fresh = new Set(dimensionsOf(movie).filter((d) => !seenDimensions.has(d)));
      const score = fresh.size;
      if (score > bestScore) {
        bestScore = score;
        bestIndexes.length = 0;
        bestIndexes.push(i);
      } else if (score === bestScore) {
        bestIndexes.push(i);
      }
    }

    if (bestIndexes.length === 0) break;

    // 同分时随机挑一个，避免每次都是同一批代表作
    const chosenIndex = bestIndexes[Math.floor(rng() * bestIndexes.length)];
    const chosen = available[chosenIndex];

    usedSeries.add(chosen.key);
    const movie = chosen.members[0];
    picked.push(movie);
    for (const dim of dimensionsOf(movie)) seenDimensions.add(dim);

    // 同一系列不再参与后续挑选
    available.splice(chosenIndex, 1);
  }

  return picked;
}

/** 用于测试与调试：返回每个系列键下有多少部作品 */
export function seriesCounts(movies: Movie[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const movie of movies) {
    const key = franchiseKeyOf(movie);
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return map;
}
