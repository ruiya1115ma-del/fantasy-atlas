#!/usr/bin/env node
/**
 * Fantasy Atlas 完整备份（代码 + 电影数据库 + 投稿 + 图片资源）。
 *
 * 用法：
 *   node scripts/backup.mjs                      # 生成一份带时间戳的备份
 *   node scripts/backup.mjs "稳定版本-2026-11-24"   # 备注写进目录名
 *
 * 产物目录：backups/<时间戳>-<备注>/
 *   ├─ data/<...>       电影数据库与原始记录（catalog.json、raw/、derived/、submissions/、admin/、reports/）
 *   ├─ code.tar.gz      源码压缩包（不含 node_modules/.next/backups/图片）
 *   ├─ images.tar.gz    全部海报与剧照（public/posters*）
 *   ├─ images-manifest.json  每张图片的 sha256 / 字节数（校验用）
 *   ├─ summary.json     这次备份的统计信息
 *   └─ RESTORE.md       怎么恢复
 *
 * 说明：本机沙箱禁止 Node 启动子进程（spawn EPERM），所以 tar.gz 用纯 JS 生成，
 * 不依赖系统 tar 命令，也不改动站点任何现有文件。
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import zlib from "node:zlib";

const ROOT = process.cwd();
const note = process.argv.slice(2).join(" ").trim();

function stamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

const NAME = `${stamp()}${note ? `-${note}` : ""}`;
const OUT = path.join(ROOT, "backups", NAME);

const DATA_ITEMS = ["catalog.json", "raw", "derived", "submissions", "admin", "reports", "backups"];
const IMAGE_DIRS = ["public/posters", "public/posters-douban"];

function ensure(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function copyDir(src, dest) {
  ensure(dest);
  let files = 0;
  let bytes = 0;
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      const sub = copyDir(from, to);
      files += sub.files;
      bytes += sub.bytes;
    } else if (entry.isFile()) {
      fs.copyFileSync(from, to);
      files += 1;
      bytes += fs.statSync(to).size;
    }
  }
  return { files, bytes };
}

function sha256(file) {
  const hash = crypto.createHash("sha256");
  hash.update(fs.readFileSync(file));
  return hash.digest("hex");
}

/* ---------- 纯 JS 生成 .tar.gz（不调用外部 tar） ---------- */

const SKIP_NAMES = new Set(["node_modules", ".next", ".git", "backups", ".test-build", ".npm-cache", ".vercel", ".appdata"]);
const SKIP_PREFIXES = ["data/cache", "public/posters", "public/posters-douban"];
const SKIP_FILES = new Set(["dev.log", "dev2.log", "dev3.log", "build.log", "err.txt"]);

