#!/usr/bin/env node
/**
 * push-isogit.mjs —— 用 isomorphic-git（纯 JS 实现）通过 git smart HTTP 协议推送，
 * 一次 POST 传整个 packfile，避开 GitHub REST API 的 blob 次要限流。
 *
 * 用法：
 *   $env:GITHUB_TOKEN="ghp_xxx"
 *   node scripts/push-isogit.mjs <owner> <repo> [branch]
 */

import fs from "node:fs";
import path from "node:path";
import git from "isomorphic-git";
import http from "isomorphic-git/http/node";

const DIR = process.cwd();
const [owner, repo, branchArg] = process.argv.slice(2);
const branch = branchArg || "main";
const token = process.env.GITHUB_TOKEN;

if (!owner || !repo) {
  console.error("用法：node scripts/push-isogit.mjs <owner> <repo> [branch]");
  process.exit(1);
}
if (!token) {
  console.error("缺少环境变量 GITHUB_TOKEN");
  process.exit(1);
}

const IGNORE_DIR = new Set(["node_modules", ".next", "out", "build", "dist", ".test-build", ".git", ".npm-cache"]);
const IGNORE_FILE = new Set(["dev.log", "build.log", "err.txt", "next-env.d.ts", "tsconfig.tsbuildinfo", "push.log"]);

function shouldSkip(rel) {
  const parts = rel.split("/");
  const base = parts[parts.length - 1];
  if (IGNORE_FILE.has(base)) return true;
  if (base.startsWith(".env")) return true;
  if (rel.startsWith("data/cache/")) return true;
  return parts.slice(0, -1).some((d) => IGNORE_DIR.has(d));
}

function walk(dir, rel = "", out = []) {
  for (const entry of fs.readdirSync(path.join(dir, rel), { withFileTypes: true })) {
    const childRel = rel ? `${rel}/${entry.name}` : entry.name;
    if (shouldSkip(childRel)) continue;
    const abs = path.join(dir, childRel);
    if (entry.isDirectory()) walk(dir, childRel, out);
    else if (entry.isFile()) out.push({ rel: childRel, abs, size: fs.statSync(abs).size });
  }
  return out;
}

async function main() {
  console.log(`初始化 git 仓库（若不存在）：${DIR}`);
  await git.init({ fs, dir: DIR, defaultBranch: branch });

  const files = walk(DIR);
  const totalMB = files.reduce((s, f) => s + f.size, 0) / 1024 / 1024;
  console.log(`加入 ${files.length} 个文件（${totalMB.toFixed(1)} MB）`);

  let i = 0;
  for (const f of files) {
    await git.add({ fs, dir: DIR, filepath: f.rel });
    i += 1;
    if (i % 100 === 0) process.stdout.write(`\r  已暂存 ${i}/${files.length}`);
  }
  process.stdout.write("\n");

  const sha = await git.commit({
    fs,
    dir: DIR,
    message: "feat: Fantasy Atlas —— 奇幻电影图鉴（274 部作品 · 全部真实海报）",
    author: { name: "ruiya1115ma-del", email: "ruiya1115ma@gmail.com" },
  });
  console.log(`本地提交完成：${sha}`);

  const url = `https://github.com/${owner}/${repo}`;
  console.log(`推送到 ${url}（分支 ${branch}）…`);
  const res = await git.push({
    fs,
    http,
    dir: DIR,
    remote: "origin",
    url,
    ref: branch,
    force: true,
    onAuth: () => ({ username: token, password: "x-oauth-basic" }),
  });
  console.log("推送结果：", JSON.stringify(res));
  if (res.error) throw new Error(res.error);
  console.log(`完成：${url}`);
}

main().catch((e) => {
  console.error("推送失败：", e?.message ?? e);
  process.exit(1);
});
