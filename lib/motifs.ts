/**
 * 八个「叙事主题」——与五个视觉风格分类（lib/curation.ts 的 CATEGORIES）并行，互不替代。
 *
 * 判定只用两样东西：站内已存在的六类标签 + 作品简介里的关键词。
 * 不新增标签、不改写数据；一部电影可以同时命中多个主题（允许交叉）。
 * 数量由规则实时算出，页面上不写死任何数字。
 */

export type MotifMode = "or" | "and";

export interface Motif {
  slug: string;
  zh: string;
  en: string;
  tagline: string;
  description: string;
  /** 卡片标题与光晕用的暗金色系 */
  ink: string;
  tags: {
    world?: string[];
    aesthetic?: string[];
    element?: string[];
    mood?: string[];
    type?: string[];
  };
  /** 简介关键词 */
  keywords?: RegExp;
  /** or = 标签或关键词命中即可；and = 两者都要命中（用于收窄语义太泛的主题） */
  mode: MotifMode;
}

export const MOTIFS: Motif[] = [
  {
    slug: "time-rift",
    zh: "时空裂隙",
    en: "Time Rift",
    tagline: "时间在这里折了一道",
    description: "时间旅行、平行世界、时空穿越 —— 角色走进另一段时间线，也走进另一个版本的自己。",
    ink: "#a9c0e0",
    tags: { world: ["平行世界", "梦境世界"], type: ["Surreal Fantasy"] },
    keywords: /时间|时空|穿越|平行|循环|回到过去|时间线/,
    mode: "or",
  },
  {
    slug: "forbidden-pact",
    zh: "禁忌契约",
    en: "Forbidden Pact",
    tagline: "每一个愿望都有代价",
    description: "诅咒、魔法契约、灵魂交易 —— 你以为签下的是合约，交出去的却是更重要的东西。",
    ink: "#d9a8bd",
    tags: { aesthetic: ["黑暗浪漫", "暗黑童话"], element: ["超自然力量"] },
    keywords: /诅咒|契约|灵魂|交易|献祭|许愿|代价/,
    mode: "and",
  },
  {
    slug: "bestiary",
    zh: "异兽图鉴",
    en: "Bestiary",
    tagline: "它们一直都在，只是不常见",
    description: "龙、精灵、吸血鬼、奇异生物 —— 这一栏收的全是「非人类住户」。",
    ink: "#c8e2d4",
    tags: { element: ["巨龙", "精灵", "吸血鬼", "狼人", "妖怪", "神祇"] },
    mode: "or",
  },
  {
    slug: "lost-realm",
    zh: "失落秘境",
    en: "Lost Realm",
    tagline: "地图边缘之外的国度",
    description: "神秘岛屿、隐藏王国、地下世界 —— 那些必须被找到、或者被误入的地方。",
    ink: "#e2c87f",
    tags: { world: ["神话世界", "古代王国"] },
    keywords: /岛|秘境|地下|王国|遗迹|迷宫|隐藏|森林深处/,
    mode: "or",
  },
  {
    slug: "fate-shift",
    zh: "命运变形",
    en: "Fate Shift",
    tagline: "醒过来，已经不是原来的自己",
    description: "身份转换、奇妙变身、重生 —— 身体、名字或命运被换掉之后，故事才真正开始。",
    ink: "#d5b8e0",
    tags: { element: ["魔法生物"], mood: ["荒诞"] },
    keywords: /变成|变身|重生|身份|化作|换脸/,
    mode: "and",
  },
  {
    slug: "magic-relic",
    zh: "魔法遗物",
    en: "Magic Relic",
    tagline: "有些东西不该被捡起来",
    description: "魔法书、神秘钥匙、古老宝物 —— 一件道具推动整个世界转动。",
    ink: "#e8d5a8",
    tags: { element: ["神秘物品"] },
    keywords: /魔法书|钥匙|宝物|遗物|古书|拼图|卷轴|水晶|护身符|戒指|王冠|面具|魔杖|宝盒/,
    mode: "and",
  },
  {
    slug: "youth-quest",
    zh: "少年奇遇",
    en: "Youth Quest",
    tagline: "第一次走进不属于自己的世界",
    description: "少年冒险、成长、奇幻旅程 —— 主角往往不知道自己正在长大。",
    ink: "#b8d8c0",
    tags: { type: ["Fantasy Adventure", "Fairy Tale"] },
    keywords: /少年|女孩|男孩|孩子|成长|童年/,
    mode: "and",
  },
  {
    slug: "strange-everyday",
    zh: "怪奇日常",
    en: "Strange Everyday",
    tagline: "怪事就发生在隔壁",
    description: "普通生活中的超自然事件 —— 学校、小镇、公寓楼，日常里裂开一道缝。",
    ink: "#cfd0e8",
    tags: { world: ["超自然现代社会"] },
    keywords: /日常|小镇|学校|邻居|搬家|公寓|郊区|高中|公司/,
    mode: "and",
  },
];

export const MOTIF_BY_SLUG: Record<string, Motif> = Object.fromEntries(MOTIFS.map((m) => [m.slug, m]));

export interface MotifSubject {
  tags: Record<string, string[]>;
  synopsis?: string;
}

function tagHit(movie: MotifSubject, motif: Motif): boolean {
  for (const [bucket, list] of Object.entries(motif.tags)) {
    if (!list) continue;
    const own = movie.tags?.[bucket] ?? [];
    if (list.some((t) => own.includes(t))) return true;
  }
  return false;
}

export function matchesMotif(movie: MotifSubject, motif: Motif): boolean {
  const t = tagHit(movie, motif);
  const k = motif.keywords ? motif.keywords.test(movie.synopsis ?? "") : false;
  if (motif.mode === "and") return t && k;
  return t || k;
}

/** 一部作品命中的所有主题（用于详情页展示交叉关系） */
export function motifsOf(movie: MotifSubject): Motif[] {
  return MOTIFS.filter((m) => matchesMotif(movie, m));
}
