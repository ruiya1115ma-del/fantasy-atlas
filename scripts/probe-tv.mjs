const UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const ids = [
  ["wednesday", "20445130"],
  ["crimson-peak", "23424586"],
  ["dark-2017", null],
];

for (const [label, sid] of ids) {
  if (!sid) continue;
  for (const kind of ["movie", "tv"]) {
    const url = `https://m.douban.com/rexxar/api/v2/${kind}/${sid}`;
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/json", Referer: `https://m.douban.com/movie/subject/${sid}/` },
    });
    const text = await res.text();
    console.log(`${label} ${kind}: ${res.status} ${text.slice(0, 90).replace(/\s+/g, " ")}`);
    await sleep(1500);
  }
}
