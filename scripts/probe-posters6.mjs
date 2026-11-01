// 探针 6：哪一类 User-Agent 能通过 upload.wikimedia.org 的机器人口径检查
const url = "https://upload.wikimedia.org/wikipedia/en/2/2a/Enchantedposter.jpg";
const VARIANTS = [
  ["FantasyAtlas/1.0 (personal film guide; contact: maria@example.com)", "自定义+邮箱"],
  ["FantasyAtlas/1.0 (https://example.org/fantasy-atlas; maria@example.com)", "自定义+URL"],
  ["fantasy-atlas-personal-site/1.0 (maria@example.com)", "小写+邮箱"],
  ["Mozilla/5.0 (compatible; FantasyAtlas/1.0; +https://example.org) ", "Mozilla兼容式"],
  ["node", "裸 node"],
];
for (const [ua, label] of VARIANTS) {
  try {
    const r = await fetch(url, { headers: { "User-Agent": ua, Accept: "image/*" } });
    const buf = Buffer.from(await r.arrayBuffer());
    console.log(`${r.status}\t${buf.length}B\t${label}\t${r.headers.get("content-type")}`);
  } catch (e) {
    console.log(`ERR\t${label}\t${e.message}`);
  }
  await new Promise((r) => setTimeout(r, 800));
}
