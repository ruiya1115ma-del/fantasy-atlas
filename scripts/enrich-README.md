# 外部资料补全（enrich）说明

`scripts/enrich.mjs` 给 `data/raw/catalog-*.json` 里的每条记录补上**真实存在**的外部资料，产出 `data/derived/enrichment.json`。
只读 catalog 文件，只写 `data/derived/` 与 `data/cache/`。仅用 Node 内置模块（v24，全局 fetch / zlib）。

## 运行

```bash
node scripts/enrich.mjs                # 完整抓取（首次约 2–3 分钟，命中缓存后几秒到半分钟）
node scripts/enrich.mjs --offline      # 只用本地缓存，不发任何网络请求
node scripts/enrich.mjs --limit=5      # 只处理前 5 条（调试试用）
node scripts/enrich.mjs --selftest     # 用脚本内 3 条样例跑到 data/derived/enrichment.selftest.json
node scripts/enrich.mjs --out=x.json   # 自定义输出路径
node scripts/enrich.mjs --quiet        # 不打印逐条进度
```

结束时打印 summary：`matched` / `needs_review` / `unmatched`、评分覆盖数、请求数与缓存命中数、耗时，以及 `human review queue`（需要人工看的 catalog_key 及原因）。`data/raw` 下没有任何 `catalog-*.json` 时会写出空结果并提示用 `--selftest`。

调试时可用环境变量 `FA_CATALOG_DIR=<目录>` 换一个 catalog 目录（不会碰 `data/raw/`）。

## 数据源与许可

| 来源 | 用途 | 许可 / 使用状态 |
| --- | --- | --- |
| [Wikidata](https://www.wikidata.org/) | 匹配实体、导演、演员、国家、片长、上映日期、IMDb ID、维基链接 | CC0 1.0，可自由使用 |
| [IMDb 公开数据集](https://datasets.imdbws.com/) `title.ratings.tsv.gz` | 评分与评分人数 | 个人非商业用途，需署名「Ratings data courtesy of IMDb」 |

输出里 `sources` 字段原样记录这两条许可信息；`ratings[].usage_status` 标为 `personal-noncommercial-attribution-required`，展示端必须带上署名。

## 抓取与缓存口径

- Wikidata 串行请求，间隔 ≥120ms；失败重试 2 次（指数退避 0.6s/1.2s，遇 429/5xx 优先遵守 `Retry-After`）。搜索接口偶发返回 `cirrussearch-too-busy-error`（后端过载），这类错误同样会重试，不会当成「没搜到」，失败时会写进 `notes`。
- 所有 Wikidata 响应按 URL 哈希缓存在 `data/cache/wikidata/*.json`，TTL 7 天。`--offline` 只读缓存，缺缓存就当抓不到（写 null，不猜）。缓存键包含查询参数，所以换 `languages` 之类参数等于换缓存。
- IMDb 数据集缓存在 `data/cache/imdb/title.ratings.tsv.gz`（约 8.3MB），7 天后才会重新下载；解析用 `zlib.createGunzip` + `readline` 流式扫，只在 Map 里保留命中的 tconst，不把 150 万行装进内存。
- `--offline` 只能复现「之前用完全相同的查询跑过」的结果：缓存键是整条 URL，换了样例或参数就会出现 cache miss，此时该条如实写 null 并在 notes 标注 `candidate entities unavailable ...`，不会用旧数据凑。
- 下载先用 `.part` 临时文件，成功后 rename，避免半截文件被复用。

## 匹配口径（准确性优先）

1. 有 `wikidata_hint` 直接用；否则用 `original_title` 搜 `wbsearchentities`；结果过少（<3）时再用 `external_title_hints` 补搜一轮。
2. 候选先按「描述里有没有 film/series + 年份 + 标题是否一致」粗排，只对前 4 个候选拉 claims 打分，控制请求量。
3. 打分（满分 1.0）：
   - `P31` 属于 film / animated film / television series / miniseries / film series → **+0.35**
   - `P577` 年份与 `release_year` 一致 **+0.35**；差 1 年 **+0.2**；差 ≥2 年该项 0 且**总分 ×0.5**
   - 标题（多语言 label，含 ja/zh）规范化后完全一致 **+0.2**；去掉冠词/副标题后包含 **+0.1**
   - `media_type` 与 `P31` 一致（movie↔film/animated film、series↔TV series、miniseries↔miniseries）**+0.1**
4. 阈值：`≥0.80` → `matched`；`0.55–0.80` → `needs_review`；`<0.55` → `unmatched`（只留候选 top3，不写事实）。
5. **一个 Wikidata 实体只能被一条记录占用**：同一 QID 被多条命中时，confidence 最高的留下，其余 `review_status="needs_review"`、`wikidata_id=null`、`notes` 写 `wikidata id conflict (...)`。
6. 规范外的 `P31`（如 `anime film`）会再看一层 `P279` 父类，父类是上述 5 类之一即按影视类计分——否则吉卜力那类条目会被系统性误判。

## 输出说明

顶层只有 `generated_at` / `sources` / `records` / `unmatched` 四个键。
每条记录固定包含 `wikidata_id`、`imdb_id`、`match`、`facts`、`ratings`、`links`、`notes`，抓不到的一律 `null` / `[]`。

- `facts.country` 用 ISO 3166-1 alpha-2 代码（取自国家实体的 `P297`）；
- `facts.runtime_minutes` 只取单位为分钟的 `P2047`；剧集的该值常常是整季总时长（如 Wednesday 的 360），此时会在 `notes` 里标注 `series runtime ... (may be season total)`，由人来判断；
- `facts.release_date` 取与 `release_year` 同年、语句顺序最靠前的 `P577`（日精度）；Wikidata 只有年份精度时写 `null` 并标注 `wikidata release date is year-only`，不自己补月日；
- 抓不到 IMDb 评分时 `ratings: []`，**绝不填数字**；
- `notes` 里会写 `no wikidata candidate` / `wikidata search failed: ...` / `year mismatch (...)` / `title mismatch` / `no cast in wikidata` / `country codes unresolved` / `low confidence (0.65)` 等异常，分号分隔。

## 如何复核匹配结果

1. 打开 `data/derived/enrichment.json`，筛选 `match.review_status != "matched"` 的记录。
2. 看 `notes`：`year mismatch` 多半是 catalog 年份写错或匹配到同名游戏/小说；`title mismatch` 是标题没对上；`wikidata id conflict` 说明两条记录抢了同一个实体，需要人工判断哪条才对。
3. 看 `match.candidates` 的前 3 个候选（QID + 英文 label + 分数），逐个打开 `https://www.wikidata.org/wiki/<QID>` 核对 P31 / P577 / P345。
4. 确认无误后，把正确的 QID 填进该记录的 `wikidata_hint` 再跑一次 `node scripts/enrich.mjs`，该条会走 hint 路径（`method: "wikidata-hint"`）直接命中；如果 catalog 年份错了，应改 catalog 而不是改这里。
5. 用 `--offline` 复跑可以验证「同样的输入产出同样的结果」，不消耗网络。

## 已知限制

- 只在 Wikidata 有的属性才写：例如《千与千寻》条目没有 `P161`，`cast` 就是 `[]` 并在 notes 注明，不补猜。
- 演员条目缺英文 label 时，退用英维条目名（同一实体的官方英文名），不使用中文译名。
- 剧集季数（`seasons`）不从 Wikidata 抓，属于 catalog 职责。
- IMDb 数据集是每日快照，评分会随时间变化；`last_checked_at` 记录本次抓取时间。
