import fs from "node:fs";

const catalog = JSON.parse(fs.readFileSync(new URL("../data/catalog.json", import.meta.url), "utf8"));
const { classifyMovie } = await import("../.test-build/motifs.js");

const none = catalog.movies.filter((m) => classifyMovie(m) === null);
console.log(`未归类 ${none.length} 部：`);
console.log(none.map((m) => `${m.chineseTitle}（${m.releaseYear}）`).join("、"));
