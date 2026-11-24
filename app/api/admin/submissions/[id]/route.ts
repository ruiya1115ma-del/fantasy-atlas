import { NextResponse } from "next/server";
import { errorResponse, requireAdminApi } from "@/lib/admin/api";
import { reviewSubmission } from "@/lib/submissions";

/**
 * POST /api/admin/submissions/[id]  { action: "approve" | "reject", note? }
 * 通过 = 进入 approved 队列；真正进正式库还需要把资料补全（后台会给出提示与链接）。
 */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const denied = await requireAdminApi();
  if (denied) return denied;
  const { id } = await context.params;

  try {
    const body = await request.json().catch(() => ({}));
    const action = body.action === "reject" ? "reject" : "approve";
    const updated = reviewSubmission(id, action, typeof body.note === "string" ? body.note : undefined);
    if (!updated) return NextResponse.json({ ok: false, error: "找不到这条投稿" }, { status: 404 });
    return NextResponse.json({
      ok: true,
      submission: updated,
      hint:
        action === "approve"
          ? "已标记为收录。接下来可在「电影资料」里新增这部作品，或运行 npm run promote:submissions 生成草稿。"
          : "已标记为暂不收录。",
    });
  } catch (err) {
    return errorResponse(err);
  }
}
