"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

export interface HeroSlide {
  id: string;
  slug: string;
  chineseTitle: string;
  originalTitle: string;
  releaseYear: number;
  /** 整屏画面：优先豆瓣剧照（宽幅），没有则用海报 */
  backdropSrc: string;
  /** 竖向海报（右侧清晰展示） */
  posterSrc: string;
  synopsis: string;
  recommendation: string;
  tags: string[];
  meta: string;
}

const FADE_MS = 1400;
const HOLD_MS = 9000;

/**
 * 首页沉浸式轮播：一次只展示一部电影。
 *
 * 图像全部是真实海报（维基百科条目主图），这里把海报铺满整屏作为"电影画面"，
 * 文字直接压在画面上，靠左侧与底部的渐隐保证可读性。
 * 切换用长淡入淡出（1.4s），不做位移与弹跳 —— 让画面自己变化。
 */
export function HeroCarousel({
  slides,
  heightClass = "h-[86svh]",
}: {
  slides: HeroSlide[];
  heightClass?: string;
}) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const go = useCallback(
    (dir: 1 | -1) => {
      setIndex((i) => (i + dir + slides.length) % slides.length);
    },
    [slides.length]
  );

  useEffect(() => {
    if (paused || slides.length < 2) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % slides.length), HOLD_MS);
    timer.current = t;
    return () => clearInterval(t);
  }, [paused, slides.length]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  if (!slides.length) return null;

  return (
    <section
      className={`relative isolate ${heightClass} min-h-[560px] w-full overflow-hidden border-b border-[var(--hairline)]`}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      aria-roledescription="carousel"
      aria-label="精选影片"
    >
      {/* 画面层 */}
      {slides.map((s, i) => (
        <div
          key={s.id}
          className="absolute inset-0 transition-opacity ease-[cubic-bezier(0.22,1,0.36,1)]"
          style={{ opacity: i === index ? 1 : 0, transitionDuration: `${FADE_MS}ms` }}
          aria-hidden={i !== index}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={s.backdropSrc}
            alt=""
            aria-hidden
            className="h-full w-full object-cover object-[50%_40%]"
            style={{
              filter: "saturate(1.06) contrast(1.04) brightness(0.78)",
              transform: i === index ? "scale(1.05)" : "scale(1)",
              transition: `transform ${HOLD_MS + FADE_MS}ms ease-out, filter ${FADE_MS}ms linear`,
            }}
            loading={i === 0 ? "eager" : "lazy"}
            decoding="async"
          />
        </div>
      ))}

      {/* 渐隐层：左侧偏暗保文字，底部压深过渡到下一屏 */}
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(100deg,rgba(5,7,12,0.97)_0%,rgba(5,7,12,0.88)_38%,rgba(5,7,12,0.35)_66%,rgba(5,7,12,0.8)_100%)]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-[linear-gradient(to_top,rgba(5,7,12,0.98),rgba(5,7,12,0.45)_55%,transparent)]" />

      {/* 顶部压深：让导航栏文字在画面上也能读 */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-56 bg-[linear-gradient(to_bottom,rgba(5,7,12,0.95),transparent)]" />

      {/* 文字层 */}
      <div className="shell relative z-10 flex h-full flex-col">
        <div className="relative flex-1">
          {slides.map((s, i) => (
            <div
              key={s.id}
              className="absolute inset-0 flex items-end pb-6 transition-all ease-[cubic-bezier(0.22,1,0.36,1)] md:pb-10"
              style={{
                opacity: i === index ? 1 : 0,
                transitionDuration: `${FADE_MS}ms`,
                transform: i === index ? "translateY(0)" : "translateY(12px)",
                pointerEvents: i === index ? "auto" : "none",
              }}
              aria-hidden={i !== index}
            >
              <div className="flex w-full items-end justify-between gap-12">
                <div className="max-w-2xl">
                  <p className="text-[0.62rem] uppercase tracking-[0.32em] text-gold-soft">{s.meta}</p>
                  <h1 className="display mt-5 text-[2.7rem] leading-[0.98] text-ivory sm:text-[3.6rem] lg:text-[4.6rem]">
                    {s.chineseTitle}
                  </h1>
                  <p className="mt-3 font-display text-[0.95rem] italic tracking-[0.04em] text-[var(--color-ivory-dim)]">
                    {s.originalTitle}
                  </p>
                  <p className="mt-6 max-w-xl text-[0.9rem] leading-[1.85] text-[var(--color-ivory-dim)] line-clamp-3">
                    {s.synopsis}
                  </p>
                  <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2">
                    {s.tags.map((t) => (
                      <span key={t} className="text-[0.66rem] tracking-[0.1em] text-[var(--color-ash)]">
                        {t}
                      </span>
                    ))}
                  </div>
                  <div className="mt-8 flex flex-wrap items-center gap-4">
                    <Link href={`/movies/${s.slug}`} className="btn btn-primary">
                      进入这部电影
                    </Link>
                    <Link
                      href="/explore?sort=editorial"
                      className="text-[0.72rem] uppercase tracking-[0.22em] text-[var(--color-ivory-dim)] transition-colors hover:text-gold-soft"
                    >
                      继续探索 →
                    </Link>
                  </div>
                </div>

                {/* 清晰的海报本体：背景是同一张图的虚化版本，这里给"真身" */}
                <Link
                  href={`/movies/${s.slug}`}
                  aria-label={`打开 ${s.chineseTitle}`}
                  className="relative hidden shrink-0 lg:block"
                >
                  <span className="absolute -inset-3 border border-[rgba(226,200,127,0.18)]" aria-hidden />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={s.posterSrc}
                    alt={`${s.chineseTitle} 海报`}
                    className="h-[clamp(280px,42vh,420px)] w-auto object-contain shadow-[0_40px_90px_-40px_rgba(0,0,0,0.95)]"
                    loading={i === 0 ? "eager" : "lazy"}
                    decoding="async"
                  />
                </Link>
              </div>
            </div>
          ))}
        </div>

        {/* 控制层 */}
        <div className="flex shrink-0 items-center justify-between pb-7">
          <div className="flex items-center gap-3">
            <span className="font-display text-sm tracking-[0.2em] text-ivory">
              {String(index + 1).padStart(2, "0")}
              <span className="text-[var(--color-ash-dim)]"> / {String(slides.length).padStart(2, "0")}</span>
            </span>
            <span className="hidden h-px w-24 overflow-hidden bg-[rgba(243,236,223,0.18)] sm:block">
              <span
                className="block h-px bg-gold transition-[width]"
                style={{ width: `${((index + 1) / slides.length) * 100}%`, transitionDuration: `${FADE_MS}ms` }}
              />
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => go(-1)}
              aria-label="上一部"
              className="flex h-11 w-11 items-center justify-center border border-[rgba(243,236,223,0.22)] text-ivory transition-all duration-500 hover:border-gold hover:text-gold-soft"
            >
              <span aria-hidden className="text-lg leading-none">
                ‹
              </span>
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              aria-label="下一部"
              className="flex h-11 w-11 items-center justify-center border border-[rgba(243,236,223,0.22)] text-ivory transition-all duration-500 hover:border-gold hover:text-gold-soft"
            >
              <span aria-hidden className="text-lg leading-none">
                ›
              </span>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
