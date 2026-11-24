# 从 0 到「域名可访问 + 有后台」的完整 SOP

> 这份文档是**给你（站长）看的操作手册**，不是给程序员看的源码说明。
> 目标：以后你想再做第二个、第三个网站，照着这份走一遍就能上线，而且**不需要国内备案**。
> 文中「你」= 你本人，「Agent」= 帮你写代码的 AI（也就是我）。

---

## 0. 先搞懂一件事：为什么不用备案

| 方案 | 服务器在哪 | 要备案吗 | 说明 |
|---|---|---|---|
| 阿里云/腾讯云轻量服务器 + 域名 | 国内 | **要**（ICP 备案，7–20 天） | 国内机房强制要求 |
| **Cloudflare Workers / Pages** | 全球边缘节点（含香港、新加坡、美国） | **不要** | 本 SOP 采用这条 |
| Vercel | 海外 | 不要 | 备选，配置更简单但国内访问速度一般 |

**关键点**：备案是「国内机房」的要求，跟你**在哪买域名**无关。
你在腾讯云买域名完全可以，只要把域名的 **NS（DNS 服务器）改到 Cloudflare**，网站跑在 Cloudflare 上，就不需要备案。

> 唯一注意：域名本身要在腾讯云完成**实名认证**（这是域名注册要求，不是备案），一般买完 1–3 天自动通过。

---

## 1. 总览：六个阶段

```
① 想清楚要什么  →  ② Agent 开发 + 本地验收  →  ③ 建 GitHub 仓库并推送
                                                        ↓
⑥ 日常维护（改内容不用推代码）  ←  ⑤ 绑域名 + 开后台  ←  ④ Cloudflare 部署
```

每个阶段下面都写了：**你要做什么**、**要给 Agent 什么**、**怎么验收**。

---

## 2. 阶段一：想清楚要什么（10 分钟）

你只需要写清楚四件事，Agent 才能少走弯路：

1. **网站是干什么的**（一句话）：例："一个只收录我个人奇幻电影片单的图鉴网站"
2. **有哪几个页面**：例：首页 / 全部作品 / 详情 / 我的收藏 / 后台
3. **数据从哪来**：例："我有一份 200 部的片单，海报要真实的，不许 AI 生成"
4. **长什么样**：给 2–3 个你喜欢的网站截图或参考描述（"深色、金色、衬线字体、像电影画册"）

**可以直接这样对 Agent 说：**

> 我要做一个「XX」网站，只看不注册。页面要有：首页、列表页、详情页、收藏页、后台。
> 数据我有一份 Excel/片单，稍后给你。风格参考这几张图（附截图）。先做能跑起来的版本，不要只给方案。

---

## 3. 阶段二：Agent 开发 + 本地验收

### 你要做的
- 什么都不用做，等它跑起来给你**截图**
- 看完提意见，**一次说一条**（"首页标题太大"比"整体再高级点"有用得多）

### 你要验收的三件事
1. **能打开**：它给你一个本地地址（如 `http://127.0.0.1:4317`），每页都能点
2. **数据对**：作品数量、海报、简介都对得上
3. **没有假东西**：不许编造评分/简介/海报，找不到就留空并标注

### 你可能会听到的技术词（不用懂，知道含义就行）
- `npm run dev` = 启动本地预览
- `tsc` 报错 = 代码有类型错误，Agent 会自己修
- 测试通过 = 它自己写的检查脚本跑通了

> ⚠️ 提醒 Agent 的话术：
> **"不许只说完成了，要给我实际运行结果；没做的功能要明确说没做，不许编。"**

---

## 4. 阶段三：建 GitHub 仓库 + 给 Agent 权限

### 4.1 你做什么（3 分钟）
1. 打开 https://github.com/new
2. Repository name 填 `你的项目名`（例如 `fantasy-atlas`）
3. 选 **Public**（免费 + Vercel/Cloudflare 都能直连）或 Private（也行，但授权要选仓库）
4. **不要**勾 "Add a README"，直接 Create

### 4.2 关于 token：两种，选 classic 更省事

Agent 需要用 token 帮你推送代码。你自己**不需要装 git**。

| | Fine-grained token（细粒度） | **Classic token（推荐）** |
|---|---|---|
| 地址 | Settings → Developer settings → Personal access tokens → Fine-grained | 同一页面 → **Tokens (classic)** |
| 麻烦点 | 要选仓库 + 逐个勾权限，**很容易漏勾导致 403** | 只勾一个 `repo` 就行 |
| 实测坑 | 我们试过两次都因为「Contents 是 Read-only」被 403 拒绝 | 一次成功 |

