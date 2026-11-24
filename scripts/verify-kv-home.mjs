const base = process.env.SITE || "https://fantasyatlas.online";

const login = await fetch(`${base}/api/admin/login`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ username: "admin", password: "mry2001" }),
});
const cookie = (login.headers.get("set-cookie") || "").split(";")[0];

const home = await fetch(`${base}/api/admin/home`, { headers: { cookie } });
const { config } = await home.json();
const first = config.sections[0];
console.log("sections", config.sections.length, "first:", first.title, "themes:", first.themes.length);

const renamed = {
  ...config,
  sections: config.sections.map((s, i) => (i === 0 ? { ...s, subtitle: "（KV 保存测试）" } : s)),
};
const put = await fetch(`${base}/api/admin/home`, {
  method: "PUT",
  headers: { "content-type": "application/json", cookie },
  body: JSON.stringify({ config: renamed }),
});
const putJson = await put.json();
console.log("put", put.status, putJson.storage, "duplicates:", putJson.duplicates);

const after = await fetch(`${base}/api/admin/home`, { headers: { cookie } });
const afterJson = await after.json();
console.log("subtitle now:", afterJson.config.sections[0].subtitle);

// 首页是否同步
const page = await fetch(`${base}/`);
const html = await page.text();
console.log("front page shows subtitle:", html.includes("（KV 保存测试）"));

// 还原
await fetch(`${base}/api/admin/home`, {
  method: "PUT",
  headers: { "content-type": "application/json", cookie },
  body: JSON.stringify({ config }),
});
console.log("reverted");
