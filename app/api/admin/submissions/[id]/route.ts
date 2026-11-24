import { NextResponse } from "next/server";
import { errorResponse, requireAdminApi } from "@/lib/admin/api";
import { getKv } from "@/lib/admin/kv";
import { reviewSubmission } from "@/lib/submissions";
import { reviewSubmissionKv } from "@/lib/submissions-kv";

/**
 * POST /api/admin/submissions/[id]  { action: "approve" | "reject", note? }
 * 通过 = 进入已收录队列；真正进正式库还需要在「电影资料」里新建或编辑这部作品。
 */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const denied = await requireAdminApi();
  if (denied) return denied;
  const { id } = await context.params;

  try {
    const body = await request.json().catch(() => ({}));
    const action = body.action === "reject" ? "reject" : "approve";
    const kv = await getKv();
    const updated = kv
      ? await reviewSubmissionKv(id, action, typeof body.note === "string" ? body.note : undefined)
      : reviewSubmission(id, action, typeof body.note === "string" ? body.note : undefined);
    if (!updated) return NextResponse.json({ ok: false, error: "找不到这条投稿" }, { status: 404 });
    return NextResponse.json({
      ok: true,
      submission: updated,
      storage: kv ? "kv" : "file",
      hint:
        action === "approve"
          ? "已标记为收录。接下来可在「电影资料」里新建这部作品，补全标签与简介后即进入正式库。"
          : "已标记为暂不收录。",
    });
  } catch (err) {
    return errorResponse(err);
  }
}
