# Fantasy Atlas · 奇幻电影探索指南

> **Enter Another World.** — 探索那些值得进入的幻想世界。

一个人的奇幻电影图鉴。不是影视数据库，也不是海报瀑布流：它按**画面、世界观和情绪**整理作品，
用可解释的标签匹配给出推荐，并且坚持一条底线 —— **不编造任何数据**。

数据（评分、导演、主演、类型、片长、简介、海报、剧照）全部抓取自各作品的**豆瓣**条目；
作品范围来自创作者自己的片单（`data/raw/`，原始文件永不被覆盖）。
当前收录数量见页面底部或 `data/reports/import-report.json`。

---

## 1. 快速开始

```bash
cd fantasy-atlas
npm install            # 依赖已装好时可跳过

npm run dev            # http://localhost:4317
```

生产构建：

```bash
npm run build && npm start
```

> **受限环境提示**：本仓库在开发时运行于一个禁止 `fork` 子进程的沙箱（`spawn EPERM`），
> 因此额外提供了 `npm run dev:sandbox`（`scripts/dev.mjs`，在同进程内启动 Next dev，
> 并用 `FA_WORKER_THREADS=1` 让 Next 用 worker_threads 代替子进程）。
> 普通机器上 `npm run dev` 即可，不需要这个脚本。
> 同一限制也导致本机无法完成 `next build`（详见 [docs/STATUS.md](docs/STATUS.md)）。

环境要求：Node ≥ 20（开发用 Node 24.19），无需任何数据库、无需任何 API Key。

---

## 2. 页面与功能

导航只保留 **首页 / 探索 / 我的收藏** 三个主入口，其余是工具页：

| 路径 | 内容 | 状态 |
| --- | --- | --- |
| `/` | **品牌首页**：`Fantasy Atlas` 巨型衬线主标题（绝对 C 位）+ 中文品牌标题「奇幻电影图鉴」+ 副标题；入口收在首屏左下角。向下依次是：五个主题的**横向展开式画廊**（悬停展开、点击进入独立主题页）、**按氛围寻找**（杂志式拼贴，六种情绪）、**命运随机抽取**（从有真实影像且未标记已看的作品里随机抽一部） | ✅ |
| `/themes/[slug]` | 五个主题的独立片单页：真实头图 + 该主题下全部作品的海报墙（可进详情），数量由标签规则实时算出 | ✅ |
| `/explore` | 顶部真实剧照轮播；标签组合筛选（同类「或」、跨类「与」）、关键词搜索、年代/地区/媒介/评分筛选、5 种排序、结果数、清除筛选、空态、移动端抽屉 | ✅ |
| `/movies/[slug]` | 详情页：真实海报 → 剧照 → 剧情简介（豆瓣原文，标注引用）→ 编辑视角（本站原写）→ 客观资料 → 六类标签 → 同系列 / 相似作品 → 收藏 / 已看 / 打分 / 笔记 → 数据来源 | ✅ |
| `/favorites` | 收藏 / 已看 / 待看 / 我评过分 / 我的笔记，支持 JSON 导出与导入 | ✅ |
| `/curated/[slug]` | 5 个编辑片单（规则生成 + 人工导语），工具页 | ✅ |
| `/recommend` | 按氛围、喜欢的作品或标签生成推荐，每条带逐条加分理由 | ✅ |
| `/sources` | 数据来源、评分 7 字段契约、图片授权、更正方式 | ✅ |
| `/submit` | 投稿补充（片名 + 豆瓣链接 + 说明），全部进入待审核队列 | ✅ |
| `/admin` | 管理后台：① 用户投稿审核（通过/驳回）② **片单批量导入**（文本一行一部 / CSV / JSON → 逐条豆瓣匹配 → 去重 → 待审核 → 批量发布，只向 raw 追加） | ✅ |
| 404 / error / loading | 友好空态、错误边界、骨架屏 | ✅ |
| `sitemap.xml` / `robots.txt` | 由 `app/sitemap.ts`、`app/robots.ts` 生成 | ✅ |

### 视觉设计系统

`app/globals.css` 里是完整的设计系统（Tailwind v4 `@theme` 令牌）：

