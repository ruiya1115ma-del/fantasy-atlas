const base = "http://127.0.0.1:4317";
const checks = [
  ["/explore?mood=神秘", "神秘"],
  ["/explore?mood=浪漫", "浪漫"],
  ["/explore?mood=治愈", "治愈"],
  ["/explore?mood=诡异", "诡谲"],
  ["/explore?mood=黑暗", "暗黑"],
  ["/explore?type=Fantasy%20Adventure", "冒险"],
];
for (const [url, label] of checks) {
  const res = await fetch(base + url);
  const html = await res.text();
  const m = /共\s*(\d+)\s*部作品/.exec(html.replace(/<!-- -->/g, ""));
  console.log(`${res.status} ${label.padEnd(4)} ${url.padEnd(42)} -> 共 ${m?.[1] ?? "?"} 部`);
}
