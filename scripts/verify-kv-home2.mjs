const base = process.env.SITE || "https://fantasyatlas.online";
const login = await fetch(`${base}/api/admin/login`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ username: "admin", password: "mry2001" }),
});
const cookie = (login.headers.get("set-cookie") || "").split(";")[0];
const { config } = await (await fetch(`${base}/api/admin/home`, { headers: { cookie } })).json();

const oldName = config.sections[0].themes[0].name;
const renamed = {
  ...config,
  sections: config.sections.map((s, i) =>
    i === 0 ? { ...s, themes: s.themes.map((t, j) => (j === 0 ? { ...t, name: "少年奇遇KV" } : t)) } : s,
  ),
};
const put = await fetch(`${base}/api/admin/home`, {
  method: "PUT",
  headers: { "content-type": "application/json", cookie },
  body: JSON.stringify({ config: renamed }),
});
console.log("put", put.status, (await put.json()).storage);

const html = await (await fetch(`${base}/`)).text();
console.log("front page shows 少年奇遇KV:", html.includes("少年奇遇KV"));

await fetch(`${base}/api/admin/home`, {
  method: "PUT",
  headers: { "content-type": "application/json", cookie },
  body: JSON.stringify({ config }),
});
const back = await (await fetch(`${base}/`)).text();
console.log("reverted, shows old name:", back.includes(oldName), "| still KV name:", back.includes("少年奇遇KV"));
