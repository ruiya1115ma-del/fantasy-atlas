import fs from "node:fs";

const path = new URL("../lib/theme-assignments.ts", import.meta.url);
let text = fs.readFileSync(path, "utf8");

// 猫的报恩：故事围绕猫王国与一群非人角色展开，归入「奇幻生物」
text = text.replace(/\s*"the-cat-returns",/, "");

const anchor = '"the-secret-of-kells",';
if (!text.includes(anchor)) throw new Error("anchor not found");
text = text.replace(anchor, `${anchor}\n    "the-cat-returns",`);

fs.writeFileSync(path, text, "utf8");
console.log("moved the-cat-returns → fantasy-creatures");
