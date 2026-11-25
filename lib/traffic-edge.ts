/**
 * 访问计数（在 middleware 里调用，运行于边缘）。
 *
 * 与 lib/traffic.ts 共用同一套 KV key（traffic:YYYY-MM-DD），
 * 区别只有一点：这里不经过 lib/admin/kv.ts 的缓存，每次直接取当前请求的 Cloudflare 上下文，
 * 因为 middleware 与页面可能跑在不同上下文里。
 */

export const UV_COOKIE = "fa_uv";

const FLUSH_INTERVAL_MS = 10 * 60 * 1000;
const PREFIX = "traffic:";

type KvLike = {
  get(key: string, type?: "text"): Promise<unknown>;
  put(key: string, value: string): Promise<void>;
};

type Buffer = { date: string; pv: number; uv: number };

let buffer: Buffer | null = null;
let lastFlushAt = 0;
let inFlight = false;

const dayOf = (d: Date) =>
  `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;

async function kv(): Promise<KvLike | null> {
  try {
    const mod = (await import("@opennextjs/cloudflare")) as {
      getCloudflareContext?: (opts?: { async?: boolean }) => Promise<unknown> | unknown;
    };
    const ctx = (await mod.getCloudflareContext?.({ async: true })) as
      | { env?: Record<string, unknown> }
      | undefined;
    const binding = ctx?.env?.FA_DATA as KvLike | undefined;
    return binding ?? null;
  } catch {
    return null;
  }
}

async function flush(force: boolean): Promise<void> {
  if (!buffer || inFlight) return;
  const now = Date.now();
  if (!force && now - lastFlushAt < FLUSH_INTERVAL_MS) return;

  const snapshot: Buffer = { ...buffer };
  buffer = null;
  lastFlushAt = now;
  inFlight = true;

  try {
    const store = await kv();
    if (!store) return;
    const key = `${PREFIX}${snapshot.date}`;
    const raw = await store.get(key, "text");
    const prev = typeof raw === "string" && raw.length > 0 ? (JSON.parse(raw) as { pv?: number; uv?: number }) : null;
    const next = {
      date: snapshot.date,
      pv: (prev?.pv ?? 0) + snapshot.pv,
      uv: (prev?.uv ?? 0) + snapshot.uv,
    };
    await store.put(key, JSON.stringify(next));
  } catch {
    /* 计数失败绝不影响页面 */
  } finally {
    inFlight = false;
  }
}

/** 记录一次页面浏览；返回今天是否为该浏览器第一次访问 */
export function countView(isFirstVisitToday: boolean): void {
  const date = dayOf(new Date());
  if (!buffer || buffer.date !== date) {
    void flush(true);
    buffer = { date, pv: 0, uv: 0 };
  }
  buffer.pv += 1;
  if (isFirstVisitToday) buffer.uv += 1;
  void flush(false);
}

/** 立刻落地（后台看统计前调用，保证数字包含刚才的浏览） */
export async function flushNow(): Promise<void> {
  await flush(true);
}
