import fs from "node:fs";
import path from "node:path";

const dir = "data/raw";
const rows = [];
for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".json"))) {
  const arr = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
  for (const r of arr) {
    if (Array.isArray(r.director) && r.director.includes("Hayao Miyazaki")) {
      rows.push({ f, key: r.catalog_key, zh: r.chinese_title, year: r.release_year, tags: r.tags, conf: r.tag_confidence, cast: r.cast, ext: r.external_title_hints });
    }
  }
}
rows.sort((a, b) => a.year - b.year);
for (const r of rows) console.log(JSON.stringify(r, null, 0));
console.log("TOTAL", rows.length);
