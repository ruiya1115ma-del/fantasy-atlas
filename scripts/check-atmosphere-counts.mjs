import { createRequire } from "node:module";
import fs from "node:fs";
const require = createRequire(import.meta.url);

const { applyFilters, DEFAULT_FILTERS } = require("../.test-build/filter.js");
const catalog = JSON.parse(fs.readFileSync(new URL("../data/catalog.json", import.meta.url), "utf8"));

const checks = [
  ["治愈", "mood"],
  ["浪漫", "mood"],
  ["神秘", "mood"],
  ["诡异", "mood"],
  ["黑暗", "mood"],
  ["Fantasy Adventure", "type"],
];

for (const [tag, bucket] of checks) {
  const filters = { ...DEFAULT_FILTERS, [bucket]: [tag] };
  const result = applyFilters(catalog.movies, filters);
  console.log(`${bucket}=${tag.padEnd(20)} -> ${result.length} 部`);
}
