import fs from "node:fs";

const path = new URL("../lib/theme-assignments.ts", import.meta.url);
let text = fs.readFileSync(path, "utf8");

function bounds(slug) {
  const start = text.indexOf(`"${slug}": [`);
  const end = text.indexOf("],", start);
  if (start < 0 || end < 0) throw new Error(`block not found: ${slug}`);
  return [start, end];
}

function removeFrom(slug, id) {
  const [start, end] = bounds(slug);
  const block = text.slice(start, end);
  const next = block.replace(new RegExp(`\\s*"${id}",`), "");
  if (next === block) return false;
  text = text.slice(0, start) + next + text.slice(end);
  return true;
}

function appendTo(slug, ids) {
  const [, end] = bounds(slug);
  text = text.slice(0, end) + ids.map((id) => `\n    "${id}",`).join("") + text.slice(end);
}

// 魔法世界再收窄：没有魔法体系、只是「奇幻设定」的作品不再硬塞进来
for (const id of [
  "charlie-and-the-chocolate-factory-2005",
  "wonka-2023",
  "the-wonderland",
  "tangled-ever-after-2012",
  "tangled-before-ever-after",
]) {
  removeFrom("magic-world", id);
}

// 暗黑童话再补两部（严格：童话骨架 + 黑暗讲述）
for (const id of ["corpse-bride-2005", "a-monster-calls-2016"]) {
  removeFrom("fantasy-creatures", id);
}
appendTo("dark-fairytale", ["corpse-bride-2005", "a-monster-calls-2016"]);

fs.writeFileSync(path, text, "utf8");
console.log("rebalanced");
