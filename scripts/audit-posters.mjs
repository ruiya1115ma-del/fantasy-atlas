/**
 * 海报全量体检：逐部核对「catalog 里的每一条作品」是否都有真实海报文件，
 * 并检查文件存在性、真实图片格式、尺寸、竖版/方形、来源与核验状态。
 *
 * 用法：node scripts/audit-posters.mjs
 * 产物：data/reports/poster-audit.json
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "catalog.json"), "utf8"));
const store = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "derived", "posters.json"), "utf8"));
const records = store.records ?? {};

function dims(buf) {
  if (buf.length > 24 && buf[0] === 0x89 && buf[1] === 0x50) {
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20), kind: "png" };
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
        return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7), kind: "jpg" };
      }
      i += 2 + len;
    }
  }
  return null;
}

const rows = [];
for (const m of catalog.movies) {
  const src = m.poster?.src ?? records[m.id]?.src ?? null;
  const rec = records[m.id] ?? null;
  let fileOk = false;
  let bytes = 0;
  let size = null;
  let error = null;
  if (src) {
    const abs = path.join(ROOT, "public", src.replace(/^\//, ""));
    if (fs.existsSync(abs)) {
      const buf = fs.readFileSync(abs);
      bytes = buf.length;
      size = dims(buf);
      fileOk = Boolean(size) && bytes > 12000;
      if (!fileOk) error = size ? `文件过小 ${bytes}B` : "不是有效 JPEG/PNG";
    } else {
      error = "文件不存在";
    }
  } else {
    error = "没有海报记录";
  }
  const portrait = size ? size.height > size.width : false;
  const square = size ? Math.abs(size.height - size.width) <= Math.max(8, size.width * 0.04) : false;
  rows.push({
    id: m.id,
    title: m.chineseTitle,
    originalTitle: m.originalTitle,
    year: m.releaseYear,
    src,
    fileOk,
    bytes,
    width: size?.width ?? null,
    height: size?.height ?? null,
    portrait,
    square,
    source: m.poster?.source ?? rec?.source ?? null,
    tier: rec?.tier ?? (String(m.poster?.source ?? "").includes("douban") ? "B" : null),
    verified: rec?.verified?.status ?? null,
    matchedTitle: rec?.matchedTitle ?? null,
    matchedYear: rec?.matchedYear ?? null,
    error,
  });
}

const bad = rows.filter((r) => !r.fileOk || (!r.portrait && !r.square));
const unverified = rows.filter((r) => r.verified && r.verified !== "verified");
const bySource = rows.reduce((acc, r) => {
  const key = String(r.source ?? "unknown").replace(/^https?:\/\//, "").split("/")[0];
  acc[key] = (acc[key] ?? 0) + 1;
  return acc;
}, {});

const report = {
  checkedAt: new Date().toISOString(),
  total: rows.length,
  withFile: rows.filter((r) => r.fileOk).length,
  portrait: rows.filter((r) => r.portrait).length,
  square: rows.filter((r) => r.square && !r.portrait).length,
  bySource,
  problems: bad.map((r) => ({ id: r.id, title: r.title, error: r.error })),
  needsManualReview: unverified.map((r) => ({
    id: r.id,
    title: r.title,
    year: r.year,
    verified: r.verified,
    matchedTitle: r.matchedTitle,
    matchedYear: r.matchedYear,
    source: r.source,
  })),
  rows,
};
fs.mkdirSync(path.join(ROOT, "data", "reports"), { recursive: true });
fs.writeFileSync(path.join(ROOT, "data", "reports", "poster-audit.json"), JSON.stringify(report, null, 2) + "\n", "utf8");

console.log(`海报体检：${report.withFile}/${report.total} 有可用文件；竖版 ${report.portrait}，方形 ${report.square}`);
console.log(`来源分布：${JSON.stringify(bySource)}`);
if (bad.length) {
  console.log(`\n有问题的 ${bad.length} 条：`);
  for (const r of bad) console.log(`  ${r.id} ${r.title} —— ${r.error}`);
} else {
  console.log("\n没有“缺图/坏图”的作品。");
}
if (unverified.length) {
  console.log(`\n核验状态非 verified 的 ${unverified.length} 条（需要人工复核年份/版本）：`);
  for (const r of unverified.slice(0, 30)) {
    console.log(`  ${r.id} ${r.title} (${r.year}) → ${r.verified} · 命中「${r.matchedTitle}」${r.matchedYear ?? ""}`);
  }
  if (unverified.length > 30) console.log(`  …… 其余见 data/reports/poster-audit.json`);
}
