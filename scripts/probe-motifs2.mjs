import fs from "node:fs";
const catalog = JSON.parse(fs.readFileSync(new URL("../data/catalog.json", import.meta.url), "utf8"));

const CANDIDATES = [
  { slug: "forbidden-pact", tags: { aesthetic: ["黑暗浪漫", "暗黑童话"], element: ["超自然力量"] }, kw: /诅咒|契约|灵魂|交易|献祭|许愿|代价/, mode: "and" },
  { slug: "fate-shift", tags: { element: ["魔法生物"], mood: ["荒诞"] }, kw: /变成|变身|重生|身份|化作|换脸/, mode: "and" },
  { slug: "strange-everyday", tags: { world: ["超自然现代社会"] }, kw: /日常|小镇|学校|邻居|搬家|公寓|郊区|高中|公司/, mode: "and" },
  { slug: "magic-relic", tags: { element: ["神秘物品"] }, kw: /魔法书|钥匙|宝物|遗物|古书|拼图|卷轴|水晶|护身符|戒指|王冠|面具|魔杖|宝盒/, mode: "and" },
];

for (const c of CANDIDATES) {
  const hits = catalog.movies.filter((m) => {
    const tagHit = Object.entries(c.tags).some(([b, list]) => (m.tags?.[b] ?? []).some((t) => list.includes(t)));
    const kwHit = c.kw.test(m.synopsis ?? "");
    return c.mode === "and" ? tagHit && kwHit : tagHit || kwHit;
  });
  console.log(`${c.slug.padEnd(16)} ${String(hits.length).padStart(4)} 部  ${hits.slice(0, 4).map((m) => m.chineseTitle).join("、")}`);
}
