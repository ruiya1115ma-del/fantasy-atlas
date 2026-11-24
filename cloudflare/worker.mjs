/**
 * Fantasy Atlas —— Workers 静态资源入口。
 * 所有页面、海报、JS/CSS 都已由 `node scripts/build-static-pages.mjs` 预渲染到 out/，
 * 这里只负责把请求交给 Workers 静态资源绑定（ASSETS）。
 * 找不到的路径回退到 404.html（Next 导出的自定义 404）。
 */
export default {
  async fetch(request, env) {
    const res = await env.ASSETS.fetch(request);
    if (res.status === 404) {
      const url = new URL(request.url);
      if (!url.pathname.includes(".")) {
        const fallback = await env.ASSETS.fetch(new Request(new URL("/404.html", url), request));
        if (fallback.status === 200) return fallback;
      }
    }
    return res;
  },
};
