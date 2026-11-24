# 管理员后台使用说明

后台地址：`/admin`（网站最底部小字「管理入口」也能进）。普通访客看不到入口，直接访问会被跳转到登录页。

## 1. 首次登录与账号配置

凭据来自环境变量（服务端读取，不写进代码）：

| 变量 | 作用 | 不配置时的默认值 |
| --- | --- | --- |
| `ADMIN_USER` | 管理员账号 | `admin` |
| `ADMIN_PASSWORD` | 管理员密码 | `fantasy-atlas-admin` |
| `ADMIN_SECRET` | 会话 Cookie 的 HMAC 密钥 | 由账号密码派生（仅够本地用） |

本机已配置在 `fantasy-atlas/.env.local`（已被 `.gitignore` 忽略）：

```ini
ADMIN_USER=admin
ADMIN_PASSWORD=mry2001
ADMIN_SECRET=fa-local-session-8f3c1d7a5b924e6cb0d1a4f7e2c95b38
```

改完需要**重启 dev server** 才生效。登录状态保存在一枚 HttpOnly Cookie（`fa_admin_session`）里，有效期 7 天。

线上部署（Vercel）要在 Project → Settings → Environment Variables 里配同样三个变量，否则会用默认密码。

## 2. 后台能做什么

| 页面 | 说明 |
| --- | --- |
| `/admin` | 总览：待审投稿、电影库、标签、缺海报、备份数量 |
| `/admin/home` | **首页内容管理**：板块 / 主题卡片 / 电影归属全部可配 |
| `/admin/submissions` | 投稿审核：推荐理由、喜爱程度、是否已在库，收录或暂不收录 |
| `/admin/movies` | 电影资料增删改（片名、年份、简介、海报、标签） |
| `/admin/tags` | 每个标签被用了多少次，发现空标签 |
| `/admin/media` | 缺海报检查 |
| `/admin/data` | 整库导出 JSON、手动快照 |
| `/admin/sources` | 数据来源与授权说明（原来在前台的那页） |

## 3. 首页内容管理（`/admin/home`）

首页现在**完全由配置生成**，不再写死在代码里。配置保存在 `data/home-config.json`。

可以做的事：

- **板块**：新增 / 删除 / 隐藏 / 恢复 / 改名 / 改副标题 / 上下移动排序，数量不限。
- **板块前台布局**：每个板块可以选「并排悬停展开」（原来五个视觉风格的交互：五张卡并排，鼠标悬停横向展开、其余收窄）或「平铺网格」（按主题寻找那种样式）。
- **主题卡片**：在任意板块里新增 / 删除 / 隐藏 / 恢复 / 改名 / 上下移动 / 移到别的板块，数量不限。
- **主题图片**：直接填图片路径（如 `/posters-douban/coraline.jpg`），或在「管理电影」里点「用其海报做封面」。
- **电影归属**：点「管理电影」查看该主题当前收录的电影，搜索片名 / 原名 / 年份，勾选后批量加入，单部可移除。

后台总览（`/admin`）把「首页内容管理」放在主体区域的第一个模块，下面直接有 **板块管理 / 主题管理 / 电影管理** 三个入口（分别跳到 `/admin/home#sections`、`#themes-<板块id>`、`#movies`），原有投稿审核、电影资料、分类标签、缺海报检查、数据备份卡片都保持不变。

规则：

1. **同一板块内，一部电影只能属于一个主题**：把电影加入 B 主题时，如果它已在同一板块的 A 主题里，会**自动从 A 移出**（保存提示里会写「已从『A』移出」）。
2. **不同板块之间允许重复**：同一部电影可以同时出现在「五个视觉风格」和「按主题寻找」里。
3. **移除电影只解除关联**，电影资料（`data/catalog.json`、raw 文件、海报）都不动。
4. **隐藏**只影响前台展示，配置全部保留，随时可恢复；**删除**会永久删掉该板块/主题的配置与关联，但不会删除任何电影。
5. 删除前会弹二次确认，并写明影响范围（多少主题、多少条关联、电影资料不受影响）。
6. 探索页的多标签筛选、详情页、收藏都不读这份配置，改首页不会影响它们。

保存行为：每次保存前会把上一份配置备份到 `data/backups/home-config-<时间戳>.json`；写入是原子写（先写 `.tmp` 再 rename）。

## 4. 数据存在哪里

| 内容 | 位置 |
| --- | --- |
| 首页板块 / 主题 / 归属 | `data/home-config.json` |
| 电影库 | `data/catalog.json`（由 `data/raw/*.json` 合并生成） |
| 后台修改前的备份 | `data/backups/catalog-*.json`、`data/backups/home-config-*.json` |
| 投稿 | `data/submissions/submissions.json` |
| 收藏 / 评分 / 笔记 | 访客浏览器 `localStorage`（`fantasy-atlas:library:v1`） |

## 5. 部署到 Vercel 后的限制

Vercel 的 Serverless 文件系统是**只读**的，所以线上后台保存会返回明确提示（不会假装成功）：

> 当前部署环境是只读文件系统，无法保存。请在本机或自托管环境运行后台。

线上首页会读到随代码一起部署的 `data/home-config.json`（如果存在），否则用代码里的初始配置。要让线上也能编辑，需要把存储换成可写的数据库（如 Supabase / Vercel KV / 对象存储），改动集中在 `lib/home-config.ts` 与 `lib/admin/store.ts` 两个文件。

## 6. 一个本地开发的注意点

用 PowerShell 直接改 JSON 容易写进 UTF-8 BOM（`package.json` 出过这个事故，会报 `Unexpected token '﻿'`）。改配置请用编辑器或后台，不要用 `Set-Content -Encoding utf8`；必要时用：

```powershell
[IO.File]::WriteAllText($absPath, $text, (New-Object System.Text.UTF8Encoding($false)))
```
