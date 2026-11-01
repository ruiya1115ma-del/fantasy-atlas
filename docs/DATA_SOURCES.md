# 数据源配置与抓取口径

本文件说明：数据从哪来、怎么抓、许可如何、哪些事绝对不做。

**主数据来源是豆瓣**（评分、导演、主演、类型、地区、片长、简介、剧照）；
IMDb 公开数据集与 Wikidata 只作为第二来源与交叉核对。
抓取脚本：`scripts/fetch-douban.mjs`（豆瓣）、`scripts/poster-hunt.mjs`（海报多来源猎取，当前主力）、
`scripts/fill-posters.mjs`（维基百科海报）、`scripts/shrink-posters.mjs`（海报瘦身）、
`scripts/audit-posters.mjs`（逐部海报体检）、`scripts/enrich.mjs`（Wikidata/IMDb 核对）。

---

## 1. 数据源总览

| 源 | 用途 | 许可 | 接入方式 |
| --- | --- | --- | --- |
| 创作者个人片单 | 作品范围、系列顺序、看过状态 | 作者私有资料，仅本站使用 | 人工写进 `data/raw/catalog-*.json` |
| **豆瓣电影**（主来源） | 评分 + 评分人数、导演、主演、类型、地区、片长、剧情简介、海报、剧照 | 页面公开信息引用；海报/剧照版权归发行方，个人非商业引用 | `movie.douban.com/j/subject_suggest` 定位条目 → `m.douban.com/rexxar/api/v2/movie/{id}` 取资料 → `/photos` 取剧照；失败时用 `www.douban.com/search` 网页搜索兜底 |
| **IMDb（海报 + 评分）** | 官方发行海报（A 级）、评分备份、条目链接 | 海报版权归发行方；IMDb 作为资料库展示官方海报，个人非商业引用并署名 | 海报：`v3.sg.media-imdb.com/suggestion/x/<片名>.json` 取 `i.imageUrl`（可加 `_V1_UX800_` 控制尺寸）→ 下载后本地校验尺寸；评分：`datasets.imdbws.com/title.ratings.tsv.gz` 流式解压匹配 |
| **TVmaze**（剧集） | 剧集海报（B 级兜底） | 版权归发行方；公开剧集资料库 | `api.tvmaze.com/search/shows?q=` |
| **维基百科条目主图** | 海报兜底（IMDb 命不中时） | 版权归发行方；维基以合理使用（fair use）收录 | `action=query` 取 infobox `\|image=` + `prop=imageinfo` |
| **Wikimedia Commons** | 自由许可图片（C 级兜底） | 依文件页许可（多为 CC） | `list=search&srnamespace=6` → `prop=imageinfo` |
| **Wikidata** | 上映日 / 片长 / IMDb ID 交叉核对 | CC0 1.0 | `wbsearchentities` + `wbgetentities` |
| 本站原创内容 | 编辑视角、推荐语、适合谁/不适合谁、标签 | 本站原创 | 人工撰写（标签按封闭词表） |

> 评分的 7 个字段（`rating_source / rating_value / rating_scale / rating_count / last_checked_at / source_url / usage_status`）
> 对每一个来源都必须齐全；豆瓣评分排在第一位，IMDb 只在豆瓣缺失时展示，**两者永不加权平均**。

---

## 2. 豆瓣抓取（`scripts/fetch-douban.mjs`）

```bash
node scripts/fetch-douban.mjs                 # 只补缺（已有条目跳过，可反复续跑）
node scripts/fetch-douban.mjs --limit=5       # 先试 5 部
node scripts/fetch-douban.mjs --stills=3      # 每部下载 3 张剧照（默认 2）
node scripts/fetch-douban.mjs --gap=2500      # 放慢请求（默认 2200ms/次）
node scripts/fetch-douban.mjs --force         # 全量重抓
node scripts/fix-douban-records.mjs           # 体检：剔除明显错配（评分 0 / 年份差 3 年以上 / 标题对不上）
```

**产物**

- `data/derived/douban.json`：每部含 `subjectId / url / title / originalTitle / year / genres / countries / durations / directors / actors / intro / rating{value,scale,count} / poster / stills[] / fetchedAt`
- `public/posters-douban/<id>.jpg`、`public/stills/<id>-1.jpg`
- `data/cache/douban/`：原始响应缓存（7 天有效）

