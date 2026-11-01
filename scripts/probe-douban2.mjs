// 探测豆瓣可用接口（subject 详情页被反爬拦截，试 JSON 接口与移动端）
const UA_M =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

async function get(label, url, headers = {}) {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": UA_M,
        Accept: "application/json, text/plain, */*",
        "Accept-Language": "zh-CN,zh;q=0.9",
        ...headers,
      },
    });
    const text = await res.text();
    console.log(`\n== ${label} == ${res.status} len=${text.length}`);
    console.log(text.slice(0, 400).replace(/\s+/g, " "));
  } catch (e) {
    console.log(`\n== ${label} == 失败 ${e.message}`);
  }
}

await get("j/subject_abstract", "https://movie.douban.com/j/subject_abstract?subject_id=1291561");
await get(
  "rexxar movie photos",
  "https://m.douban.com/rexxar/api/v2/movie/1291561/photos?count=10&start=0",
  { Referer: "https://m.douban.com/movie/subject/1291561/" }
);
await get(
  "rexxar movie detail",
  "https://m.douban.com/rexxar/api/v2/movie/1291561",
  { Referer: "https://m.douban.com/movie/subject/1291561/" }
);
await get("m.douban subject html", "https://m.douban.com/movie/subject/1291561/");
