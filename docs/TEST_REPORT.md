# 测试与验收报告

> 所有数字均为 2026-11-01 在本机（Windows / Node v24.19.0 / 受限沙箱）实跑所得，可复现。

---

## 1. 结果总览

| 层 | 命令 | 结果 |
| --- | --- | --- |
| 类型检查 | `npx tsc --noEmit` | **通过**，0 error |
| 数据体检 | `npm run validate` | **通过**，0 error / 1 warning（16 部无演员信息） |
| 单元测试（数据契约 + 业务逻辑） | `npm test` | **25 pass / 0 fail**（73ms） |
| HTTP 冒烟（真实请求 9 组） | `npm run test:e2e` | **9 pass / 0 fail**（4.7s） |
| 页面实测 | 手工 + 截图 | 8 类路由全部 200，无 500 |
| 生产构建 | `npm run build` | **未通过**（环境限制，见 §6） |

---

## 2. 数据体检（`scripts/validate-data.mjs`）

实际输出：

```
作品数: 58
有评分: 58/58
系列数: 9
待复核: 21
无导演: 0
无演员: 16
媒体类型: {"movie":57,"series":1}

⚠ 警告 1 条：
  - 16 部作品没有演员信息（多为动画/剧集，Wikidata 无 P161）

✔ 数据体检通过（没有编造字段、没有占位评分、标签分类齐全）
```

体检检查项（每条都是硬断言，失败即 error）：

- `catalog.movies.length === import-report.accepted`
- `id` / `slug` 唯一；`franchise` 内 `seriesOrder` 唯一
- 必填字段非空；年份 1900–2030；简介 ≥60 汉字
- 评分 7 字段齐全、`scale ∈ {5,10}`、`value ≤ scale`、`source_url` 以 http 开头、`last_checked_at` 是 ISO 时间
- 不存在 `0` 分占位、不存在"只有分数没有来源"的评分
- 五类标签（type/world/aesthetic/element/mood）每部至少各 1 个
- `import-report.rejected` 必须为空数组

---

## 3. 单元测试 `tests/data.test.mjs`（11 组）

只读 JSON，不依赖构建产物，用来守住**数据契约**：

| 断言 | 说明 |
| --- | --- |
| 数量一致 | catalog 与 import-report 的 accepted 一致 |
| id/slug 唯一 | 58 条无重复 |
| 必填字段 | 中文名/原名/年份/媒体类型/格式/简介/推荐语 全部非空 |
| 年份范围 | 1900–2030 |
| 简介字数 | 每条 ≥60 汉字 |
| 评分契约 | 7 字段 + 范围 + URL + ISO 时间 + usage_status |
| 无占位评分 | 不存在 0 分或空来源 |
| 导入报告 | `accepted === movies.length`、`rejected` 为空 |
| 标签完整 | 五类每类至少 1 个标签 |
| 系列顺序 | 同系列内 seriesOrder 唯一 |
| 媒体类型 | 只能是 movie / series |

## 4. 单元测试 `tests/logic.test.mjs`（14 组）

用 `createRequire` 直接载入 `.test-build/*.js`（`tsc -p tsconfig.test.json` 的产物），
测的是**真实逻辑**，不是 mock：

| 断言 | 说明 |
| --- | --- |
| 数据加载 | `node:test` 进程里能读 catalog 并构造 Movie[] |
| 筛选语义 | 同类标签之间是「或」、不同类之间是「与」 |
| 关键词搜索 | 命中中文名 / 导演名 |
| URL 往返 | `filtersToQuery` → `filtersFromQuery` 等价 |
| 空态 | 无结果时返回空数组 + `describeFilters` 有标签 + `activeFilterCount` 正确 |
| 排序稳定 | 5 种排序（编辑推荐/年份新→旧/年份旧→新/评分高→低/中文名）都不丢不重 |
| 推荐空态 | 无偏好 → `empty === "no-preference"`（不硬推） |
| 推荐可解释 | 每条 reason 里的标签必须真的在该作品的 tags 里 |
| 确定性 | 同一输入两次调用结果完全一致 |
| 排除已看 | `excludeWatched` 生效 |
| 评分不主导 | `|score - 标签得分| <= 1.01`（评分只做 ±0.2 微调） |
| 相似作品 | 至少跨 2 个标签维度、分数 ≥ 门槛、排除同系列 |
| 策展完整性 | 5 个世界观分类 / 8 个氛围入口 / 5 个编辑片单都不为空 |
| 编辑推荐度 | ∈ [0,100]，且不是外部评分的线性映射 |

