const base = "https://fantasy-atlas.ruiya1115ma.workers.dev";
const paths = ["/movies/spirited-away", "/explore", "/collections/style-dark-gothic", "/"];
for (const p of paths) {
  const r = await fetch(base + p);
  const t = await r.text();
  console.log(
    p,
    r.status,
    "len",
    t.length,
    "movieTitle:",
    /千与千寻|哈尔的移动城堡/.test(t),
    "busy:",
    t.includes('aria-busy="true"'),
    "themeSection:",
    t.includes("五个视觉风格"),
  );
}
