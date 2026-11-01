// 探针 7：缩小 403 触发条件
const url = "https://upload.wikimedia.org/wikipedia/en/2/2a/Enchantedposter.jpg";
const VARIANTS = [
  "FantasyAtlas/1.0",
  "FantasyAtlas/1.0 (node)",
  "film-guide/1.0 (node)",
  "FantasyAtlas/1.0 (personal film guide)",
  "FantasyAtlas/1.0 (node; personal film guide)",
];
for (const ua of VARIANTS) {
  const r = await fetch(url, { headers: { "User-Agent": ua, Accept: "image/*" } });
  const buf = Buffer.from(await r.arrayBuffer());
  console.log(`${r.status}\t${buf.length}B\t${ua}`);
  await new Promise((r) => setTimeout(r, 700));
}
