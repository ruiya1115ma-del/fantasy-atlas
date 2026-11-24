import fs from "node:fs";

const catalog = JSON.parse(fs.readFileSync(new URL("../data/catalog.json", import.meta.url), "utf8"));
const { MOTIFS, classifyMovie } = await import("../.test-build/motifs.js");

const lines = [
  "# 六主题归类清单（人工逐部判定）",
  "",
  "每部作品只进入一个主题，按最突出的核心特征归类；六个主题都不像的作品不收录。",
  `总计 ${catalog.movies.length} 部，已归类 ${catalog.movies.filter((m) => classifyMovie(m)).length} 部，未归类 ${
    catalog.movies.filter((m) => !classifyMovie(m)).length
  } 部。`,
  "",
];

for (const motif of MOTIFS) {
  const list = catalog.movies.filter((m) => classifyMovie(m) === motif.slug);
  lines.push(`## ${motif.zh}（${list.length} 部）`, "");
  lines.push(list.map((m) => `${m.chineseTitle}（${m.releaseYear}）`).join("、"), "");
}

const none = catalog.movies.filter((m) => !classifyMovie(m));
lines.push(`## 未归类（${none.length} 部）`, "");
lines.push("不属于这六个叙事主题，仍可在探索页按标签、世界观、视觉美学找到。", "");
lines.push(none.map((m) => `${m.chineseTitle}（${m.releaseYear}）`).join("、"), "");

fs.writeFileSync(new URL("../data/reports/theme-assignments.md", import.meta.url), lines.join("\n"), "utf8");
console.log("written data/reports/theme-assignments.md");
