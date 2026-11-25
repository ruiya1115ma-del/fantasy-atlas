import { kvReadJson, kvWriteJson, KV_KEYS } from "@/lib/admin/kv";
import { loadHomeConfig, normalizeConfig, type HomeConfig } from "@/lib/home-config";

/**
 * 首页配置的运行时读取（线上读 KV，本地读文件）。
 * 结构校验/去重仍然复用 home-config.ts 的 normalizeConfig，避免两套规则。
 *
 * 进程内缓存：正常化 + JSON 解析都不便宜，Workers 免费额度下每请求都做容易超 CPU。
 * 缓存 20 秒，后台保存时立即失效（跨 isolate 最多 20 秒）。
 */

const MEMO_TTL_MS = 20_000;
let configMemo: { config: HomeConfig; at: number } | null = null;

export function invalidateHomeConfigMemo(): void {
  configMemo = null;
}

export async function loadHomeConfigRuntime(): Promise<HomeConfig> {
  const now = Date.now();
  if (configMemo && now - configMemo.at < MEMO_TTL_MS) return configMemo.config;

  const fromKv = await kvReadJson<HomeConfig>(KV_KEYS.homeConfig);
  if (fromKv && Array.isArray(fromKv.sections)) {
    const config = normalizeConfig(fromKv).config;
    configMemo = { config, at: now };
    return config;
  }
  const local = loadHomeConfig();
  configMemo = { config: local, at: now };
  return local;
}

export async function saveHomeConfigKv(input: HomeConfig): Promise<{
  config: HomeConfig;
  droppedMovies: number;
  duplicates: number;
}> {
  const { config, droppedMovies, duplicates } = normalizeConfig(input);
  await kvWriteJson(KV_KEYS.homeConfig, config);
  configMemo = { config, at: Date.now() };
  return { config, droppedMovies, duplicates };
}
