/**
 * Cloudflare Workers KV 访问层（后台写入的持久化存储）。
 *
 * 线上（Workers）：有 FA_DATA 绑定时，所有后台改动写 KV，前台动态页读 KV。
 * 本地开发（node）：没有绑定，自动退回原来的文件读写，行为完全不变。
 */

export interface KvBinding {
  get(key: string, type?: "text" | "json"): Promise<unknown>;
  put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
  list(opts?: { prefix?: string; limit?: number }): Promise<{ keys: { name: string }[] }>;
}

let cached: KvBinding | null | undefined;

/** 拿到 KV 绑定；本地开发返回 null（调用方走文件系统） */
export async function getKv(): Promise<KvBinding | null> {
  if (cached !== undefined) return cached;
  try {
    const mod = (await import("@opennextjs/cloudflare")) as {
      getCloudflareContext?: (opts?: { async?: boolean }) => unknown;
    };
    const ctx = (await mod.getCloudflareContext?.({ async: true })) as
      | { env?: Record<string, unknown> }
      | undefined;
    const binding = ctx?.env?.FA_DATA as KvBinding | undefined;
    cached = binding ?? null;
  } catch {
    cached = null;
  }
  return cached;
}

export const KV_KEYS = {
  catalog: "catalog",
  homeConfig: "home-config",
  submissions: "submissions",
  importQueue: "import-queue",
} as const;

export async function kvReadJson<T>(key: string): Promise<T | null> {
  const kv = await getKv();
  if (!kv) return null;
  try {
    const raw = await kv.get(key, "text");
    if (typeof raw !== "string" || raw.length === 0) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function kvWriteJson(key: string, value: unknown): Promise<void> {
  const kv = await getKv();
  if (!kv) throw new Error("KV 未绑定");
  await kv.put(key, JSON.stringify(value));
}
