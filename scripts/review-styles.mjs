import fs from "node:fs";

const catalog = JSON.parse(fs.readFileSync(new URL("../data/catalog.json", import.meta.url), "utf8"));
const { assignStyle } = await import("../.test-build/style-assignments.js");

const groups = new Map();
const none = [];
for (const m of catalog.movies) {
  const slug = assignStyle(m);
  if (!slug) {
    none.push(m);
    continue;
  }
  if (!groups.has(slug)) groups.set(slug, []);
  groups.get(slug).push(m);
}

const order = ["dark-gothic", "epic-fantasy", "enchanted-worlds", "surreal-dreams", "whimsical-tales"];
const zh = {
  "dark-gothic": "暗黑与哥特",
  "epic-fantasy": "史诗奇幻",
  "enchanted-worlds": "少年奇遇",
  "surreal-dreams": "超现实梦境",
  "whimsical-tales": "奇趣童话",
};

const lines = [];
for (const slug of order) {
  const list = groups.get(slug) ?? [];
  lines.push(`## ${zh[slug]}（${list.length}）`);
  lines.push(list.map((m) => `${m.chineseTitle}(${m.releaseYear})`).join("、"));
  lines.push("");
}
lines.push(`## 未归类（${none.length}）`);
lines.push(none.map((m) => `${m.chineseTitle}(${m.releaseYear})`).join("、"));

fs.writeFileSync(new URL("../data/reports/style-assignments.txt", import.meta.url), lines.join("\n"), "utf8");
console.log(order.map((s) => `${zh[s]}=${(groups.get(s) ?? []).length}`).join(" "), `未归类=${none.length}`);
