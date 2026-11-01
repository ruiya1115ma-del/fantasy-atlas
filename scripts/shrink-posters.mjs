/**
 * 海报瘦身：把过大的海报按 IMDb CDN 的缩略参数重新取一份（默认宽 800），
 * 只处理 source === "imdb" 且字节数超过阈值的记录，不动宽高比与内容。
 *
 * 用法：node scripts/shrink-posters.mjs [--min-kb=600] [--max-width=800]
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const STORE = path.join(ROOT, "data", "derived", "posters.json");
const args = process.argv.slice(2);
const MIN_KB = Number(args.find((a) => a.startsWith("--min-kb="))?.split("=")[1] ?? 600);
const MAXW = Number(args.find((a) => a.startsWith("--max-width="))?.split("=")[1] ?? 800);

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function imageDims(buf) {
  if (buf.length > 24 && buf[0] === 0x89 && buf[1] === 0x50) {
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }
  if (buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i < buf.length - 9) {
      if (buf[i] !== 0xff) {
        i += 1;
        continue;
      }
      const marker = buf[i + 1];
      const len = buf.readUInt16BE(i + 2);
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
      }
      i += 2 + len;
    }
  }
  return null;
}

const payload = JSON.parse(fs.readFileSync(STORE, "utf8"));
const records = payload.records ?? {};
const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "catalog.json"), "utf8"));
const byId = new Map(catalog.movies.map((m) => [m.id, m]));

const heavy = Object.entries(records)
  .filter(([, r]) => r.source === "imdb" && (r.bytes ?? 0) > MIN_KB * 1024 && /\/title\/tt\d+/.test(r.sourceUrl ?? ""))
  .sort((a, b) => (b[1].bytes ?? 0) - (a[1].bytes ?? 0));

console.log(`需要瘦身 ${heavy.length} 张（>${MIN_KB}KB，目标宽 ${MAXW}）`);

let saved = 0;
let failed = 0;
for (const [id, rec] of heavy) {
  const movie = byId.get(id);
  const tt = rec.sourceUrl.match(/tt\d+/)?.[0];
  if (!movie || !tt) {
    failed += 1;
    continue;
  }
  const query = movie.originalTitle || movie.chineseTitle;
  try {
    const res = await fetch(`https://v3.sg.media-imdb.com/suggestion/x/${encodeURIComponent(query)}.json`, {
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) throw new Error(`suggest HTTP ${res.status}`);
    const json = await res.json();
    const hit = (json?.d ?? []).find((x) => x.id === tt && x.i?.imageUrl);
    if (!hit) throw new Error("suggestion 里没有这条 id");
    const url = hit.i.imageUrl.replace(/\._V1_[^.]+\.jpg$/, "._V1_.jpg").replace(/\._V1_\.jpg$/, `._V1_UX${MAXW}_.jpg`);
    const img = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(30000) });
    if (!img.ok) throw new Error(`img HTTP ${img.status}`);
    const buf = Buffer.from(await img.arrayBuffer());
    if (buf.length < 20000) throw new Error(`返回过小 ${buf.length}B`);
    const dims = imageDims(buf);
    if (!dims || dims.height <= dims.width) throw new Error(`尺寸异常 ${dims?.width}×${dims?.height}`);
    const ext = rec.src.endsWith(".png") ? "png" : "jpg";
    const rel = `/posters/${id}.${ext}`;
    fs.writeFileSync(path.join(ROOT, "public", rel.replace(/^\//, "")), buf);
    saved += rec.bytes - buf.length;
    rec.src = rel;
    rec.width = dims.width;
    rec.height = dims.height;
    rec.bytes = buf.length;
    rec.imageUrl = url;
    rec.integrity = { fileExists: true, bytes: buf.length, posterLike: true, checkedAt: new Date().toISOString() };
    rec.shrunkAt = new Date().toISOString();
    console.log(`✓ ${id} ${Math.round(rec.bytes / 1024)}KB ${dims.width}×${dims.height}`);
  } catch (err) {
    failed += 1;
    console.log(`✗ ${id} ${err.message}`);
  }
  await sleep(200);
}

payload.generated_at = new Date().toISOString();
fs.writeFileSync(STORE, JSON.stringify(payload, null, 2) + "\n", "utf8");
console.log(`\n完成：瘦身 ${heavy.length - failed} 张，失败 ${failed}，共省 ${(saved / 1048576).toFixed(1)}MB`);