- 颜色：午夜蓝 `#0a1020`、墨黑 `#080b12`、深森林 `#0a1a14`、暖金 `#c9a227`、象牙白 `#f3ecdf`、雾紫 `#6e5c86`
- 字体：衬线英文（Cormorant Garamond）+ 中文宋体/思源宋体回退；正文 Inter + 苹方/微软雅黑
- 间距与容器：`.shell`（max 1240px）、`.section`、`.hairline`
- 组件类：`.btn` 系列、`.chip` 系列、`.panel` / `.panel-quiet`、`.field`、`.poster-frame`、`.skeleton`、`.display` / `.eyebrow` / `.lede`
- 动效：轮播 1.4s 淡入淡出、`fade-up` / `fade-in`、雾光漂移、胶片颗粒，全部在 `prefers-reduced-motion` 下降级

**图片全部是真实物料**：每部作品的海报都由 `scripts/poster-hunt.mjs` 按
**IMDb 官方发行海报 → 维基百科条目主图 → TVmaze（剧集）→ Wikimedia Commons** 的顺序猎取，
并逐部核验「命中的片名 + 年份 + 是否竖版」，核验不通过就换下一个来源，宁缺也不张冠李戴；
剧照来自豆瓣条目图。**不使用任何 AI 生成画面冒充海报**。
当前实测：274 部作品 **274/274 有真实海报**（可直接跑 `node scripts/audit-posters.mjs` 复核）。

---

## 3. 数据与"不编造"的具体做法

| 数据 | 来源 | 说明 |
| --- | --- | --- |
| 作品范围 / 系列顺序 / 是否看过 | 创作者本人的片单（`data/raw/catalog-*.json`） | 原始文件永不被覆盖；新增作品只能新建 raw 文件或追加记录 |
| 评分 / 导演 / 主演 / 类型 / 地区 / 片长 | **豆瓣**（`scripts/fetch-douban.mjs`） | 10 分制、含评分人数与条目链接；逐条记录抓取时间，7 字段契约 |
| 剧情简介 | **豆瓣条目原文**（引用，详情页标注来源） | 本站另有自写的「编辑视角」，两部分明确分区 |
| 海报 | **IMDb 官方海报 → 维基条目主图 → TVmaze → Commons**（`scripts/poster-hunt.mjs`） | 逐部核验片名/年份/竖版，记录 `matchedTitle`、`matchedYear`、`tier`、来源链接与许可；版权归发行方，个人非商业引用 |
| 剧照 | **豆瓣**（`scripts/fetch-douban.mjs`） | 逐条记录来源与条目链接 |
| 标签 | 人工按固定词表标注 | 六类词表见 `docs/TAG_VOCABULARY.txt`，AI 生成必须带来源/置信度/审核状态 |
| 交叉核对 | IMDb 数据集 / Wikidata | 只在豆瓣缺数据时作为第二来源或校验用，不与豆瓣评分加权 |

每条记录的 `provenance` 都写明：来自哪个原始文件、外部补全方式与置信度、最后核对时间、待复核原因。

### 可解释推荐

`lib/recommend.ts` 的权重是写死的、可复核的：

```
世界观 3 · 视觉美学 3 · 核心元素 2 · 情绪氛围 2 · 相似作品 2 · 奇幻类型 1
```

外部 IMDb 评分**不参与主排序**，只用于同分时 ±0.2 的微调。每条推荐都会输出
`reasons[]`（每条带分值）、`matchedTags[]`、`caution[]`（劝退提示），
并有测试断言"理由里的标签必须真的在作品标签里"。

---

## 4. 目录结构

```
fantasy-atlas/
├─ app/                      # Next.js App Router
│  ├─ page.tsx               # 首页
│  ├─ explore/page.tsx       # 探索页（searchParams → ExploreClient）
│  ├─ movies/[slug]/page.tsx # 详情页（编辑内容 / 客观资料分区）
│  ├─ curated/[slug]/page.tsx# 编辑片单
│  ├─ favorites/page.tsx     # 我的收藏
│  ├─ recommend/page.tsx     # 推荐
│  ├─ sources/page.tsx       # 数据与授权
│  ├─ not-found.tsx · error.tsx · loading.tsx
│  ├─ sitemap.ts · robots.ts
│  ├─ layout.tsx             # metadata + LibraryProvider + header/footer
│  └─ globals.css            # 设计系统（Tailwind v4 令牌）
├─ components/               # Poster / MovieCard / ExploreClient / RecommendClient / LibraryProvider …
├─ lib/
│  ├─ types.ts               # 领域类型（Movie / MediaCard / Rating / UserPreferences …）
│  ├─ vocabulary.ts          # 六类标签词表、国家/语言/媒介标签
│  ├─ curation.ts            # 5 个分类、8 个氛围入口、5 个编辑片单（规则 + 导语）
│  ├─ data.ts                # 读 data/catalog.json（带 mtime 缓存）
│  ├─ filter.ts              # 筛选 / 排序 / URL 往返 / 编辑推荐度
│  ├─ recommend.ts           # 可解释推荐引擎
│  └─ similar.ts             # 相似作品（跨维度门槛）
├─ data/
│  ├─ raw/catalog-*.json     # 原始片单（只增不改，永不覆盖）
│  ├─ derived/enrichment.json# Wikidata + IMDb 补全结果
│  ├─ catalog.json           # 生成物（合并 + 校验后的标准化数据）
│  ├─ reports/import-report.json
│  └─ cache/                 # 抓取缓存（7 天 TTL）
├─ scripts/
│  ├─ merge-catalog.mjs      # 原始 → 标准化（校验 25 字段、剔除未知标签）
│  ├─ enrich.mjs             # Wikidata + IMDb 补全（0 依赖，支持 --offline/--selftest）
│  ├─ validate-data.mjs      # 数据体检
│  ├─ dev.mjs                # 沙箱内等价于 next dev
│  └─ enrich-README.md
├─ tests/                    # node:test（数据契约 / 逻辑 / HTTP 冒烟）
├─ docs/                     # 契约、架构、数据库、数据源、部署、测试、状态
└─ .env.example
```

