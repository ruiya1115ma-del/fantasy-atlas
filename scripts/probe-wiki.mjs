const UA = "FantasyAtlas/1.0 (node; personal non-commercial film atlas)";
const base = "https://en.wikipedia.org/w/api.php";
const q = (params) => `${base}?${new URLSearchParams({ format: "json", origin: "*", ...params })}`;

const s = await fetch(q({ action: "query", list: "search", srsearch: "Crimson Peak film", srlimit: "3" }), {
  headers: { "User-Agent": UA },
}).then((r) => r.json());
console.log("search:", s.query.search.map((h) => h.title));

const p = await fetch(q({ action: "parse", page: "Crimson Peak", prop: "text", section: "0", redirects: "1" }), {
  headers: { "User-Agent": UA },
}).then((r) => r.json());
const html = p?.parse?.text?.["*"] ?? "";
console.log("html len", html.length);
const imgs = [...html.matchAll(/<img[^>]+src="([^"]+)"/g)].map((m) => m[1]).slice(0, 5);
console.log(imgs);
