// 测试豆瓣网页搜索兜底（name 搜索返回 subject 链接）
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

for (const q of ["魔法灰姑娘", "芭比之真假公主", "指环王：双塔奇兵", "芭比与胡桃夹子的梦幻之旅"]) {
  const res = await fetch(`https://www.douban.com/search?cat=1002&q=${encodeURIComponent(q)}`, {
    headers: { "User-Agent": UA, "Accept-Language": "zh-CN,zh;q=0.9", Accept: "text/html" },
  });
  const html = await res.text();
  const ids = [...new Set([...html.matchAll(/movie\.douban\.com\/(?:subject\/)?(\d+)/g)].map((m) => m[1]))].slice(0, 5);
  const titles = [...html.matchAll(/title="([^"]{2,40})"/g)].map((m) => m[1]).slice(0, 6);
  console.log(`${q} | ${res.status} | len=${html.length} | ids=${ids.join(",")} | titles=${titles.join(" / ")}`);
  await sleep(2500);
}
