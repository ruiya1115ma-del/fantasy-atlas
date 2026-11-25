import { kvReadJson, kvWriteJson } from "@/lib/admin/kv";

/**
 * 简单可靠的访问计数（不依赖第三方统计，页面里不放任何追踪脚本）。
 *
 * 只在服务端记录「文档请求」：
 * - pv：每次打开一个页面 +1
 * - uv：同一个浏览器当天第一次打开算 1 个访客（用 cookie 标记，不存 IP、不存指纹）
 *
 * 为了不把 KV 写爆，计数先在内存里累加，最多每 10 分钟落地一次；
 * 极端情况下（isolate 被提前回收）可能丢几个数，但整体趋势准确。
 */

export type DayStat = { date: string; pv: number; uv: number };

export const UV_COOKIE = "fa_uv";
const FLUSH_INTERVAL_MS = 10 * 60 * 1000;

type Buffer = { date: string; pv: number; uv: number; touchedAt: number };

let buffer: Buffer | null = null;
let lastFlushAt = 0;
let flushing: Promise<void> | null = null;

const dayOf = (d: Date) => {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const keyOf = (date: string) => `traffic:${date}`;

async function flush(force = false): Promise<void> {
  if (!buffer) return;
  const now = Date.now();
  if (!force && now - lastFlushAt < FLUSH_INTERVAL_MS) return;
  if (flushing) return;

  const snapshot: Buffer = { ...buffer };
  buffer = null;
  lastFlushAt = now;

  flushing = (async () => {
    try {
      const existing = (await kvReadJson<DayStat>(keyOf(snapshot.date))) ?? {
        date: snapshot.date,
        pv: 0,
        uv: 0,
      };
      await kvWriteJson(keyOf(snapshot.date), {
        date: snapshot.date,
        pv: (existing.pv ?? 0) + snapshot.pv,
        uv: (existing.uv ?? 0) + snapshot.uv,
      });
    } catch {
      /* 计数失败不影响页面 */
    } finally {
      flushing = null;
    }
  })();

  await flushing;
}

/** 记录一次页面浏览。返回值为 true 时调用方应下发 uv cookie。 */
export function countPageView(isFirstVisitToday: boolean): boolean {
  const date = dayOf(new Date());
  if (!buffer || buffer.date !== date) {
    if (buffer) void flush(true);
    buffer = { date, pv: 0, uv: 0, touchedAt: Date.now() };
  }
  buffer.pv += 1;
  if (isFirstVisitToday) buffer.uv += 1;
  buffer.touchedAt = Date.now();
  void flush();
  return true;
}

/** 立即落地（后台/部署后调用，或页面读之前确保最新） */
export async function flushTraffic(): Promise<void> {
  await flush(true);
}

/** 读最近 N 天（含今天）的计数，缺失的日期补 0 */
export async function readTraffic(days = 14): Promise<DayStat[]> {
  await flush(true);
  const out: DayStat[] = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
    const date = dayOf(d);
    const stat = await kvReadJson<DayStat>(keyOf(date));
    out.push({ date, pv: stat?.pv ?? 0, uv: stat?.uv ?? 0 });
  }
  return out;
}
