import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin/auth";

/** GET /api/admin/session → 前端用来决定是否显示「编辑这部作品」入口 */
export async function GET() {
  const session = await getAdminSession();
  return NextResponse.json({ ok: true, admin: Boolean(session), user: session?.u ?? null });
}
