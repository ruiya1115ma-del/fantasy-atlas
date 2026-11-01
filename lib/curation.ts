import type { MediaCard, Movie, TagMatchSubject } from "./types";

/**
 * 编辑层：分类、氛围入口、专题片单。
 * 全部是"规则 + 人工撰写的说明文字"，不写死电影列表，
 * 这样新增作品后分类与专题会自动纳入新内容，而文案始终由人写。
 */

export interface ArtPalette {
  /** 32 位色，用于程序化视觉生成 */
  from: string;
  via: string;
  to: string;
  ink: string;
}

export interface Category {
  slug: string;
  en: string;
  zh: string;
  tagline: string;
  description: string;
  /** 代表标签：详情页会显式列出 */
  signatureTags: string[];
  palette: ArtPalette;
  motif: "arch" | "spire" | "peak" | "moon" | "bloom";
  match: (m: TagMatchSubject) => boolean;
}

const has = (m: TagMatchSubject, bucket: keyof MediaCard["tags"], ids: string[]) =>
  m.tags[bucket].some((t) => ids.includes(t));

export const CATEGORIES: Category[] = [
  {
    slug: "enchanted-worlds",
    en: "Enchanted Worlds",
    zh: "魔法世界",
    tagline: "这里有另一套物理法则",
    description:
      "魔法不是道具，而是这些世界运转的方式。学院、咒语、会移动的楼梯，以及一套完整到可以住进去的社会规则。",
    signatureTags: ["魔法学院", "魔法社会", "魔法学院美学", "魔法师", "女巫"],
    palette: { from: "#101c33", via: "#1d2b46", to: "#0a1a14", ink: "#e2c87f" },
    motif: "arch",
    match: (m) =>
      has(m, "world", ["魔法学院", "魔法社会"]) ||
      has(m, "aesthetic", ["魔法学院美学"]) ||
      (has(m, "element", ["魔法师", "女巫"]) && m.tagConfidence !== "low"),
  },
  {
    slug: "dark-gothic",
    en: "Dark & Gothic",
    zh: "暗黑与哥特",
    tagline: "恐惧也可以是一种审美",
    description:
      "尖顶、雾、衰败的贵族与不被允许的爱。黑暗在这里不是缺点，而是画面和情绪的主要材质。",
    signatureTags: ["哥特建筑", "暗黑童话", "黑暗浪漫", "阴森", "吸血鬼"],
    palette: { from: "#1a0f1c", via: "#2c1226", to: "#0a0810", ink: "#d9a8bf" },
    motif: "spire",
    match: (m) =>
      has(m, "type", ["Dark Fantasy", "Gothic Fantasy"]) ||
      has(m, "aesthetic", ["哥特建筑", "暗黑童话", "黑暗浪漫"]) ||
      has(m, "mood", ["阴森", "黑暗", "诡异"]),
  },
  {
    slug: "epic-fantasy",
    en: "Epic Fantasy",
    zh: "史诗奇幻",
    tagline: "命运比个人更大",
    description:
      "从雪山到战场，从王座到巨龙。这类作品的尺度感来自世界本身的分量：一个时代在你眼前开始和结束。",
    signatureTags: ["Epic Fantasy", "宏大", "史诗感", "巨龙", "古代王国"],
    palette: { from: "#0d1a12", via: "#20321d", to: "#0a0c0a", ink: "#e0c87e" },
    motif: "peak",
    match: (m) =>
      has(m, "type", ["Epic Fantasy", "Mythological Fantasy"]) ||
      has(m, "mood", ["宏大", "史诗感"]) ||
      has(m, "element", ["巨龙", "神祇"]) ||
      has(m, "world", ["古代王国", "神话世界"]),
  },
  {
    slug: "surreal-dreams",
    en: "Surreal Dreams",
    zh: "超现实梦境",
    tagline: "逻辑失效，但画面成立",
    description:
      "梦有自己的因果。这里的空间会折叠、时间会循环，而你在其中却觉得比现实更清醒。",
    signatureTags: ["Surreal Fantasy", "超现实主义", "梦境世界", "迷离"],
    palette: { from: "#0e1424", via: "#2a2340", to: "#071018", ink: "#b9c6e6" },
    motif: "moon",
    match: (m) =>
      has(m, "type", ["Surreal Fantasy"]) ||
      has(m, "world", ["梦境世界", "平行世界", "末世幻想"]) ||
      has(m, "aesthetic", ["超现实主义"]) ||
      has(m, "mood", ["迷离", "荒诞"]),
  },
  {
    slug: "whimsical-tales",
    en: "Whimsical Tales",
    zh: "奇趣童话",
    tagline: "漂亮的东西里藏着一点尖",
    description:
      "童话的壳，成人的核。它们看上去可以给孩子看，但真正被打动的往往是长大后的人。",
    signatureTags: ["Fairy Tale", "Fantasy Animation", "怪诞美学", "童话王国", "怀旧"],
    palette: { from: "#141326", via: "#2b2340", to: "#101a24", ink: "#e8d5a8" },
    motif: "bloom",
    match: (m) =>
      has(m, "type", ["Fairy Tale", "Fantasy Animation"]) ||
      has(m, "world", ["童话王国"]) ||
      has(m, "aesthetic", ["怪诞美学"]) ||
      has(m, "mood", ["荒诞", "怀旧", "治愈"]),
  },
];

