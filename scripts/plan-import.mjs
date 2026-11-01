/**
 * 导入计划：核对用户提供的片单与现有 194 部作品，输出「新增 / 已存在 / 跳过」三张表。
 *
 * 用法：node scripts/plan-import.mjs [--write-ids]
 * 产物：data/reports/import-plan.json（供审核与后续生成使用）
 *
 * 去重规则（任一命中即视为已存在，绝不覆盖）：
 *   1. 英文原名去掉副标题/标点后相同，且年份相差 ≤1
 *   2. 中文名相同且年份相同
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const CATALOG = path.join(ROOT, "data", "catalog.json");
const OUT = path.join(ROOT, "data", "reports", "import-plan.json");

const normTitle = (s) =>
  String(s ?? "")
    .toLowerCase()
    .replace(/[（(].*?[)）]/g, " ")
    .replace(/[:：–—-].*$/, " ")
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, " ")
    .trim();

/** [中文名, 英文原名, 年份, 分组] */
const CANDIDATES = [
  // ── 一、用户列出的 49 部奇幻电影 ──
  ["大魔域", "The NeverEnding Story", 1984, "fantasy"],
  ["诡秘怪谈", "Legend", 1985, "fantasy"],
  ["黑水晶", "The Dark Crystal", 1982, "fantasy"],
  ["重返奥兹国", "Return to Oz", 1985, "fantasy"],
  ["公主新娘", "The Princess Bride", 1987, "fantasy"],
  ["图书馆员奇幻之旅", "The Pagemaster", 1994, "fantasy"],
  ["终极天将", "The Adventures of Baron Munchausen", 1988, "fantasy"],
  ["最后的独角兽", "The Last Unicorn", 1982, "fantasy"],
  ["辛巴达七航妖岛", "The 7th Voyage of Sinbad", 1958, "fantasy"],
  ["辛巴达黄金航程", "The Golden Voyage of Sinbad", 1973, "fantasy"],
  ["狼的公司", "The Company of Wolves", 1984, "fantasy"],
  ["故事的故事", "Tale of Tales", 2015, "fantasy"],
  ["童梦失魂夜", "The City of Lost Children", 1995, "fantasy"],
  ["镜子面具", "MirrorMask", 2005, "fantasy"],
  ["坠入", "The Fall", 2006, "fantasy"],
  ["魔法奇幻秀", "The Imaginarium of Doctor Parnassus", 2009, "fantasy"],
  ["女巫（1990）", "The Witches", 1990, "fantasy"],
  ["女巫（2020）", "Roald Dahl's The Witches", 2020, "fantasy"],
  ["秘密花园", "The Secret Garden", 1993, "fantasy"],
  ["印第安人在橱柜里", "The Indian in the Cupboard", 1995, "fantasy"],
  ["神剑", "Excalibur", 1981, "fantasy"],
  ["杰逊王子战群妖", "Jason and the Argonauts", 1963, "fantasy"],
  ["诸神之战", "Clash of the Titans", 2010, "fantasy"],
  ["惊天战神", "Immortals", 2011, "fantasy"],
  ["龙之心", "Dragonheart", 1996, "fantasy"],
  ["龙骑士", "Eragon", 2006, "fantasy"],
  ["绿衣骑士", "The Green Knight", 2021, "fantasy"],
  ["尼斯湖水怪", "The Water Horse", 2007, "fantasy"],
  ["第十三个勇士", "The 13th Warrior", 1999, "fantasy"],
  ["龙与地下城：侠盗荣耀", "Dungeons & Dragons: Honor Among Thieves", 2023, "fantasy"],
  ["狼行者", "Wolfwalkers", 2020, "fantasy"],
  ["海洋之歌", "Song of the Sea", 2014, "fantasy"],
  ["凯尔经的秘密", "The Secret of Kells", 2009, "fantasy"],
  ["魔弦传说", "Kubo and the Two Strings", 2016, "fantasy"],
  ["怪物之子", "The Boy and the Beast", 2015, "fantasy"],
  ["追逐繁星的孩子", "Children Who Chase Lost Voices", 2011, "fantasy"],
  ["玛丽与魔女之花", "Mary and the Witch's Flower", 2017, "fantasy"],
  ["猫的报恩", "The Cat Returns", 2002, "fantasy"],
  ["辉夜姬物语", "The Tale of the Princess Kaguya", 2013, "fantasy"],
  ["生日幻境", "The Wonderland", 2019, "fantasy"],
  ["魔法师的学徒", "The Sorcerer's Apprentice", 2010, "fantasy"],
  ["第七子：降魔之战", "Seventh Son", 2014, "fantasy"],
  ["最后的巫师猎人", "The Last Witch Hunter", 2015, "fantasy"],
  ["时间的皱折", "A Wrinkle in Time", 2018, "fantasy"],
  ["生命之书", "The Book of Life", 2014, "fantasy"],
  ["奇异魔法", "Strange Magic", 2015, "fantasy"],
  ["神奇的莫里斯", "The Amazing Maurice", 2022, "fantasy"],
  ["公主与青蛙", "The Princess and the Frog", 2009, "disney"],
  ["寻龙传说", "Raya and the Last Dragon", 2021, "disney"],

  // ── 二、迪士尼公主系列（官方动画 + 续集 + 真人版 + 其他经典） ──
  ["白雪公主和七个小矮人", "Snow White and the Seven Dwarfs", 1937, "disney"],
  ["灰姑娘（1950）", "Cinderella", 1950, "disney"],
  ["睡美人", "Sleeping Beauty", 1959, "disney"],
  ["小美人鱼（1989）", "The Little Mermaid", 1989, "disney"],
  ["美女与野兽（1991）", "Beauty and the Beast", 1991, "disney"],
  ["阿拉丁（1992）", "Aladdin", 1992, "disney"],
  ["风中奇缘", "Pocahontas", 1995, "disney"],
  ["花木兰（1998）", "Mulan", 1998, "disney"],
  ["魔发奇缘", "Tangled", 2010, "disney"],
  ["勇敢传说", "Brave", 2012, "disney"],
  ["海洋奇缘", "Moana", 2016, "disney"],
  ["灰姑娘2：美梦成真", "Cinderella II: Dreams Come True", 2002, "disney"],
  ["灰姑娘3：时间魔法", "Cinderella III: A Twist in Time", 2007, "disney"],
  ["小美人鱼2：重返大海", "The Little Mermaid II: Return to the Sea", 2000, "disney"],
  ["小美人鱼：艾莉儿的起源", "The Little Mermaid: Ariel's Beginning", 2008, "disney"],
  ["美女与野兽：贝儿的心愿", "Beauty and the Beast: The Enchanted Christmas", 1997, "disney"],
  ["美女与野兽：贝儿的奇幻世界", "Beauty and the Beast: Belle's Magical World", 1998, "disney"],
  ["贾方复仇记", "The Return of Jafar", 1994, "disney"],
  ["阿拉丁和大盗之王", "Aladdin and the King of Thieves", 1996, "disney"],
  ["风中奇缘2：伦敦之旅", "Pocahontas II: Journey to a New World", 1998, "disney"],
  ["花木兰2", "Mulan II", 2004, "disney"],
  ["魔发奇缘：幸福前奏", "Tangled: Before Ever After", 2017, "disney"],
  ["海洋奇缘2", "Moana 2", 2024, "disney"],
  ["灰姑娘（1997）", "Cinderella", 1997, "disney"],
  ["花木兰（2020）", "Mulan", 2020, "disney"],
  ["沉睡魔咒2：恶魔夫人", "Maleficent: Mistress of Evil", 2019, "disney"],
  ["森林王子", "The Jungle Book", 2016, "disney"],
  ["狮子王：木法沙传奇", "Mufasa: The Lion King", 2024, "disney"],
  ["彼得潘与温蒂", "Peter Pan & Wendy", 2023, "disney"],
  ["匹诺曹", "Pinocchio", 2022, "disney"],

  // ── 三、宫崎骏导演作品（与现有 194 部去重后补齐） ──
  ["鲁邦三世：卡里奥斯特罗之城", "The Castle of Cagliostro", 1979, "ghibli"],
  ["风之谷", "Nausicaä of the Valley of the Wind", 1984, "ghibli"],
  ["红猪", "Porco Rosso", 1992, "ghibli"],
  ["起风了", "The Wind Rises", 2013, "ghibli"],
];

