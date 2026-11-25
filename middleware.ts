import { NextResponse, type NextRequest } from "next/server";
import { countView, UV_COOKIE } from "@/lib/traffic-edge";

/**
 * 后台访问控制（第一道闸）。
 *
 * - /admin/*（登录页除外）没有有效会话 → 跳转登录页
 * - /api/admin/*（login 除外）没有有效会话 → 401 JSON
 * - /sources（原公开「数据与授权」）对非管理员一律 404
 *
 * 会话 Cookie 是 HMAC-SHA256 签名的 payload，这里用 Web Crypto 校验签名，
 * 因此伪造 cookie 也过不去；页面与接口内部还有第二道 isAdmin() 校验。
 */

const SESSION_COOKIE = "fa_admin_session";

function adminUser(): string {
  return process.env.ADMIN_USER?.trim() || "admin";
}

function adminPassword(): string {
  return process.env.ADMIN_PASSWORD?.trim() || "fantasy-atlas-admin";
}

function secret(): string {
  return process.env.ADMIN_SECRET?.trim() || `fa-session:${adminUser()}:${adminPassword()}`;
}

function base64urlToBytes(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function bytesToBase64url(bytes: ArrayBuffer): string {
  const view = new Uint8Array(bytes);
  let binary = "";
  for (const byte of view) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function isValidSession(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const [body, signature] = token.split(".");
  if (!body || !signature) return false;

  try {
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret()),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
    if (bytesToBase64url(mac) !== signature) return false;

    const payload = JSON.parse(new TextDecoder().decode(base64urlToBytes(body))) as {
      u?: string;
      exp?: number;
    };
    if (payload.u !== adminUser()) return false;
    if (typeof payload.exp !== "number" || payload.exp * 1000 < Date.now()) return false;
    return true;
  } catch {
    return false;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(SESSION_COOKIE)?.value;

  // 只在「真正的页面浏览」上计数：跳过资源、接口、预取、后台
  const isDocument =
    (request.method === "GET" || request.method === "HEAD") &&
    !pathname.startsWith("/_next") &&
    !pathname.startsWith("/api") &&
    !pathname.startsWith("/admin") &&
    !pathname.startsWith("/posters") &&
    (request.headers.get("accept") ?? "").includes("text/html") &&
    request.headers.get("next-router-prefetch") === null &&
    request.headers.get("purpose") !== "prefetch" &&
    request.headers.get("x-middleware-prefetch") === null;

  const isAdminArea = pathname.startsWith("/admin") && pathname !== "/admin/login";
  const isAdminApi = pathname.startsWith("/api/admin") && pathname !== "/api/admin/login";
  const isRetiredPublicPage = pathname === "/sources" || pathname.startsWith("/sources/");

  if (isDocument) {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const seen = request.cookies.get(UV_COOKIE)?.value;
      const firstToday = seen !== today;
      countView(firstToday);

      const response = isAdminArea || isAdminApi || isRetiredPublicPage
        ? await gate(request, token, { isAdminArea, isAdminApi, isRetiredPublicPage })
        : NextResponse.next();

      if (firstToday) {
        response.cookies.set(UV_COOKIE, today, {
          path: "/",
          maxAge: 60 * 60 * 24,
          sameSite: "lax",
          httpOnly: false,
        });
      }
      return response;
    } catch {
      /* 计数出错不影响访问 */
    }
  }

  if (!isAdminArea && !isAdminApi && !isRetiredPublicPage) return NextResponse.next();

  return gate(request, token, { isAdminArea, isAdminApi, isRetiredPublicPage });
}

async function gate(
  request: NextRequest,
  token: string | undefined,
  flags: { isAdminArea: boolean; isAdminApi: boolean; isRetiredPublicPage: boolean },
): Promise<NextResponse> {
  const { isAdminArea, isAdminApi, isRetiredPublicPage } = flags;
  if (await isValidSession(token)) return NextResponse.next();

  if (isAdminApi) {
    return NextResponse.json({ ok: false, error: "未登录或会话已过期" }, { status: 401 });
  }

  if (isAdminArea) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (isRetiredPublicPage) {
    // 已下架的公开页面：对普通访客直接 404，不暴露它存在过
    return new NextResponse("Not Found", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|posters|posters-douban|favicon.ico|robots.txt|sitemap.xml).*)"],
};
