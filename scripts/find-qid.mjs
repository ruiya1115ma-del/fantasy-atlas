// 小工具：由英文维基条目标题取 Wikidata QID（用于修正 wikidata_hint）
// 用法: node scripts/find-qid.mjs "Beauty and the Beast (2017 film)"
const UA = "FantasyAtlas/1.0 (node; personal film guide)";
const title = process.argv.slice(2).join(" ");
if (!title) {
  console.error('用法: node scripts/find-qid.mjs "Beauty and the Beast (2017 film)"');
  process.exit(1);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(url, tries = 5) {
  for (let i = 0; i < tries; i++) {
    const res = await fetch(url, { headers: { "User-Agent": UA, "Accept-Encoding": "identity" } });
    if (res.status === 429 || res.status === 503) {
      const wait = 5000 * (i + 1);
      console.log(`   ${res.status} 退避 ${wait}ms`);
      await sleep(wait);
      continue;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }
  throw new Error("限流");
}

const json = await get(
  `https://en.wikipedia.org/w/api.php?format=json&formatversion=2&action=query&redirects=1&prop=pageprops&titles=${encodeURIComponent(title)}`
);
const page = json.query?.pages?.[0];
if (!page || page.missing) {
  console.log(`✗ 维基条目不存在: ${title}`);
  process.exit(2);
}
const qid = page.pageprops?.wikibase_item ?? null;
console.log(`条目: ${page.title}`);
console.log(`QID : ${qid ?? "（无）"}`);
if (qid) {
  await sleep(900);
  const ent = await get(
    `https://www.wikidata.org/w/api.php?format=json&action=wbgetentities&props=labels|descriptions|claims&languages=en&ids=${qid}`
  );
  const e = ent.entities?.[qid];
  const p345 = e?.claims?.P345?.[0]?.mainsnak?.datavalue?.value ?? "-";
  const p577 = (e?.claims?.P577 ?? [])
    .map((c) => c.mainsnak?.datavalue?.value?.time?.slice(1, 11))
    .filter(Boolean)
    .join(",");
  console.log(`label: ${e?.labels?.en?.value ?? ""} | ${e?.descriptions?.en?.value ?? ""}`);
  console.log(`imdb: ${p345} | P577: ${p577}`);
}
