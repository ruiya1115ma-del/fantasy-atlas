import { NextResponse } from "next/server";
import { checkCredentials, SESSION_COOKIE, sessionCookieOptions, signSession } from "@/lib/admin/auth";

/** POST /api/admin/login  { username, password } → 设置 HttpOnly 会话 Cookie */
export async function POST(request: Request) {
  let body: { username?: string; password?: string };
  try {
    body = (await request.json()) as { username?: string; password?: string };
  } catch {
    return NextResponse.json({ ok: false, error: "请求格式不正确" }, { status: 400 });
  }

  const username = String(body.username ?? "");
  const password = String(body.password ?? "");

  if (!checkCredentials(username, password)) {
    // 故意不区分「账号错」还是「密码错」
    return NextResponse.json({ ok: false, error: "账号或密码不正确" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, signSession(username.trim()), sessionCookieOptions());
  return res;
}
