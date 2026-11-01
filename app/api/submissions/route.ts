import { NextResponse } from "next/server";
import { addSubmission, listSubmissions, submissionSchema } from "@/lib/submissions";

export const dynamic = "force-dynamic";

/** POST /api/submissions —— 公开投稿入口 */
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

  const created = addSubmission(parsed.data);
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
  return NextResponse.json({ ok: true, submissions: listSubmissions(status ?? undefined) });
}
