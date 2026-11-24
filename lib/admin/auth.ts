/**
 * 管理员会话（仅服务端）。
 *
 * 账号密码来自环境变量：
 *   ADMIN_USER      默认 admin
 *   ADMIN_PASSWORD  未设置时用内置开发口令（部署前必须设置）
 *   ADMIN_SECRET    签名密钥；未设置时由密码派生（改密码会让旧会话失效）
 *
 * 会话是一枚 HttpOnly Cookie，内容是 HMAC-SHA256 签名的 payload：
 *   base64url(JSON{u,iat,exp}).base64url(sig)
 * 因此管理员身份无法被前端伪造，也没有引入任何用户系统/数据库。
 */
import crypto from "node:crypto";
import { cookies } from "next/headers";

export const SESSION_COOKIE = "fa_admin_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 天

const DEV_PASSWORD = "fantasy-atlas-admin";

export function adminUser(): string {
  return process.env.ADMIN_USER?.trim() || "admin";
}

export function adminPassword(): string {
  return process.env.ADMIN_PASSWORD?.trim() || DEV_PASSWORD;
}

/** 是否仍在使用内置口令（后台首页会提示） */
export function usingDefaultPassword(): boolean {
  return !process.env.ADMIN_PASSWORD?.trim();
}

function secret(): string {
  return process.env.ADMIN_SECRET?.trim() || `fa-session:${adminUser()}:${adminPassword()}`;
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

interface SessionPayload {
  u: string;
  iat: number;
  exp: number;
}

export function signSession(user: string, now = Date.now()): string {
  const payload: SessionPayload = {
    u: user,
    iat: Math.floor(now / 1000),
    exp: Math.floor(now / 1000) + SESSION_TTL_SECONDS,
  };
  const body = base64url(JSON.stringify(payload));
  const signature = crypto.createHmac("sha256", secret()).update(body).digest("base64url");
  return `${body}.${signature}`;
}

export function verifySession(token: string | undefined | null): SessionPayload | null {
  if (!token) return null;
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;
  const expected = crypto.createHmac("sha256", secret()).update(body).digest("base64url");
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SessionPayload;
    if (typeof payload.exp !== "number" || payload.exp * 1000 < Date.now()) return null;
    if (payload.u !== adminUser()) return null;
    return payload;
  } catch {
    return null;
  }
}

/** 校验账号密码（时间恒定比较，避免逐字符试探） */
export function checkCredentials(username: string, password: string): boolean {
  const user = Buffer.from(String(username ?? "").trim());
  const expectedUser = Buffer.from(adminUser());
  const pass = Buffer.from(String(password ?? ""));
  const expectedPass = Buffer.from(adminPassword());
  const sameLength = user.length === expectedUser.length && pass.length === expectedPass.length;
  const userOk = sameLength && crypto.timingSafeEqual(user, expectedUser);
  const passOk =
    pass.length === expectedPass.length ? crypto.timingSafeEqual(pass, expectedPass) : false;
  return userOk && passOk;
}

/** 供服务端组件使用：当前请求是否已登录 */
export async function getAdminSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  return verifySession(store.get(SESSION_COOKIE)?.value);
}

export async function isAdmin(): Promise<boolean> {
  return (await getAdminSession()) !== null;
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_TTL_SECONDS,
  };
}
