/**
 * 全站唯一的标签词表。
 * 任何页面展示标签都必须经过这里取中文名，避免同一标签出现多种写法。
 */

export type TagCategory = "type" | "world" | "aesthetic" | "element" | "mood" | "exclude";

export interface TagTerm {
  /** 数据里存的规范值 */
  id: string;
  /** 中文展示名 */
  zh: string;
  /** 一句话解释，用于筛选面板的 hover 提示与标签详情 */
  hint?: string;
}

export interface TagGroup {
  category: TagCategory;
  en: string;
  zh: string;
  /** 筛选面板上的说明 */
  blurb: string;
  terms: TagTerm[];
}

export const TAG_GROUPS: TagGroup[] = [
  {
    category: "type",
    en: "Genre",
    zh: "类型",
    blurb: "作品在奇幻光谱上的位置",
    terms: [
      { id: "Epic Fantasy", zh: "史诗奇幻", hint: "宏大的世界、战争与命运" },
      { id: "Dark Fantasy", zh: "黑暗奇幻", hint: "道德灰暗、恐怖与美感并存" },
      { id: "Urban Fantasy", zh: "都市奇幻", hint: "魔法藏在现代城市里" },
      { id: "Fantasy Adventure", zh: "奇幻冒险", hint: "旅程、寻宝与奇遇" },
      { id: "Mythological Fantasy", zh: "神话奇幻", hint: "来自神话与传说的世界" },
      { id: "Gothic Fantasy", zh: "哥特奇幻", hint: "古堡、雾、衰败的贵族" },
      { id: "Fairy Tale", zh: "童话改编", hint: "童话母题的再讲述" },
      { id: "Supernatural Fantasy", zh: "超自然奇幻", hint: "吸血鬼、狼人、幽灵" },
      { id: "Surreal Fantasy", zh: "超现实幻想", hint: "梦的逻辑取代现实的逻辑" },
      { id: "Fantasy Animation", zh: "奇幻动画", hint: "以动画构建的幻想世界" },
    ],
  },
  {
    category: "world",
    en: "World",
    zh: "世界观",
    blurb: "这个故事发生在什么样的地方",
    terms: [
      { id: "魔法学院", zh: "魔法学院", hint: "城堡里的课堂、宿舍与禁林" },
      { id: "魔法社会", zh: "魔法社会", hint: "自成体系的巫师社会" },
      { id: "平行世界", zh: "平行世界", hint: "另一重现实与现世的通道" },
      { id: "异世界冒险", zh: "异世界冒险", hint: "从此处出发去往别处" },
      { id: "神话世界", zh: "神话世界", hint: "神祇、妖怪与古老信仰" },
      { id: "古代王国", zh: "古代王国", hint: "王座、骑士与宫廷" },
      { id: "超自然现代社会", zh: "超自然现代社会", hint: "现代都市里的非人存在" },
      { id: "童话王国", zh: "童话王国", hint: "公主、城堡与许愿" },
      { id: "梦境世界", zh: "梦境世界", hint: "梦与记忆构成的国度" },
      { id: "末世幻想", zh: "末世幻想", hint: "世界已经结束之后" },
      { id: "迪士尼", zh: "迪士尼", hint: "迪士尼出品的动画与真人奇幻" },
      { id: "芭比", zh: "芭比", hint: "芭比系列动画电影" },
      { id: "宫崎骏", zh: "宫崎骏", hint: "宫崎骏执导的长篇动画" },
    ],
  },
  {
    category: "aesthetic",
    en: "Aesthetic",
    zh: "视觉美学",
    blurb: "如果只能看画面，它长什么样",
    terms: [
      { id: "哥特建筑", zh: "哥特建筑", hint: "尖顶、彩窗、石像与雾" },
      { id: "暗黑童话", zh: "暗黑童话", hint: "漂亮的画面下面藏着刀" },
      { id: "梦幻唯美", zh: "梦幻唯美", hint: "密度极高的美，几乎不真实" },
      { id: "复古英伦", zh: "复古英伦", hint: "旧羊毛、壁炉与阴雨" },
      { id: "黑暗浪漫", zh: "黑暗浪漫", hint: "把爱拍成一场濒死的审慎" },
      { id: "超现实主义", zh: "超现实主义", hint: "不合常理却极其精确" },
      { id: "自然幻想", zh: "自然幻想", hint: "森林、苔藓与巨树" },
      { id: "东方幻想", zh: "东方幻想", hint: "东方美学下的神怪世界" },
      { id: "古典神话", zh: "古典神话", hint: "雕塑感、壁画与神性" },
      { id: "怪诞美学", zh: "怪诞美学", hint: "不适与迷人同时发生" },
      { id: "蒸汽朋克", zh: "蒸汽朋克", hint: "齿轮、铁皮与飞行器" },
      { id: "魔法学院美学", zh: "魔法学院美学", hint: "长袍、烛光与移动的楼梯" },
    ],
  },
  {
    category: "element",
    en: "Elements",
    zh: "核心元素",
    blurb: "里面一定会出现的东西",
    terms: [
      { id: "女巫", zh: "女巫" },
      { id: "魔法师", zh: "魔法师" },
      { id: "吸血鬼", zh: "吸血鬼" },
      { id: "狼人", zh: "狼人" },
      { id: "精灵", zh: "精灵" },
      { id: "巨龙", zh: "巨龙" },
      { id: "妖怪", zh: "妖怪" },
      { id: "神祇", zh: "神祇" },
      { id: "魔法生物", zh: "魔法生物" },
      { id: "鬼魂", zh: "鬼魂" },
      { id: "超自然力量", zh: "超自然力量" },
      { id: "神秘物品", zh: "神秘物品" },
    ],
  },
  {
    category: "mood",
    en: "Mood",
    zh: "观影氛围",
    blurb: "看完之后你身上残留的情绪",
    terms: [
      { id: "温暖", zh: "温暖" },
      { id: "治愈", zh: "治愈" },
      { id: "神秘", zh: "神秘" },
      { id: "浪漫", zh: "浪漫" },
      { id: "怀旧", zh: "怀旧" },
      { id: "诡异", zh: "诡异" },
      { id: "阴森", zh: "阴森" },
      { id: "黑暗", zh: "黑暗" },
      { id: "宏大", zh: "宏大" },
      { id: "荒诞", zh: "荒诞" },
      { id: "迷离", zh: "迷离" },
      { id: "史诗感", zh: "史诗感" },
    ],
  },
  {
    category: "exclude",
    en: "Heads-up",
    zh: "劝退提示",
    blurb: "不一定是缺点，但值得提前知道",
    terms: [
      { id: "血腥", zh: "血腥" },
      { id: "恐怖惊吓", zh: "恐怖惊吓" },
      { id: "节奏缓慢", zh: "节奏缓慢" },
      { id: "剧情晦涩", zh: "剧情晦涩" },
      { id: "目标受众偏低龄", zh: "偏低龄" },
      { id: "含大量歌舞", zh: "大量歌舞" },
    ],
  },
];

