const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const res = await fetch(`https://www.douban.com/search?cat=1002&q=${encodeURIComponent("魔法灰姑娘")}`, {
  headers: { "User-Agent": UA, "Accept-Language": "zh-CN,zh;q=0.9", Accept: "text/html" },
});
const html = await res.text();
const hrefs = [...html.matchAll(/href="([^"]*subject[^"]*)"/g)].map((m) => m[1]);
console.log("subject hrefs:", hrefs.slice(0, 8));
const idx = html.indexOf("Ella Enchanted");
console.log("snippet:", html.slice(Math.max(0, idx - 400), idx + 200).replace(/\s+/g, " "));