完整说明见 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)。

---

## 5. 命令

| 命令 | 作用 |
| --- | --- |
| `npm run dev` | 开发服务器（4317） |
| `npm run dev:sandbox` | 沙箱/无 fork 环境下的开发服务器 |
| `npm run build` / `npm start` | 生产构建 / 启动 |
| `npm run typecheck` | `tsc --noEmit`（当前 0 错误） |
| `npm run merge` | 原始片单 → `data/catalog.json` |
| `npm run enrich` | 拉取 Wikidata + IMDb 补全（`--offline` 只用缓存） |
| `npm run validate` | 数据体检（缺字段 / 编造值 / 评分越界都会报错） |
| `npm test` | 编译 lib 后跑 25 个单元测试 |
| `npm run test:e2e` | 对运行中的服务跑 9 个 HTTP 冒烟测试 |

---

## 6. 已知限制

1. **创作者真实片单尚未提供** —— 当前 58 条是按用户给的示例清单整理的，`watch_status` / `creator_note` 全部留空待确认，没有假装"这已经是全部收藏"。
2. **本机无法完成 `next build`** —— 沙箱禁止 `fork`（webpack 路径 `spawn EPERM`）且 Turbopack + `workerThreads` 会触发 `DataCloneError`（Next 16.0.7 上游问题）。开发服务器与全部页面已实测可运行，详见 [docs/STATUS.md](docs/STATUS.md)。
3. **21 条记录待人工复核**（多数是 Wikidata 没有演员字段的动画），清单见 `data/reports/import-report.json` 与 [docs/MANUAL_REVIEW.md](docs/MANUAL_REVIEW.md)。
4. **没有账号系统** —— 收藏/评分/笔记存在浏览器 localStorage，可导出 JSON，不跨设备同步。
5. **"最近收录"按上映年份排** —— 数据里没有逐条入库时间戳，页面已明确说明，不伪造每日新增。

---

## 7. 文档

- [docs/CATALOG_RECORD_SCHEMA.md](docs/CATALOG_RECORD_SCHEMA.md) — 片单 25 字段契约 + 六类标签词表
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — 架构、数据流、设计系统
- [docs/DATABASE_SCHEMA.md](docs/DATABASE_SCHEMA.md) — 8 张表的数据库结构（JSON ↔ SQL）
- [docs/DATA_SOURCES.md](docs/DATA_SOURCES.md) — 数据源配置、抓取口径、许可
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) — 部署步骤与环境变量
- [docs/TEST_REPORT.md](docs/TEST_REPORT.md) — 测试结果
- [docs/STATUS.md](docs/STATUS.md) — 未完成清单与原因
- [docs/MANUAL_REVIEW.md](docs/MANUAL_REVIEW.md) — 需要人工确认的事项
- [docs/NEXT_STEPS.md](docs/NEXT_STEPS.md) — 后续建议

---

## 8. 许可与署名

- 评分数值来自 **IMDb 公开数据集**，仅用于个人非商业展示，页脚保留 `Ratings data courtesy of IMDb`。
- 事实核对使用 **Wikidata**（CC0 1.0）。
- 封面为本站程序化生成的原创视觉，非官方海报。
- 本项目为个人非商业项目，不提供任何电影下载或流媒体入口。
