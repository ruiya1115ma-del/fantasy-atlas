// 探针 2：通过页面 infobox 拿真实海报直链（含维基百科上的非自由版权海报文件）
// 注意：请求之间必须限速，否则维基会返回 429。
const TARGETS = [
  "The Chronicles of Narnia: The Lion, the Witch and the Wardrobe",
  "Spirited Away",
  "Barbie in the Nutcracker",
  "Wednesday (TV series)",
  "Enchanted (film)",
];
const UA = "FantasyAtlas/1.0 (personal non-commercial film guide; contact: fantasy-atlas@example.com)";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(lang, params, tries = 4) {
  const url = `https://${lang}.wikipedia.org/w/api.php?format=json&formatversion=2&${params}`;
  for (let i = 0; i < tries; i++) {
    const res = await fetch(url, { headers: { "User-Agent": UA, "Accept-Encoding": "identity" } });
    if (res.status === 429) {
      const wait = 3000 * (i + 1);
      console.log(`   429 → wait ${wait}ms`);
      await sleep(wait);
      continue;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }
  throw new Error("429 重试仍失败");
}

async function infoboxImage(lang, title) {
  const json = await api(lang, `action=parse&prop=text&redirects=1&section=0&page=${encodeURIComponent(title)}`);
  const html = json?.parse?.text ?? "";
  const m = html.match(/<img[^>]+src="([^"]+)"/i);
  return { src: m?.[1] ?? null, htmlLen: html.length };
}

async function fileInfo(lang, fileName) {
  const json = await api(
    lang,
    `action=query&prop=imageinfo&iiprop=url|size|mime|extmetadata&iiurlwidth=800&titles=${encodeURIComponent("File:" + fileName)}`
  );
  const info = json?.query?.pages?.[0]?.imageinfo?.[0];
  if (!info) return { missing: true };
  return {
    thumb: info.thumburl,
    full: info.url,
    size: [info.width, info.height],
    mime: info.mime,
    license: info.extmetadata?.LicenseShortName?.value ?? null,
    usage: info.extmetadata?.UsageTerms?.value ?? null,
  };
}

for (const t of TARGETS) {
  console.log(`\n=== ${t} ===`);
  try {
    const img = await infoboxImage("en", t);
    console.log("infobox img:", img.src);
    if (img.src) {
      // //upload.wikimedia.org/wikipedia/en/thumb/a/ab/Poster.jpg/250px-Poster.jpg
      const parts = img.src.replace(/^https?:/, "").split("/");
      const base = parts.pop();
      const fileName = decodeURIComponent(base.replace(/^\d+px-/, ""));
      console.log("file:", fileName);
      const info = await fileInfo("en", fileName);
      console.log("imageinfo:", JSON.stringify(info));
    }
  } catch (e) {
    console.log("ERROR:", e.message);
  }
  await sleep(2500);
}
