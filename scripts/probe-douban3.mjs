// 摸清豆瓣接口字段（一次探测，产出样例结构写进 data/cache/douban-sample.json）
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const UA_M =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function json(url, headers = {}) {
  const res = await fetch(url, {
    headers: { "User-Agent": UA_M, Accept: "application/json", "Accept-Language": "zh-CN,zh;q=0.9", ...headers },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  return res.json();
}

const out = {};
out.suggest = await json("https://movie.douban.com/j/subject_suggest?q=" + encodeURIComponent("千与千寻"));
await sleep(1500);
out.detail = await json("https://m.douban.com/rexxar/api/v2/movie/1291561", {
  Referer: "https://m.douban.com/movie/subject/1291561/",
});
await sleep(1500);
out.photos = await json("https://m.douban.com/rexxar/api/v2/movie/1291561/photos?count=6&start=0", {
  Referer: "https://m.douban.com/movie/subject/1291561/",
});

const dir = path.join(ROOT, "data", "cache");
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, "douban-sample.json"), JSON.stringify(out, null, 2), "utf8");

console.log("suggest[0] keys:", Object.keys(out.suggest[0] ?? {}));
console.log("suggest[0]:", JSON.stringify(out.suggest[0], null, 1));
console.log("\ndetail keys:", Object.keys(out.detail));
const d = out.detail;
for (const k of ["title", "original_title", "year", "genres", "countries", "durations", "intro", "pic", "rating", "directors", "actors", "aka", "pubdate", "card_subtitle"]) {
  console.log(`  ${k}:`, JSON.stringify(d[k])?.slice(0, 260));
}
console.log("\nphotos[0] keys:", Object.keys(out.photos.photos?.[0] ?? {}));
console.log("photos[0].image:", JSON.stringify(out.photos.photos?.[0]?.image));
console.log("photos total:", out.photos.total);
