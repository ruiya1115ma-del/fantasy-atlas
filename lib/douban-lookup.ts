/**
 * 服务端豆瓣匹配 + 自动打标签（仅用于管理后台的增量导入）。
 *
 * 原则：
 *   - 只用豆瓣公开数据（条目 suggest / rexxar 详情）；不生成任何图片。
 *   - 置信度低就返回 needs_review，由管理员决定，不猜。
 */
import { CATEGORIES } from "@/lib/curation";
import { TAG_GROUPS } from "@/lib/vocabulary";
import type { ImportMatch } from "@/lib/import-queue";

const UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const norm = (s: string) =>
  String(s ?? "")
    .toLowerCase()
    .replace(/[\s·:：\-—–_,，。！!？?（）()《》「」"'·・]/g, "");

function jaccard(a: string, b: string): number {
  const A = new Set([...a]);
  const B = new Set([...b]);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const c of A) if (B.has(c)) inter++;
  return inter / (A.size + B.size - inter);
}

async function getJson(url: string, referer?: string) {
  const res = await fetch(url, {
    headers: {
      "User-Agent": UA,
      Accept: "application/json, text/plain, */*",
      "Accept-Language": "zh-CN,zh;q=0.9",
      ...(referer ? { Referer: referer } : {}),
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

interface SuggestItem {
  id: string;
  title: string;
  sub_title?: string;
  year?: string;
  type?: string;
}

/** 语义词表 → 站内标签（用于自动生成初始标签，低置信度会进待审核） */
const GENRE_MAP: Record<string, { bucket: string; tag: string }[]> = {
  奇幻: [
    { bucket: "type", tag: "Fantasy" },
    { bucket: "type", tag: "Epic Fantasy" },
  ],
  魔幻: [{ bucket: "type", tag: "Fantasy" }],
  冒险: [{ bucket: "type", tag: "Fantasy Adventure" }],
  动画: [{ bucket: "type", tag: "Fantasy Animation" }],
  家庭: [{ bucket: "mood", tag: "温暖" }],
  恐怖: [{ bucket: "type", tag: "Dark Fantasy" }],
  惊悚: [{ bucket: "type", tag: "Dark Fantasy" }],
  悬疑: [{ bucket: "mood", tag: "神秘" }],
  爱情: [{ bucket: "mood", tag: "浪漫" }],
  喜剧: [{ bucket: "mood", tag: "幽默" }],
  歌舞: [{ bucket: "mood", tag: "唯美" }],
  剧情: [{ bucket: "mood", tag: "抒情" }],
  纪录片: [],
};

const KEYWORD_MAP: { re: RegExp; bucket: string; tag: string }[] = [
  { re: /魔法|魔法师|女巫|学院|咒语/, bucket: "world", tag: "魔法学院" },
  { re: /巫师|魔法社会/, bucket: "world", tag: "魔法社会" },
  { re: /哥特|吸血鬼|古堡|阴森/, bucket: "aesthetic", tag: "哥特建筑" },
  { re: /童话|公主|王国|王子/, bucket: "world", tag: "童话王国" },
  { re: /神话|传说|诸神/, bucket: "world", tag: "神话世界" },
  { re: /异世界|另一个世界|平行世界/, bucket: "world", tag: "异世界冒险" },
  { re: /吸血鬼/, bucket: "element", tag: "吸血鬼" },
  { re: /龙|巨龙/, bucket: "element", tag: "龙" },
  { re: /精灵|仙子|妖精/, bucket: "element", tag: "精灵" },
  { re: /末日|史诗|战争/, bucket: "mood", tag: "宏大" },
  { re: /黑暗|阴森|诡异/, bucket: "mood", tag: "阴森" },
  { re: /梦|幻境/, bucket: "mood", tag: "迷离" },
];

function validTag(category: string, tag: string): boolean {
  const group = TAG_GROUPS.find((g) => g.category === category);
  return Boolean(group?.terms.some((t) => t.id === tag));
}

export function autoTags(genres: string[], intro: string): {
  tags: { type: string[]; world: string[]; aesthetic: string[]; element: string[]; mood: string[]; exclude: string[] };
  themeSlug: string | null;
  confidence: number;
  hits: number;
} {
  const tags = { type: [] as string[], world: [] as string[], aesthetic: [] as string[], element: [] as string[], mood: [] as string[], exclude: [] as string[] };
  const push = (bucket: string, tag: string) => {
    if (!validTag(bucket, tag)) return;
    const arr = (tags as unknown as Record<string, string[]>)[bucket];
    if (!arr.includes(tag)) arr.push(tag);
  };

  for (const g of genres) for (const m of GENRE_MAP[g] ?? []) push(m.bucket, m.tag);
  const text = `${intro}`.slice(0, 600);
  for (const k of KEYWORD_MAP) if (k.re.test(text)) push(k.bucket, k.tag);

  // 兜底：至少给一个 type / world / mood，否则主题分类无法生效
  if (!tags.type.length) push("type", "Fantasy");
  if (!tags.world.length) push("world", "异世界冒险");
  if (!tags.mood.length) push("mood", "神秘");

  const probe = { tags, tagConfidence: "high" as const };
  let themeSlug: string | null = null;
  for (const cat of CATEGORIES) {
    try {
      if (cat.match(probe as never)) {
        themeSlug = cat.slug;
        break;
      }
    } catch {
      /* 忽略单个分类的匹配异常 */
    }
  }

  const hits = tags.type.length + tags.world.length + tags.aesthetic.length + tags.element.length + tags.mood.length;
  const confidence = Math.max(0.35, Math.min(0.95, hits / 12));
  return { tags, themeSlug, confidence, hits };
}

/** 用片名在豆瓣定位条目并取回可展示资料 */
export async function lookupDouban(query: string): Promise<{ match: ImportMatch | null; reason: string }> {
  const yearMatch = /(19\d{2}|20\d{2})/.exec(query);
  const year = yearMatch ? Number(yearMatch[1]) : null;
  const title = query.replace(/[（(]?\s*(19\d{2}|20\d{2})\s*[)）]?/g, "").trim();

  let pool: SuggestItem[] = [];
  try {
    pool = (await getJson(`https://movie.douban.com/j/subject_suggest?q=${encodeURIComponent(title)}`)) as SuggestItem[];
  } catch (e) {
    return { match: null, reason: `搜索失败：${e instanceof Error ? e.message : "unknown"}` };
  }
  await sleep(900);
  if (!Array.isArray(pool) || !pool.length) return { match: null, reason: "豆瓣搜索无结果" };

  const scored = pool
    .map((c) => {
      const t = norm(c.title);
      const sub = norm(c.sub_title ?? "");
      const want = norm(title);
      const cy = Number(String(c.year ?? "").slice(0, 4)) || null;
      let s = jaccard(want, t) * 60 + jaccard(want, sub) * 30;
      if (t === want) s += 40;
      if (year && cy) {
        const d = Math.abs(cy - year);
        s += d === 0 ? 40 : d === 1 ? 12 : -50;
      }
      return { c, s, fuzzy: Math.max(jaccard(want, t), jaccard(want, sub)) };
    })
    .sort((a, b) => b.s - a.s);

  const top = scored[0];
  if (!top || (top.fuzzy < 0.62 && top.s < 50)) {
    return { match: null, reason: `候选不够像（最佳：${top?.c.title ?? "-"}，相似度 ${top?.fuzzy.toFixed(2) ?? "0"}）` };
  }

  const sid = top.c.id;
  const referer = `https://m.douban.com/movie/subject/${sid}/`;
  let detail: Record<string, unknown>;
  try {
    detail = (await getJson(`https://m.douban.com/rexxar/api/v2/movie/${sid}`, referer)) as Record<string, unknown>;
  } catch (e) {
    return { match: null, reason: `条目详情抓取失败：${e instanceof Error ? e.message : "unknown"}` };
  }
  await sleep(900);

  const rating = detail.rating as { value?: number; max?: number; count?: number } | undefined;
  const pic = detail.pic as { large?: string } | undefined;
  const genres = (detail.genres as string[]) ?? [];
  const intro = String(detail.intro ?? "");

  const match: ImportMatch = {
    doubanId: sid,
    doubanUrl: `https://movie.douban.com/subject/${sid}/`,
    chineseTitle: String(detail.title ?? top.c.title),
    originalTitle: String(detail.original_title ?? top.c.sub_title ?? ""),
    year: Number(String(detail.year ?? top.c.year ?? "").slice(0, 4)) || null,
    isTv: Boolean(detail.is_tv),
    genres,
    countries: (detail.countries as string[]) ?? [],
    durations: (detail.durations as string[]) ?? [],
    directors: ((detail.directors as { name: string }[]) ?? []).map((d) => d.name).filter(Boolean),
    actors: ((detail.actors as { name: string }[]) ?? []).map((a) => a.name).filter(Boolean).slice(0, 8),
    intro,
    rating:
      rating && typeof rating.value === "number"
        ? { value: rating.value, scale: rating.max ?? 10, count: rating.count ?? null }
        : null,
    poster: pic?.large ?? null,
    still: null,
    confidence: Math.min(0.98, Math.max(0.4, top.fuzzy)),
    reason: `豆瓣 suggest 命中「${top.c.title}」（相似度 ${top.fuzzy.toFixed(2)}）`,
  };

  return { match, reason: match.reason };
}