**推荐做法（classic，30 秒）：**
1. 打开 👉 https://github.com/settings/tokens/new?scopes=repo&description=website-deploy
2. Note 随便填（如 `website-deploy`）
3. Expiration 选 **7 days**（短一点更安全）
4. 勾选 **`repo`** 这一个复选框（其他都不用勾）
5. 拉到底 **Generate token** → 复制 `ghp_` 开头那串

**怎么给 Agent**：直接把 token 贴在对话里，并说：

> 这是我的 GitHub token：`ghp_xxx`，仓库 `用户名/仓库名` 已经建好。请你把代码推上去，推完告诉我 commit ID。用完提醒我撤销。

⚠️ **用完必须撤销**：https://github.com/settings/tokens → Delete。

### 4.3 验收
- 打开 `https://github.com/你的用户名/仓库名`，能看到 `app/`、`package.json` 等文件
- Agent 应该给你一个 **commit ID**（如 `f62c00c`）

---

## 5. 阶段四：Cloudflare 部署（推荐，不用备案）

### 5.1 你注册/准备
1. 注册 https://dash.cloudflare.com （邮箱即可，免费）
2. 登录后记下两样东西（后面要给 Agent）：
   - **Account ID**：首页右侧栏，或地址栏 `dash.cloudflare.com/<这一串>`
   - **API Token**（见下）

### 5.2 创建 API Token（关键：用模板，别自己勾权限）

1. 打开 👉 https://dash.cloudflare.com/profile/api-tokens
2. **Create Token**
3. 往下找到模板 **Edit Cloudflare Workers** → 点 **Use template**
   - 权限会自动填好（Workers Scripts、KV、R2、D1 都在里面）
4. **Account Resources** → Include → 你的账户
5. **Zone Resources** → Include → 你的域名（还没加域名就先选 All zones）
6. **Continue to summary** → **Create token** → 复制 `cfut_` 开头那串

> 如果 Agent 后面说「DNS 权限不够」（403 Authentication error），再建一个模板为 **Edit zone DNS** 的 token 给它，或用 Cloudflare 网页手动加 DNS（见阶段五）。

### 5.3 在 Cloudflare 里把「应用」和「仓库」连起来

> 这一步**必须你点**，因为要授权 GitHub，API token 代替不了。

1. 打开 https://dash.cloudflare.com → 左侧 **Workers & Pages** → **Create**
2. 选 **Import a repository**（或 **Connect to Git**）→ 授权 GitHub → 选你的 `用户名/仓库名`
3. 出现构建配置页时**先别点 Deploy**，把页面截图发给 Agent，让它告诉你三格怎么填
4. 本项目最终填的是：

   | 字段 | 值 |
   |---|---|
   | Build command | `npx opennextjs-cloudflare build` |
   | Deploy command | `npx wrangler deploy` |
   | Root directory | `/`（默认） |

5. 点 **Deploy**，等 2–5 分钟

### 5.4 如果构建失败怎么办（把这三件事告诉 Agent）

Agent 可以拿到构建日志，常见的三个坑（我们都踩过）：

| 报错 | 原因 | 解决 |
|---|---|---|
| `Could not find compiled Open Next config` | 构建命令只跑了 `next build`，没生成 `.open-next` | 构建命令改成 `npx opennextjs-cloudflare build` |
| `Can't set compatibility date in the future` | `wrangler.jsonc` 里的日期比 Cloudflare 服务器「今天」晚 | 改成今天或更早 |
| `spawn EPERM` / 卡在打包 | **你自己电脑**的安全策略禁止子进程（我们这台机器就是这样） | 别在本机打 Workers 包，交给 Cloudflare 云端构建 |

### 5.5 验收
- Cloudflare → 你的 Worker → **Deployments** 里最新一条是 **Success**
- 打开 `https://你的项目名.你的子域.workers.dev` 能看到网站

---

## 6. 阶段五：绑上你在腾讯云买的域名

### 6.1 把域名 NS 改到 Cloudflare（一次性，10 分钟生效，最多 24 小时）

1. Cloudflare → **Add a site** → 输入 `你的域名.com` → 选 **Free** 计划
2. Cloudflare 会给你两个 NS 地址，例如 `armando.ns.cloudflare.com`、`paloma.ns.cloudflare.com`
3. 打开腾讯云 → **域名与网站 → 我的域名 → 管理 → DNS 修改**
4. 把原来的 DNSPod 两条 NS **删掉/替换**成 Cloudflare 那两条 → 保存
5. 回 Cloudflare 点 **Check nameservers**，等状态变 **Active**

