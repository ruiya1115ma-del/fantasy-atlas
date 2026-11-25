const base = "https://fantasyatlas.online";
const lr = await fetch(base + "/api/admin/login", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ username: "admin", password: "mry2001" }),
});
const raw = lr.headers.get("set-cookie") || "";
const cookie = raw.split(";")[0];
console.log("login", lr.status, "cookie?", cookie.startsWith("fa_admin_session"));

const r = await fetch(base + "/api/admin/home", { headers: { cookie } });
console.log("home api", r.status, r.headers.get("content-type"));
const j = await r.json();
for (const s of j.config.sections) {
  console.log(`[${s.id}] ${s.title} layout=${s.layout} hidden=${s.hidden}`);
  for (const t of s.themes) console.log(`   ${t.id} | ${t.name} | ${t.movieIds.length} 部`);
}
