/**
 * 本地开发服务器启动脚本。
 *
 * 为什么不用 `next dev`：
 * 本机运行在受限沙箱里，`next dev` 会 fork 一个子进程（需要 IPC 管道），在这里会 EPERM。
 * 直接调用 Next 的 start-server 在同一个进程内启动 dev 服务器，行为与 `next dev` 一致
 * （包含 HMR、按需编译），只是少了那层进程隔离。
 *
 * 正常环境下应该直接用 `npm run dev`（即 next dev -p 4317）；这个脚本是受限环境的等价替代。
 */
import { createRequire } from "node:module";
import path from "node:path";

// 让 Next 用 worker_threads 而不是 fork 子进程（沙箱里 fork 会 EPERM）
process.env.FA_WORKER_THREADS = process.env.FA_WORKER_THREADS ?? "1";

const require = createRequire(import.meta.url);
const { startServer } = require("next/dist/server/lib/start-server");

const port = Number(process.env.PORT ?? 4317);
const dir = path.resolve(process.cwd());

console.log(`> Fantasy Atlas dev server (in-process) on http://localhost:${port}`);

await startServer({
  dir,
  isDev: true,
  hostname: process.env.HOSTNAME ?? "127.0.0.1",
  port,
  allowRetry: false,
});
