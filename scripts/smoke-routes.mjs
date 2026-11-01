const base = "http://127.0.0.1:4317";
const routes = [
  "/",
  "/explore",
  "/favorites",
  "/recommend",
  "/sources",
  "/submit",
  "/admin",
  "/themes/enchanted-worlds",
  "/themes/dark-gothic",
  "/themes/epic-fantasy",
  "/themes/surreal-dreams",
  "/themes/whimsical-tales",
  "/movies/spirited-away",
  "/curated/gothic-lovers",
  "/sitemap.xml",
  "/robots.txt",
];

for (const r of routes) {
  try {
    const res = await fetch(base + r);
    const html = res.headers.get("content-type")?.includes("text") ? await res.text() : "";
    const count = (html.match(/(\d+)\s*部作品/g) || []).slice(0, 2).join(", ");
    console.log(`${res.status}  ${r.padEnd(34)} ${html.length}b ${count}`);
  } catch (e) {
    console.log(`ERR ${r}: ${e.message}`);
  }
}
