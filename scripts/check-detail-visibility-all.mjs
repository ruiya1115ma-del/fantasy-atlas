const base = "https://fantasyatlas.online";
const slugs = ["spirited-away", "crimson-peak", "harry-potter-and-the-philosophers-stone", "the-neverending-story"];
const l = await fetch(base + "/api/admin/login", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ username: "admin", password: "mry2001" }),
});
const cookie = (l.headers.get("set-cookie") || "").split(";")[0];

for (const slug of slugs) {
  const url = `${base}/movies/${slug}`;
  const vh = await (await fetch(url)).text();
  const ah = await (await fetch(url, { headers: { cookie } })).text();
  const v = {
    provenance: vh.includes("数据来源与核对"),
    posterCredit: vh.includes("海报来源") || vh.includes("不作官方物料使用") || vh.includes("不是官方海报"),
    record: vh.includes("已看") && vh.includes("收藏") && vh.includes("待看"),
    stars: (vh.match(/aria-label="[1-5] 星"/g) || []).length,
  };
  const a = { provenance: ah.includes("数据来源与核对") };
  console.log(slug.padEnd(52), "visitor", JSON.stringify(v), "admin", JSON.stringify(a));
}
