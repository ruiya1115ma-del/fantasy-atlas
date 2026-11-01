import fs from "node:fs";
const edits = [
  ["docs/DEPLOY_VERCEL.md", "194 部作品、海报/剧照/评分/标签全在里面", "274 部作品、海报/剧照/评分/标签全在里面"],
  ["docs/DEPLOY_VERCEL.md", "194 部作品、左侧筛选、海报全部加载", "274 部作品、左侧筛选、海报全部加载"],
  ["docs/STATUS.md", "194 部作品中，**165 部有真实海报**（豆瓣 108 / 维基 57）、108 部有剧照、", "274 部作品中，**274 部有真实海报**（豆瓣 108 / IMDb 144 / 维基 22）、108 部有剧照、"],
  ["docs/STATUS.md", "| 片单 194 部导入 + 校验 | ✅ |", "| 片单 274 部导入 + 校验 | ✅ |"],
  ["docs/STATUS.md", "| 真实海报 / 剧照 | ⏳ 165/194 有海报、108 部有剧照；抓不到的回退维基，再不行明确标注缺失 |", "| 真实海报 / 剧照 | ✅ 274/274 有真实海报（逐部核验年份与版本）；剧照 108 部 |"],
];
for (const [file, from, to] of edits) {
  const p = new URL("file://" + process.cwd().replace(/\\/g, "/") + "/" + file);
  let s = fs.readFileSync(p, "utf8");
  if (!s.includes(from)) { console.log("miss", file, from.slice(0, 20)); continue; }
  s = s.replace(from, to);
  fs.writeFileSync(p, s);
  console.log("ok", file);
}