const catalog = JSON.parse(fs.readFileSync(CATALOG, "utf8"));
const existing = catalog.movies.map((m) => ({
  id: m.id,
  zh: m.chineseTitle,
  en: m.originalTitle,
  year: m.releaseYear,
}));

const sameTitle = (a, b) => {
  const na = normTitle(a);
  const nb = normTitle(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  // 去掉副标题后相等（如 "Harry Potter and the ..." 不算，避免误判）
  return false;
};

const padded = (n) => String(n).padStart(2, "0");

// 已存在的判断：英文名相同 + 年差 ≤1，或中文名相同 + 年份相同，或英文名包含关系 + 年份相同
const findExisting = (cand) => {
  const [zh, en, year] = cand;
  const ne = normTitle(en);
  const nz = normTitle(zh.replace(/（\d{4}）$/, ""));
  return (
    existing.find((e) => {
      const ee = normTitle(e.en);
      const ez = normTitle(e.zh.replace(/（\d{4}）$/, ""));
      if (ee === ne && Math.abs(e.year - year) <= 1) return true;
      if (ne && ee && (ee.startsWith(ne) || ne.startsWith(ee)) && Math.abs(e.year - year) <= 1) return true;
      if (ez === nz && e.year === year) return true;
      return false;
    }) ?? null
  );
};

const plan = { generatedAt: new Date().toISOString(), counts: {}, existing: [], toAdd: [], skipped: [] };

const seenNew = new Set();
const usedIds = new Set(existing.map((e) => e.id));

const slugify = (s) =>
  String(s)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’'&]/g, " ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

for (const cand of CANDIDATES) {
  const [zh, en, year, group] = cand;
  const hit = findExisting(cand);
  if (hit) {
    plan.existing.push({ input: `${zh}（${en}, ${year}）`, matched: `${hit.id} ${hit.zh}/${hit.en} ${hit.year}`, group });
    continue;
  }
  const key = `${normTitle(en)}|${year}`;
  if (seenNew.has(key)) {
    plan.skipped.push({ input: `${zh}（${en}, ${year}）`, reason: "名单内重复" });
    continue;
  }
  seenNew.add(key);
  let id = slugify(en) || `film-${year}`;
  if (usedIds.has(id)) id = `${id}-${year}`;
  usedIds.add(id);
  plan.toAdd.push({ id, chineseTitle: zh, originalTitle: en, year, group });
}

plan.counts = {
  candidates: CANDIDATES.length,
  alreadyInCatalog: plan.existing.length,
  toAdd: plan.toAdd.length,
  skipped: plan.skipped.length,
  byGroup: plan.toAdd.reduce((acc, f) => ((acc[f.group] = (acc[f.group] ?? 0) + 1), acc), {}),
};

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(plan, null, 2) + "\n", "utf8");

console.log(`候选 ${plan.counts.candidates} 部`);
console.log(`  已在库中（不重复导入）：${plan.counts.alreadyInCatalog}`);
console.log(`  待新增：${plan.counts.toAdd} ${JSON.stringify(plan.counts.byGroup)}`);
console.log(`  名单内重复：${plan.counts.skipped}`);
console.log("\n已存在明细：");
for (const e of plan.existing) console.log(`  · ${e.input} → ${e.matched}`);
console.log("\n待新增：");
for (const f of plan.toAdd) console.log(`  ${padded(plan.toAdd.indexOf(f) + 1)}. ${f.chineseTitle}（${f.originalTitle}, ${f.year}） [${f.id}]`);
console.log(`\n→ ${OUT}`);
