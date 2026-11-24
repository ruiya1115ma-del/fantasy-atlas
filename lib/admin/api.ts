import { NextResponse } from "next/server";
import { getAdminSession } from "./auth";
import { StorageUnavailableError } from "./store";

/** API 统一鉴权：未登录返回 401，绝不在未认证时读写数据。 */
export async function requireAdminApi() {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "未登录或会话已过期" }, { status: 401 });
  }
  return null;
}

/** 统一错误响应：把只读文件系统这类环境问题翻译成可读中文。 */
export function errorResponse(err: unknown) {
  if (err instanceof StorageUnavailableError) {
    return NextResponse.json({ ok: false, error: err.message, code: "read-only" }, { status: 503 });
  }
  const message = err instanceof Error ? err.message : "操作失败";
  return NextResponse.json({ ok: false, error: message }, { status: 400 });
}
