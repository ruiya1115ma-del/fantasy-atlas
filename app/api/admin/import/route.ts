import { NextResponse } from "next/server";
import { adminToken } from "@/lib/submissions";
import { addItems, readQueue, updateItem } from "@/lib/import-queue";
import { autoTags, lookupDouban } from "@/lib/douban-lookup";

export const dynamic = "force-dynamic";

interface Body {
  token?: string;
  /** 一行一部的纯文本 */
  text?: string;
  /** CSV / JSON 解析后的条目列表 */
  items?: string[];
  /** 是否执行豆瓣匹配（默认 true） */
  match?: boolean;
}

function parseCsv(text: string): string[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return [];
  const header = lines[0].toLowerCase();
  const hasHeader = /title|片名|name/.test(header);
  const rows = hasHeader ? lines.slice(1) : lines;
  return rows
    .map((line) => {
      // 支持「片名,年份」或「中文名,原名,年份」；取第一个字段 + 年份
      const cells = line.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
      const title = cells[0];
      const year = cells.find((c) => /^(19|20)\d{2}$/.test(c));
      return year ? `${title} ${year}` : title;
    })
    .filter(Boolean);
}

export async function POST(request: Request) {
  let body: Body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "请求格式不对" }, { status: 400 });
  }

  if (!body.token || body.token !== adminToken()) {
    return NextResponse.json({ ok: false, error: "管理口令不正确" }, { status: 401 });
  }

  const incoming: string[] = [];
  if (body.text) {
    const t = body.text.trim();
    if (t.startsWith("[") || t.startsWith("{")) {
      try {
        const parsed = JSON.parse(t);
        const arr = Array.isArray(parsed) ? parsed : [parsed];
        for (const row of arr) {
          if (typeof row === "string") incoming.push(row);
          else if (row && typeof row === "object") {
            const r = row as Record<string, unknown>;
            const title = String(r.chinese_title ?? r.title ?? r.chineseTitle ?? "").trim();
            const year = r.release_year ?? r.year ?? "";
            if (title) incoming.push(`${title}${year ? ` ${year}` : ""}`);
          }
        }
      } catch {
        return NextResponse.json({ ok: false, error: "JSON 解析失败" }, { status: 400 });
      }
    } else if (t.includes(",") && t.split(/\r?\n/).length > 1) {
      incoming.push(...parseCsv(t));
    } else {
      incoming.push(...t.split(/\r?\n/));
    }
  }
  if (Array.isArray(body.items)) incoming.push(...body.items);

  const cleaned = [...new Set(incoming.map((s) => s.trim()).filter(Boolean))].slice(0, 40);
  if (!cleaned.length) return NextResponse.json({ ok: false, error: "没有可导入的片名" }, { status: 400 });

  const { added, skipped } = addItems(cleaned);

  // 逐条匹配（串行 + 节流，避免给豆瓣压力，也避免被限流）
  const results: { id: string; query: string; status: string; reason: string; match: unknown }[] = [];
  if (body.match !== false) {
    for (const item of added) {
      const { match, reason } = await lookupDouban(item.query);
      if (!match) {
        updateItem(item.id, { status: "needs_review", note: reason, match: null });
        results.push({ id: item.id, query: item.query, status: "needs_review", reason, match: null });
      } else {
        const { tags, themeSlug, confidence } = autoTags(match.genres, match.intro);
        const status = match.confidence >= 0.7 && confidence >= 0.4 ? "matched" : "needs_review";
        updateItem(item.id, {
          status,
          match,
          tags,
          themeSlug,
          note: `${match.reason}；自动标签命中 ${confidence.toFixed(2)}`,
        });
        results.push({ id: item.id, query: item.query, status, reason: match.reason, match });
      }
      await new Promise((r) => setTimeout(r, 1200));
    }
  }

  return NextResponse.json({
    ok: true,
    added: added.length,
    skipped,
    results,
    queue: readQueue().items.slice(0, 60),
  });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  if (searchParams.get("token") !== adminToken()) {
    return NextResponse.json({ ok: false, error: "需要管理口令" }, { status: 401 });
  }
  return NextResponse.json({ ok: true, ...readQueue() });
}