export const CATEGORY_BY_SLUG: Record<string, Category> = Object.fromEntries(
  CATEGORIES.map((c) => [c.slug, c]),
);

/** 首页「按感觉寻找电影」入口 */
export interface MoodEntry {
  slug: string;
  title: string;
  en: string;
  subtitle: string;
  /** 进入探索页时预置的标签筛选需求 */
  preset: {
    tags: string[];
    /** 至少命中几个标签才入选 */
    minMatch?: number;
  };
  palette: ArtPalette;
  motif: "arch" | "spire" | "peak" | "moon" | "bloom";
  match: (m: TagMatchSubject) => boolean;
}

export const MOODS: MoodEntry[] = [
  {
    slug: "escape",
    title: "想逃离现实",
    en: "Escape",
    subtitle: "让两小时属于另一个世界",
    preset: { tags: ["异世界冒险", "平行世界", "梦幻唯美"], minMatch: 1 },
    palette: { from: "#101c33", via: "#243a5c", to: "#0a1424", ink: "#cfd9ee" },
    motif: "moon",
    match: (m) =>
      has(m, "world", ["异世界冒险", "平行世界", "梦境世界"]) ||
      has(m, "mood", ["宏大", "迷离"]),
  },
  {
    slug: "magic-academy",
    title: "想进入魔法学院",
    en: "Magic Academy",
    subtitle: "长袍、烛光、会动的画",
    preset: { tags: ["魔法学院", "魔法学院美学", "魔法师"], minMatch: 1 },
    palette: { from: "#101a2c", via: "#1b2f4d", to: "#0b1a14", ink: "#e2c87f" },
    motif: "arch",
    match: (m) => has(m, "world", ["魔法学院"]) || has(m, "aesthetic", ["魔法学院美学"]),
  },
  {
    slug: "dark-fairytale",
    title: "想探索黑暗童话",
    en: "Dark Fairy Tale",
    subtitle: "漂亮画面下藏着刀",
    preset: { tags: ["暗黑童话", "Dark Fantasy", "诡异"], minMatch: 1 },
    palette: { from: "#1b0f16", via: "#3a1226", to: "#0b0810", ink: "#e0a9b8" },
    motif: "bloom",
    match: (m) => has(m, "aesthetic", ["暗黑童话"]) || has(m, "type", ["Dark Fantasy"]),
  },
  {
    slug: "ethereal-otherworld",
    title: "想看唯美的异世界",
    en: "Ethereal Otherworld",
    subtitle: "密度极高的美，几乎不真实",
    preset: { tags: ["梦幻唯美", "东方幻想", "自然幻想"], minMatch: 1 },
    palette: { from: "#0f1c1a", via: "#1d3a34", to: "#0a1620", ink: "#c8e2d4" },
    motif: "bloom",
    match: (m) => has(m, "aesthetic", ["梦幻唯美", "东方幻想", "自然幻想"]),
  },
  {
    slug: "dragons-epic",
    title: "想看巨龙与史诗冒险",
    en: "Dragons & Epic",
    subtitle: "一个时代在你眼前结束",
    preset: { tags: ["史诗感", "宏大", "巨龙", "Epic Fantasy"], minMatch: 1 },
    palette: { from: "#141210", via: "#33291a", to: "#0a0c0a", ink: "#e5c98a" },
    motif: "peak",
    match: (m) => has(m, "element", ["巨龙", "神祇"]) || has(m, "mood", ["史诗感", "宏大"]),
  },
  {
    slug: "childhood-wonder",
    title: "想寻找童年奇幻感",
    en: "Childhood Wonder",
    subtitle: "被某种熟悉的光照到",
    preset: { tags: ["怀旧", "温暖", "童话王国", "治愈"], minMatch: 1 },
    palette: { from: "#141326", via: "#3a2f46", to: "#101a24", ink: "#f0dcb4" },
    motif: "bloom",
    match: (m) => has(m, "mood", ["怀旧", "温暖", "治愈"]) || has(m, "world", ["童话王国"]),
  },
  {
    slug: "grotesque-charm",
    title: "想看怪诞而迷人的世界",
    en: "Grotesque Charm",
    subtitle: "不适与迷人同时发生",
    preset: { tags: ["怪诞美学", "荒诞", "诡异", "超现实主义"], minMatch: 1 },
    palette: { from: "#12131c", via: "#2b2a3d", to: "#0a0b12", ink: "#dcd0e8" },
    motif: "spire",
    match: (m) => has(m, "aesthetic", ["怪诞美学", "超现实主义"]) || has(m, "mood", ["荒诞"]),
  },
  {
    slug: "gothic-aesthetic",
    title: "想沉浸在哥特美学中",
    en: "Gothic Immersion",
    subtitle: "尖顶、雾、衰败的贵族",
    preset: { tags: ["哥特建筑", "Gothic Fantasy", "黑暗浪漫", "阴森"], minMatch: 1 },
    palette: { from: "#171018", via: "#331a2c", to: "#090a10", ink: "#dfb9c9" },
    motif: "spire",
    match: (m) => has(m, "aesthetic", ["哥特建筑", "黑暗浪漫"]) || has(m, "type", ["Gothic Fantasy"]),
  },
];

