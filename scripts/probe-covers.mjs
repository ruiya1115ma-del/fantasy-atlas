import fs from "node:fs";
const catalog = JSON.parse(fs.readFileSync(new URL("../data/catalog.json", import.meta.url), "utf8"));
const { CATEGORIES } = await import("../.test-build/curation.js");

for (const slug of ["whimsical-tales", "surreal-dreams"]) {
  const cat = CATEGORIES.find((c) => c.slug === slug);
  const matched = catalog.movies.filter(cat.match);
  const withPoster = matched.filter((m) => m.poster?.src);
  const rows = withPoster
    .map((m) => ({
      t: m.chineseTitle,
      src: m.poster.src,
      kind: m.poster.source?.includes("douban") ? "douban" : "wiki",
      w: m.poster.width,
      h: m.poster.height,
      cnt: m.ratings?.[0]?.rating_count ?? 0,
    }))
    .sort((a, b) => b.cnt - a.cnt)
    .slice(0, 8);
  console.log(`\n== ${slug} (${matched.length} matched, ${withPoster.length} with poster)`);
  for (const r of rows) console.log(`  ${r.t} [${r.kind} ${r.w}x${r.h}] cnt=${r.cnt} ${r.src}`);
}
