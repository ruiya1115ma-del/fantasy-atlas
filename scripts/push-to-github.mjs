#!/usr/bin/env node
/**
 * push-to-github.mjs —— 在没有 git 命令行的环境里，用 GitHub REST API 一次性推送整个项目。
 *
 * 用法：
 *   $env:GITHUB_TOKEN="ghp_xxx"
 *   node scripts/push-to-github.mjs <owner> <repo> [branch] [--dry]
 *
 * 特性：
 * - 尊重 .gitignore 白名单式排除（node_modules/.next/out/.test-build/data/cache/日志/环境变量）
 * - 先建 blob（并发 6，失败重试 3 次），再建 tree、commit（无父提交，适配空仓库），最后建/更新 ref
 * - --dry 只统计将要推送的文件，不发起任何写请求
 */

import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative, sep, posix } from "node:path";
import { createHash } from "node:crypto";

const ROOT = process.cwd();
const API = "https://api.github.com";

const EXCLUDED_DIRS = new Set([
  "node_modules",
  ".next",
  "out",
  "build",
  "dist",
  ".test-build",
  ".git",
  ".npm-cache",
  "cache", // 仅当路径含 data/cache，见下方判断
]);
const EXCLUDED_TOP = new Set([
  "dev.log",
  "build.log",
  "err.txt",
  "snap.log",
  "push.log",
  "poster-hunt.log",
  "enrich.log",
  "next-env.d.ts",
  "tsconfig.tsbuildinfo",
]);
const EXCLUDED_PREFIX = [".env", ".DS_Store", "Thumbs.db"];
const EXCLUDED_TOP_DIRS = new Set(["backups", ".vercel", ".appdata", ".static-staging", ".tmp-push", ".npm-cache"]);

function isExcluded(relPath) {
  const parts = relPath.split(posix.sep);
  const base = parts[parts.length - 1];
  if (EXCLUDED_TOP.has(base)) return true;
  if (base.endsWith(".log")) return true;
  if (base.endsWith(".zip")) return true;
  if (EXCLUDED_PREFIX.some((p) => base.startsWith(p))) return true;
  if (relPath.startsWith("data/cache/")) return true;
  if (parts.length > 1 && EXCLUDED_TOP_DIRS.has(parts[0])) return true;
  for (const d of parts.slice(0, -1)) {
    if (d === "node_modules" || d === ".next" || d === "out" || d === ".test-build" || d === ".git" || d === ".npm-cache") {
      return true;
    }
  }
  return false;
}

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const abs = join(dir, entry.name);
    const rel = relative(ROOT, abs).split(sep).join(posix.sep);
    if (entry.isDirectory()) {
      if (isExcluded(rel + "/x")) continue;
      walk(abs, out);
    } else if (entry.isFile()) {
      if (isExcluded(rel)) continue;
      out.push({ abs, rel, size: statSync(abs).size });
    }
  }
  return out;
}

async function api(path, { token, method = "GET", body } = {}) {
  const res = await fetch(API + path, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
      "User-Agent": "fantasy-atlas-push",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  if (!res.ok) {
    const err = new Error(`${method} ${path} → ${res.status} ${text.slice(0, 300)}`);
    err.status = res.status;
    throw err;
  }
  return json;
}

async function withRetry(fn, label, tries = 8) {
  let last;
  for (let i = 0; i < tries; i += 1) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      const msg = String(e.message || "");
      const network = /fetch failed|ECONNRESET|ETIMEDOUT|socket hang up|other side closed|UND_ERR/i.test(msg) || e.name === "TypeError";
      const secondary = e.status === 403 && /secondary rate limit|rate limit/i.test(msg);
      const retryable = network || secondary || e.status === 401 || e.status === 429 || (e.status && e.status >= 500);
      if (!retryable) throw e;
      const wait = secondary ? Math.min(120000, 30000 * (i + 1)) : Math.min(30000, 1000 * 2 ** i);
      if (secondary) process.stdout.write(`\n  ⏳ 触发 GitHub 次要限流，等待 ${Math.round(wait / 1000)}s 后重试（${label}）\n`);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  throw new Error(`${label} 失败：${last?.message ?? last}`);
}

function gitBlobSha(buf) {
  const header = Buffer.from(`blob ${buf.length}\0`, "utf8");
  return createHash("sha1").update(Buffer.concat([header, buf])).digest("hex");
}

async function pool(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const i = cursor;
      cursor += 1;
      results[i] = await worker(items[i], i);
    }
  });
  await Promise.all(runners);
  return results;
}

