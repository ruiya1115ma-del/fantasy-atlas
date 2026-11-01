# 片单记录写作指南（给数据录入用）

你要产出的文件：`data/raw/catalog-<字母>.json`，内容是**一个 JSON 数组**，每个元素是一部作品。
写完必须能被 `node scripts/merge-catalog.mjs` 接受（字段错、标签不在词表、简介太短都会被拒）。

## 铁律（违反即被导入脚本拦下或被人一眼看出编造）

1. **不编造**。不知道导演/演员/片长就写 `null` 或 `[]`，不要猜、不要凑。
2. **不写评分**。评分只能由外部数据集核实，记录里出现任何 rating/score 字段都会被忽略并报警。
3. **简介必须自己写**：80–150 个汉字，不复述豆瓣/维基原文，不剧透结局，只交代设定与进入方式。
4. **标签只能取词表里的值**：完整词表见 `docs/TAG_VOCABULARY.txt`。词表外的标签会被剔除。
5. **年份必须是数字**（如 `2005`，不是 `"2005年"`）。
6. **watch_status 一律写 `"watched"`**（这批全部是创作者看过的）。
7. **creator_note 一律写 `null`**（创作者没给逐部评语，不许代写）。
8. 文件编码 **UTF-8 无 BOM**，`JSON.parse` 必须成功。

## 字段清单（25 个，一个都不能少）

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `catalog_key` | string | 稳定 id，小写连字符，**全局唯一**，用我给你指定的 |
| `chinese_title` | string | 中文片名（用最通行的译名） |
| `original_title` | string | 原文片名（英文/日文/法文原名，不要中译） |
| `release_year` | number | 上映年份 |
| `media_type` | string | `"movie"` 或 `"series"` |
| `format` | string | `"live_action"` 或 `"animation"` |
| `franchise` | string\|null | 系列机器名（小写连字符），单片为 null |
| `franchise_name` | string\|null | 系列中文名，单片为 null |
| `series_order` | number\|null | 系列内序号（从 1 开始）；单片为 null |
| `country` | string[] | ISO 3166-1 alpha-2 大写代码，如 `["US","GB"]` |
| `director` | string[] | 导演原名；不知道写 `[]` |
| `cast` | string[] | 主演原名（最多 6 个）；不知道写 `[]` |
| `runtime_minutes` | number\|null | 电影片长；剧集写 `null` |
| `seasons` | number\|null | 剧集季数；电影写 `null` |
| `original_language` | string\|null | ISO 639-1，如 `"en"` `"ja"` `"fr"` |
| `watch_status` | string | 固定 `"watched"` |
| `creator_note` | null | 固定 `null` |
| `wikidata_hint` | null | 固定 `null`（留空让脚本自动匹配） |
| `wikipedia_page_en` | string\|null | **英文维基百科条目名**（用于抓真实海报），如 `"Spirited Away"`。必须真实存在 |
| `external_title_hints` | string[] | 其他已知英文别名，可为 `[]` |
| `tags` | object | 见下 |
| `tag_confidence` | string | `"high"` / `"medium"` / `"low"` |
| `synopsis_zh` | string | 80–150 汉字原创简介 |
| `recommendation_zh` | string | 一句话编辑推荐语（30–60 汉字），说清楚"为什么值得进这个视界" |
| `audience_fit` | string | 适合谁（20–40 汉字） |
| `audience_mismatch` | string | 可能不适合谁（20–40 汉字） |

### tags 结构（六类，每类都是字符串数组）

```json
"tags": {
  "type": ["Fantasy Adventure", "Fairy Tale"],
  "world": ["童话王国", "平行世界"],
  "aesthetic": ["梦幻唯美"],
  "element": ["公主", "魔法生物"],
  "mood": ["温暖", "怀旧"],
  "exclude": []
}
```

- `type` / `world` / `aesthetic` / `element` / `mood` 每类**至少 1 个**；
- `exclude`（劝退提示）可以为空，只在确有劝退点时写（血腥、恐怖惊吓、节奏缓慢、剧情沉闷、目标受众偏低龄、含大量歌舞）；
- 每部作品建议总标签数 6–12 个，别堆满。

## 完整示例（照这个格式写）

```json
{
  "catalog_key": "spirited-away",
  "chinese_title": "千与千寻",
  "original_title": "千と千尋の神隠し",
  "release_year": 2001,
  "media_type": "movie",
  "format": "animation",
  "franchise": null,
  "franchise_name": null,
  "series_order": null,
  "country": ["JP"],
  "director": ["Hayao Miyazaki"],
  "cast": [],
  "runtime_minutes": 125,
  "seasons": null,
  "original_language": "ja",
  "watch_status": "watched",
  "creator_note": null,
  "wikidata_hint": null,
  "wikipedia_page_en": "Spirited Away",
  "external_title_hints": ["Sen to Chihiro no Kamikakushi"],
  "tags": {
    "type": ["Fantasy Adventure", "Fantasy Animation"],
    "world": ["神话世界", "异世界冒险"],
    "aesthetic": ["东方幻想", "梦幻唯美"],
    "element": ["妖怪", "魔法生物"],
    "mood": ["神秘", "治疗"],
    "exclude": []
  },
  "tag_confidence": "high",
  "synopsis_zh": "十岁的女孩随父母搬去新家，误入一条被荒草掩埋的隧道，父母因贪食变成了猪。她被留在一个专供神灵沐浴的国度，为了活下去，她在汤屋里做工，被夺去名字只剩一个「千」字。灯火通明的浴场、沉默的无脸男、驶向海心的列车，都在提醒她必须记住自己是谁。",
  "recommendation_zh": "如果你只想看一部「世界本身就迷人」的动画，它把想象力的密度和孤独感同时推到极致。",
  "audience_fit": "初次接触宫崎骏的观众，以及喜欢世界构建胜过情节的成年人。",
  "audience_mismatch": "怕妖怪造型的小朋友需要大人陪看，个别段落略阴暗。"
}
```

## 自检清单（提交前逐条过）

- [ ] `JSON.parse` 成功，是数组
- [ ] 每条的 `catalog_key` 与别人给你的清单一致、无重复
- [ ] 24 个字段齐全（含 `wikipedia_page_en`）
- [ ] 标签全部能在 `docs/TAG_VOCABULARY.txt` 里找到
- [ ] 每部 `synopsis_zh` ≥ 80 汉字（中文标点也算字符，但不要凑字数）
- [ ] 没有 rating / score / vote / douban / imdb 字段
- [ ] 剧集 `runtime_minutes` 为 null、`seasons` 有数字；电影反之
- [ ] 系列作品 `franchise` / `series_order` 正确且组内不重复
- [ ] 改完跑一次 `node scripts/merge-catalog.mjs`，确认「被拒 0 条」

> 注意：多人同时写不同文件时**不要运行 merge**（会产生写入竞争），只在你自己确认 JSON 合法后交给 Lead 统一跑。
