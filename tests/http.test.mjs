/**
 * HTTP 冒烟测试 —— 需要有一个正在运行的服务。
 * 用法（先起 dev server 或 next start）：
 *   node --test --test-isolation=none tests/http.test.mjs
 * 可指定 BASE_URL，默认 http://127.0.0.1:4317
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:4317";
const catalog = JSON.parse(readFileSync(path.join(process.cwd(), "data", "catalog.json"), "utf8"));

async function get(pathname) {
  const res = await fetch(`${BASE}${pathname}`);
  const html = await res.text();
  return { status: res.status, html };
}

test("首页是品牌落地页：大标题 + 中文品牌标题 + 进入入口 + 氛围/随机模块", async () => {
  const { status, html } = await get("/");
  assert.equal(status, 200);
  assert.ok(html.includes("Fantasy") && html.includes("Atlas"), "缺少品牌名");
  assert.ok(html.includes("奇幻电影图鉴"), "缺少中文品牌标题");
  assert.ok(html.includes("一座收藏奇幻世界的私人电影图鉴"), "缺少品牌副标题");
  assert.ok(html.includes("进入魔法世界"), "缺少「进入魔法世界」入口");
  assert.ok(html.includes("按主题寻找"), "缺少「按主题寻找」区块");
  assert.ok(html.includes("命运随机抽取"), "缺少「命运随机抽取」区块");
  // 候选池必须是完整电影库，不能因为缺少剧照而漏掉条目
  const plain = html.replace(/<!--.*?-->/g, "").replace(/<[^>]+>/g, " ");
  const pool = /候选池\s*(\d+)\s*部/.exec(plain);
  assert.ok(pool, "首页缺少「候选池 N 部」文案");
  assert.equal(Number(pool[1]), catalog.count, `候选池应等于全库 ${catalog.count} 部，实际 ${pool[1]} 部`);
  // 品牌页不应该被某部电影的轮播占据
  assert.ok(!html.includes("进入这部电影"), "首页不该出现电影轮播");
});

test("探索页返回 200 且列出全部作品数", async () => {
  const { status, html } = await get("/explore");
  assert.equal(status, 200);
  assert.ok(html.includes("探索全部作品"));
  assert.ok(html.includes(`${catalog.count} 部作品`) || html.includes(String(catalog.count)), "结果数不对");
});

test("探索页带筛选参数时结果收敛，不会 500", async () => {
  const { status, html } = await get(`/explore?world=${encodeURIComponent("魔法学院")}`);
  assert.equal(status, 200);
  assert.ok(html.length > 1000);
});

test("详情页返回 200，且剧照/简介/编辑视角/客观资料分区可见", async () => {
  const slug = catalog.movies[0].slug;
  const { status, html } = await get(`/movies/${slug}`);
  assert.equal(status, 200);
  assert.ok(html.includes("编辑视角"), "缺少编辑视角分区");
  assert.ok(html.includes("客观资料"), "缺少客观资料分区");
  assert.ok(html.includes("数据来源与核对"), "缺少来源与核对分区");
  assert.ok(html.includes("我的记录"), "缺少个人记录分区");
  assert.ok(html.includes("海报来源"), "缺少海报来源标注");
});

test("推荐页 / 收藏页返回 200；数据与授权页已收进后台，访客访问返回 404", async () => {
  for (const p of ["/recommend", "/favorites"]) {
    const { status } = await get(p);
    assert.equal(status, 200, `${p} 返回 ${status}`);
  }
  const sources = await get("/sources");
  assert.equal(sources.status, 404, `访客访问 /sources 应返回 404，实际 ${sources.status}`);
});

test("五个编辑片单页面都返回 200", async () => {
  for (const slug of ["immersive", "magic-atmosphere", "underrated", "rewatchable", "gothic-lovers"]) {
    const { status } = await get(`/curated/${slug}`);
    assert.equal(status, 200, `/curated/${slug} 返回 ${status}`);
  }
});

test("六个叙事主题页面都返回 200，且各自渲染了不同的作品数量", async () => {
  const slugs = ["time-rift", "magic-world", "strange-everyday", "fantasy-creatures", "dark-fairytale", "epic-quest"];
  const counts = new Set();
  for (const slug of slugs) {
    const { status, html } = await get(`/motifs/${slug}`);
    assert.equal(status, 200, `/motifs/${slug} 返回 ${status}`);
    const clean = html.replace(/<!--.*?-->/g, "");
    assert.ok(clean.includes("部作品"), `/motifs/${slug} 缺少作品计数`);
    const m = clean.match(/共\s*(\d+)\s*部/);
    if (m) counts.add(`${slug}:${m[1]}`);
  }
  assert.equal(counts.size, slugs.length, `六个主题的作品数量应当各不相同，实际只有 ${counts.size} 种`);
});

test("首页包含六个叙事主题入口与整屏命运抽取", async () => {
  const { html } = await get("/");
  for (const zh of ["时空裂隙", "魔法世界", "怪奇日常", "奇幻生物", "暗黑童话", "史诗远征"]) {
    assert.ok(html.includes(zh), `首页缺少主题：${zh}`);
  }
  assert.ok(html.includes("按主题寻找"), "缺少「按主题寻找」分区");
  assert.ok(html.includes("闭上眼，交给命运"), "缺少命运抽取文案");
  assert.ok(html.includes("允许重复抽取"), "缺少重复抽取开关");
  // 首页主题卡片只显示主题名、图片与数量，不放介绍文字
  assert.ok(!html.includes("故事可以同时属于"), "首页仍在展示主题介绍文字");
});

test("不存在的作品：不 500，返回友好页面（dev 流式渲染下 HTTP 码可能是 200）", async () => {
  const { status, html } = await get("/movies/this-movie-does-not-exist");
  assert.ok([200, 404].includes(status), `未知 slug 不应返回 ${status}`);
  assert.ok(html.includes("这个世界地图上没有") || html.includes("404"), "404 页面文案缺失");
  // 不能把「不存在」渲染成一部正常作品
  assert.ok(!html.includes("编辑视角"), "不存在的作品不应渲染详情页正文");
});

test("sitemap.xml 与 robots.txt 可访问", async () => {
  const sm = await get("/sitemap.xml");
  assert.equal(sm.status, 200);
  assert.ok(sm.html.includes("/movies/"), "sitemap 缺少作品页");
  const rb = await get("/robots.txt");
  assert.equal(rb.status, 200);
});

test("数据来源署名出现在页脚（豆瓣主来源 + IMDb/Wikidata 备份）", async () => {
  const { html } = await get("/");
  assert.ok(html.includes("豆瓣"), "缺少豆瓣署名");
  assert.ok(html.includes("IMDb") && html.includes("Wikidata"), "缺少备份来源署名");
});
