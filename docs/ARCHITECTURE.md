# 架构、数据流与设计系统

## 1. 技术选型与理由

| 选择 | 理由 |
| --- | --- |
| Next.js 16（App Router）+ React 19 | 服务端读本地 JSON 渲染，58 个详情页零客户端数据负担；动态路由 + `generateStaticParams` 便于将来静态化 |
| TypeScript strict | 领域类型（`Movie` / `MediaCard` / `FilterState` / `UserPreferences`）在 6 个模块间共享，靠类型而不是注释保证契约 |
| Tailwind CSS v4（`@theme` 令牌） | 设计系统以 CSS 变量落地，颜色/字体/缓动可被组件直接引用，不引入 UI 库 |
| 无数据库、无 API 必需项 | 个人项目、单用户、数据量 58 条；JSON 落盘 + 构建期读取最简单也最可审计 |
| 程序化 SVG 封面 | 无海报授权 → 用确定性算法生成原创视觉，既不侵权也不留空白 |
| node:test（零依赖） | 沙箱里装不了额外测试框架也不必装；断言直接跑在真实数据上 |

**刻意不用**：`next/font`（构建期需联网下载字体，断网会失败 → 改 CSS 字体栈）、
任何第三方埋点/评论/账号服务。

## 2. 数据流（三段，互相可追溯）

```
① 原始记录（人写，只增不改）
   data/raw/catalog-a..e.json      62 条示例片单，25 字段契约
        │
        │  npm run merge  (scripts/merge-catalog.mjs)
        │  · 校验 18 个必填字段、枚举、简介字数
        │  · 未知标签剔除并写进报告（不静默通过）
        │  · 原始记录里出现评分 → 直接忽略并报警（评分只能来自外部核实）
        ▼
② 外部补全（机器抓，可缓存可复跑）
   data/derived/enrichment.json
        · Wikidata：P31/P577/P57/P161/P495/P2047/P345/P136
        · IMDb datasets：title.ratings.tsv.gz（流式解压匹配）
        · 置信度 < 0.8 → needs_review；无匹配 → 不编造，留空
        │
        │  再跑一次 npm run merge（把 enrichment 合进 catalog）
        ▼
③ 生成物（只读）
   data/catalog.json + data/reports/import-report.json
        │
        ├─ lib/data.ts        → 服务端组件（首页/探索/详情/片单）
        ├─ lib/filter.ts      → 客户端筛选（拿 MediaCard 轻量结构）
        ├─ lib/recommend.ts   → 浏览器内计算推荐
        └─ scripts/validate-data.mjs / tests/  → 体检与回归
```

关键设计：**原始记录永不被覆盖**。想修正数据就改 `data/raw/*.json` 再重跑导入；
`data/catalog.json` 被视为生成物，任何时候删掉都能重建。

## 3. 分层与职责

```
app/           路由与页面（服务端优先；只有真正需要交互的区块才是 client）
components/    Poster(纯函数) · MovieCard · ExploreClient · RecommendClient
               LibraryProvider(localStorage) · DetailActions · FavoritesClient
lib/           领域逻辑：types / vocabulary / curation / data / filter / recommend / similar
data/          raw(输入) · derived(补全) · catalog(生成) · reports(审计) · cache(抓取缓存)
scripts/       导入、补全、体检、沙箱开发服务器
tests/         数据契约 / 逻辑单元 / HTTP 冒烟
```

服务端与客户端的边界：

- **服务端**：读 catalog、算分类/氛围/片单、算相似作品、生成 metadata/sitemap。
- **客户端**：筛选与排序（`MediaCard` 只有列表需要的字段，58 条 ≈ 40KB）、
  推荐计算（纯函数，同一份代码服务端也能跑）、收藏/评分/笔记。

## 4. 设计系统（`app/globals.css`）

### 4.1 颜色令牌

| 令牌 | 值 | 用途 |
| --- | --- | --- |
| `--color-void` | `#05070c` | 最深背景 |
| `--color-ink` | `#080b12` | 主背景 |
| `--color-midnight` | `#0a1020` | 卡片背景（午夜蓝） |
| `--color-forest` | `#0a1a14` | 森林绿点缀 |
| `--color-gold` | `#c9a227` | 主强调色（暖金） |
| `--color-gold-soft` | `#e2c87f` | 次级强调、链接悬停 |
| `--color-ivory` | `#f3ecdf` | 主文字（象牙白） |
| `--color-ash` | `#97a0ae` | 次级文字 |
| `--color-mist` | `#6e5c86` | 雾紫点缀 |
| `--color-wine` | `#4a1626` | 暗红，用于哥特氛围 |

