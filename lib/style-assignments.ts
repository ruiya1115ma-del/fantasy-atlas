/**
 * 五个「视觉风格」分类的人工归属表。
 *
 * 与六个叙事主题一样：**每部作品只归入一个分类**，按最突出的整体气质判定；
 * 五个都不像的作品不收录（不强行分配）。
 *
 * 归属方法：先用六主题的人工归类作骨架（暗黑童话 / 怪奇日常 → 暗黑与哥特，
 * 史诗远征 → 史诗奇幻，时空裂隙 → 超现实梦境，魔法世界 / 奇幻生物再按「是不是动画、童话」分流），
 * 再用 lib/style-overrides.ts 里的人工覆盖逐条修正。
 */

import type { MediaCard } from "./types";
import { classifyMovie } from "./motifs";
import { STYLE_OVERRIDES } from "./style-overrides";

export type StyleSlug =
  | "dark-gothic"
  | "epic-fantasy"
  | "enchanted-worlds"
  | "surreal-dreams"
  | "whimsical-tales";

const has = (m: MediaCard, bucket: keyof MediaCard["tags"], ids: string[]) =>
  m.tags[bucket].some((t) => ids.includes(t));

/** 规则基线：按六主题归属 + 动画 / 童话与否分流 */
export function baseStyle(m: MediaCard): StyleSlug | null {
  const theme = classifyMovie(m);
  const animated = m.format === "animation" || has(m, "type", ["Fantasy Animation", "Fairy Tale"]);

  switch (theme) {
    case "dark-fairytale":
    case "strange-everyday":
      return "dark-gothic";
    case "epic-quest":
      return "epic-fantasy";
    case "time-rift":
      return "surreal-dreams";
    case "magic-world":
      return animated ? "whimsical-tales" : "enchanted-worlds";
    case "fantasy-creatures":
      return animated ? "whimsical-tales" : "epic-fantasy";
    default:
      return null;
  }
}

export function assignStyle(m: MediaCard): StyleSlug | null {
  const override = STYLE_OVERRIDES[m.id];
  if (override === "none") return null;
  if (override) return override;
  return baseStyle(m);
}
