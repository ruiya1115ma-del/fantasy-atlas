/**
 * 把「已通过审核」的投稿转成片单草稿：data/raw/catalog-submissions.draft.json
 *
 * 为什么是草稿而不是直接进库：
 *   merge 会校验 25 个字段（六类标签、≥80 字原创简介、系列信息…），
 *   这些必须由人写，脚本不会替你编。脚本负责的是机械部分：
 *   用豆瓣条目把 中文名/原名/年份/国家/类型 这些**事实**取回来。
 *
 * 用法：
 *   node scripts/promote-submissions.mjs
 *   # 然后手工补 tags / synopsis_zh / recommendation_zh / audience_* 等字段，
 *   # 把 catalog-submissions.draft.json 改名为 catalog-submissions.json 再 npm run merge
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const SUBS = path.join(ROOT, "data", "submissions", "submissions.json");
const OUT = path.join(ROOT, "data", "raw", "catalog-submissions.draft.json");
const UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

if (!fs.existsSync(SUBS)) {
  console.log("没有投稿记录（data/submissions/submissions.json 不存在）");
  process.exit(0);
}

const store = JSON.parse(fs.readFileSync(SUBS, "utf8"));
const approved = (store.submissions ?? []).filter((s) => s.status === "approved");
if (!approved.length) {
  console.log("没有「已通过」的投稿。");
  process.exit(0);
}

const existing = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, "utf8")) : [];
const byKey = new Map(existing.map((r) => [r.catalog_key, r]));

for (const s of approved) {
  const idm = /subject\/(\d+)/.exec(s.doubanUrl ?? "");
  if (!idm) {
    console.log(`- 跳过 ${s.chineseTitle}：豆瓣链接里没有条目 ID`);
    continue;
  }
  const sid = idm[1];
  const key = `submission-${sid}`;
  if (byKey.has(key)) {
    console.log(`- 已有草稿：${key}`);
    continue;
  }

  let detail = null;
  try {
    const res = await fetch(`https://m.douban.com/rexxar/api/v2/movie/${sid}`, {
      headers: {
        "User-Agent": UA,
        Accept: "application/json",
        "Accept-Language": "zh-CN,zh;q=0.9",
        Referer: `https://m.douban.com/movie/subject/${sid}/`,
      },
    });
    if (res.ok) detail = await res.json();
  } catch (e) {
    console.log(`- ${s.chineseTitle}：豆瓣资料抓取失败（${e.message}），只写投稿信息`);
  }
  await sleep(2000);

  const rec = {
    catalog_key: key,
    chinese_title: s.chineseTitle,
    original_title: detail?.original_title ?? s.originalTitle ?? s.chineseTitle,
    release_year: Number(String(detail?.year ?? s.releaseYear ?? "").slice(0, 4)) || s.releaseYear || 0,
    media_type: "movie",
    format: "live_action",
    franchise: null,
    franchise_name: null,
    series_order: null,
    country: [],
    director: (detail?.directors ?? []).map((d) => d.name).filter(Boolean).slice(0, 3),
    cast: (detail?.actors ?? []).map((a) => a.name).filter(Boolean).slice(0, 6),
    runtime_minutes: null,
    seasons: null,
    original_language: null,
    watch_status: "unknown",
    creator_note: null,
    wikidata_hint: null,
    wikipedia_page_en: null,
    external_title_hints: [],
    tags: { type: [], world: [], aesthetic: [], element: [], mood: [], exclude: [] },
    tag_confidence: "low",
    synopsis_zh: "",
    recommendation_zh: "",
    audience_fit: "",
    audience_mismatch: "",
    /* 下面三个字段 merge 会忽略，保留给你做参考 */
    _submission_douban_url: s.doubanUrl,
    _submission_note: s.note ?? "",
    _submission_id: s.id,
  };
  byKey.set(key, rec);
  console.log(`+ 生成草稿 ${key}（${rec.chinese_title}，${rec.release_year}）—— 需要你补标签与简介`);
}

const out = [...byKey.values()];
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(out, null, 2), "utf8");
console.log(`\n已写入 ${path.relative(ROOT, OUT)}：共 ${out.length} 条草稿`);
console.log("下一步：补齐 tags / synopsis_zh ≥80 汉字 / recommendation_zh / audience_fit / audience_mismatch，");
console.log("        然后改名为 catalog-submissions.json 并运行 node scripts/merge-catalog.mjs");
