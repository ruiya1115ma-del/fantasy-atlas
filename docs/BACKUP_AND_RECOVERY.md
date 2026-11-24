# 备份与恢复（Backup & Recovery）

Fantasy Atlas 的「数据 / 代码 / 图片」三类资产各有独立备份，任何一次重要改动前后都能回到上一个可用状态。

## 一句话版本

```powershell
cd fantasy-atlas
node scripts/backup.mjs "改了什么"   # 完整备份（数据 + 代码 + 图片 + 校验清单）
```

## 1. 当前资产状态

| 资产 | 位置 | 备份方式 |
|---|---|---|
| 电影数据库 | `data/catalog.json`（唯一数据源）+ `data/raw/*.json`（原始记录） | 每次 `backup.mjs` 复制到 `backups/<时间>-<备注>/data/`；后台每次改数据还会在 `data/backups/` 留单文件快照 |
| 投稿数据 | `data/submissions/submissions.json` | 同上（含在 `data/` 里） |
| 后台导入队列 | `data/admin/import-queue.json` | 同上 |
| 图片资源 | `public/posters/`、`public/posters-douban/` | `backups/<时间>/images.tar.gz` + `images-manifest.json`（每张图的 sha256） |
| 代码 | 整个项目 | `backups/<时间>/code.tar.gz` + 本地 Git 仓库 `.git` |

## 2. 备份产物结构

```
backups/20261124-192249-稳定版本-2026-11-24/
├─ data/                   # catalog.json、raw/、derived/、submissions/、admin/、reports/
├─ code.tar.gz             # 源码（434 个文件，不含 node_modules/.next/图片）
├─ images.tar.gz           # 298 张海报与剧照（46.5 MB）
├─ images-manifest.json    # 每张图的 sha256 / 字节数，用于校验
├─ summary.json            # 电影数、图片数、体积统计
└─ RESTORE.md              # 该次备份的恢复步骤
```

`backups/` 已加入 `.gitignore`，不会污染版本库，也不会被部署上传。

## 3. 日常开发流程（重要）

```powershell
# ① 动代码前：先留一份可回退的现状
node scripts/backup.mjs "开发前-<功能名>"

# ② 开发并测试
node node_modules/typescript/bin/tsc --noEmit
node --test --test-isolation=none tests/*.test.mjs

# ③ 测试全绿后：存新版本（本地 Git 提交 + 标签）
node scripts/git-snapshot.mjs "feat: <功能名>" "stable-<日期>"
```

`node scripts/git-snapshot.mjs` 会遍历工作区、跳过 `node_modules/.next/backups/data/cache` 与 `.env*`，然后 `git add + commit`，最后一个参数是标签名。

## 4. 出问题时怎么回退

三种粒度，从轻到重：

**① 只回退数据**（改坏了 catalog / 投稿）
```powershell
Copy-Item "backups\<最近一次>\data\*" "data\" -Recurse -Force
node scripts/dev.mjs
```

**② 回退代码**（改坏了页面/逻辑）
```powershell
tar -xzf "backups\<最近一次>\code.tar.gz" -C .
npm install
node scripts/dev.mjs
```

**③ 用 Git 回到某个提交**
```powershell
node scripts/git-snapshot.mjs              # 先看最近提交与标签
```
本机没有 `git` 命令，仓库由 isomorphic-git 维护；如需切回某个提交，用该次快照的 `code.tar.gz` 覆盖最直接。

## 5. 校验备份是否完整

```powershell
node -e "const fs=require('fs'),zlib=require('zlib'),p=require('path');const d=fs.readdirSync('backups').sort().pop();for(const f of ['code.tar.gz','images.tar.gz']){const raw=zlib.gunzipSync(fs.readFileSync(p.join('backups',d,f)));console.log(f, raw.length, 'bytes ok')}"
```

图片逐张校验：对照 `images-manifest.json` 里的 `sha256`。

## 6. 已知限制

- 本机**没有安装 git 命令**，版本库由 `isomorphic-git`（纯 JS）维护；`.git` 目录可用，但不能用命令行 git 操作。
- 推送 GitHub 需要 token：`$env:GITHUB_TOKEN="ghp_..."` 后运行
  ```powershell
  node scripts/push-isogit.mjs ruiya1115ma-del fantasy-atlas main
  ```
  token 只放在环境变量里，不写进仓库。
- 沙箱禁止 Node 启动子进程，所以 `backup.mjs` 用纯 JS 生成 `tar.gz`，不依赖系统 `tar`。
