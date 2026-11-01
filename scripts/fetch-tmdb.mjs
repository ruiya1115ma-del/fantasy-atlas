/**
 * 可选的 TMDB 图片增强：抓取真实**宽幅剧照（backdrop）**与高清海报。
 *
 * 为什么是可选的：
 *   TMDB 的所有接口都需要 API key（免费申请：https://www.themoviedb.org/settings/api）。
 *   没有 key 时本站依然完整可用 —— 海报来自维基百科条目主图，首页背景用海报的虚化版本。
 *   配了 key 之后，首页轮播与详情页顶部会换成真正的电影剧照，观感提升明显。
 *
 * 用法：
 *   $env:TMDB_API_KEY="xxxxxxxx"
 *   node scripts/fetch-tmdb.mjs                 # 只补缺的
 *   node scripts/fetch-tmdb.mjs --force         # 全量重抓
 *   node scripts/fetch-tmdb.mjs --limit=10      # 先试 10 部
 *
 * 产物：
 *   public/backdrops/<id>.jpg     宽幅剧照（w1280）
 *   public/posters-tmdb/<id>.jpg  高清海报（w500）
 *   data/derived/tmdb.json        每条含 tmdbId / backdrop / poster / attribution / fetchedAt
 *
 * 说明：TMDB 要求署名（本站页脚与详情页已写 "This product uses the TMDB API but is not
 * endorsed or certified by TMDB."）。图片版权仍归发行方。
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const ROOT = path.resolve(import.meta.dirname, "..");
const UA = "FantasyAtlas/1.0 (node; personal non-commercial film guide)";
const API = "https://api.themoviedb.org/3";
const IMG = "https://image.tmdb.org/t/p";

const KEY = process.env.TMDB_API_KEY || process.env.TMDB_KEY || "";
const args = process.argv.slice(2);
const FORCE = args.includes("--force");
const LIMIT = Number((args.find((a) => a.startsWith("--limit=")) || "").split("=")[1] || 0);

if (!KEY) {
  console.log("未配置 TMDB_API_KEY —— 跳过（本站会继续使用维基海报 + 海报虚化背景）。");
  console.log("申请地址：https://www.themoviedb.org/settings/api");
  console.log('PowerShell: $env:TMDB_API_KEY="你的key"; node scripts/fetch-tmdb.mjs');
  process.exit(0);
}

const OUT_BACKDROP = path.join(ROOT, "public", "backdrops");
const OUT_POSTER = path.join(ROOT, "public", "posters-tmdb");
fs.mkdirSync(OUT_BACKDROP, { recursive: true });
fs.mkdirSync(OUT_POSTER, { recursive: true });

const STORE = path.join(ROOT, "data", "derived", "tmdb.json");
const store = fs.existsSync(STORE) ? JSON.parse(fs.readFileSync(STORE, "utf8")) : { records: {} };
store.records ??= {};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function apiJson(url, tries = 4) {
  for (let i = 0; i < tries; i++) {
    const res = await fetch(url, { headers: { "User-Agent": UA, accept: "application/json" } });
    if (res.status === 429) {
      await sleep(2000 * (i + 1));
      continue;
    }
    if (!res.ok) throw new Error(`TMDB HTTP ${res.status}`);
    return res.json();
  }
  throw new Error("TMDB 限流");
}

async function download(url, dest) {
  for (let i = 0; i < 4; i++) {
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if (res.status === 429) {
      await sleep(2000 * (i + 1));
      continue;
    }
    if (!res.ok) throw new Error(`图片 HTTP ${res.status} ${url}`);
    const buf = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(dest, buf);
    return buf.length;
  }
  throw new Error("图片下载限流");
}

const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "catalog.json"), "utf8"));
let movies = catalog.movies;
if (!FORCE) movies = movies.filter((m) => !store.records[m.id]?.backdrop);
if (LIMIT) movies = movies.slice(0, LIMIT);

console.log(`目标 ${movies.length} 部${FORCE ? "（强制）" : ""}`);

let done = 0;
let failed = 0;

for (const m of movies) {
  const imdb = m.externalIds?.imdb;
  if (!imdb) {
    failed++;
    continue;
  }
  try {
    const found = await apiJson(
      `${API}/find/${imdb}?external_source=imdb_id&language=zh-CN&api_key=${KEY}`
    );
    const hit = [...(found.movie_results ?? []), ...(found.tv_results ?? [])][0];
    if (!hit) {
      console.log(`  ✗ ${m.id}: TMDB 无匹配`);
      failed++;
      await sleep(260);
      continue;
    }

    const rec = {
      tmdbId: hit.id,
      backdrop: null,
      poster: null,
      attribution: "This product uses the TMDB API but is not endorsed or certified by TMDB.",
      fetchedAt: new Date().toISOString(),
    };

    if (hit.backdrop_path) {
      const file = path.join(OUT_BACKDROP, `${m.id}.jpg`);
      await download(`${IMG}/w1280${hit.backdrop_path}`, file);
      rec.backdrop = {
        src: `/backdrops/${m.id}.jpg`,
        width: 1280,
        height: 720,
        source: "tmdb.org",
        sourceUrl: `https://www.themoviedb.org/movie/${hit.id}/images`,
        articleUrl: `https://www.themoviedb.org/movie/${hit.id}`,
        license: "版权归发行方；经 TMDB API 取得，仅个人非商业使用",
        licenseNote: "TMDB 要求署名；本站页脚与详情页已标注。图片版权归原发行方。",
        fetchedAt: rec.fetchedAt,
      };
    }
    if (hit.poster_path) {
      const file = path.join(OUT_POSTER, `${m.id}.jpg`);
      await download(`${IMG}/w500${hit.poster_path}`, file);
      rec.poster = {
        src: `/posters-tmdb/${m.id}.jpg`,
        width: 500,
        height: 750,
        source: "tmdb.org",
        sourceUrl: `https://www.themoviedb.org/movie/${hit.id}/images`,
        articleUrl: `https://www.themoviedb.org/movie/${hit.id}`,
        license: "版权归发行方；经 TMDB API 取得，仅个人非商业使用",
        licenseNote: "TMDB 要求署名；本站页脚与详情页已标注。",
        fetchedAt: rec.fetchedAt,
      };
    }

    store.records[m.id] = rec;
    done++;
    if (done % 10 === 0) {
      fs.writeFileSync(STORE, JSON.stringify(store, null, 2), "utf8");
      console.log(`  … 已完成 ${done}`);
    }
    console.log(`  ✓ ${m.id} tmdb=${hit.id} backdrop=${rec.backdrop ? "yes" : "no"}`);
    await sleep(260);
  } catch (e) {
    failed++;
    console.log(`  ✗ ${m.id}: ${e.message}`);
    await sleep(600);
  }
}

fs.writeFileSync(STORE, JSON.stringify(store, null, 2), "utf8");
console.log(`\n完成：成功 ${done}，失败/跳过 ${failed}`);
console.log("产物：" + path.relative(ROOT, OUT_BACKDROP) + " / " + path.relative(ROOT, OUT_POSTER) + " / data/derived/tmdb.json");
console.log("下一步：node scripts/merge-catalog.mjs  （把 backdrop 合并进 catalog.json）");
try {
  execFileSync(process.execPath, [path.join(ROOT, "scripts", "merge-catalog.mjs")], { stdio: "inherit" });
} catch {
  console.log("（merge 未执行成功，请手动跑 node scripts/merge-catalog.mjs）");
}
