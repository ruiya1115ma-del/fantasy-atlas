#!/usr/bin/env node
/**
 * 用一个 Git 提交保存当前工作区快照（本机没有 git 命令，使用 isomorphic-git 纯 JS 实现）。
 *
 * 用法：
 *   node scripts/git-snapshot.mjs "提交说明"
 *   node scripts/git-snapshot.mjs "提交说明" "tag-name"
 *
 * 说明：
 * - 只做本地 add/commit/tag，不联网、不推送。
 * - 跳过 node_modules / .next / backups / data/cache 等生成物与私密文件。
 */
import fs from "node:fs";
import path from "node:path";
import git from "isomorphic-git";

const DIR = process.cwd();
const message = process.argv[2] || `snapshot: ${new Date().toISOString()}`;
const tagName = process.argv[3] || null;

const IGNORE_DIRS = new Set([
  "node_modules",
  ".next",
  "out",
  "build",
  "dist",
  ".test-build",
  ".git",
  ".npm-cache",
  ".vercel",
  ".appdata",
  "backups",
]);
const IGNORE_FILES = new Set([
  "dev.log",
  "dev2.log",
  "dev3.log",
  "build.log",
  "err.txt",
  "next-env.d.ts",
  "tsconfig.tsbuildinfo",
  "push.log",
  "vercel-deploy.log",
  "vercel-deploy2.log",
]);

function shouldSkip(rel) {
  const parts = rel.split("/");
  const base = parts[parts.length - 1];
  if (IGNORE_FILES.has(base)) return true;
  if (base.startsWith(".env")) return true;
  if (/\.tar\.gz$/.test(base) || /\.zip$/.test(base)) return true;
  if (rel.startsWith("data/cache/")) return true;
  return parts.slice(0, -1).some((d) => IGNORE_DIRS.has(d));
}

function walk(dir, rel = "", out = []) {
  for (const entry of fs.readdirSync(path.join(dir, rel), { withFileTypes: true })) {
    const childRel = rel ? `${rel}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      if (IGNORE_DIRS.has(entry.name)) continue;
      walk(dir, childRel, out);
    } else if (entry.isFile()) {
      if (shouldSkip(childRel)) continue;
      out.push(childRel);
    }
  }
  return out;
}

async function main() {
  if (!fs.existsSync(path.join(DIR, ".git"))) {
    console.log("没有 .git 目录，正在初始化仓库…");
    await git.init({ fs, dir: DIR, defaultBranch: "main" });
  }

  const files = walk(DIR);
  console.log(`待提交文件：${files.length} 个`);

  let added = 0;
  for (const filepath of files) {
    await git.add({ fs, dir: DIR, filepath });
    added += 1;
    if (added % 100 === 0) console.log(`  …已暂存 ${added}/${files.length}`);
  }
  console.log(`已暂存 ${added} 个文件`);

  const oid = await git.commit({
    fs,
    dir: DIR,
    message,
    author: { name: "Fantasy Atlas", email: "fantasy-atlas@local" },
  });
  console.log(`提交完成：${oid.slice(0, 8)}  ${message}`);

  if (tagName) {
    await git.tag({ fs, dir: DIR, ref: tagName, object: oid });
    console.log(`已打标签：${tagName} → ${oid.slice(0, 8)}`);
  }

  try {
    const log = await git.log({ fs, dir: DIR, depth: 5 });
    console.log("\n最近 5 个提交：");
    for (const entry of log) {
      console.log(`  ${entry.oid.slice(0, 8)}  ${new Date(entry.commit.committer.timestamp * 1000).toLocaleString("zh-CN")}  ${entry.commit.message.split("\n")[0]}`);
    }
    const tags = await git.listTags({ fs, dir: DIR });
    console.log(`\n现有标签：${tags.length ? tags.join(" / ") : "（无）"}`);
  } catch {
    /* 首次提交时 log/tag 可能为空，忽略 */
  }
}

main().catch((err) => {
  console.error("快照失败：", err?.message ?? err);
  process.exit(1);
});
