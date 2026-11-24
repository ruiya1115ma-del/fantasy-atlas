import fs from "node:fs";

const catalog = JSON.parse(fs.readFileSync(new URL("../data/catalog.json", import.meta.url), "utf8"));
const { THEME_ASSIGNMENTS } = await import("../.test-build/theme-assignments.js");

const ids = new Set(catalog.movies.map((m) => m.id));
const seen = new Map();
const problems = [];

for (const [slug, list] of Object.entries(THEME_ASSIGNMENTS)) {
  for (const id of list) {
    if (!ids.has(id)) problems.push(`未知 id: ${slug} → ${id}`);
    if (seen.has(id)) problems.push(`重复归类: ${id} 出现在 ${seen.get(id)} 与 ${slug}`);
    seen.set(id, slug);
  }
}

const counts = Object.entries(THEME_ASSIGNMENTS).map(([slug, list]) => `${slug}=${list.length}`);
console.log(counts.join("  "));
console.log(`已归类 ${seen.size} / ${catalog.movies.length}，未归类 ${catalog.movies.length - seen.size}`);
if (problems.length) {
  console.log("\n问题：");
  for (const p of problems) console.log(" - " + p);
  process.exitCode = 1;
} else {
  console.log("校验通过：所有 id 存在且无重复。");
}
