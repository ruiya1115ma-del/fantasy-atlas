/**
 * 六个「叙事主题」——与五个视觉风格分类（lib/curation.ts 的 CATEGORIES）并行，互不替代。
 *
 * 归类规则：每部作品**只能归入一个主题**，按最突出的核心特征判定；
 * 六个都不像的作品不收录。具体归类见 lib/theme-assignments.ts（人工逐部判定）。
 */

import { THEME_BY_ID } from "./theme-assignments";

export type MotifSlug =
  | "time-rift"
  | "magic-world"
  | "strange-everyday"
  | "fantasy-creatures"
  | "dark-fairytale"
  | "epic-quest";

export interface Motif {
  slug: MotifSlug;
  zh: string;
  en: string;
  /** 首页卡片上的一行小字（一句话说明这是什么主题） */
  hint: string;
  /** 主题详情页的一句注解 */
  description: string;
  /** 卡片标题与光晕用的暗金色系 */
  ink: string;
}

export const MOTIFS: Motif[] = [
  {
    slug: "time-rift",
    zh: "时空裂隙",
    en: "Time Rift",
    ink: "#a9c0e0",
    hint: "时间折了一道缝",
    description: "时间穿越、时间循环、平行世界与时空错位 —— 故事的动力来自「时间」本身。",
  },
  {
    slug: "magic-world",
    zh: "魔法世界",
    en: "Magic World",
    ink: "#e8d5a8",
    hint: "巫师与成体系的魔法",
    description: "巫师、魔法学校、咒语与成体系的魔法力量 —— 世界按魔法的规则运转。",
  },
  {
    slug: "strange-everyday",
    zh: "怪奇日常",
    en: "Strange Everyday",
    ink: "#cfd0e8",
    hint: "怪事就发生在隔壁",
    description: "哥特与怪诞的人物、超自然现象混进日常生活 —— 诡异从客厅与学校后排长出来。",
  },
  {
    slug: "fantasy-creatures",
    zh: "奇幻生物",
    en: "Fantasy Creatures",
    ink: "#c8e2d4",
    hint: "异兽才是真正的主角",
    description: "龙、精灵、妖怪、异兽或非人生命是故事的核心角色，情节围绕它们展开。",
  },
  {
    slug: "dark-fairytale",
    zh: "暗黑童话",
    en: "Dark Fairy Tale",
    ink: "#d9a8bd",
    hint: "睡前故事的另一面",
    description: "以童话原型为骨架，却用黑暗、诡谲、惊悚或成人的方式重新讲述。",
  },
  {
    slug: "epic-quest",
    zh: "史诗远征",
    en: "Epic Quest",
    ink: "#e2c87f",
    hint: "出发，去很远的地方",
    description: "远征、寻找、拯救、征服 —— 一条明确的长途旅程撑起整个世界。",
  },
];

export const MOTIF_BY_SLUG: Record<string, Motif> = Object.fromEntries(MOTIFS.map((m) => [m.slug, m]));

export interface MotifSubject {
  id?: string;
}

/** 每部作品最多一个主题；未列入人工归类表的作品不归入任何主题 */
export function classifyMovie(movie: MotifSubject): MotifSlug | null {
  if (!movie.id) return null;
  return THEME_BY_ID.get(movie.id) ?? null;
}

export function matchesMotif(movie: MotifSubject, motif: Motif): boolean {
  return classifyMovie(movie) === motif.slug;
}

/** 一部作品命中的主题（0 或 1 个） */
export function motifsOf(movie: MotifSubject): Motif[] {
  const slug = classifyMovie(movie);
  return slug ? [MOTIF_BY_SLUG[slug]] : [];
}
