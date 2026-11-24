#!/usr/bin/env node
/**
 * deploy-vercel.mjs —— 不依赖 Vercel CLI（CLI 需要 /v2/user，团队 token 会 404），
 * 直接用 Vercel REST API 上传文件并触发一次生产部署。
 *
 * 用法：
 *   $env:VERCEL_TOKEN="vcp_xxx"
 *   node scripts/deploy-vercel.mjs [--team=team_xxx] [--project=prj_xxx] [--name=fantasy-atlas] [--dry]
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep, posix } from "node:path";
import { createHash } from "node:crypto";

const API = "https://api.vercel.com";
const ROOT = process.cwd();
const args = process.argv.slice(2);
const flag = (name, def) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split("=").slice(1).join("=") : def;
};
const dry = args.includes("--dry");
const token = process.env.VERCEL_TOKEN;
const teamId = flag("team", "team_b08rmEQFnPihgpUmIV3gKcEb");
const projectId = flag("project", "prj_hci0ZtRrIVtufeaha83xNn9dXa96");
const projectName = flag("name", "fantasy-atlas");

if (!token) {
  console.error("缺少环境变量 VERCEL_TOKEN");
  process.exit(1);
}

const IGNORE_DIRS = new Set([
  "node_modules",
  ".next",
  "out",
  ".test-build",
  "backups",
  ".vercel",
  ".appdata",
  ".npm-cache",
  ".static-staging",
  ".git",
]);
const IGNORE_TOP = new Set(["dev.log", "build.log", "err.txt", "next-env.d.ts", "tsconfig.tsbuildinfo"]);
const IGNORE_PREFIX = [".env", ".DS_Store", "Thumbs.db"];

function ignored(rel) {
  const parts = rel.split(posix.sep);
  const base = parts[parts.length - 1];
  if (IGNORE_TOP.has(base)) return true;
  if (base.endsWith(".log") || base.endsWith(".zip")) return true;
  if (IGNORE_PREFIX.some((p) => base.startsWith(p))) return true;
  if (rel.startsWith("data/cache/")) return true;
  return parts.slice(0, -1).some((d) => IGNORE_DIRS.has(d));
}

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const abs = join(dir, entry.name);
    const rel = relative(ROOT, abs).split(sep).join(posix.sep);
    if (entry.isDirectory()) {
      if (ignored(rel + "/x")) continue;
      walk(abs, out);
    } else if (entry.isFile() && !ignored(rel)) {
      out.push({ abs, rel, size: statSync(abs).size });
    }
  }
  return out;
}

const authHeaders = (extra = {}) => ({ authorization: `Bearer ${token}`, ...extra });

async function call(path, opts = {}) {
  const res = await fetch(API + path, opts);
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  if (!res.ok) {
    const err = new Error(`${opts.method || "GET"} ${path} → ${res.status} ${text.slice(0, 300)}`);
    err.status = res.status;
    throw err;
  }
  return json;
}

async function withRetry(fn, label, tries = 6) {
  let last;
  for (let i = 0; i < tries; i += 1) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      const msg = String(e.message || "");
      const net = /fetch failed|ECONNRESET|ETIMEDOUT|socket hang up|other side closed|UND_ERR/i.test(msg);
      if (!(net || e.status === 429 || (e.status && e.status >= 500))) throw e;
      await new Promise((r) => setTimeout(r, Math.min(20000, 700 * 2 ** i)));
    }
  }
  throw new Error(`${label} 失败：${last?.message ?? last}`);
}

async function pool(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (cursor < items.length) {
        const i = cursor++;
        results[i] = await worker(items[i], i);
      }
    }),
  );
  return results;
}

async function main() {
  const files = walk(ROOT);
  const totalBytes = files.reduce((s, f) => s + f.size, 0);
  console.log(`准备部署 ${files.length} 个文件 / ${(totalBytes / 1048576).toFixed(1)} MB → 项目 ${projectName}`);
  if (dry) {
    files.slice(0, 10).forEach((f) => console.log("  ", f.rel));
    return;
  }

  let done = 0;
  const entries = await pool(files, 6, async (f) => {
    const buf = readFileSync(f.abs);
    const sha = createHash("sha1").update(buf).digest("hex");
    await withRetry(
      () =>
        call(`/v2/files?teamId=${teamId}`, {
          method: "POST",
          headers: authHeaders({ "x-vercel-digest": sha, "content-type": "application/octet-stream" }),
          body: buf,
        }),
      `upload ${f.rel}`,
    );
    done += 1;
    if (done % 50 === 0 || done === files.length) process.stdout.write(`\r  已上传 ${done}/${files.length}`);
    return { file: f.rel, sha, size: f.size };
  });
  process.stdout.write("\n");

  const deployment = await withRetry(
    () =>
      call(`/v13/deployments?teamId=${teamId}&forceNew=1`, {
        method: "POST",
        headers: authHeaders({ "content-type": "application/json" }),
        body: JSON.stringify({
          name: projectName,
          project: projectId,
          target: "production",
          files: entries,
          projectSettings: { framework: "nextjs", nodeVersion: "22.x" },
        }),
      }),
    "create-deployment",
  );
  console.log(`部署已创建：${deployment.id}`);
  console.log(`预览/生产 URL：https://${deployment.url}`);

  let state = deployment.readyState || deployment.status || "QUEUED";
  for (let i = 0; i < 120 && !["READY", "ERROR", "CANCELED"].includes(state); i += 1) {
    await new Promise((r) => setTimeout(r, 5000));
    const info = await call(`/v13/deployments/${deployment.id}?teamId=${teamId}`, { headers: authHeaders() });
    state = info.readyState || info.status;
    process.stdout.write(`\r  部署状态：${state}`);
    if (state === "READY") {
      console.log(`\n完成：https://${info.url}`);
      console.log(`别名：${(info.alias || []).join(", ") || "（见 Vercel 面板）"}`);
      return;
    }
    if (state === "ERROR") {
      console.error("\n构建失败，查看日志：https://vercel.com/" + projectName + "/" + deployment.id);
      process.exit(1);
    }
  }
  console.log(`\n部署仍在进行，请到 Vercel 面板查看：https://vercel.com/${projectName}`);
}

main().catch((e) => {
  console.error("部署失败：", e.message);
  process.exit(1);
});
