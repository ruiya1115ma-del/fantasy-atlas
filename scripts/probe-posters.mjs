// 探针：测试能否从维基百科拿到真实海报图（pageimages 的原始图）
// 用法：node scripts/probe-posters.mjs
const TARGETS = [
  { id: "narnia-1", en: "The Chronicles of Narnia: The Lion, the Witch and the Wardrobe", zh: "納尼亞傳奇：獅子·女巫·魔衣櫥" },
  { id: "spirited-away", en: "Spirited Away", zh: "千与千寻" },
  { id: "barbie-nutcracker", en: "Barbie in the Nutcracker", zh: "芭比与胡桃夹子的梦幻之旅" },
  { id: "wednesday", en: "Wednesday (TV series)", zh: "星期三 (电视剧)" },
  { id: "enchanted", en: "Enchanted (film)", zh: "魔法奇缘" },
];

const UA = "FantasyAtlas/1.0 (personal non-commercial film guide; contact: local)";

async function pageImage(lang, title) {
  const url =
    `https://${lang}.wikipedia.org/w/api.php?action=query&format=json&formatversion=2` +
    `&prop=pageimages&piprop=original|thumbnail&pithumbsize=800&redirects=1` +
    `&titles=${encodeURIComponent(title)}`;
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
  if (!res.ok) return { error: `HTTP ${res.status}` };
  const json = await res.json();
  const page = json?.query?.pages?.[0];
  if (!page || page.missing) return { missing: true };
  return {
    pageTitle: page.title,
    original: page.original?.source ?? null,
    width: page.original?.width ?? null,
    height: page.original?.height ?? null,
    thumb: page.thumbnail?.source ?? null,
  };
}

for (const t of TARGETS) {
  const en = await pageImage("en", t.en).catch((e) => ({ error: String(e.message) }));
  const zh = await pageImage("zh", t.zh).catch((e) => ({ error: String(e.message) }));
  console.log(`\n=== ${t.id} ===`);
  console.log("en:", JSON.stringify(en));
  console.log("zh:", JSON.stringify(zh));
}
