import { kvReadJson, kvWriteJson, KV_KEYS } from "@/lib/admin/kv";
import { loadHomeConfig, normalizeConfig, type HomeConfig } from "@/lib/home-config";

/**
 * 首页配置的运行时读取（线上读 KV，本地读文件）。
 * 结构校验/去重仍然复用 home-config.ts 的 normalizeConfig，避免两套规则。
 */

export async function loadHomeConfigRuntime(): Promise<HomeConfig> {
  const fromKv = await kvReadJson<HomeConfig>(KV_KEYS.homeConfig);
  if (fromKv && Array.isArray(fromKv.sections)) {
    return normalizeConfig(fromKv).config;
  }
  return loadHomeConfig();
}

export async function saveHomeConfigKv(input: HomeConfig): Promise<{
  config: HomeConfig;
  droppedMovies: number;
  duplicates: number;
}> {
  const { config, droppedMovies, duplicates } = normalizeConfig(input);
  await kvWriteJson(KV_KEYS.homeConfig, config);
  return { config, droppedMovies, duplicates };
}