export const TAG_INDEX: Record<string, TagTerm & { category: TagCategory }> = (() => {
  const map: Record<string, TagTerm & { category: TagCategory }> = {};
  for (const group of TAG_GROUPS) {
    for (const term of group.terms) map[term.id] = { ...term, category: group.category };
  }
  return map;
})();

export function tagLabel(id: string): string {
  return TAG_INDEX[id]?.zh ?? id;
}

export function tagCategory(id: string): TagCategory | null {
  return TAG_INDEX[id]?.category ?? null;
}

export const TAG_IDS_BY_CATEGORY: Record<TagCategory, string[]> = (() => {
  const out = { type: [], world: [], aesthetic: [], element: [], mood: [], exclude: [] } as Record<TagCategory, string[]>;
  for (const group of TAG_GROUPS) out[group.category] = group.terms.map((t) => t.id);
  return out;
})();

/** 国家/地区代码 → 中文名 */
export const COUNTRY_NAMES: Record<string, string> = {
  US: "美国", GB: "英国", NZ: "新西兰", AU: "澳大利亚", CA: "加拿大", FR: "法国", DE: "德国",
  IT: "意大利", ES: "西班牙", MX: "墨西哥", JP: "日本", CN: "中国", HK: "中国香港", TW: "中国台湾",
  KR: "韩国", IN: "印度", SE: "瑞典", NO: "挪威", DK: "丹麦", FI: "芬兰", RU: "俄罗斯", IE: "爱尔兰",
  CZ: "捷克", PL: "波兰", BE: "比利时", NL: "荷兰", AT: "奥地利", CH: "瑞士",
};

export const LANGUAGE_NAMES: Record<string, string> = {
  en: "英语", zh: "中文", ja: "日语", fr: "法语", es: "西班牙语", de: "德语", it: "意大利语",
  ko: "韩语", ru: "俄语", sv: "瑞典语", da: "丹麦语", no: "挪威语", fi: "芬兰语", pt: "葡萄牙语",
};

export const MEDIA_TYPE_LABELS: Record<string, string> = {
  movie: "电影",
  series: "剧集",
  miniseries: "迷你剧",
};

export const FORMAT_LABELS: Record<string, string> = {
  live_action: "真人",
  animation: "动画",
};

export const WATCH_STATUS_LABELS: Record<string, string> = {
  watched: "已看",
  wishlist: "待看",
  unknown: "未标注",
};
