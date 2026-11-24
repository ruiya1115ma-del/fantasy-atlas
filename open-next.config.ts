import { defineCloudflareConfig } from "@opennextjs/cloudflare";

/**
 * OpenNext（Cloudflare Workers）配置。
 * 默认即可：把 Next.js 的 SSR/ISR 输出打包成 Worker + 静态资源。
 * 后台的写入后续接 Workers KV（binding 名 FA_DATA，见 wrangler.jsonc）。
 */
export default defineCloudflareConfig({});
