# Fantasy Atlas — 片单原始记录契约（catalog record v1）

> 这份文档是全队共享的数据契约。所有 `data/raw/catalog-*.json` 文件必须是**顶层为数组**的合法 JSON，数组每一项都严格符合下面的字段定义。
> 不要写注释、不要写 markdown 之外的旁注，文件里只能有 JSON。

## 0. 铁律（违反即返工）

1. **不许编造事实。** 不确定的字段写 `null`，不要猜片长、档期、导演、演员、评分。
2. **不许编造评分。** 评分由另一个流程从 IMDb 公开数据集与 Wikidata 抓取并记录来源。本文件**不包含任何评数字段**。
3. **简介必须自己写。** `synopsis_zh` 是对该作品的中文概括，不得逐句翻译或复制任何网站（含豆瓣、维基、IMDb、TMDB）的原文。80–150 个汉字之间，不剧透结局。
4. **标签只能从词表里选**（见第 3 节），拼写必须完全一致，包括大小写。
5. **年份必须是数字**（如 `2001`），不是字符串。
6. 数组内条目按 `release_year` 升序、同系列按 `series_order` 升序排列。

## 1. 字段定义

```jsonc
{
  "catalog_key": "harry-potter-and-the-philosophers-stone", // 必填，全库唯一，kebab-case，仅含 a-z 0-9 和 -
  "chinese_title": "哈利·波特与魔法石",                     // 必填，大陆通行译名（简体）
  "original_title": "Harry Potter and the Philosopher's Stone", // 必填，作品原始语言官方名
  "release_year": 2001,                                     // 必填，数字。电视剧填首播年份
  "media_type": "movie",                                    // 必填：movie | series | miniseries
  "format": "live_action",                                  // 必填：live_action | animation
  "franchise": "harry-potter",                              // 系列 slug，独立作品填 null
  "franchise_name": "哈利·波特系列",                         // 系列中文名，独立作品填 null
  "series_order": 1,                                        // 系列内序号（从 1 开始）；独立作品填 null
  "country": ["GB", "US"],                                  // 制片国家/地区代码，见第 4 节；未知填 []
  "director": ["Chris Columbus"],                           // 导演英文原名；剧集填主创/剧集统筹；未知填 []
  "cast": ["Daniel Radcliffe", "Emma Watson", "Rupert Grint"], // 主要演员英文原名，3 人左右；未知填 []
  "runtime_minutes": 152,                                   // 单部影片片长（数字）；剧集整季填 null
  "seasons": null,                                          // 仅 series/miniseries：季数（数字）；电影填 null
  "original_language": "en",                                // 主要语言代码：en / zh / ja / fr / es …
  "watch_status": "unknown",                                // 创作者观看状态：watched | wishlist | unknown（本轮全部填 unknown）
  "creator_note": null,                                     // 创作者本人写下的话。**本轮一律 null**，不要代写
  "wikidata_hint": null,                                    // 可选：已知的 Wikidata QID，不知道就 null
  "external_title_hints": ["Sorcerer's Stone"],             // 可选：美版标题等别名，帮助后续精确匹配；没有填 []
  "tags": {
    "type": ["Epic Fantasy", "Fantasy Adventure"],          // 1–3 个
    "world": ["魔法学院", "古代王国"],                        // 1–3 个
    "aesthetic": ["魔法学院美学", "复古英伦"],                // 1–3 个
    "element": ["魔法", "魔法师", "魔法生物"],                // 2–5 个
    "mood": ["神秘", "宏大", "温暖"],                         // 2–4 个
    "exclude": []                                           // 0–2 个，仅当该作品明显带有让人劝退的元素时填写
  },
  "tag_confidence": "high",                                 // high | medium | low（AI 生成标签的整体置信度）
  "synopsis_zh": "……",                                      // 必填，80–150 汉字，原创
  "recommendation_zh": "……",                                // 必填，40–80 汉字，说明为什么值得看、氛围指向
  "audience_fit": "……",                                     // 必填，20–50 汉字，适合谁
  "audience_mismatch": "……"                                 // 必填，20–50 汉字，可能不适合谁
}
```

