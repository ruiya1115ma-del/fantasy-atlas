/**
 * 调用一次批量导入接口（真实请求豆瓣），验证：去重 → 匹配 → 队列落盘。
 * 用法：node scripts/test-import-api.mjs ["潘神的迷宫 2006"]
 */
const BASE = "http://127.0.0.1:4317";
const TOKEN = process.env.ADMIN_TOKEN || "fantasy-atlas-admin";
const title = process.argv[2] ?? "猩红山峰 2015";

const res = await fetch(`${BASE}/api/admin/import`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ token: TOKEN, text: title }),
});
const json = await res.json();
console.log("status", res.status);
console.log("added:", json.added, "skipped:", json.skipped);
for (const r of json.results ?? []) {
  console.log(` - ${r.query} → ${r.status} :: ${r.reason}`);
  if (r.match) console.log(`   豆瓣 ${r.match.doubanId} ${r.match.chineseTitle} (${r.match.year}) 海报 ${r.match.poster ? "有" : "无"}`);
}
const queue = json.queue ?? [];
console.log("队列前 3 条：");
for (const q of queue.slice(0, 3)) {
  console.log(` · ${q.query} [${q.status}] theme=${q.themeSlug ?? "-"} tags=${JSON.stringify(q.tags?.mood ?? [])}`);
}
