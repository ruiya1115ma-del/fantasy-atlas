import fs from "node:fs";

const p = new URL("../lib/motifs.ts", import.meta.url);
let t = fs.readFileSync(p, "utf8");

const pairs = [
  ["时间折了一道，另一个世界在裂缝那头", "时间折了一道缝"],
  ["巫师、咒语与成体系的魔法力量", "巫师与成体系的魔法"],
  ["怪事就发生在隔壁与客厅", "怪事就发生在隔壁"],
  ["龙、精灵与异兽才是真正的主角", "异兽才是真正的主角"],
  ["睡前故事的另一面，甜味底下是骨", "睡前故事的另一面"],
  ["为了抵达，先要出发很远", "出发，去很远的地方"],
];

for (const [a, b] of pairs) {
  t = t.split(`hint: "${a}"`).join(`hint: "${b}"`);
}

fs.writeFileSync(p, t, "utf8");
console.log("hints updated");
