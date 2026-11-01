// 追加两条在核对用户片单时发现遗漏的迪士尼条目：
//   《曼哈顿奇缘》（Disenchanted, 2022）
//   《魔发奇缘：幸福终点站》（Tangled Ever After, 2012，短片）
// 只向 catalog-new-e.json 追加，不修改已有记录。
import fs from "node:fs";
import path from "node:path";

const FILE = path.join(process.cwd(), "data", "raw", "catalog-new-e.json");
const records = JSON.parse(fs.readFileSync(FILE, "utf8"));

const additions = [
  {
    catalog_key: "disenchanted-2022",
    chinese_title: "曼哈顿奇缘",
    original_title: "Disenchanted",
    release_year: 2022,
    media_type: "movie",
    format: "live_action",
    franchise: "enchanted",
    franchise_name: "魔法奇缘系列",
    series_order: 2,
    country: ["US"],
    director: ["Adam Shankman"],
    cast: ["Amy Adams", "Patrick Dempsey", "Maya Rudolph", "Gabriella Baldacchino", "James Marsden", "Idina Menzel"],
    runtime_minutes: 118,
    seasons: null,
    original_language: "en",
    watch_status: "watched",
    creator_note: null,
    wikidata_hint: null,
    external_title_hints: ["Disenchanted"],
    tags: {
      type: ["Fairy Tale", "Urban Fantasy"],
      world: ["童话王国", "平行世界"],
      aesthetic: ["梦幻唯美", "复古英伦"],
      element: ["魔法契约", "变形", "魔法生物"],
      mood: ["温暖", "幽默", "怀旧"],
      exclude: [],
    },
    tag_confidence: "medium",
    synopsis_zh:
      "吉赛尔与罗伯特结婚多年后搬到郊外小镇，发现新生活并不像童话里的「从此幸福」。为了让日子回到故事书里的模样，她向一根许愿魔杖许了愿，整座小镇随之一夜变成童话村落，邪恶继母的剧本也一并落到了她头上。她必须在午夜之前把愿望收回来。",
    recommendation_zh:
      "把上一部「童话人物进纽约」倒过来拍成「纽约人掉进童话镇」，许愿的代价写得比预期狠，适合想看童话续篇而不只是怀旧的人。",
    audience_fit: "看过《魔法奇缘》、喜欢把童话套路拆开再拼回去的观众。",
    audience_mismatch: "没看过上一部会漏掉不少笑点，也嫌它歌舞段落偏多的人。",
  },
  {
    catalog_key: "tangled-ever-after-2012",
    chinese_title: "魔发奇缘：幸福终点站",
    original_title: "Tangled Ever After",
    release_year: 2012,
    media_type: "movie",
    format: "animation",
    franchise: "tangled",
    franchise_name: "魔发奇缘系列",
    series_order: 3,
    country: ["US"],
    director: ["Nathan Greno", "Byron Howard"],
    cast: ["Mandy Moore", "Zachary Levi", "Alan Dale", "Paul F. Tompkins"],
    runtime_minutes: 6,
    seasons: null,
    original_language: "en",
    watch_status: "watched",
    creator_note: "短片（6 分钟），随《魔发奇缘》衍生发行。",
    wikidata_hint: null,
    external_title_hints: ["Tangled Ever After"],
    tags: {
      type: ["Fairy Tale", "Fantasy Animation"],
      world: ["童话王国"],
      aesthetic: ["梦幻唯美"],
      element: ["魔法生物"],
      mood: ["幽默", "温暖"],
      exclude: [],
    },
    tag_confidence: "low",
    synopsis_zh:
      "长发公主与尤金的婚礼当天，两只负责送戒指的小动物把戒指弄丢了。它们从礼堂一路追到屋顶与街道，把一场本该庄重的仪式变成了连环事故，而新郎新娘始终不知道身后发生了什么。",
    recommendation_zh: "六分钟的闹剧彩蛋，只有看过正片才笑得出来，当作婚礼花絮看即可。",
    audience_fit: "看过《魔发奇缘》正片、想补完系列的观众。",
    audience_mismatch: "想找一部完整长片的人，它只是短片。",
  },
];

const existing = new Set(records.map((r) => r.catalog_key));
let added = 0;
for (const rec of additions) {
  if (existing.has(rec.catalog_key)) {
    console.log("已存在，跳过：", rec.catalog_key);
    continue;
  }
  records.push(rec);
  added += 1;
}

fs.writeFileSync(FILE, JSON.stringify(records, null, 2) + "\n", "utf8");
console.log(`追加 ${added} 条，${path.basename(FILE)} 现有 ${records.length} 条`);
