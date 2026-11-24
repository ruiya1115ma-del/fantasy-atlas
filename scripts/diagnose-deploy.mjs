#!/usr/bin/env node
/**
 * 部署排查：本地源码 / Git / GitHub / 线上站点 四处对照。
 * 只读，不改任何东西。
 */
import fs from "node:fs";
import path from "node:path";
import git from "isomorphic-git";
import http from "isomorphic-git/http/node";

const root = path.resolve(import.meta.dirname, "..");
const repo = "ruiya1115ma-del/fantasy-atlas";
const liveOrigin = process.argv[2] || "https://fantasy-atlas-beta.vercel.app";
const token = process.env.GITHUB_TOKEN;

function out(title, value) {
  console.log("\n=== " + title + " ===");
  console.log(typeof value === "string" ? value : JSON.stringify(value, null, 2));
}

// 1. 本地 Git
const dir = path.join(root, ".git");
out("本地 .git 存在", fs.existsSync(dir));

try {
  const branch = await git.currentBranch({ fs, dir });
  const commits = await git.log({ fs, dir, depth: 5 });
  out("本地分支 / HEAD", {
    branch,
    head: commits[0] ? commits[0].oid : null,
    recent: commits.map((c) => ({
      oid: c.oid.slice(0, 10),
      date: new Date(c.commit.author.timestamp * 1000).toISOString(),
      message: c.commit.message.split("\n")[0]
    }))
  });

  const matrix = await git.statusMatrix({ fs, dir });
  const dirty = matrix.filter(([, head, work, stage]) => head !== work || stage !== 1);
  out("未提交的改动数", dirty.length);
  out("未提交文件（前 20）", dirty.slice(0, 20).map(([f]) => f));

  const remotes = await git.listRemotes({ fs, dir });
  out("本地 remote", remotes);
} catch (error) {
  out("本地 Git 读取失败", String(error));
}

// 2. GitHub 远端
async function gh(urlPath) {
  const res = await fetch("https://api.github.com" + urlPath, {
    headers: {
      accept: "application/vnd.github+json",
      "user-agent": "fantasy-atlas-diagnose",
      ...(token ? { authorization: "Bearer " + token } : {})
    }
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = text.slice(0, 300);
  }
  return { status: res.status, json };
}

const repoInfo = await gh(`/repos/${repo}`);
out("GitHub 仓库", repoInfo.status === 200 ? {
  full_name: repoInfo.json.full_name,
  default_branch: repoInfo.json.default_branch,
  pushed_at: repoInfo.json.pushed_at,
  private: repoInfo.json.private
} : repoInfo);

const branches = await gh(`/repos/${repo}/branches`);
out("GitHub 分支", branches.status === 200 ? branches.json.map((b) => ({
  name: b.name,
  sha: b.commit.sha.slice(0, 10),
  date: b.commit.commit?.author?.date ?? null
})) : branches);

const commits = await gh(`/repos/${repo}/commits?per_page=5`);
out("GitHub 最近提交", commits.status === 200 ? commits.json.map((c) => ({
  sha: c.sha.slice(0, 10),
  date: c.commit.author.date,
  message: c.commit.message.split("\n")[0]
})) : commits);

// 远端 HEAD 与本地 HEAD 对比
try {
  const localHead = (await git.log({ fs, dir, depth: 1 }))[0]?.oid;
  const remoteHead = commits.status === 200 ? commits.json[0]?.sha : null;
  out("HEAD 对比", {
    local: localHead ? localHead.slice(0, 10) : null,
    remote: remoteHead ? remoteHead.slice(0, 10) : null,
    same: Boolean(localHead && remoteHead && localHead === remoteHead)
  });
} catch {}

// 关键文件在 GitHub 上是否存在（判断今天的改动有没有推上去）
for (const file of ["lib/home-config.ts", "app/admin/home/page.tsx", "scripts/build-static-pages.mjs"]) {
  const r = await gh(`/repos/${repo}/contents/${file}`);
  out(`GitHub 有 ${file}`, r.status === 200 ? "yes" : r.status);
}

// 3. 线上站点
async function probe(url) {
  const started = Date.now();
  const res = await fetch(url, { redirect: "follow", headers: { "user-agent": "Mozilla/5.0 diagnose" } });
  const html = await res.text();
  return {
    url,
    status: res.status,
    finalUrl: res.url,
    ms: Date.now() - started,
    buildId: (html.match(/"buildId":"([^"]+)"/) || [])[1] ?? null,
    title: (html.match(/<title>([^<]*)<\/title>/) || [])[1] ?? null,
    markers: {
      homeConfig: html.includes("五个视觉风格"),
      fateDraw: html.includes("命运随机抽取"),
      sixThemes: html.includes("暗黑童话"),
      oldHero: html.includes("进入魔法世界"),
      adminLink: html.includes("管理入口")
    },
    headers: {
      "x-vercel-id": res.headers.get("x-vercel-id"),
      "x-vercel-cache": res.headers.get("x-vercel-cache"),
      age: res.headers.get("age"),
      "last-modified": res.headers.get("last-modified")
    }
  };
}

out("线上首页探测", await probe(liveOrigin + "/"));
out("线上 /explore 探测", await probe(liveOrigin + "/explore"));