## 2. 书写规范

- 中文标点用全角（，。·「」），英文名保留原文大小写。
- `chinese_title` 用大陆简体通行译名；港台译名放进 `external_title_hints`。
- `director` / `cast` 用英文原名（如 `Guillermo del Toro`、`Hayao Miyazaki`），不要写中文译名。
- 系列作品必须填 `franchise` / `franchise_name` / `series_order`；`franchise` slug 由系列英文名 kebab-case 得到：
  - `harry-potter`（哈利·波特）
  - `fantastic-beasts`（神奇动物）
  - `the-chronicles-of-narnia`（纳尼亚传奇）
  - `the-lord-of-the-rings`（指环王）
  - `the-hobbit`（霍比特人）
  - `pirates-of-the-caribbean`（加勒比海盗）
  - `twilight`（暮光之城）
  - `barbie-animated`（芭比奇幻动画）
  - `alice-in-wonderland`（爱丽丝梦游仙境，真人版两部）
- 剧集（如《星期三》）`media_type` 用 `series`，`runtime_minutes` 用 null，`seasons` 填数字。
- 动画电影 `format` 用 `animation`，`media_type` 仍是 `movie`。

## 3. 标签词表（只能用这些，逐字一致）

**type**（作品类型，1–3 个）
`Epic Fantasy` `Dark Fantasy` `Urban Fantasy` `Fantasy Adventure` `Mythological Fantasy` `Gothic Fantasy` `Fairy Tale` `Supernatural Fantasy` `Surreal Fantasy` `Fantasy Animation`

**world**（世界观，1–3 个）
`魔法学院` `魔法社会` `平行世界` `异世界冒险` `神话世界` `古代王国` `超自然现代社会` `童话王国` `梦境世界` `末世幻想`

**aesthetic**（视觉美学，1–3 个）
`哥特建筑` `暗黑童话` `梦幻唯美` `复古英伦` `黑暗浪漫` `超现实主义` `自然幻想` `东方幻想` `古典神话` `怪诞美学` `蒸汽朋克` `魔法学院美学`

**element**（核心元素，2–5 个）
`女巫` `魔法师` `吸血鬼` `狼人` `精灵` `巨龙` `妖怪` `神祇` `魔法生物` `鬼魂` `超自然力量` `神秘物品`

**mood**（观影氛围，2–4 个）
`温暖` `治愈` `神秘` `浪漫` `怀旧` `诡异` `阴森` `黑暗` `宏大` `荒诞` `迷离` `史诗感`

**exclude**（劝退元素，0–2 个，可留空数组）
`血腥` `恐怖惊吓` `节奏缓慢` `剧情晦涩` `目标受众偏低龄` `含大量歌舞`

## 4. 国家/地区代码

`US` `GB` `NZ` `AU` `CA` `FR` `DE` `IT` `ES` `MX` `JP` `CN` `HK` `TW` `KR` `IN` `SE` `NO` `DK` `FI` `RU` `IE` `CZ` `PL` `BE` `NL` `AT` `CH`

## 5. 校验规则（写完后自查）

- [ ] `node -e "JSON.parse(require('fs').readFileSync('<你的文件>','utf8'))"` 能通过
- [ ] 每条记录 18 个字段齐全（值可以是 null / []）
- [ ] `catalog_key` 无重复，全部 kebab-case
- [ ] `synopsis_zh` 汉字数在 80–150（用脚本数：`[...s.matchAll(/[\u4e00-\u9fa5]/g)].length`）
- [ ] 所有标签都在词表内（逐字匹配）
- [ ] 没有出现任何评分/分数/打分字段
- [ ] `watch_status` 全部是 `unknown`，`creator_note` 全部是 `null`