async function main() {
  const args = process.argv.slice(2);
  const dry = args.includes("--dry");
  const rest = args.filter((a) => a !== "--dry");
  const [owner, repo, branchArg] = rest;
  const branch = branchArg || "main";
  const token = process.env.GITHUB_TOKEN;

  if (!owner || !repo) {
    console.error("用法：node scripts/push-to-github.mjs <owner> <repo> [branch] [--dry]");
    process.exit(1);
  }
  if (!dry && !token) {
    console.error("缺少环境变量 GITHUB_TOKEN");
    process.exit(1);
  }

  const files = walk(ROOT);
  const totalBytes = files.reduce((s, f) => s + f.size, 0);
  console.log(`准备推送 ${files.length} 个文件 / ${(totalBytes / 1024 / 1024).toFixed(1)} MB → ${owner}/${repo}#${branch}`);
  const big = files.filter((f) => f.size > 50 * 1024 * 1024);
  if (big.length) {
    console.error("存在超过 50MB 的文件（GitHub 单文件上限 100MB）：", big.map((f) => `${f.rel} ${(f.size / 1024 / 1024).toFixed(1)}MB`));
    process.exit(1);
  }
  if (dry) {
    console.log("--dry 模式：未发起任何写请求。前 10 个文件示例：");
    files.slice(0, 10).forEach((f) => console.log("  ", f.rel));
    return;
  }

  // 1. 确认仓库可访问
  const info = await api(`/repos/${owner}/${repo}`, { token });
  console.log(`仓库可访问：${info.full_name}（默认分支 ${info.default_branch}，空仓库=${info.size === 0}）`);

  // 1.5 空仓库预热：GitHub 对「完全没有提交」的仓库，Git Data API 的 blobs 会返回 409
  //     （"Git Repository is empty."）。用 Contents API 建一个 README 占位提交即可激活 git 库；
  //     正式 tree 里包含根目录 README.md，随后会被覆盖，不留垃圾文件。
  //     若 README.md 已存在（例如上一次预热成功但 size 字段未刷新），跳过预热。
  let needBootstrap = info.size === 0;
  if (needBootstrap) {
    try {
      await api(`/repos/${owner}/${repo}/contents/README.md?ref=${branch}`, { token });
      needBootstrap = false;
      console.log("README.md 已存在，跳过预热");
    } catch (e) {
      if (e.status !== 404) throw e;
    }
  }
  if (needBootstrap) {
    const bootstrap = `# ${repo}\n\n初始化占位文件，构建完成后会被项目真正的 README 覆盖。\n`;
    await withRetry(
      () =>
        api(`/repos/${owner}/${repo}/contents/README.md`, {
          token,
          method: "PUT",
          body: {
            message: "chore: bootstrap repository",
            content: Buffer.from(bootstrap, "utf8").toString("base64"),
            branch,
          },
        }),
      "bootstrap",
    );
    console.log("空仓库已预热（创建 README 占位提交）");
  }

  // 2. 上传 blob（并发 2 + 轻量节流，避免触发 GitHub 次要限流；已存在的 blob 直接复用）
  let done = 0;
  let reused = 0;
  const blobs = await pool(files, 2, async (f) => {
    const buf = readFileSync(f.abs);
    const sha = gitBlobSha(buf);
    done += 1;
    let exists = false;
    try {
      await withRetry(() => api(`/repos/${owner}/${repo}/git/blobs/${sha}`, { token }), `probe ${f.rel}`, 2);
      exists = true;
    } catch (e) {
      if (e.status !== 404 && !String(e.message).includes("404")) throw e;
    }
    if (exists) {
      reused += 1;
    } else {
      const content = buf.toString("base64");
      await withRetry(
        () => api(`/repos/${owner}/${repo}/git/blobs`, { token, method: "POST", body: { content, encoding: "base64" } }),
        `blob ${f.rel}`,
      );
      await new Promise((r) => setTimeout(r, 120));
    }
    if (done % 25 === 0 || done === files.length) {
      process.stdout.write(`\r  已处理 ${done}/${files.length} 个 blob（复用 ${reused}）`);
    }
    return { path: f.rel, sha, mode: "100644", type: "blob" };
  });
  process.stdout.write("\n");

  // 3. 建 tree
  const tree = await withRetry(
    () => api(`/repos/${owner}/${repo}/git/trees`, { token, method: "POST", body: { tree: blobs } }),
    "tree",
  );
  console.log(`tree 创建完成：${tree.sha}（${blobs.length} 项）`);

  // 4. 建 commit（不设 parent：适配空仓库；若已有历史则取当前分支头作为 parent）
  let parents = [];
  try {
    const ref = await api(`/repos/${owner}/${repo}/git/ref/heads/${branch}`, { token });
    parents = [ref.object.sha];
  } catch (e) {
    if (e.status !== 404) throw e;
  }
  const commit = await withRetry(
    () =>
      api(`/repos/${owner}/${repo}/git/commits`, {
        token,
        method: "POST",
        body: {
          message: "feat: Fantasy Atlas —— 奇幻电影图鉴（274 部作品 · 全部真实海报）",
          tree: tree.sha,
          parents,
        },
      }),
    "commit",
  );
  console.log(`commit 创建完成：${commit.sha}（父提交 ${parents.length} 个）`);

  // 5. 建 / 更新 ref
  if (parents.length === 0) {
    await withRetry(
      () => api(`/repos/${owner}/${repo}/git/refs`, { token, method: "POST", body: { ref: `refs/heads/${branch}`, sha: commit.sha } }),
      "ref(create)",
    );
  } else {
    await withRetry(
      () => api(`/repos/${owner}/${repo}/git/refs/heads/${branch}`, { token, method: "PATCH", body: { sha: commit.sha, force: true } }),
      "ref(update)",
    );
  }
  console.log(`分支 ${branch} 已指向 ${commit.sha}`);
  console.log(`完成：https://github.com/${owner}/${repo}`);
}

main().catch((e) => {
  console.error("推送失败：", e.message);
  process.exit(1);
});
