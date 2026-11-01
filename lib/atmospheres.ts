import type { MediaCard } from "@/lib/types";

/**
 * 「按氛围寻找」的六种情绪。
 * 每一种**只对应一个站内标签**，数量与筛选结果用同一条规则算出来，
 * 因此卡片上写的「N 部」点进去一定能在探索页复现同样的结果集。
 */
export type AtmosphereBuckets = "mood" | "aesthetic" | "world" | "type";

export interface Atmosphere {
  slug: string;
  zh: string;
  en: string;
  hint: string;
  bucket: AtmosphereBuckets;
  tag: string;
}

export const ATMOSPHERES: Atmosphere[] = [
  { slug: "healing", zh: "治愈", en: "Healing", hint: "看完想出门散一场步", bucket: "mood", tag: "治愈" },
  { slug: "romance", zh: "浪漫", en: "Romance", hint: "爱在最不可能的地方发生", bucket: "mood", tag: "浪漫" },
  { slug: "mystery", zh: "神秘", en: "Mystery", hint: "雾、预言，以及说不清来历的东西", bucket: "mood", tag: "神秘" },
  { slug: "eerie", zh: "诡谲", en: "Eerie", hint: "怪，但怪得让人移不开眼", bucket: "mood", tag: "诡异" },
  { slug: "dark", zh: "暗黑", en: "Dark", hint: "画面越美，代价往往越大", bucket: "mood", tag: "黑暗" },
  { slug: "adventure", zh: "冒险", en: "Adventure", hint: "世界永远比地图更大", bucket: "type", tag: "Fantasy Adventure" },
];

export function matchesAtmosphere(movie: MediaCard, a: Atmosphere): boolean {
  const list = (movie.tags as unknown as Record<string, string[]>)[a.bucket] ?? [];
  return list.includes(a.tag);
}

/** 与探索页筛选参数一致的链接 */
export function atmosphereHref(a: Atmosphere): string {
  const key = a.bucket === "type" ? "type" : a.bucket;
  return `/explore?${key}=${encodeURIComponent(a.tag)}`;
}
