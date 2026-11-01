// 生成标签词表清单（给数据录入用，避免误用非词表标签）
// 用法：node scripts/dump-vocabulary.mjs
import fs from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { TAG_GROUPS, COUNTRY_NAMES, LANGUAGE_NAMES } = require("../.test-build/vocabulary.js");

let out = "# 标签词表（唯一合法集合）\n\n";
out += "> 生成自 lib/vocabulary.ts。`tags` 里只能出现下面这些字符串，写别的会被导入脚本剔除。\n\n";

for (const g of TAG_GROUPS) {
  out += `## ${g.zh}（${g.category}）\n\n> ${g.blurb}\n\n`;
  for (const t of g.terms) {
    out += `- ${t.id} — ${t.zh}${t.hint ? `（${t.hint}）` : ""}\n`;
  }
  out += "\n";
}

out += "## 统计\n\n";
for (const g of TAG_GROUPS) out += `- ${g.category}: ${g.terms.length} 个\n`;

out += "\n## 国家代码（ISO 3166-1 alpha-2，用大写）\n\n";
out += Object.entries(COUNTRY_NAMES)
  .map(([k, v]) => `${k} ${v}`)
  .sort()
  .join(" / ") + "\n";

out += "\n## 语言代码（ISO 639-1）\n\n";
out += Object.entries(LANGUAGE_NAMES)
  .map(([k, v]) => `${k} ${v}`)
  .sort()
  .join(" / ") + "\n";

fs.writeFileSync("docs/TAG_VOCABULARY.txt", out, "utf8");
console.log("wrote docs/TAG_VOCABULARY.txt", out.length, "chars");
