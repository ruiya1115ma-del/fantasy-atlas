import { NextResponse } from "next/server";
import { getKv } from "@/lib/admin/kv";
import { adminToken, reviewSubmission } from "@/lib/submissions";
import { reviewSubmissionKv } from "@/lib/submissions-kv";

export const dynamic = "force-dynamic";

/** POST /api/submissions/review —— 管理员审核（通过 / 驳回），线上写 KV */
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

  const kv = await getKv();
  const updated = kv
    ? await reviewSubmissionKv(body.id, body.action, body.reviewNote)
    : reviewSubmission(body.id, body.action, body.reviewNote);
  if (!updated) return NextResponse.json({ ok: false, error: "找不到这条投稿" }, { status: 404 });

  return NextResponse.json({
    ok: true,
    submission: updated,
    hint:
      updated.status === "approved"
        ? "已通过。后台「电影资料」里可以直接新建这部作品并补全标签与简介。"
        : "已驳回。",
  });
}