> 改 NS 后，原来在腾讯云 DNS 里配的记录（邮箱、其他子域）会失效，需要的话在 Cloudflare 里重建。

### 6.2 把域名指向 Worker（二选一）

**办法 A（推荐，自动建 DNS）**
1. Cloudflare → **Workers & Pages** → 点你的 Worker 名字进详情
2. **Settings** → **Domains & Routes** → **Add** → **Custom domain**
3. 输入 `你的域名.com` → Continue → 它会自动建 CNAME → 等状态变 **Active**

**办法 B（手动建 DNS）**
Cloudflare → 你的域名 → **DNS → Records → Add record**：

| Type | Name | Target | Proxy |
|---|---|---|---|
| CNAME | `@` | `你的项目.子域.workers.dev` | **Proxied（橙云）** |
| CNAME | `www` | 同上 | **Proxied（橙云）** |

> 必须是橙云（代理开启），否则 Worker 路由不生效。同一个 `@` 不能同时留 A 记录和 CNAME，旧的先删。

### 6.3 验收
- 浏览器打开 `https://你的域名.com` → 正常显示，地址栏有锁（证书 Cloudflare 自动签发）
- 手机 4G 打开也正常

---

## 7. 阶段六：给自己开一个后台（重要）

这是「不用每次改内容都找 Agent 改代码」的关键。

### 7.1 说清楚你要的后台
对 Agent 说：

> 加一个后台 `/admin`，不放在普通导航里（只放页脚小字入口）。用账号密码登录，能：
> ① 增删改电影（片名、年份、简介、海报、标签）；② 改首页板块和主题；③ 审核用户投稿；④ 导出备份。
> 所有读写必须在服务端鉴权，游客不能访问。保存后前台立刻生效。

### 7.2 密码怎么设（云端的坑）

- 后台密码**写进代码里**是危险的（仓库是公开的）
- 正确做法：设为平台的**环境变量/密钥**
  - Vercel：Project → Settings → Environment Variables
  - Cloudflare Workers：Worker → **Settings → Variables and Secrets** → 添加 `ADMIN_USER` / `ADMIN_PASSWORD` / `ADMIN_SECRET`（类型选 **Secret**）
- 对 Agent 说：

> 后台账号 `admin`，密码 `你的密码`，请配置成平台密钥（不要写进仓库），然后告诉我线上用这套能不能登进去。

### 7.3 为什么后台「能登录但保存失败」（一定会遇到）

云平台的文件系统是**只读**的。网站数据如果存在本地 JSON 文件里，线上就无法写。

**解决办法：把数据存到云数据库/KV。** 常见选择：

| 方案 | 适合 | 说明 |
|---|---|---|
| **Cloudflare KV** | 数据量小（<25MB/条）、读写简单 | 我们用的这个，免费额度够个人站 |
| Cloudflare D1 | 需要 SQL 查询 | 稍复杂 |
| Vercel KV / Upstash Redis | 部署在 Vercel | 免费额度小 |
| Supabase | 需要用户系统 | 杀鸡用牛刀 |

对 Agent 说：

> 后台保存的时候线上报 ENOENT / 只读文件系统。请把数据层改成 Cloudflare KV（或对应云存储），本地开发仍用文件，两边都要能用。

### 7.4 验收（一定要让它给你证据）
- 登录 → 改一部电影简介 → 保存 → 打开该电影详情页 → **刷新能看到新简介**
- 改首页某个主题名字 → 保存 → 回首页刷新 → **名字变了**
- 再改回去 → 确认能还原

---

## 8. 日常怎么维护

| 你想做的事 | 怎么做 | 要不要找 Agent |
|---|---|---|
| 加一部电影 / 改简介 / 换海报 | 后台 `/admin/movies` | ❌ 不用 |
| 调整首页板块、主题、收录 | 后台 `/admin/home` | ❌ 不用 |
| 审核投稿 | 后台 `/admin/submissions` | ❌ 不用 |
| 改配色、加新页面、改交互 | 让 Agent 改代码 → 推 GitHub → 自动重新部署 | ✅ 要 |
| 换域名 / 换平台 | 参照本文档阶段五 | ✅ 建议让 Agent 陪着做 |

