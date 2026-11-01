"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Movie } from "@/lib/types";
import { Poster } from "./Poster";

/**
 * 首页「随机发现」。
 * 只随机"给你看一张"，不假装是推荐 —— 推荐要走 /recommend 的透明算法。
 */
export function RandomPick({ movies }: { movies: Movie[] }) {
  // 初始值固定为 0，避免服务端与客户端渲染出不同的随机结果（hydration mismatch）；
  // 挂载后再随机一次。
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (movies.length > 1) setIndex(Math.floor(Math.random() * movies.length));
  }, [movies.length]);

  if (!movies.length) return null;
  const movie = movies[index] ?? movies[0];

  return (
    <div className="panel grid gap-6 p-5 md:grid-cols-[160px_1fr] md:items-center md:gap-8 md:p-7">
      <Link href={`/movies/${movie.slug}`} className="group hidden md:block" aria-label={`查看 ${movie.chineseTitle}`}>
        <div className="poster-frame aspect-[2/3]">
          <Poster movie={movie} className="poster-art h-full w-full" />
        </div>
      </Link>
      <div className="min-w-0">
        <p className="eyebrow">Random Discovery</p>
        <h3 className="display mt-2 text-2xl text-ivory md:text-3xl">
          <Link href={`/movies/${movie.slug}`} className="transition-colors hover:text-gold-soft">
            {movie.chineseTitle}
          </Link>
          <span className="ml-3 align-middle text-xs tracking-[0.1em] text-[var(--color-ash-dim)]">
            {movie.releaseYear}
          </span>
        </h3>
        <p className="lede mt-3 line-clamp-3 text-sm">{movie.synopsis}</p>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setIndex((i) => (movies.length > 1 ? (i + 1 + Math.floor(Math.random() * (movies.length - 1))) % movies.length : i))}
            className="btn btn-ghost btn-sm"
          >
            换一部
          </button>
          <Link href={`/movies/${movie.slug}`} className="btn btn-quiet">
            看看详情 →
          </Link>
        </div>
      </div>
    </div>
  );
}
