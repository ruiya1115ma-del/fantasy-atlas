import { NextResponse } from "next/server";
import { adminToken } from "@/lib/submissions";
import { bulkUpdate, publishItems, readQueue, removeItems, updateItem } from "@/lib/import-queue";

export const dynamic = "force-dynamic";

interface Body {
  token?: string;
  ids?: string[];
  action?: "publish" | "reject" | "delete" | "edit";
  patch?: Record<string, unknown>;
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
  const ids = Array.isArray(body.ids) ? body.ids : [];
  if (!ids.length) return NextResponse.json({ ok: false, error: "缺少 ids" }, { status: 400 });

  if (body.action === "publish") {
    const { published, skipped } = publishItems(ids);
    return NextResponse.json({
      ok: true,
      published,
      skipped,
      hint: published
        ? "已写入 data/raw/catalog-imported.json（只新增，不覆盖）。运行 npm run merge 后才会出现在网站上。"
        : "没有可发布的条目（需要状态为 matched 且非重复）。",
    });
  }

  if (body.action === "reject") {
    const n = bulkUpdate(ids, { status: "rejected" });
    return NextResponse.json({ ok: true, updated: n });
  }

  if (body.action === "delete") {
    const n = removeItems(ids);
    return NextResponse.json({ ok: true, removed: n });
  }

  if (body.action === "edit") {
    // 单条编辑：patch 里允许改 title/originalTitle/year/tags/themeSlug/note
    const id = ids[0];
    const patch = body.patch ?? {};
    const current = readQueue().items.find((i) => i.id === id);
    if (!current) return NextResponse.json({ ok: false, error: "找不到该条目" }, { status: 404 });

    const nextMatch = current.match
      ? {
          ...current.match,
          chineseTitle: typeof patch.chineseTitle === "string" ? patch.chineseTitle : current.match.chineseTitle,
          originalTitle: typeof patch.originalTitle === "string" ? patch.originalTitle : current.match.originalTitle,
          year: typeof patch.year === "number" ? patch.year : current.match.year,
        }
      : null;

    const nextTags =
      patch.tags && typeof patch.tags === "object"
        ? { ...current.tags, ...(patch.tags as Record<string, string[]>) }
        : current.tags;

    const updated = updateItem(id, {
      match: nextMatch,
      tags: nextTags,
      themeSlug: typeof patch.themeSlug === "string" ? patch.themeSlug : current.themeSlug,
      note: typeof patch.note === "string" ? patch.note : current.note,
      status: "matched",
    });
    return NextResponse.json({ ok: true, item: updated });
  }

  return NextResponse.json({ ok: false, error: "未知 action" }, { status: 400 });
}
