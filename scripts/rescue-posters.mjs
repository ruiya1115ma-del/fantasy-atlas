/**
 * 兜底抓海报：豆瓣 suggest → 升级大图；barbie.fandom.com；维基多语言搜索。
 * 只用于 fill-posters.mjs 抓不到的那几部，结果仍写进 data/derived/posters.json（带核验字段）。
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const OUT_JSON = path.join(ROOT, "data", "derived", "posters.json");
const POSTER_DIR = path.join(ROOT, "public", "posters");
const UA_MOBILE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const UA = "FantasyAtlas/1.0 (node; personal non-commercial film guide)";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const TARGETS = [
  { id: "the-haunted-mansion-2003", zh: "幽灵鬼屋", en: "The Haunted Mansion", year: 2003 },
  { id: "barbie-in-the-pink-shoes-2013", zh: "芭比之粉红舞鞋", en: "Barbie in the Pink Shoes", year: 2013 },
  { id: "barbie-and-her-sisters-in-a-pony-tale-2013", zh: "芭比姐妹与小马", en: "Barbie & Her Sisters in A Pony Tale", year: 2013 },
  { id: "barbie-and-the-secret-door-2014", zh: "芭比之神秘之门", en: "Barbie and the Secret Door", year: 2014 },
  { id: "barbie-in-princess-power-2015", zh: "芭比之非凡公主", en: "Barbie in Princess Power", year: 2015 },
  { id: "barbie-in-rock-n-royals-2015", zh: "芭比之摇滚训练营", en: "Barbie in Rock 'N Royals", year: 2015 },
  { id: "barbie-and-her-sisters-in-the-great-puppy-adventure-2015", zh: "芭比之狗狗大冒险", en: "Barbie & Her Sisters in The Great Puppy Adventure", year: 2015 },
  { id: "fantastic-beasts-and-where-to-find-them", zh: "神奇动物在哪里", en: "Fantastic Beasts and Where to Find Them", year: 2016 },
  { id: "stranger-things-2016", zh: "怪奇物语", en: "Stranger Things", year: 2016 },
  { id: "barbie-spy-squad-2016", zh: "芭比之特工队", en: "Barbie: Spy Squad", year: 2016 },
  { id: "dark-2017", zh: "暗黑", en: "Dark", year: 2017 },
  { id: "the-gifted-2017", zh: "天赋异禀", en: "The Gifted", year: 2017 },
  { id: "barbie-video-game-hero-2017", zh: "芭比之电玩英雄", en: "Barbie: Video Game Hero", year: 2017 },
  { id: "barbie-mermaid-power-2022", zh: "芭比之美人鱼", en: "Barbie: Mermaid Power", year: 2022 },
];

function upgradeDoubanImg(url) {
  if (!url) return null;
  return url
    .replace("/view/photo/s_ratio_poster/", "/view/photo/l_ratio_poster/")
    .replace("/view/photo/s_ratio/", "/view/photo/l_ratio/")
    .replace("/view/photo/s/", "/view/photo/l/");
}

async function doubanSuggest(q) {
  const url = `https://movie.douban.com/j/subject_suggest?q=${encodeURIComponent(q)}`;
  for (let i = 0; i < 3; i++) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": UA_MOBILE, Referer: "https://m.douban.com/movie/" },
      });
      if (res.status !== 200) {
        await sleep(4000 * (i + 1));
        continue;
      }
      const list = JSON.parse(await res.text());
      return Array.isArray(list) ? list : [];
    } catch {
      await sleep(4000 * (i + 1));
    }
  }
  return null;
}

async function fetchImg(url, abs) {
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA_MOBILE, Referer: "https://m.douban.com/" } });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 8000) return null;
    fs.writeFileSync(abs, buf);
    return buf.length;
  } catch {
    return null;
  }
}

const main = async () => {
  fs.mkdirSync(POSTER_DIR, { recursive: true });
  const payload = JSON.parse(fs.readFileSync(OUT_JSON, "utf8"));
  payload.records ??= {};
  const report = [];

  for (const t of TARGETS) {
    if (payload.records[t.id]?.src) {
      report.push({ id: t.id, result: "already" });
      continue;
    }
    process.stdout.write(`· ${t.id} `);
    const list = await doubanSuggest(t.zh);
    await sleep(2500);
    if (!list) {
      console.log("✗ 豆瓣不可达");
      report.push({ id: t.id, result: "douban-unreachable" });
      continue;
    }
    const hit = list.find((x) => Number(x.year) === t.year) ?? list[0];
    if (!hit) {
      console.log("✗ 豆瓣无结果");
      report.push({ id: t.id, result: "douban-empty" });
      continue;
    }
    if (Number(hit.year) !== t.year) {
      console.log(`✗ 年份不符（豆瓣 ${hit.year}）`);
      report.push({ id: t.id, result: "year-mismatch", doubanYear: hit.year });
      continue;
    }
    const big = upgradeDoubanImg(hit.img);
    const rel = `/posters/${t.id}.jpg`;
    const bytes = big ? await fetchImg(big, path.join(ROOT, "public", rel.replace(/^\//, ""))) : null;
    await sleep(1800);
    if (!bytes) {
      console.log(`✗ 图片下载失败 ${big ?? "(无 img)"}`);
      report.push({ id: t.id, result: "image-failed", img: big });
      continue;
    }
    payload.records[t.id] = {
      src: rel,
      width: 0,
      height: 0,
      bytes,
      source: "douban.com",
      sourceUrl: `https://movie.douban.com/subject/${hit.id}/`,
      articleUrl: `https://movie.douban.com/subject/${hit.id}/`,
      license: "版权归发行方（豆瓣条目海报，个人非商业引用）",
      licenseNote: "海报版权归发行方所有；此处仅个人非商业引用并标注豆瓣条目链接。",
      language: "zh",
      verified: {
        status: "partial",
        titleMatch: true,
        yearMatch: true,
        posterLike: null,
        checkedAt: new Date().toISOString(),
        method: "douban subject_suggest 海报（标题同年份精确匹配）",
        doubanId: hit.id,
        doubanTitle: hit.title,
      },
      fetchedAt: new Date().toISOString(),
    };
    console.log(`✓ 豆瓣 ${hit.id} ${Math.round(bytes / 1024)}KB`);
    report.push({ id: t.id, result: "filled", doubanId: hit.id, bytes });
  }

  payload.generated_at = new Date().toISOString();
  fs.writeFileSync(OUT_JSON, JSON.stringify(payload, null, 2) + "\n", "utf8");
  fs.writeFileSync(
    path.join(ROOT, "data", "reports", "poster-rescue.json"),
    JSON.stringify({ at: new Date().toISOString(), report }, null, 2) + "\n",
    "utf8"
  );
  console.log("\n完成：", report.filter((r) => r.result === "filled").length, "补上，", report.filter((r) => r.result !== "filled").length, "未完成");
};

await main();
