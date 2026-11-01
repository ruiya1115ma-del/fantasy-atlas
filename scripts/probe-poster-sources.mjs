/**
 * 探测可用的海报来源（一次性排查脚本，不写入数据）。
 * 用法：node scripts/probe-poster-sources.mjs
 */
const UA_MOBILE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const UA_DESKTOP =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36";

async function head(url, headers) {
  try {
    const res = await fetch(url, { headers, redirect: "follow" });
    const ct = res.headers.get("content-type") || "";
    const len = res.headers.get("content-length");
    return { status: res.status, ct, len };
  } catch (e) {
    return { error: String(e.message || e) };
  }
}

async function tryDoubanSuggest(q) {
  const url = `https://movie.douban.com/j/subject_suggest?q=${encodeURIComponent(q)}`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA_MOBILE, Referer: "https://m.douban.com/" },
    });
    const text = await res.text();
    if (res.status !== 200) return { status: res.status, body: text.slice(0, 120) };
    const list = JSON.parse(text);
    return {
      status: 200,
      count: list.length,
      first: list.slice(0, 2).map((x) => ({ id: x.id, title: x.title, year: x.year, img: x.img })),
    };
  } catch (e) {
    return { error: String(e.message || e) };
  }
}

async function tryTmdbHtml(q) {
  const url = `https://www.themoviedb.org/search?query=${encodeURIComponent(q)}`;
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA_DESKTOP, "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8" } });
    const text = await res.text();
    return {
      status: res.status,
      len: text.length,
      hasResults: /results|poster/i.test(text.slice(0, 20000)),
      og: (text.match(/og:image" content="([^"]+)"/) || [])[1] || null,
    };
  } catch (e) {
    return { error: String(e.message || e) };
  }
}

async function tryWikipedia(q) {
  const api = `https://en.wikipedia.org/w/api.php?action=query&format=json&prop=pageprops&titles=${encodeURIComponent(q)}`;
  try {
    const res = await fetch(api, { headers: { "User-Agent": "FantasyAtlas/1.0 (node; personal project)" } });
    const json = await res.json();
    return { status: res.status, pages: Object.keys(json?.query?.pages || {}).length };
  } catch (e) {
    return { error: String(e.message || e) };
  }
}

const samples = ["你想活出怎样的人生", "Crimson Peak", "Wednesday", "芭比之粉红舞鞋"];

for (const q of samples) {
  console.log("\n=== ", q);
  console.log("douban suggest:", JSON.stringify(await tryDoubanSuggest(q)).slice(0, 400));
  console.log("tmdb html:", JSON.stringify(await tryTmdbHtml(q)).slice(0, 300));
  console.log("wiki:", JSON.stringify(await tryWikipedia(q)).slice(0, 200));
}

console.log("\n--- image reachability ---");
console.log(
  "douban img1:",
  JSON.stringify(await head("https://img1.doubanio.com/view/photo/s_ratio_poster/public/p2900945821.jpg", { "User-Agent": UA_MOBILE }))
);
console.log(
  "wikimedia:",
  JSON.stringify(
    await head("https://upload.wikimedia.org/wikipedia/en/9/9c/Crimson_Peak_poster.jpg", { "User-Agent": "FantasyAtlas/1.0 (node)" })
  )
);
