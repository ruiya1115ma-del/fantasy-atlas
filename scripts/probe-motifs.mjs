import fs from "node:fs";
const catalog = JSON.parse(fs.readFileSync(new URL("../data/catalog.json", import.meta.url), "utf8"));

const CANDIDATES = [
  { slug: "time-rift", tags: { world: ["平行世界", "梦境世界"], type: ["Surreal Fantasy"] }, kw: /时间|时空|穿越|平行|循环|回到过去|时间线/, mode: "or" },
  { slug: "forbidden-pact", tags: { aesthetic: ["黑暗浪漫", "暗黑童话"], element: ["超自然力量"] }, kw: /诅咒|契约|灵魂|交易|献祭|许愿|代价/, mode: "or" },
  { slug: "bestiary", tags: { element: ["巨龙", "精灵", "吸血鬼", "狼人", "妖怪", "神祇"] }, mode: "or" },
  { slug: "lost-realm", tags: { world: ["神话世界", "古代王国"] }, kw: /岛|秘境|地下|王国|遗迹|迷宫|森林深处|隐藏/, mode: "or" },
  { slug: "fate-shift", tags: { element: ["魔法生物"] }, kw: /变成|变身|重生|身份|化作|被诅咒变成/, mode: "or" },
  { slug: "magic-relic", tags: { element: ["神秘物品"] }, kw: /魔法书|钥匙|宝物|遗物|古书|拼图|卷轴|水晶|护身符/, mode: "and" },
  { slug: "youth-quest", tags: { type: ["Fantasy Adventure", "Fairy Tale"] }, kw: /少年|女孩|男孩|孩子|成长|童年/, mode: "and" },
  { slug: "strange-everyday", tags: { world: ["超自然现代社会"] }, kw: /日常|小镇|学校|邻居|搬家|公寓|郊区|高中/, mode: "or" },
];

for (const c of CANDIDATES) {
  const hits = catalog.movies.filter((m) => {
    const tagHit = Object.entries(c.tags).some(([b, list]) => ((m.tags?.[b] ?? []).some((t) => list.includes(t))));
    const kwHit = c.kw ? c.kw.test(m.synopsis ?? "") : false;
    return c.mode === "and" ? tagHit && kwHit : tagHit || kwHit;
  });
  console.log(`${c.slug.padEnd(16)} ${String(hits.length).padStart(4)} 部  ${hits.slice(0, 3).map((m) => m.chineseTitle).join("、")}`);
}
