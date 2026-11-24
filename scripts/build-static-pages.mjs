#!/usr/bin/env node
/**
 * 生成一份纯静态站点（out/），用于 Cloudflare Pages 的 Direct Upload。
 *
 * 背景：
 * - 本项目是 Next App Router，带后台（/admin）、API（/api/*）和 middleware，
 *   这些在静态托管上跑不了，所以导出时会把它们临时移出 app 目录。
 * - 首页 / 探索页 / 主题片单页原本是 force-dynamic（读 data/home-config.json），
 *   静态导出时改成 force-static 并补 generateStaticParams。
 * - 本机沙箱禁止 fork，构建前先给 Next 的静态生成 worker 打 in-process 补丁。
 *
 * 用法：node scripts/build-static-pages.mjs
 * 产物：out/（静态 HTML + 资源），随后由 make-upload-zip.mjs 打包。
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const root = path.resolve(import.meta.dirname, "..");
const staging = path.join(root, ".static-staging");
const outDir = path.join(root, "out");
const nextBin = path.join(root, "node_modules/next/dist/bin/next");

const moves = [
  { from: "app/admin", to: ".static-staging/app-admin" },
  { from: "app/api", to: ".static-staging/app-api" },
  { from: "app/sources", to: ".static-staging/app-sources" },
  { from: "middleware.ts", to: ".static-staging/middleware.ts" }
];

const patches = {
  "app/page.tsx": (src) =>
    src.replace(
      'export const dynamic = "force-dynamic";',
      'export const dynamic = "force-static";'
    ),
  "app/explore/page.tsx": (src) =>
    src.replace(
      'export const dynamic = "force-dynamic";',
      'export const dynamic = "force-static";'
    ),
  "app/collections/[id]/page.tsx": (src) => {
    let next = src.replace(
      'export const dynamic = "force-dynamic";',
      'export const dynamic = "force-static";\n\nexport async function generateStaticParams() {\n  const config = loadHomeConfig();\n  return config.sections.flatMap((section) => section.themes.map((theme) => ({ id: theme.id })));\n}'
    );
    return next;
  }
};

const moved = [];
const patched = [];

function log(msg) {
  console.log("[static-build] " + msg);
}

function rmrf(target) {
  if (fs.existsSync(target)) fs.rmSync(target, { recursive: true, force: true });
}

try {
  rmrf(staging);
  fs.mkdirSync(staging, { recursive: true });

  for (const move of moves) {
    const from = path.join(root, move.from);
    if (!fs.existsSync(from)) {
      log("跳过（不存在）：" + move.from);
      continue;
    }
    const to = path.join(root, move.to);
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.renameSync(from, to);
    moved.push({ from, to });
    log("移出：" + move.from);
  }

  for (const [rel, apply] of Object.entries(patches)) {
    const file = path.join(root, rel);
    if (!fs.existsSync(file)) continue;
    const src = fs.readFileSync(file, "utf8");
    const next = apply(src);
    if (next === src) {
      log("未改动（找不到 force-dynamic？）：" + rel);
      continue;
    }
    const keep = path.join(staging, "patched", rel.replace(/[\\/\[\]]/g, "_"));
    fs.mkdirSync(path.dirname(keep), { recursive: true });
    fs.writeFileSync(keep, src);
    fs.writeFileSync(file, next);
    patched.push({ file, backup: keep });
    log("改写为静态：" + rel);
  }

  rmrf(outDir);
  rmrf(path.join(root, ".next"));

  // 先给 Next 的静态生成 worker 打补丁（沙箱禁止 fork / 不能 postMessage 闭包）
  execFileSync(process.execPath, [path.join(root, "scripts/patch-inprocess-workers.mjs")], {
    cwd: root,
    stdio: "inherit"
  });

  log("开始构建静态导出…");
  execFileSync(process.execPath, [nextBin, "build"], {
    cwd: root,
    stdio: "inherit",
    env: {
      ...process.env,
      NEXT_TELEMETRY_DISABLED: "1",
      FA_STATIC_EXPORT: "1",
      FA_INPROCESS_WORKERS: "1",
      FA_WORKER_THREADS: "0",
      NODE_OPTIONS: process.env.NODE_OPTIONS || "--max-old-space-size=6144"
    }
  });

  if (!fs.existsSync(path.join(outDir, "index.html"))) {
    throw new Error("构建结束但没有 out/index.html，静态导出可能没生效");
  }
  const count = countHtml(outDir);
  log("导出完成：out/ 共 " + count + " 个 html");
} finally {
  for (const p of patched) {
    fs.copyFileSync(p.backup, p.file);
    log("还原源码：" + path.relative(root, p.file));
  }
  for (const m of moved.reverse()) {
    fs.mkdirSync(path.dirname(m.from), { recursive: true });
    fs.renameSync(m.to, m.from);
    log("移回：" + path.relative(root, m.from));
  }
  rmrf(staging);
}

function countHtml(dir) {
  let n = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) n += countHtml(full);
    else if (entry.name.endsWith(".html")) n += 1;
  }
  return n;
}
