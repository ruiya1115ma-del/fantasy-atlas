// 探针 5：看 upload.wikimedia.org 到底返回什么
const UA = "FantasyAtlas/1.0 (personal non-commercial film guide; contact: fantasy-atlas@example.com)";
const url =
  "https://upload.wikimedia.org/wikipedia/en/2/2a/Enchantedposter.jpg";

for (const ua of [UA, "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"]) {
  const r = await fetch(url, { headers: { "User-Agent": ua, Accept: "image/avif,image/webp,image/*,*/*;q=0.8" } });
  const buf = Buffer.from(await r.arrayBuffer());
  console.log("ua:", ua.slice(0, 28), "→", r.status, r.headers.get("content-type"), buf.length + "B");
  console.log("  head:", buf.subarray(0, 60).toString("utf8").replace(/\n/g, " "));
}