### 备份建议（每 1–2 周一次）
后台 → **数据与备份** → 导出 JSON，存到自己电脑。
代码层面：GitHub 仓库本身就是备份（每次推送都有历史）。

### 出问题怎么回滚
- 网站白屏/报错：Cloudflare → Worker → **Deployments** → 找到上一个 Success 的版本 → **Rollback**
- 内容改坏了：用后台再改回来，或用备份 JSON 恢复

---

## 9. 成本与限额（个人站基本不花钱）

| 服务 | 免费额度 | 个人站用量 |
|---|---|---|
| GitHub 仓库 | 免费（公开/私有都行） | 绰绰有余 |
| Cloudflare Workers | 10 万次请求/天 | 个人站每天几十~几百次 |
| Cloudflare KV | 10 万次读/天、1000 次写/天 | 你改内容才写，够用 |
| Cloudflare DNS + 证书 | 免费 | — |
| 域名（腾讯云） | 约 30–80 元/年 | 唯一支出 |

---

## 10. 给 Agent 的「分阶段话术模板」

按顺序发，不要一次全发（一次一件事，它做得准）。

**① 立项**
> 我要做一个「___」网站，目标用户是我自己。页面：首页 / 列表 / 详情 / 收藏 / 后台。
> 风格参考（图）。数据我稍后给。先给我能跑起来的版本，别只给方案。

**② 数据**
> 这是我的片单（贴文本/上传文件）。要求：真实海报，找不到就标"待补充"；不许编造评分和简介；重复的要去重；只新增不覆盖。

**③ 验收**
> 给我本地地址和截图，每页都打开一遍。没做的功能明确列出来，不许说"已完成"但其实没做。

**④ 推 GitHub**
> 仓库 `用户名/仓库` 已建好，token：`ghp_xxx`。请推送，给我 commit ID。

**⑤ 部署**
> 我要部署到 Cloudflare Workers（不用备案）。这是我的 Account ID 和 API token：`___`。构建和部署配置你来写；需要我点的地方（GitHub 授权）告诉我点哪里。

**⑥ 后台**
> 加后台 `/admin`：账号密码登录、电影增删改、首页配置、投稿审核、备份导出。密码用平台密钥，不要写进代码。保存后前台立即生效。

**⑦ 域名**
> 域名 `___` 已买在腾讯云。请告诉我 NS 怎么改、DNS 记录怎么加；需要你操作的部分用 token 直接做。

**⑧ 验收（每次都问）**
> 用证据告诉我：改了哪部电影、改了什么、哪个页面刷新后变了、有没有还原。

---

## 11. 上线前检查清单（照着打勾）

- [ ] 本地每页都能打开，没有报错
- [ ] 作品数量、海报、简介都对
- [ ] 没有编造的评分/简介；缺图有"待补充"标记
- [ ] GitHub 上能看到最新代码（commit 时间是对的）
- [ ] Cloudflare Deployments 最新一条是 Success
- [ ] `https://域名.com` 打开正常，手机也能开
- [ ] 后台能登录（用你设的密码）
- [ ] 后台改一部电影 → 详情页刷新能看到
- [ ] 改坏了能改回来
- [ ] 两个 token（GitHub / Cloudflare）用完已撤销
- [ ] 后台密码不是默认值

---

## 12. 常见问题（FAQ）

**Q：一定要买域名吗？**
A：不买也能用 `xxx.workers.dev` 的免费域名。买域名只是为了好记、好看。

**Q：备案真的不用吗？**
A：网站放在 Cloudflare/Vercel 这类境外节点就不用。一旦你换成国内服务器（阿里云 ECS、腾讯云 CVM），就必须备案。

**Q：国内访问 Cloudflare 快吗？**
A：一般可用，晚高峰可能偏慢。要更快就需要国内 CDN + 备案，那是另一套方案。

**Q：Agent 说它本机打不出包怎么办？**
A：正常。让它把构建交给 Cloudflare 云端（阶段 5.3），本机只负责写代码和推 GitHub。

**Q：以后想换平台（比如换回 Vercel）麻烦吗？**
A：代码在 GitHub 上，换平台基本就是重新连一次仓库 + 改环境变量。数据在 KV 里的话需要导出再导入。

**Q：数据会不会丢？**
A：会。所以：① 后台定期导出 JSON；② GitHub 有代码历史；③ 重要改动前让 Agent 做一次快照。

---

*文档版本：2026-11-25 · 基于 Fantasy Atlas（fantasyatlas.online）的实际部署过程整理*
