// 探针 3：修正文件名（去掉 utm 查询串）→ 取 imageinfo + 直接下载 800px 图
const UA = "FantasyAtlas/1.0 (personal non-commercial film guide; contact: fantasy-atlas@example.com)";
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

function cleanThumb(src, width = 800) {
  const noQuery = src.split("?")[0];
  const abs = noQuery.startsWith("//") ? "https:" + noQuery : noQuery;
  return abs.replace(/\/(\d+)px-/, `/${width}px-`);
}

function fileNameOf(src) {
  const noQuery = src.split("?")[0];
  const base = decodeURIComponent(noQuery.split("/").pop() ?? "");
  return base.replace(/^\d+px-/, "");
}

const CASES = [
  { title: "Spirited Away", lang: "en" },
  { title: "Wednesday (TV series)", lang: "en" },
  { title: "Enchanted (film)", lang: "en" },
];

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
    const file = fileNameOf(src);
    console.log("file:", file);
    const info = await api(
      c.lang,
      `action=query&prop=imageinfo&iiprop=url|size|mime|extmetadata&iiurlwidth=800&titles=${encodeURIComponent("File:" + file)}`
    );
    const ii = info?.query?.pages?.[0]?.imageinfo?.[0];
    console.log("imageinfo:", ii ? JSON.stringify({ size: [ii.width, ii.height], mime: ii.mime, license: ii.extmetadata?.LicenseShortName?.value, usage: ii.extmetadata?.UsageTerms?.value }) : "MISSING");

    const dl = cleanThumb(src, 800);
    const r = await fetch(dl, { headers: { "User-Agent": UA } });
    const buf = Buffer.from(await r.arrayBuffer());
    console.log("download:", r.status, r.headers.get("content-type"), buf.length, "bytes", dl.slice(0, 90));
    const sig = buf.subarray(0, 4).toString("hex");
    console.log("magic:", sig, sig === "89504e47" ? "PNG" : sig.startsWith("ffd8") ? "JPEG" : "??");
  } catch (e) {
    console.log("ERROR:", e.message);
  }
  await sleep(2500);
}
