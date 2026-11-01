// 探针 4：直接用 imageinfo 的原始 url 下载（非自由版权海报原始尺寸通常 ≤ 400px 宽）
const UA = "FantasyAtlas/1.0 (personal non-commercial film guide; contact: fantasy-atlas@example.com)";
const fs = await import("node:fs/promises");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(lang, params, tries = 4) {
  const url = `https://${lang}.wikipedia.org/w/api.php?format=json&formatversion=2&${params}`;
  for (let i = 0; i < tries; i++) {
    const res = await fetch(url, { headers: { "User-Agent": UA, "Accept-Encoding": "identity" } });
    if (res.status === 429) {
      await sleep(3000 * (i + 1));
      continue;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }
  throw new Error("429 重试仍失败");
}

const CASES = [
  { id: "spirited-away", title: "Spirited Away", lang: "en" },
  { id: "enchanted", title: "Enchanted (film)", lang: "en" },
  { id: "narnia-1", title: "The Chronicles of Narnia: The Lion, the Witch and the Wardrobe", lang: "en" },
];

await fs.mkdir(".probe-out", { recursive: true });

for (const c of CASES) {
  console.log(`\n=== ${c.title} ===`);
  try {
    const json = await api(c.lang, `action=parse&prop=text&redirects=1&section=0&page=${encodeURIComponent(c.title)}`);
    const html = json?.parse?.text ?? "";
    const src = html.match(/<img[^>]+src="([^"]+)"/i)?.[1];
    if (!src) {
      console.log("no img");
      continue;
    }
    const file = decodeURIComponent(src.split("?")[0].split("/").pop() ?? "").replace(/^\d+px-/, "");
    const info = await api(
      c.lang,
      `action=query&prop=imageinfo&iiprop=url|size|mime|extmetadata&titles=${encodeURIComponent("File:" + file)}`
    );
    const ii = info?.query?.pages?.[0]?.imageinfo?.[0];
    if (!ii) {
      console.log("no imageinfo for", file);
      continue;
    }
    console.log("size:", ii.width, "x", ii.height, ii.mime);
    const r = await fetch(ii.url, { headers: { "User-Agent": UA } });
    const buf = Buffer.from(await r.arrayBuffer());
    const sig = buf.subarray(0, 4).toString("hex");
    const kind = sig === "89504e47" ? "png" : sig.startsWith("ffd8") ? "jpg" : "??";
    const out = `.probe-out/${c.id}.${kind}`;
    await fs.writeFile(out, buf);
    console.log("saved:", out, buf.length, "bytes", "|", ii.url.slice(0, 80));
  } catch (e) {
    console.log("ERROR:", e.message);
  }
  await sleep(2000);
}