**匹配策略（防错配）**

1. 先用中文名做 `subject_suggest`；空数组时依次换「去掉冒号的片名」「主标题」「英文原名」。
2. 仍为空 → 用 `www.douban.com/search?cat=1002` 网页搜索兜底（该接口能搜到 suggest 索引不到的老片/芭比系列）。
3. 候选用「标题精确 + 字符相似度（Jaccard）+ 年份差」打分；年份差 ≥3 年重罚，重映/重制条目会被排除。
4. 抓完跑 `fix-douban-records.mjs`，把评分 0 或年份明显不符的记录连同图片一起删掉重抓。

**节流与礼貌**：默认每部约 2.2 秒、单线程串行；遇到 403/418/429 指数退避（最长 90s）。不做并发轰炸。

---

## 3. 图片与许可

- 海报来源优先级：**IMDb 官方发行海报（A 级）→ 其他国家/地区正式发行海报（B 级，含 TVmaze 剧集海报）→
  电影节 / 官方宣传图与 Commons 自由许可图（C 级）→ 豆瓣条目图**；剧照目前只来自豆瓣条目图。
- 每一张海报都逐部核验三件事，写进 `data/derived/posters.json` 的 `verified` 字段：
  `matchedTitle`（命中的条目名）、`matchedYear`（命中年份）、
  `status`（`verified` 标题与年份都对 / `partial` 其一有差异 / `unverified`）、
  `versionMatch`（年份一致或相差几年）、`posterLike`（竖版）、`method`（走的是哪个来源）。
  同名翻拍（灰姑娘 1950 / 1997 / 2015）靠年份区分，年份差 >1 年直接拒绝写入。
- 图片文件本地化到 `public/posters/`，记录 `source / sourceUrl / articleUrl / license / licenseNote / tier / fetchedAt`，
  详情页逐条显示来源与条目链接；体积过大的原图用 IMDb CDN 的 `_V1_UX800_` 参数重新取一份（`shrink-posters.mjs`）。
- 版权归发行方所有；本站**不主张任何权利**，不提供下载、不做商业分发、不使用 AI 生成图冒充海报。
- 全量体检：`node scripts/audit-posters.mjs` 会逐部检查文件是否存在、是否真的是 JPEG/PNG、尺寸与竖版，
  结果写入 `data/reports/poster-audit.json`。当前实测 **274/274 有真实海报**（竖版 273 + 1 张方形官方宣传图）。
- 抓不到（或只找到横版 logo）的条目**不写错图**，回退程序化封面并在页面注明。

---

## 4. 明确不做的事

1. 不编造评分、简介、导演、片长；抓不到就留空并在页面写明。
2. 不把不同作品的信息混在一起（错配会被 `fix-douban-records.mjs` 剔除）。
3. 不用 AI 生成的图片、插画、概念图冒充电影剧照或海报。
4. 不对豆瓣做并发轰炸或绕过登录的接口调用；只用公开页面与公开 JSON 接口。
5. 不把豆瓣评分与 IMDb 评分加权成一个"综合分"。
6. 不伪造"最近更新"时间（数据里没有逐条时间戳就不编）。

---

## 5. 排查顺序

1. 页面上没海报 → `node scripts/audit-posters.mjs` 看是哪一部、什么原因；再 `node scripts/poster-hunt.mjs --only=<id>` 单部重猎（会依次试 IMDb / 维基 / TVmaze / Commons）。
2. 海报错配 → 看 `data/derived/posters.json` 里该条的 `matchedTitle` / `matchedYear`；错配就在原始记录里补 `wikipedia_page_en` 或 `wikipedia_page_zh`，再 `node scripts/poster-hunt.mjs --force --only=<id>`。
3. 海报太大 → `node scripts/shrink-posters.mjs --min-kb=600`（IMDb 来源会按 `_V1_UX800_` 重新取）。
4. 评分没出现 → 看 `data/derived/douban.json` 里有没有该 id 的 `rating.value`；没有就靠 `scripts/enrich.mjs` 的 IMDb 数据集兜底。
5. 页面数据没变 → 抓完必须 `node scripts/merge-catalog.mjs`（它把 `douban.json`、`posters.json`、`enrichment.json` 合并进 `data/catalog.json`）。
6. 全站回退成程序化封面 → 删掉 `data/derived/douban.json` 与 `posters.json` 后重新 merge 即可。
