// 探测豆瓣可达性与接口形态
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

async function probe(label, url, opts = {}) {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": UA,
        Accept: "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
        ...(opts.headers || {}),
      },
      redirect: "follow",
    });
    const text = await res.text();
    console.log(`\n== ${label} ==\n  status=${res.status} len=${text.length} ct=${res.headers.get("content-type")}`);
    console.log("  head:", text.slice(0, 220).replace(/\s+/g, " "));
    return { res, text };
  } catch (e) {
    console.log(`\n== ${label} ==\n  失败: ${e.message}`);
    return null;
  }
}

await probe("suggest 电影 千与千寻", "https://movie.douban.com/j/subject_suggest?q=" + encodeURIComponent("千与千寻"));
await probe("search", "https://www.douban.com/search?cat=1002&q=" + encodeURIComponent("千与千寻"));
await probe("subject", "https://movie.douban.com/subject/1291561/");
await probe("photos", "https://movie.douban.com/subject/1291561/photos?type=S");
