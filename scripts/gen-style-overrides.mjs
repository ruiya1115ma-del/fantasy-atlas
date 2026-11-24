import fs from "node:fs";

const catalog = JSON.parse(fs.readFileSync(new URL("../data/catalog.json", import.meta.url), "utf8"));

const byTitle = new Map();
for (const m of catalog.movies) {
  if (!byTitle.has(m.chineseTitle)) byTitle.set(m.chineseTitle, []);
  byTitle.get(m.chineseTitle).push(m);
}

const plan = {
  "dark-gothic": [
    "吸血鬼惊情四百年",
    "夜访吸血鬼",
    "范海辛",
    "地狱男爵",
    "黑水晶",
    "诡秘怪谈",
    "黑白魔女库伊拉",
    "白雪公主与猎人",
    "沉睡魔咒",
    "沉睡魔咒2：恶魔夫人",
  ],
  "epic-fantasy": ["幽灵公主"],
  "enchanted-worlds": [
    "绿野仙踪",
    "大魔域",
    "千与千寻",
    "纳尼亚传奇：狮子、女巫和魔衣橱",
    "魔发奇缘",
    "胡桃夹子和四个王国",
    "寻梦环游记",
    "海洋奇缘",
    "海洋奇缘2",
    "寻龙传说",
    "狮子王",
    "狮子王：木法沙传奇",
    "森林王子",
    "小飞侠彼得潘",
    "彼得潘与温蒂",
    "纳尼亚传奇：凯斯宾王子",
    "纳尼亚传奇：黎明踏浪号",
    "圆梦巨人",
    "黄金罗盘",
    "奇幻精灵事件簿",
    "勇敢者的游戏2：太空飞行棋",
    "生命之书",
    "勇敢者的游戏",
    "魔发奇缘：幸福前奏",
    "仙境之桥",
    "微光城市",
    "雨果",
    "亚瑟和迷你王国",
    "善恶魔法学院",
    "佩小姐的奇幻城堡",
    "勇敢者游戏：决战丛林",
    "勇敢者游戏2：再战巅峰",
    "梦乡",
  ],
  "surreal-dreams": [
    "博物馆奇妙夜",
    "博物馆奇妙夜2",
    "博物馆奇妙夜3：墓葬秘密",
    "坠入",
    "菲比梦游奇境",
    "查理和巧克力工厂",
    "你想活出怎样的人生",
    "生日幻境",
    "镜子面具",
    "魔法奇幻秀",
    "魔境仙踪",
    "爱丽丝梦游仙境2：镜中奇遇记",
    "墨水心",
    "怪奇物语",
    "暗黑",
    "时间的皱折",
    "黑暗物质",
    "灰姑娘3：时间魔法",
  ],
  "whimsical-tales": [
    "大鱼",
    "魔法奇缘",
    "魔法奇缘2：解除魔法",
    "辉夜姬物语",
    "芭比",
    "旺卡",
    "风中奇缘",
    "风中奇缘2：伦敦之旅",
    "花木兰2",
    "秘密花园",
  ],
  none: [
    "美人鱼",
    "变相怪杰",
    "最后的巫师猎人",
    "天赋异禀",
    "红猪",
    "起风了",
    "灯塔",
    "头脑特工队",
    // 少年奇遇只收「少年主角」：成年主角的作品移出
    "马格瑞姆的神奇玩具店",
    "神奇动物在哪里",
    "神奇动物：格林德沃之罪",
    "神奇动物：邓布利多之谜",
    "魔法师的学徒",
    "魔发奇缘：幸福终点站",
  ],
};

const lines = [];
let missing = [];
for (const [slug, titles] of Object.entries(plan)) {
  for (const title of titles) {
    const found = (byTitle.get(title) ?? []).filter((m) => !lines.some((l) => l.includes(`"${m.id}"`)));
    if (!found.length) {
      missing.push(title);
      continue;
    }
    for (const m of found) {
      lines.push(`  "${m.id}": "${slug}", // ${m.chineseTitle}(${m.releaseYear})`);
    }
  }
}

const content = `/**
 * 五个视觉风格分类的人工覆盖表（由 scripts/gen-style-overrides.mjs 生成，可手改）。
 * 值 "none" 表示「不属于这五个分类」，不强行分配。
 */

import type { StyleSlug } from "./style-assignments";

export type StyleOverride = StyleSlug | "none";

export const STYLE_OVERRIDES: Record<string, StyleOverride> = {
${lines.join("\n")}
};
`;

fs.writeFileSync(new URL("../lib/style-overrides.ts", import.meta.url), content, "utf8");
console.log(`written ${lines.length} overrides; missing: ${missing.join("、") || "none"}`);
