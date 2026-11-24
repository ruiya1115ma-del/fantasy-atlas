import { readFileSync } from "node:fs";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:4317";
const catalog = JSON.parse(readFileSync("data/catalog.json", "utf8"));
const byTitle = new Map(catalog.movies.map((m) => [m.chineseTitle, m]));

async function getHeroSlides() {
  const html = await (await fetch(`${BASE}/explore`)).text();
  const raw = html.replace(/\\"/g, '"');
  const start = raw.indexOf('"slides":[');
  if (start < 0) return { titles: [], note: "未找到 slides" };
  const end = raw.indexOf('],"heightClass"', start);
  const block = raw.slice(start, end > 0 ? end : start + 60000);
  const titles = [...block.matchAll(/"chineseTitle":"([^"]+)"/g)].map((m) => m[1]);
  return { titles };
}

const runs = [];
for (let i = 0; i < 3; i += 1) {
  runs.push(await getHeroSlides());
  await new Promise((r) => setTimeout(r, 300));
}

let ok = true;
runs.forEach(({ titles }, i) => {
  const ids = titles.map((t) => byTitle.get(t)?.id).filter(Boolean);
  const franchises = titles.map((t) => byTitle.get(t)?.franchise).filter(Boolean);
  const decades = titles.map((t) => byTitle.get(t)?.releaseYear && `${Math.floor(byTitle.get(t).releaseYear / 10) * 10}s`);
  const types = titles.map((t) => byTitle.get(t)?.tags?.type?.[0]);

  const uniqueIds = new Set(ids).size === ids.length;
  const uniqueFranchise = new Set(franchises).size === franchises.length;
  if (!uniqueIds || !uniqueFranchise || titles.length === 0) ok = false;

  console.log(`\nrun ${i}: ${titles.length} 部`);
  console.log(`  ${titles.join(" / ")}`);
  console.log(`  id 唯一: ${uniqueIds} | 系列唯一: ${uniqueFranchise} | 系列: ${[...new Set(franchises)].join(",") || "全单片"}`);
  console.log(`  类型: ${[...new Set(types)].join(",")}`);
  console.log(`  年代: ${[...new Set(decades)].join(",")}`);
});

const same = runs.every((r) => r.titles.join("|") === runs[0].titles.join("|"));
console.log(`\n三次结果完全相同: ${same}（期望 false）`);
console.log(`整体检查: ${ok && !same ? "通过" : "需要复查"}`);
