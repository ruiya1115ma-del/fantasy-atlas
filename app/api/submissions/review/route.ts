import { NextResponse } from "next/server";
import { adminToken, reviewSubmission } from "@/lib/submissions";

export const dynamic = "force-dynamic";

/** POST /api/submissions/review —— 管理员审核（通过 / 驳回） */
export async function POST(request: Request) {
  let body: { id?: string; action?: string; token?: string; reviewNote?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "请求格式不对" }, { status: 400 });
  }

  if (!body.token || body.token !== adminToken()) {
    return NextResponse.json({ ok: false, error: "管理口令不正确" }, { status: 401 });
  }
  if (!body.id || (body.action !== "approve" && body.action !== "reject")) {
    return NextResponse.json({ ok: false, error: "缺少 id 或 action" }, { status: 400 });
  }

  const updated = reviewSubmission(body.id, body.action, body.reviewNote);
  if (!updated) return NextResponse.json({ ok: false, error: "找不到这条投稿" }, { status: 404 });

  return NextResponse.json({
    ok: true,
    submission: updated,
    hint:
      updated.status === "approved"
        ? "已通过。运行 node scripts/promote-submissions.mjs 生成草稿记录，补标签与简介后 npm run merge 才会进正式库。"
        : "已驳回。",
  });
}
