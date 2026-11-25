const base = "https://fantasyatlas.online";
const url = base + "/movies/spirited-away";

function checks(html) {
  return {
    provenance: html.includes("数据来源与核对"),
    posterCredit: html.includes("海报来源") || html.includes("版权归发行方所有"),
    stillCredit: html.includes("图片来源：豆瓣"),
    recordButtons: html.includes("已看") && html.includes("收藏") && html.includes("待看"),
    stars: (html.match(/aria-label="[1-5] 星"/g) || []).length,
    myNotesTitle: html.includes("我的记录"),
    editShortcut: html.includes("编辑这部作品"),
  };
}

const v = await fetch(url);
const vh = await v.text();
console.log("visitor", v.status, JSON.stringify(checks(vh)));

const l = await fetch(base + "/api/admin/login", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ username: "admin", password: "mry2001" }),
});
const cookie = (l.headers.get("set-cookie") || "").split(";")[0];
const a = await fetch(url, { headers: { cookie } });
const ah = await a.text();
console.log("admin  ", a.status, JSON.stringify(checks(ah)));
