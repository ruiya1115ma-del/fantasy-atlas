"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // 开发期保留控制台输出，生产环境这里可以接自建日志（不接第三方埋点）
    console.error("[fantasy-atlas] render error:", error.message);
  }, [error]);

  return (
    <div className="shell flex min-h-[70vh] flex-col items-center justify-center py-24 text-center">
      <p className="eyebrow">Something Broke</p>
      <h1 className="display mt-4 text-4xl text-ivory md:text-5xl">这一页没能点亮</h1>
      <p className="lede mt-5 max-w-md text-[0.95rem]">
        渲染时出错了。数据文件可能正在被导入脚本改写，或者某一页的字段不完整。可以重试，也可以先回到首页。
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <button type="button" onClick={reset} className="btn btn-primary">
          重试
        </button>
        <Link href="/" className="btn btn-ghost">
          回到首页
        </Link>
      </div>
      {error.digest && <p className="mt-6 font-mono text-[0.68rem] text-[var(--color-ash-dim)]">digest: {error.digest}</p>}
    </div>
  );
}
