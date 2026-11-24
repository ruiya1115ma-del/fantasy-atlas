/** @type {import('next').NextConfig} */
const staticExport = process.env.FA_STATIC_EXPORT === "1";

const nextConfig = {
  reactStrictMode: true,
  // 静态导出（Cloudflare Pages / 任意静态托管）时使用：
  //   FA_STATIC_EXPORT=1 node scripts/build-static-pages.mjs  →  out/
  // 导出模式下没有服务端，图片优化要关掉，路由改由目录 + index.html 承载。
  ...(staticExport
    ? {
        output: "export",
        images: { unoptimized: true },
        trailingSlash: true,
      }
    : {}),
  experimental: {
    // keep the JSON catalog importable at build time without bundling it into client JS
    optimizePackageImports: [],
    // 默认关闭。开启原因只有一个：本机沙箱禁止 fork 子进程（spawn EPERM），
    // 而 Next dev 会用 jest-worker 起子进程跑 generateStaticParams。
    // 设 FA_WORKER_THREADS=1 后改用 worker_threads（同进程），dev 才能渲染动态路由。
    // 普通机器不需要它 —— 而且 Turbopack 的 `next build` 在开启时会有
    // `DataCloneError: ()=>null could not be cloned`，所以默认必须是 false。
    workerThreads: process.env.FA_WORKER_THREADS === "1",
  },
};

export default nextConfig;
