import { NextResponse } from "next/server";
import { getKv } from "@/lib/admin/kv";
import { addSubmission, listSubmissions, submissionSchema } from "@/lib/submissions";
import { addSubmissionKv, listSubmissionsKv } from "@/lib/submissions-kv";

export const dynamic = "force-dynamic";

/** POST /api/submissions —— 公开投稿入口（线上写 KV，本机写文件） */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "请求格式不对" }, { status: 400 });
  }

  const parsed = submissionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0]?.message ?? "内容不合法" },
      { status: 422 }
    );
  }

  const kv = await getKv();
  const created = kv ? await addSubmissionKv(parsed.data) : addSubmission(parsed.data);
  if (!created) {
    return NextResponse.json({ ok: false, error: "投稿暂时无法保存，请稍后再试" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, id: created.id, status: created.status }, { status: 201 });
}

/** GET /api/submissions?token=... —— 管理员查看队列 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token") ?? "";
  const expected = process.env.ADMIN_TOKEN || "fantasy-atlas-admin";
  if (token !== expected) {
    return NextResponse.json({ ok: false, error: "需要管理口令" }, { status: 401 });
  }
  const status = searchParams.get("status") as "pending" | "approved" | "rejected" | null;
  const kv = await getKv();
  const submissions = kv ? await listSubmissionsKv(status ?? undefined) : listSubmissions(status ?? undefined);
  return NextResponse.json({ ok: true, submissions });
}
