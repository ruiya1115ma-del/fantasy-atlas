# 后续建议（按性价比排序）

> 每一条都写清"为什么值得做"和"大概要动哪里"，方便直接开工。

---

## 第一优先：让站变成"你的"站（1–2 天）

### 1. 导入你的真实片单

- **为什么**：现在 58 部是示例。真片单进来，推荐和收藏才有意义——
  没有真实片单，这个站只是别人的展厅。
- **怎么做**：准备 CSV（列名照 `docs/CATALOG_RECORD_SCHEMA.md`），放到 `data/raw/catalog-personal.json`，
  `npm run merge` → `npm run enrich` → `npm run validate`。
- **注意**：原始文件永远不被覆盖；被拒的记录会列在 `data/reports/import-report.json`。

### 2. 补 `watch_status` 与 `creator_note`

- **为什么**：这两列是"个人"与"数据库"的分界线。现在全空，页面上只能写"待确认"。
- **怎么做**：在 raw JSON 里填 `watched` / `rewatched` / `want_to_watch` / `dropped`；
  `creator_note` 写你当时的一句话。详情页会自动显示。

### 3. 通读并改写 58 条原创文案

- **为什么**：简介、推荐语、"不适合谁"都是我写的。语气不是你的，站就不是你的。
- **改哪里**：`data/raw/catalog-*.json` 的 `synopsis_zh` / `recommendation_zh` / `audience_fit` / `audience_mismatch`。
- **约束**：简介 ≥60 汉字，不写剧透结局，不抄维基/豆瓣。

---

## 第二优先：把"可解释"再往前推一步（2–3 天）

### 4. 推荐权重可视化调节

- **为什么**：3/3/2/2/2 是需求给的固定权重。让用户在页面上拖动权重，
  立刻看到"我把世界观权重调高后，推荐结果变成了这 9 部"——这是最直观的可解释性。
- **怎么做**：`lib/recommend.ts` 已经接受 `UserPreferences.weights`，
  只需在 `RecommendClient` 的 STEP 3 加 5 个 range slider + 重置按钮，把值传进 `recommend()`。
- **成本低**：算法本身不用改。

### 5. "为什么没有推荐 X" 的反向解释

- **为什么**：用户常有"我明明喜欢 A，为什么不推 A"的疑问。
- **怎么做**：搜索结果里点一部没被推荐的作品，弹出"它没进前 12 的原因：
  只命中 1 个标签（3 分），低于门槛；或它在你的'不喜欢'列表里"。
- **逻辑**：`recommend()` 已经算了所有候选的分数，只是没返回被淘汰的。

### 6. 推荐快照存档

- **为什么**：`docs/DATABASE_SCHEMA.md` 的 `recommendations` 表设计了但没用。
  存下来才能回答"上个月它给我推了什么，我当时为什么点了"。
- **怎么做**：先把权重/结果存 localStorage，再考虑落库。

---

## 第三优先：内容与自动化（各 1–2 天）

### 7. AI 打标 + 审核队列

- **为什么**：58 部还能手工，500 部就必须批量。但 AI 标签必须能被审。
- **怎么做**：
  1. `scripts/tag.mjs`：读作品简介 → 调模型 → 只允许输出词表内的标签 + 置信度；
  2. 写进 `tag_source: "ai-assist"`、`review_status: "pending"`；
  3. 做 `/admin/review` 页面：左卡片右标签，一键 approve/reject；
  4. 未 approve 的标签不参与推荐（`lib/recommend.ts` 已按此设计）。
- **风险控制**：模型不许自由发明标签，否则词表约束就白设了。

### 8. 抓取增量更新（cron）

- **为什么**：评分会变（每次跑 enrich 都会更新 `last_checked_at`）。
- **怎么做**：GitHub Actions 每月跑 `npm run enrich && npm run merge && npm run validate`，
  有差异就提 PR。`data/cache` 用 Actions cache 复用，成本几乎为零。

### 9. 海报授权工作流

- **为什么**：程序化封面是诚实但抽象的；真实海报认片更快。
- **怎么做**：只在你确认授权的作品上，把 `images` 表补一条 `kind: "official"`、
  `license: "licensed"`、`attribution` 记录来源，`Poster` 组件优先渲染该图，否则回退到生成图。
- **红线**：没有 `license` 字段的图**不允许**进前端。

---

## 第四优先：工程健壮性（技术债）

### 10. 让它能构建（把 A1 解决掉）

- 在普通机器/CI 上验证 `npm run build`；
- 如果 Turbopack 路径确实有 `DataCloneError`（Next 16.0.7 上游问题），
  把 `package.json` 的 build 固定成 `next build --webpack`（普通机器 fork 正常，不会有 EPERM）；
- 构建通过后再加 `output: "export"` 试试静态部署。

### 11. Playwright E2E + axe 无障碍扫描

- **为什么**：现在交互（抽屉、评分、导入导出）只有我手工点过，没有回归保护。
- **怎么做**：3 条关键路径就够——筛选组合、详情页写入收藏并出现在收藏页、推荐选氛围出结果；
  再跑一次 axe，修掉对比度与 aria 问题。

### 12. 首屏体积优化

- **为什么**：首页 HTML 约 1.5MB，其中绝大部分是内联 SVG。
- **怎么做**（任选）：
  - 把 `Poster` 的 SVG 抽成服务端生成的静态 `.svg` 文件 + `<img loading="lazy">`（推荐，还能被 CDN 缓存）；
  - 或只内联首屏 6 张，其余用 IntersectionObserver 懒渲染。

### 13. 搜索升级

- **为什么**：现在是子串匹配，用户输入"霍格沃兹"找不到（数据里没有这个词）。
- **怎么做**：加一张别名字段（`aliases: ["霍格沃茨","Hogwarts"]`）做同义词；
  再加拼音首字母索引（`hgwz`）。数据量小的时候，甚至可以直接在前端建倒排表。

---

## 第五优先：产品化（需要先决定要不要做）

### 14. 账号 + 云端库

- 表已设计好（`personal_reviews` / `watchlist`），需要 NextAuth + Postgres。
- 好处：多设备同步；坏处：个人项目要维护账号系统与隐私责任。

### 15. 分享卡片 / OG 图

- 每部作品生成一张带标题+标签的分享图（可用现有 `Poster` 逻辑扩展成 1200×630）；
- 好处：分享到社交平台有辨识度；成本低（现有 SVG 代码复用）。

### 16. 双语文案

- 英文界面（至少 Hero 与导航已经是英文），中文内容保留。
- 适合"给外国朋友看"的场景；工作量大在文案，不在技术。

---

## 一句话总结

**先把站变成你的**（真实片单 + 你自己的话），
**再把可解释性变成能玩的**（权重滑块 + 反向解释），
**最后才是工程与产品化**（构建、E2E、账号）。
