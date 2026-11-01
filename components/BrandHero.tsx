"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export interface BrandTile {
  id: string;
  src: string;
  title: string;
}

/**
 * 品牌首页的视觉底：真实电影剧照/海报铺满整屏（每格都是不同电影，不留空）。
 *
 * 做法：24 张互不相同的真实图片填满网格（3/4/6 列都能整除 24，所以不会出现空格），
 * 每格在自身范围内缓慢放大（不位移，避免露出底色），整体压暗成朦胧的电影感背景，
 * 中央留给站名。没有任何 AI 生成画面。
 */
export function BrandHero({ tiles, count }: { tiles: BrandTile[]; count: number }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // 24 格：3 / 4 / 6 列都能整除，保证任何断点都铺满
  const cells = tiles.slice(0, 24);

  return (
    <section className="relative isolate flex min-h-[92svh] items-center overflow-hidden border-b border-[var(--hairline)]">
      {/* 拼贴层：每格一张不同的真实电影图，铺满整屏 */}
      <div className="absolute inset-0 grid h-full w-full grid-cols-3 grid-rows-8 gap-[3px] md:grid-cols-4 md:grid-rows-6 lg:grid-cols-6 lg:grid-rows-4">
        {cells.map((t, i) => (
          <div key={t.id} className="relative h-full w-full overflow-hidden bg-[var(--color-ink)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={t.src}
              alt=""
              aria-hidden
              className="h-full w-full object-cover transition-transform duration-[6000ms] ease-out"
              style={{
                transform: mounted ? "scale(1.06)" : "scale(1)",
                filter: "saturate(0.95) contrast(1.02) brightness(0.62)",
                transitionDelay: `${(i % 6) * 120}ms`,
              }}
              loading={i < 6 ? "eager" : "lazy"}
              decoding="async"
            />
          </div>
        ))}
      </div>

      {/* 薄雾与暗角：画面退到背景，注意力交还给站名 */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_44%,rgba(5,7,12,0.92)_0%,rgba(5,7,12,0.82)_30%,rgba(5,7,12,0.5)_58%,rgba(5,7,12,0.9)_100%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgba(5,7,12,0.85),transparent_28%,transparent_72%,rgba(5,7,12,0.92))]" />
      <div className="pointer-events-none absolute inset-0 mix-blend-screen bg-[radial-gradient(55%_38%_at_50%_50%,rgba(110,92,134,0.14),transparent_72%)]" />

      {/* 品牌层：Fantasy Atlas（绝对 C 位）> 中文品牌标题 > 进入按钮 > 副标题 > 装饰小字 */}
      <div className="shell relative z-10 py-20 text-center">
        <p className="animate-fade-in text-[0.62rem] uppercase tracking-[0.44em] text-[rgba(226,200,127,0.72)] sm:text-[0.68rem]">
          A Private Atlas of Fantasy Cinema
        </p>

        <h1
          className="display mt-6 animate-fade-up text-[4.2rem] font-normal leading-[0.82] tracking-[-0.015em] text-ivory sm:text-[7.4rem] lg:text-[10.6rem]"
          style={{ textShadow: "0 12px 60px rgba(0,0,0,0.55)" }}
        >
          Fantasy
          <span
            className="ml-2 inline-block italic sm:ml-4"
            style={{
              backgroundImage: "linear-gradient(150deg,#f7e9bd 0%,#e2c87f 45%,#c9a227 100%)",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              color: "transparent",
            }}
          >
            Atlas
          </span>
        </h1>

        {/* 中文品牌标题 */}
        <h2
          className="mt-7 animate-fade-up text-[1.55rem] font-normal leading-none tracking-[0.34em] text-ivory sm:mt-9 sm:text-[2.1rem] lg:text-[2.7rem]"
          style={{ fontFamily: '"Noto Serif SC","Songti SC","SimSun",serif' }}
        >
          奇幻电影图鉴
        </h2>

        <div
          className="mx-auto mt-8 h-px w-32 animate-fade-in bg-[linear-gradient(to_right,transparent,rgba(226,200,127,0.75),transparent)]"
          aria-hidden
        />

        {/* 副标题：古典宋体，字号适中，字距舒展 */}
        <div
          className="mt-9 animate-fade-up space-y-3 leading-[2.1] text-[var(--color-ivory-dim)] sm:mt-10"
          style={{ fontFamily: '"Noto Serif SC","Songti SC","SimSun",serif' }}
        >
          <p className="text-[1.02rem] tracking-[0.14em] sm:text-[1.14rem]">一座收藏奇幻世界的私人电影图鉴</p>
          <p className="text-[0.9rem] tracking-[0.1em] text-[var(--color-ash)] sm:text-[0.98rem]">
            上百部奇幻电影与剧集，通往魔法、秘境与未知世界
          </p>
        </div>

        {/* 唯一入口：居中，位于说明文字下方 */}
        <div className="mt-11 flex animate-fade-up justify-center sm:mt-12">
          <Link
            href="/explore"
            className="group inline-flex items-center border border-[rgba(226,200,127,0.68)] bg-[linear-gradient(120deg,rgba(201,162,39,0.26),rgba(110,92,134,0.22))] px-12 py-5 shadow-[0_0_50px_-22px_rgba(226,200,127,0.55)] backdrop-blur-sm transition-all duration-500 hover:border-gold hover:bg-[rgba(201,162,39,0.24)] hover:shadow-[0_0_80px_-12px_rgba(226,200,127,0.9)] sm:px-16 sm:py-6"
          >
            <span
              className="display text-[1.3rem] font-semibold tracking-[0.2em] text-transparent sm:text-[1.7rem]"
              style={{
                backgroundImage: "linear-gradient(100deg,#f3ecdf 0%,#e2c87f 42%,#f7e9bd 62%,#c9a227 100%)",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                textShadow: "0 0 26px rgba(226,200,127,0.3)",
              }}
            >
              进入魔法世界
            </span>
          </Link>
        </div>

        <p className="mt-11 animate-fade-in text-[0.5rem] uppercase tracking-[0.2em] text-[var(--color-ash-dim)] sm:text-[0.58rem] sm:tracking-[0.46em]">
          {count} Films · Magic · Gothic · Epic · Wonder
        </p>
      </div>
    </section>
  );
}
