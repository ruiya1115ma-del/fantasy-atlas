const UA = "FantasyAtlas/1.0 (node; personal non-commercial film atlas)";
const base = "https://en.wikipedia.org/w/api.php";
const q = (params) => `${base}?${new URLSearchParams({ format: "json", origin: "*", ...params })}`;
const get = (u) => fetch(u, { headers: { "User-Agent": UA, Accept: "application/json" } }).then((r) => r.json());

const p = await get(q({ action: "parse", page: "Crimson Peak", prop: "text", section: "0", redirects: "1" }));
const html = p?.parse?.text?.["*"] ?? "";
const m = /<img[^>]+src="([^"]+)"/.exec(html);
console.log("img tag match:", m?.[1]?.slice(0, 80));
const raw = m[1].startsWith("//") ? `https:${m[1]}` : m[1];
const file = decodeURIComponent((raw.split("?")[0].split("/").pop() ?? "").replace(/^\d+px-/, ""));
console.log("file:", file);

const info = await get(
  q({ action: "query", titles: `File:${file}`, prop: "imageinfo", iiprop: "url|size|extmetadata" })
);
const first = Object.values(info?.query?.pages ?? {})[0];
console.log("keys:", Object.keys(info?.query?.pages ?? {}));
console.log("imageinfo:", first?.imageinfo?.[0]?.url);
