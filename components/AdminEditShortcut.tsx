"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

/**
 * 详情页上的「编辑这部作品」入口。
 * 只有登录后端的浏览器才会看到它；普通访客不会多一个按钮，也不影响页面的静态渲染。
 */
export function AdminEditShortcut({ movieId, slug }: { movieId: string; slug: string }) {
  const [admin, setAdmin] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch("/api/admin/session", { cache: "no-store" })
      .then((res) => res.json())
      .then((json) => {
        if (alive && json?.admin) setAdmin(true);
      })
      .catch(() => {
        /* 未登录或网络问题：不显示入口 */
      });
    return () => {
      alive = false;
    };
  }, []);

  if (!admin) return null;

  return (
    <Link
      href={`/admin/movies/${movieId}`}
      className="fixed bottom-6 left-6 z-40 border border-[rgba(226,200,127,0.5)] bg-[rgba(10,11,18,0.9)] px-4 py-2 text-[0.72rem] tracking-[0.08em] text-gold-soft backdrop-blur transition-colors hover:border-[rgba(226,200,127,0.9)]"
      title={`编辑 /movies/${slug}`}
    >
      编辑这部作品
    </Link>
  );
}
