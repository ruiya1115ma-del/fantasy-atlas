import fs from "node:fs";

const catalog = JSON.parse(fs.readFileSync(new URL("../data/catalog.json", import.meta.url), "utf8"));
const { MOTIFS, matchesMotif } = await import("../.test-build/motifs.js");

const seen = new Map();
for (const m of catalog.movies) {
  const matched = MOTIFS.filter((x) => matchesMotif(m, x)).map((x) => x.slug);
  seen.set(m.id, matched);
}

for (const motif of MOTIFS) {
  const list = catalog.movies.filter((m) => matchesMotif(m, motif));
  const overlap = list.filter((m) => (seen.get(m.id) ?? []).length > 1).length;
  console.log(
    `${motif.slug.padEnd(16)} ${String(list.length).padStart(4)} 部  多重命中 ${overlap}  例：${list
      .slice(0, 3)
      .map((m) => m.chineseTitle)
      .join("、")}`
  );
}
const uncovered = catalog.movies.filter((m) => (seen.get(m.id) ?? []).length === 0).length;
console.log(`\n未命中任何主题的作品：${uncovered} / ${catalog.movies.length}`);