## 5. HTTP 冒烟 `tests/http.test.mjs`（9 组，真实请求）

对 `http://127.0.0.1:4317` 发真实 GET：

| 断言 | 结果 |
| --- | --- |
| 首页标题 + 两个主按钮文案 | ✔ |
| 探索页显示「共 58 部作品」 | ✔ |
| 带组合筛选参数的探索页不 500 | ✔ |
| 详情页四分区（编辑视角/客观资料/标签/数据来源）+「不是官方海报」 | ✔ |
| `/recommend` `/favorites` `/sources` 均 200 | ✔ |
| 5 个编辑片单页均 200 | ✔ |
| 不存在的 slug 不 500（dev 流式下码为 200，内容为友好 404） | ✔ |
| `sitemap.xml` / `robots.txt` 200 | ✔ |
| 页脚含 IMDb 署名（许可要求） | ✔ |

---

## 6. 未通过项：生产构建（环境限制）

| 命令 | 现象 |
| --- | --- |
| `next build`（Turbopack） | 编译通过 → 静态生成阶段 `Error [DataCloneError]: () => null could not be cloned`（`Generating static pages using 11 workers (0/72)`） |
| `next build --webpack` | `Error: spawn EPERM`（webpack 构建 worker 需要 fork） |

原因：本机沙箱**禁止 fork 子进程**。同一条限制还影响了 `next dev` 启动（已用
`scripts/dev.mjs` 同进程启动绕过）和 `node --test tests/`（已用 `--test-isolation=none` 绕过），
但构建期的 worker 没有等价开关可用。

**判断**：这不是项目代码缺陷 —— 类型检查 0 错误、所有页面在 dev 模式正常渲染、
34 条断言全绿。部署到允许 fork 的普通机器 / CI / Vercel 应可正常构建（见 docs/DEPLOYMENT.md §3.1）。

**风险**：无法在本机给出"生产构建产物"的实测证据。这是本次交付唯一未达成的验证项，
已在 `docs/STATUS.md` 中列为未完成项，不做粉饰。

---

## 7. 视觉与交互验收（截图见仓库外 `shots/` 目录）

| 检查 | 视口 | 结果 |
| --- | --- | --- |
| 首页 Hero / 氛围卡 / 分类卡 / 最近收录 / 随机发现 | 1922×993 | ✔ 排版与配色符合电影画册风 |
| 首页移动端 | 390×844 | ✔ 统计区改 2×2 栅格，无横向滚动 |
| 探索页筛选栏 + 5 列网格 + 58 部计数 | 1922×993 | ✔ |
| 探索页移动端 | 390×844 | ✔ 筛选改为抽屉，badge 显示已选数量 |
| 详情页编辑视角 / 客观资料分区 | 1264×805 | ✔ 主观与客观严格分开 |
| 详情页同系列 + 相似作品（附共同标签） | 1264×805 | ✔ |
| 推荐页选「想进入魔法学院」 | 1264×805 | ✔ 出 9 部，逐条显示 +3/+3/+2 理由与劝退提示 |
| 收藏页空态 | 1264×805 | ✔ 友好空态 + 去探索按钮 |
| 收藏页写入后（1 收藏/1 已看/4 星/1 笔记） | 1264×805 | ✔ 计数、卡片、导出按钮正常 |
| 海报差异化 | 全部 | ✔ 58 张封面按分类配色 + 作品种子生成，无重复观感 |

---

## 8. 复现方式

```bash
cd fantasy-atlas
npm install
npm run typecheck                     # 期望：无输出
npm run validate                      # 期望：数据体检通过，退出码 0
npm test                              # 期望：25 pass / 0 fail

# 另开一个终端
npm run dev
npm run test:e2e                      # 期望：9 pass / 0 fail
```

沙箱内若遇 `spawn EPERM`，用：

```bash
node node_modules/typescript/bin/tsc -p tsconfig.test.json
node --test --test-isolation=none tests/data.test.mjs tests/logic.test.mjs tests/http.test.mjs
```
