"use client";

import dynamic from "next/dynamic";
import type { MediaCard } from "@/lib/types";
import type { FilterState } from "@/lib/filter";

/**
 * 探索页的筛选与结果网格只在浏览器里渲染。
 *
 * 原因：服务端渲染这 274 张卡片要几百毫秒 CPU，
 * Cloudflare Workers 免费额度（每请求 10ms）会直接超限返回 503。
 * 关掉 SSR 后服务端只输出骨架，卡片由浏览器渲染，首屏时间和以前一致。
 */

const ExploreClient = dynamic(() => import("./ExploreClient").then((m) => m.ExploreClient), {
  ssr: false,
  loading: () => (
    <div className="mx-auto max-w-[1600px] px-5 pb-24 sm:px-8 lg:px-12">
      <div className="flex flex-col gap-10 lg:flex-row lg:items-start">
        <div className="hidden w-[264px] shrink-0 lg:block">
          <div className="h-[520px] animate-pulse rounded-sm border border-[rgba(148,163,184,0.14)] bg-[rgba(255,255,255,0.02)]" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-8 h-6 w-40 animate-pulse rounded-sm bg-[rgba(255,255,255,0.06)]" />
          <div className="grid grid-cols-2 gap-x-4 gap-y-9 sm:grid-cols-3 xl:grid-cols-5">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="space-y-3">
                <div className="aspect-[2/3] w-full animate-pulse rounded-sm bg-[rgba(255,255,255,0.05)]" />
                <div className="h-3 w-3/4 animate-pulse rounded-sm bg-[rgba(255,255,255,0.05)]" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  ),
});

export function ExploreMount({ movies, initial }: { movies: MediaCard[]; initial: FilterState }) {
  return <ExploreClient movies={movies} initial={initial} />;
}
