# 部署到 Vercel（GitHub 自动更新）

> 本文件说明「怎么把这个站点变成公开网址」以及**必须由你本人完成**的三步。
> 站点本身不需要数据库、不需要登录即可浏览；收藏/评分/笔记存在访客自己的浏览器里。

---

## 一、这个项目的真实形态（部署前先确认）

| 项目 | 现状 |
| --- | --- |
| 技术栈 | Next.js 16（App Router）+ React 19 + TypeScript + Tailwind CSS 4 |
| 数据 | 构建期读取仓库内的 JSON（`data/catalog.json`：274 部作品、海报/剧照/评分/标签全在里面） |
| 数据库 | **没有数据库**，也没有使用 Supabase |
| 用户数据 | 收藏 / 已看 / 评分 / 笔记 → `localStorage`（`fantasy-atlas:library:v1`），不落服务器 |
| 图片 | 海报已下载到 `public/posters/`（随仓库发布），不依赖第三方图床 |
| 需要登录才能看吗 | 不需要。普通访客直接可浏览全站 |
| 环境变量 | 一个都不需要（`NEXT_PUBLIC_SITE_URL` 可选，仅影响 sitemap 绝对地址） |
| 后台 `/admin`、`/submit` | 依赖服务端写文件，**Vercel 上是只读文件系统**，线上只能浏览、不能写入（详见第五节） |

---

## 二、需要你完成的 3 件事

### 1）准备一个 GitHub 仓库

- 注册 / 登录 <https://github.com>（如果没有账号）。
- 新建一个仓库，例如 `fantasy-atlas`，**不要**勾选自动生成 README。
- 把仓库地址发我，或者把有 `repo` 权限的 token 发我（见下面「关于 token」）。

> 我这边**没有 git 命令行**（本机未安装 git），也没有你的 GitHub 授权。所以「推代码 / 建 Vercel 项目」这两步要么你给授权，要么你自己点几下。

### 2）Vercel 关联 GitHub

- 登录 <https://vercel.com>（用 GitHub 账号一键登录即可）。
- `Add New… → Project → Import Git Repository`，选中上面的仓库。
- Framework Preset 会自动识别为 **Next.js**；Build Command `npm run build`；Output 默认。
- 环境变量：**不用填**。
- 点 Deploy，等 1–2 分钟。

完成后 Vercel 会给你一个 `https://<project>.vercel.app` 的公开网址。

### 3）以后自动更新

Vercel 项目默认就开了自动部署：
- 推到 `main` 分支 → 自动构建并上线；
- 其他分支 / PR → 生成 Preview 网址，不影响正式站。

所以以后你（或我）改完代码，只要 commit + push，线上会在 1–2 分钟内自动更新。

---

## 三、关于 token（如果你希望我代劳）

我可以用 GitHub REST API 建仓库并推送代码，但需要你提供：

- 一个 **Fine-grained personal access token**，权限只需要 `Contents: Read and write`（限定到那一个仓库）；
- 有效期建议 7 天，用完可立刻 revoke。

Vercel 部署同理需要 **Vercel Access Token**（Account Settings → Tokens）。

**安全提醒**：token 请不要发在公开聊天里；如果这是共享会话，建议你自己在 Vercel 面板点 Import，我不需要任何 token。

---

## 四、部署后自检清单

| 检查项 | 地址 | 期望 |
| --- | --- | --- |
| 首页 | `/` | 品牌首屏 + 5 个视觉风格画廊 + 8 个叙事主题 + 命运抽取 |
| 探索 | `/explore` | 274 部作品、左侧筛选、海报全部加载 |
| 分类页 | `/themes/dark-gothic` | 69 部件品、真实剧照头图 |
| 叙事主题页 | `/motifs/bestiary` | 57 部，可进详情 |
| 详情页 | `/movies/crimson-peak` | 海报、剧照、简介、外部评分来源 |
| 随机抽取 | `/` 滚动到最下方 | 点「抽取一部」出真实海报结果卡 |
| 收藏页 | `/favorites` | 空态正常，加入收藏后刷新仍在 |
| 移动端 | 手机打开同一网址 | 导航抽屉、画廊横滑、筛选抽屉可用 |

---

## 五、上线后会受限的两个功能（重要）

| 功能 | 本地 | Vercel 线上 | 原因 |
| --- | --- | --- | --- |
| 用户投稿 `/submit` | 写入 `data/submissions/submissions.json` | **会失败** | 无服务器磁盘写入权限（只读文件系统） |
| 后台批量导入 `/admin` | 写入 `data/admin/import-queue.json` + `data/raw/` | **会失败** | 同上 |
| 已审核内容 | 跟随仓库发布 | 正常显示 | 内容在构建期已进 JSON |

要让这两个功能在线上可用，需要外部存储（任选一种，都是小改动）：

1. **Supabase**（Postgres + Storage）：建两张表 `submissions`、`import_queue`，用 `SUPABASE_URL` + `SUPABASE_ANON_KEY`（RLS 只允许插入、不允许读全表）；
2. Vercel KV / Upstash Redis：适合队列型数据；
3. 简化为「投稿 → 打开 GitHub Issue」：零后端，最省事。

> 如果你希望线上也能投稿，告诉我选哪种，我来接（需要你建账号并把 URL / key 填进 Vercel 环境变量）。

---

## 六、本地复现生产构建（本机跑不通，非代码问题）

```bash
cd fantasy-atlas
npm install
npm run build     # 本机会失败：沙箱禁止 fork 子进程
npm start
```

失败原因（已确认，与代码无关）：本机沙箱不允许 `fork` 子进程，`next build` 的静态生成 worker 起不来。
- Turbopack：`Error [DataCloneError]: () = >null could not be cloned`
- webpack：`Error: spawn EPERM`

在 Vercel（或任意普通电脑 / Docker）上构建是正常的 —— `next.config.mjs` 里 `workerThreads` 默认 `false`，只有本机 dev 用 `scripts/dev.mjs` 时才置 `1`。