function collectFiles(dir, rel = "", out = [], skipPrefixes = []) {
  for (const entry of fs.readdirSync(path.join(dir, rel), { withFileTypes: true })) {
    const childRel = rel ? `${rel}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      if (SKIP_NAMES.has(entry.name)) continue;
      if (skipPrefixes.some((p) => childRel === p || childRel.startsWith(`${p}/`))) continue;
      collectFiles(dir, childRel, out, skipPrefixes);
    } else if (entry.isFile()) {
      if (SKIP_FILES.has(entry.name)) continue;
      if (/^\.env/.test(entry.name)) continue;
      out.push(childRel);
    }
  }
  return out;
}

function octal(value, length) {
  return value.toString(8).padStart(length - 1, "0") + "\0";
}

function tarHeader(name, size, mtime) {
  const header = Buffer.alloc(512);
  const nameBuf = Buffer.from(name, "utf8");
  nameBuf.copy(header, 0, 0, Math.min(nameBuf.length, 100));
  header.write(octal(0o644, 8), 100, "ascii"); // mode
  header.write(octal(0, 8), 108, "ascii"); // uid
  header.write(octal(0, 8), 116, "ascii"); // gid
  header.write(octal(size, 12), 124, "ascii"); // size
  header.write(octal(mtime, 12), 136, "ascii"); // mtime
  header.write("        ", 148, "ascii"); // checksum 占位
  header.write("0", 156, "ascii"); // typeflag: 普通文件
  header.write("ustar\0", 257, "ascii");
  header.write("00", 263, "ascii");
  let sum = 0;
  for (let i = 0; i < 512; i += 1) sum += header[i];
  header.write(`${sum.toString(8).padStart(6, "0")}\0 `, 148, "ascii");
  return header;
}

function createTarGz(sourceDir, targetFile, skipPrefixes = []) {
  const files = collectFiles(sourceDir, "", [], skipPrefixes);
  const parts = [];
  for (const rel of files) {
    const abs = path.join(sourceDir, rel);
    const stat = fs.statSync(abs);
    const content = fs.readFileSync(abs);
    parts.push(tarHeader(rel, content.length, Math.floor(stat.mtimeMs / 1000)));
    parts.push(content);
    const pad = (512 - (content.length % 512)) % 512;
    if (pad) parts.push(Buffer.alloc(pad));
  }
  parts.push(Buffer.alloc(1024)); // 结束块
  const raw = Buffer.concat(parts);
  const gz = zlib.gzipSync(raw, { level: 6 });
  fs.writeFileSync(targetFile, gz);
  return { bytes: gz.length, files: files.length };
}

function mb(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function main() {
  console.log(`开始备份 → backups/${NAME}`);
  ensure(OUT);

  /* 1. 数据库与投稿等 JSON 文件 */
  const dataOut = path.join(OUT, "data");
  let dataFiles = 0;
  let dataBytes = 0;
  for (const item of DATA_ITEMS) {
    const src = path.join(ROOT, "data", item);
    if (!fs.existsSync(src)) continue;
    const dest = path.join(dataOut, item);
    if (fs.statSync(src).isDirectory()) {
      const r = copyDir(src, dest);
      dataFiles += r.files;
      dataBytes += r.bytes;
    } else {
      ensure(path.dirname(dest));
      fs.copyFileSync(src, dest);
      dataFiles += 1;
      dataBytes += fs.statSync(dest).size;
    }
  }
  console.log(`  数据文件：${dataFiles} 个，${mb(dataBytes)}`);

  /* 2. 图片清单（sha256 校验） */
  const images = [];
  for (const rel of IMAGE_DIRS) {
    const dir = path.join(ROOT, rel);
    if (!fs.existsSync(dir)) continue;
    for (const name of fs.readdirSync(dir)) {
      const file = path.join(dir, name);
      if (!fs.statSync(file).isFile()) continue;
      images.push({ path: `${rel}/${name}`, bytes: fs.statSync(file).size, sha256: sha256(file) });
    }
  }
  fs.writeFileSync(
    path.join(OUT, "images-manifest.json"),
    JSON.stringify({ count: images.length, images }, null, 2),
    "utf8",
  );
  const imageBytes = images.reduce((sum, i) => sum + i.bytes, 0);
  console.log(`  图片：${images.length} 张，${mb(imageBytes)}（含 sha256 清单）`);

  /* 3. 代码压缩包（排除生成物、备份、图片） */
  const code = createTarGz(ROOT, path.join(OUT, "code.tar.gz"), SKIP_PREFIXES);
  console.log(`  代码包：${code.files} 个文件，${mb(code.bytes)}`);

  /* 4. 图片压缩包（只打包 public/posters*） */
  const imagesTmp = path.join(OUT, "_images_");
  ensure(imagesTmp);
  for (const rel of IMAGE_DIRS) {
    const src = path.join(ROOT, rel);
    if (!fs.existsSync(src)) continue;
    copyDir(src, path.join(imagesTmp, rel));
  }
  const img = createTarGz(imagesTmp, path.join(OUT, "images.tar.gz"));
  console.log(`  图片包：${img.files} 个文件，${mb(img.bytes)}`);
  fs.rmSync(imagesTmp, { recursive: true, force: true });

  /* 5. 统计与恢复说明 */
  const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "catalog.json"), "utf8"));
  const summary = {
    createdAt: new Date().toISOString(),
    label: note || null,
    movies: catalog.movies.length,
    moviesWithPoster: catalog.movies.filter((m) => m.poster?.src).length,
    imageFiles: images.length,
    imageBytes,
    dataFiles,
    dataBytes,
    codeArchiveBytes: code.bytes,
    imagesArchiveBytes: img.bytes,
    node: process.version,
  };
  fs.writeFileSync(path.join(OUT, "summary.json"), JSON.stringify(summary, null, 2), "utf8");

  fs.writeFileSync(
    path.join(OUT, "RESTORE.md"),
    `# 恢复说明（${NAME}）

这份备份包含四部分：数据、代码、图片、校验清单。

## 1. 只恢复数据（最常见）
把本目录的 \`data/\` 覆盖回项目的 \`data/\`，然后重启 dev server（\`node scripts/dev.mjs\`）：
- \`data/catalog.json\` 是站点唯一数据源；
- \`data/raw/\` 是原始记录，重新 merge 会以它为准；
- \`data/submissions/\` 是投稿队列；\`data/admin/\` 是后台队列与备份。

## 2. 恢复代码
把 \`code.tar.gz\` 解压覆盖到项目根目录即可（不含 node_modules，需重新 \`npm install\`）。

## 3. 恢复图片
把 \`images.tar.gz\` 解压到项目根目录，得到 \`public/posters/\` 与 \`public/posters-douban/\`；
再用 \`images-manifest.json\` 里的 sha256 校验每张图片是否完整。

## 4. 这次备份的数字
- 电影：${summary.movies} 部（${summary.moviesWithPoster} 部有海报）
- 图片：${summary.imageFiles} 张（${mb(imageBytes)}）
- 数据文件：${dataFiles} 个（${mb(dataBytes)}）
- 代码包 / 图片包：${mb(code.bytes)} / ${mb(img.bytes)}

## 5. 代码版本
本机没有 git 命令，代码版本用 isomorphic-git 存在项目 \`.git\` 里：
\`\`\`powershell
node scripts/git-snapshot.mjs "提交说明" "标签名"
\`\`\`
回退到某个版本：把那次快照的 \`code.tar.gz\` 解压覆盖，或用 git 恢复该提交的文件。
`,
    "utf8",
  );

  console.log(`\n完成：backups/${NAME}`);
  console.log(`  电影 ${summary.movies} 部 / 图片 ${summary.imageFiles} 张 / 数据 ${dataFiles} 个文件`);
}

main();
