import fs from "node:fs";

const catalog = JSON.parse(fs.readFileSync(new URL("../data/catalog.json", import.meta.url), "utf8"));
const { MOTIFS, classifyMovie } = await import("../.test-build/motifs.js");

const byTheme = new Map(MOTIFS.map((m) => [m.slug, []]));
const none = [];
for (const m of catalog.movies) {
  const slug = classifyMovie(m);
  if (slug) byTheme.get(slug).push(m);
  else none.push(m);
}

const lines = [];
for (const motif of MOTIFS) {
  const list = byTheme.get(motif.slug);
  lines.push(`\n=== ${motif.zh} (${motif.slug}) ${list.length} 部 ===`);
  lines.push(list.map((m) => `${m.chineseTitle}(${m.releaseYear})`).join("、"));
}
lines.push(`\n=== 未归类 ${none.length} 部 ===`);
lines.push(none.map((m) => `${m.chineseTitle}(${m.releaseYear})`).join("、"));
lines.push(`\n总计 ${catalog.movies.length}，已归类 ${catalog.movies.length - none.length}，未归类 ${none.length}`);

const out = new URL("../data/reports/theme-review-v1.txt", import.meta.url);
fs.writeFileSync(out, lines.join("\n"), "utf8");
console.log(`written ${out.pathname}`);
console.log(MOTIFS.map((m) => `${m.zh}=${byTheme.get(m.slug).length}`).join("  "), `未归类=${none.length}`);