export const MOOD_BY_SLUG: Record<string, MoodEntry> = Object.fromEntries(
  MOODS.map((m) => [m.slug, m]),
);

/** 编辑精选 —— 规则挑选 + 人工撰写的导语 */
export interface EditorialList {
  slug: string;
  title: string;
  en: string;
  intro: string;
  /** 挑选规则（只依赖标签/评分，因此用轻量结构即可） */
  pick: (movies: MediaCard[]) => MediaCard[];
  limit: number;
}

const externalRating = (m: MediaCard): number | null => {
  const r = m.ratings.find((x) => x.source === "IMDb") ?? m.ratings[0];
  return r ? (r.rating_value / r.rating_scale) * 10 : null;
};

export const EDITORIAL_LISTS: EditorialList[] = [
  {
    slug: "immersive",
    title: "值得沉浸其中的奇幻电影",
    en: "Made To Sink Into",
    intro:
      "有些奇幻片只提供设定，有些会让你真的住进去。这批作品共同的特点是：世界本身就值得看，剧情只是带路的线索。",
    limit: 8,
    pick: (movies) =>
      movies
        .filter((m) => m.tags.mood.includes("神秘") || m.tags.mood.includes("宏大") || m.tags.aesthetic.includes("梦幻唯美"))
        .sort((a, b) => (externalRating(b) ?? 0) - (externalRating(a) ?? 0)),
  },
  {
    slug: "magic-atmosphere",
    title: "最有魔法世界氛围的电影",
    en: "Pure Magical Atmosphere",
    intro:
      "魔法最迷人的时候不是放技能，而是你能感觉到这个世界有一套自己的规则在运转。以下是把这种规则感做得最扎实的一批。",
    limit: 8,
    pick: (movies) =>
      movies
        .filter((m) => m.tags.world.includes("魔法学院") || m.tags.world.includes("魔法社会") || m.tags.element.includes("魔法师"))
        .sort((a, b) => (externalRating(b) ?? 0) - (externalRating(a) ?? 0)),
  },
  {
    slug: "underrated",
    title: "被低估的奇幻电影",
    en: "Quietly Underrated",
    intro:
      "外部评分不是审美判决书。这批作品在公开评分里不算高，但各自有无法替代的画面或世界观，值得为它们多看一次。",
    limit: 8,
    pick: (movies) => {
      const withRating = movies.filter((m) => externalRating(m) !== null);
      return withRating
        .filter((m) => (externalRating(m) as number) < 71)
        .sort((a, b) => (externalRating(a) ?? 0) - (externalRating(b) ?? 0));
    },
  },
  {
    slug: "rewatchable",
    title: "适合反复重温的幻想世界",
    en: "Worth Returning To",
    intro:
      "第一遍看故事，第二遍开始看世界。这些作品的密度足够高，每次重看都能注意到新的细节。",
    limit: 8,
    pick: (movies) =>
      movies
        .slice()
        .sort(
          (a, b) =>
            b.tags.element.length +
            b.tags.aesthetic.length -
            (a.tags.element.length + a.tags.aesthetic.length),
        ),
  },
  {
    slug: "gothic-lovers",
    title: "哥特美学爱好者必看",
    en: "For Gothic Hearts",
    intro:
      "尖顶、雾、烛火与不被允许的爱。如果你喜欢的正是这种把危险拍得很美的方式，从这个片单开始。",
    limit: 8,
    pick: (movies) =>
      movies
        .filter(
          (m) =>
            m.tags.aesthetic.includes("哥特建筑") ||
            m.tags.type.includes("Gothic Fantasy") ||
            m.tags.aesthetic.includes("黑暗浪漫"),
        )
        .sort((a, b) => (externalRating(b) ?? 0) - (externalRating(a) ?? 0)),
  },
];

export const EDITORIAL_BY_SLUG: Record<string, EditorialList> = Object.fromEntries(
  EDITORIAL_LISTS.map((l) => [l.slug, l]),
);
