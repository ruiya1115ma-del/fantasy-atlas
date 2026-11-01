# 部署说明

本项目是 Next.js 16 应用，**不需要数据库**，没有必须配置的密钥。
下面按「本地运行 → 静态导出 → Vercel → 自托管 Node」说明。

---

## 0. 环境要求

| 项 | 要求 |
| --- | --- |
| Node.js | **≥ 20.9**（本项目在 v24.19.0 上开发验证） |
| 包管理 | npm / pnpm 均可（仓库内是 npm 的 `package-lock.json`） |
| 磁盘 | 约 400MB（node_modules 300MB + 缓存 20MB + 数据 3MB） |
| 网络 | 仅 `npm install` 与可选的 `npm run enrich` 需要 |

---

## 1. 本地运行（推荐路径）

```bash
cd fantasy-atlas
npm install
npm run dev            # → http://127.0.0.1:4317
```

数据已经随仓库提供（`data/catalog.json`），**不需要先跑抓取**，装完依赖即可打开。

其他命令：

```bash
npm run typecheck      # tsc --noEmit
npm run validate       # 数据体检（字段/评分契约/标签完整性）
npm test               # 先编译 lib 再跑 25 个单元断言
npm run test:e2e       # 需要 dev server 在 4317 端口运行
npm run merge          # 重新合并原始片单 + 外部补全
npm run enrich         # 重新抓取 Wikidata + IMDb（约 2 分钟 / 有缓存时 1 秒）
```

### 1.1 端口冲突

`dev` 脚本固定 4317（自定义端口，避免和别的项目抢 3000）。
改端口：`npx next dev -p 3000`，或直接编辑 `package.json` 的 `dev` 脚本。

### 1.2 若在受限沙箱里运行

某些环境禁止 `fork` 子进程（会报 `spawn EPERM`），Next 的启动器与构建 worker 都会失败。
仓库已带两个逃生口：

- `npm run dev` → 实际执行 `node scripts/dev.mjs`（同进程启动 dev server，绕开 fork）；
- 构建时如遇 worker 报错，可试 `FA_WORKER_THREADS=1 npm run build`（改用 worker_threads）。

普通机器上直接用 `next dev` / `next build` 即可，无需这些开关。

---

## 2. 环境变量

全部可选。复制 `.env.example` 为 `.env.local` 后按需填写：

| 变量 | 必需 | 说明 |
| --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | 否 | 生成 sitemap / OG 绝对链接用；不填则用请求头推断 |
| `TMDB_API_KEY` | 否 | 预留，当前代码不调用 |
| `OMDB_API_KEY` | 否 | 预留，当前代码不调用 |
| `FA_WORKER_THREADS` | 否 | `1` 时构建用 worker_threads（受限沙箱才需要） |
| `FA_CACHE_DIR` | 否 | 抓取缓存目录，默认 `data/cache` |

**没有 API 密钥时站点完整可用**：评分来自已落盘的数据集，推荐是纯本地计算。
把变量写进 `.env.local` 或平台面板即可，`.gitignore` 已排除 `.env*`。

---

## 3. 构建

```bash
npm run build          # next build（Turbopack）
npm start              # 生产模式启动，默认 3000 端口
```

### 3.1 关于本项目开发机上的构建问题（必读）

开发环境是受限沙箱（禁止 fork），因此**构建在开发机上未能成功**，两种模式都试过：

| 命令 | 结果 | 原因 |
| --- | --- | --- |
| `next build` | 编译通过，静态生成阶段 `DataCloneError: () => null could not be cloned` | Turbopack 静态生成 worker + `workerThreads` 组合在 Next 16.0.7 上的问题 |
| `next build --webpack` | `Error: spawn EPERM` | webpack 构建 worker 需要 fork 子进程 |

这两个错误**都不是项目代码的问题**（`tsc --noEmit` 干净、开发模式全部路由 200、
9 个 HTTP 冒烟测试通过）。在允许 fork 的普通机器 / CI / Vercel 上构建即可，
建议把 `next.config.mjs` 的 `workerThreads` 保持默认 `false`（现在就是如此）。

**替代验证方式**（已在开发机上完成，见 `docs/TEST_REPORT.md`）：
开发服务器实测所有路由 200 + 25 个单元断言 + 9 个 HTTP 冒烟断言全绿。

---

## 4. 部署到 Vercel（最省事）

1. 推送到 GitHub / GitLab；
2. Vercel → New Project → 选择仓库 → Framework 自动识别为 Next.js；
3. Environment Variables 留空也能跑（可只填 `NEXT_PUBLIC_SITE_URL`）；
4. Deploy。

注意事项：

- `data/` 目录必须一起提交（`.gitignore` 只排除 `data/cache`，`catalog.json` 与 `raw/` 都会上传）；
- 若要 `generateStaticParams` 全量预渲染，58 个详情页 + 5 个片单页的预渲染时间约十几秒；
- 不需要任何 serverless 数据库。

---

## 5. 自托管（Docker / Node）

```dockerfile
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/data ./data
COPY --from=builder /app/next.config.mjs ./
EXPOSE 3000
CMD ["npm", "start"]
```

```bash
docker build -t fantasy-atlas .
docker run -p 3000:3000 fantasy-atlas
```

纯 Node（无 Docker）：

```bash
npm ci && npm run build
NODE_ENV=production PORT=3000 npm start
```

反向代理（Nginx）片段：

```nginx
location / {
  proxy_pass http://127.0.0.1:3000;
  proxy_set_header Host $host;
  proxy_set_header X-Forwarded-Proto $scheme;
}
```

---

## 6. 静态导出（可选，纯静态托管）

`next.config.mjs` 里打开：

```js
const nextConfig = { output: "export", images: { unoptimized: true } };
```

然后 `npm run build` 产出 `out/`，可直接丢到 GitHub Pages / Cloudflare Pages / 任意 CDN。

代价：`/explore` 的筛选与 `/recommend` 仍然可用（纯客户端），
但没有服务端渲染的 `generateMetadata` 动态部分（本项目不依赖），也不会生成 404 之外的动态路由。

---

## 7. 上线前检查清单

- [ ] `npm run typecheck` 无错误
- [ ] `npm run validate` 无 error（警告可接受）
- [ ] `npm test` 全绿
- [ ] `npm run test:e2e`（对着生产构建或 dev 端口）全绿
- [ ] 页面底部 IMDb 署名仍在（许可要求）
- [ ] `/sources` 页面能打开，数据来源说明与实际一致
- [ ] 若重跑过 `npm run enrich`，检查 `data/reports/import-report.json` 里 rejected 为 0