### 4.2 字体与排版

- 展示字体：`Cormorant Garamond` → `Songti SC` → `Noto Serif SC` → `SimSun` → Georgia（英文衬线 + 中文宋体回退）
- 正文字体：`Inter` → `PingFang SC` → `Microsoft YaHei`
- 层级：`.display`（大标题，含斜体强调）、`.eyebrow`（0.68rem 大写宽字距）、`.lede`（导语）

### 4.3 组件类

`.btn` / `.btn-primary` / `.btn-ghost` / `.btn-quiet` / `.btn-sm`、`.chip` / `.chip-on` / `.chip-type` / `.chip-action`、
`.panel` / `.panel-quiet`、`.field`、`.poster-frame` / `.poster-art`、`.skeleton`、`.shell` / `.section` / `.hairline`、
`.animate-fade-up` / `.animate-fade-in`、`.scroll-x`。

### 4.4 断点与状态

- 断点：`sm 640` / `md 768` / `lg 1024`（探索页在 `lg` 切换为左筛选栏 + 右网格；更小时改为抽屉）
- 空态：`<EmptyState>`（探索无结果、收藏为空、推荐无偏好）
- 加载态：`app/loading.tsx` 骨架屏 + `.skeleton`
- 错误态：`app/error.tsx`（含 digest 与重试）
- 动效降级：`prefers-reduced-motion: reduce` 时关闭位移与雾光

### 4.5 程序化封面（`components/Poster.tsx`）

```
hash(title) → seed
  ├─ 分类调色板（5 个分类各一套 from/via/to/ink）
  ├─ 每部作品 ±14° 色相、±3% 明度偏移（同分类不撞图）
  ├─ 母题 motif：arch 拱门 / spire 尖塔 / peak 山峰 / moon 月 / bloom 花
  ├─ 三种偏心 variant + orb 位置随机 + 四选一装饰层
  └─ 底部渐隐 + 年份/评分叠层（真实数据，不装饰性伪造）
```

纯函数 + 确定性：同一部作品每次生成的封面一致，不依赖随机数种子存档。

## 5. 可解释推荐（`lib/recommend.ts`）

```
输入：UserPreferences{ likedTags, likedMovieIds, avoidTags, excludeWatched, excludeFavorite, weights }
      + LibraryState（本机收藏/已看）
      + Movie[]

打分：
  for each movie:
      score  = Σ (likedTags 命中 × 该类权重)        // world 3 · aesthetic 3 · element 2 · mood 2 · type 1
             + Σ (相似作品命中的共享标签 × 2)
             + 同系列加成
             - avoidTags 命中惩罚
             + (externalRating - 7) × 0.2            // 只做同分微调
输出：RecommendationHit{ score, strength(0–100), reasons[], matchedTags[], similarTo[], caution[] }
      + empty 原因（no-preference / no-catalog / filtered-out）
```

设计原则：

1. **每条推荐必须能说出理由**，且理由里的标签必须真的存在于作品的标签里（有测试断言）；
2. **外部评分不能主导排序** —— 只有 ±0.2 的同分微调，避免"评分高的才配被推荐"；
3. **没有偏好就不推** —— 返回 `empty: "no-preference"` 而不是随机凑数；
4. **同时给劝退** —— `caution[]` 会提示"元素比你选的更杂""节奏偏慢"等。

## 6. 已知技术约束（环境层面）

沙箱禁止 `fork` 子进程，而 Next 的以下路径依赖子进程：

| 路径 | 现象 | 处理 |
| --- | --- | --- |
| `next dev` 启动 | `startServer` → fork → `spawn EPERM` | `scripts/dev.mjs` 同进程启动 |
| dev 渲染动态路由（`getStaticPathsWorker`） | `spawn EPERM` | `experimental.workerThreads: true`（`FA_WORKER_THREADS=1`） |
| `next build`（webpack） | 构建 worker fork → `spawn EPERM` | 未解决，见 docs/STATUS.md |
| `next build`（Turbopack）+ workerThreads | `DataCloneError: ()=>null could not be cloned` | 未解决（Next 16.0.7 上游问题） |
| `node --test tests/` | 每个测试文件一个子进程 → `spawn EPERM` | `--test-isolation=none` |

这些开关都集中在 `next.config.mjs` 与 `scripts/dev.mjs`，普通机器上不需要它们。
