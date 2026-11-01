"use client";

import Link from "next/link";
import { useState } from "react";

export interface GalleryTheme {
  slug: string;
  zh: string;
  en: string;
  tagline: string;
  description: string;
  count: number;
  /** 大图：优先剧照，其次海报 */
  cover: string;
  /** 小海报三张 */
  posters: { id: string; src: string; title: string }[];
  accent: string;
}

/**
 * 交互式主题画廊：五个主题并排，鼠标悬停时当前卡片横向展开、其余收窄。
 * 移动端退化为可横向滑动的画廊（点击即进入主题页）。
 */
export function ThemeGallery({ themes }: { themes: GalleryTheme[] }) {
  const [active, setActive] = useState<number | null>(null);

  return (
    <div onMouseLeave={() => setActive(null)}>
      {/* 桌面端：并排展开式，卡片占满主体视野 */}
      <div className="hidden h-[62svh] min-h-[460px] gap-2.5 md:flex lg:h-[68svh] lg:min-h-[540px]">
        {themes.map((t, i) => {
          const isActive = active === i;
          const dim = active !== null && !isActive;
          return (
            <Link
              key={t.slug}
              href={`/themes/${t.slug}`}
              onMouseEnter={() => setActive(i)}
              onFocus={() => setActive(i)}
              className="group relative overflow-hidden border border-[var(--hairline)] transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]"
              style={{
                flexGrow: isActive ? 3.1 : dim ? 0.78 : 1,
                flexBasis: 0,
                filter: dim ? "saturate(0.9) brightness(0.86)" : "none",
              }}
              aria-label={`进入${t.zh}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={t.cover}
                alt={`${t.zh}主题画面`}
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-[1600ms] ease-out group-hover:scale-[1.05]"
                style={{ filter: "saturate(1.06) contrast(1.03) brightness(0.95)" }}
                loading={i < 2 ? "eager" : "lazy"}
                decoding="async"
              />
              <div className="absolute inset-0 bg-[linear-gradient(to_top,rgba(5,7,12,0.96)_0%,rgba(5,7,12,0.55)_38%,rgba(5,7,12,0.12)_68%,rgba(5,7,12,0.45)_100%)]" />

              {/* 主题名：始终显示在顶部，暗金衬线 */}
              <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-5">
                <div>
                  <p className="text-[0.56rem] uppercase tracking-[0.3em] text-[rgba(226,200,127,0.8)]">{t.en}</p>
                  <h3
                    className="display mt-2 whitespace-nowrap text-[1.45rem] leading-tight lg:text-[1.75rem]"
                    style={{ color: "#e6cd8d", textShadow: "0 2px 18px rgba(5,7,12,0.9)" }}
                  >
                    {t.zh}
                  </h3>
                </div>
                <span className="whitespace-nowrap text-[0.62rem] tracking-[0.14em] text-[var(--color-ivory-dim)]">
                  {t.count} 部
                </span>
              </div>

              {/* 竖排提示：未展开时也有"可进入"的暗示 */}
              <span
                className="absolute right-4 top-1/2 -translate-y-1/2 rotate-180 text-[0.58rem] uppercase tracking-[0.4em] text-[rgba(226,200,127,0.55)] transition-opacity duration-500 [writing-mode:vertical-rl]"
                style={{ opacity: isActive ? 0 : 1 }}
                aria-hidden
              >
                Click to enter
              </span>

              {/* 展开后显示的内容 */}
              <div
                className="absolute inset-x-0 bottom-0 p-5 transition-all duration-700"
                style={{ opacity: isActive || active === null ? 1 : 0.55 }}
              >
                <p className="text-[0.78rem] italic text-[var(--color-ivory-dim)]">{t.tagline}</p>

                <div
                  className="overflow-hidden transition-all duration-700"
                  style={{ maxHeight: isActive ? 220 : 0, opacity: isActive ? 1 : 0 }}
                >
                  <p className="mt-3 max-w-md text-[0.78rem] leading-relaxed text-[var(--color-ash)]">{t.description}</p>
                  <div className="mt-4 flex items-end gap-2">
                    {t.posters.slice(0, 4).map((p) => (
                      <div key={p.id} className="poster-frame aspect-[2/3] w-[52px] shrink-0 overflow-hidden" title={p.title}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={p.src} alt={p.title} className="h-full w-full object-cover" loading="lazy" />
                      </div>
                    ))}
                  </div>
                  <span className="mt-4 inline-flex items-center gap-2 border border-[rgba(226,200,127,0.5)] px-4 py-2 text-[0.7rem] tracking-[0.16em] text-gold-soft">
                    进入{t.zh} →
                  </span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* 移动端：横向滑动画廊 */}
      <div className="scroll-x -mx-5 flex gap-3 px-5 pb-3 md:hidden">
        {themes.map((t) => (
          <Link
            key={t.slug}
            href={`/themes/${t.slug}`}
            className="relative h-[340px] w-[76vw] max-w-[300px] shrink-0 overflow-hidden border border-[var(--hairline)]"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={t.cover} alt={`${t.zh}主题画面`} className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
            <div className="absolute inset-0 bg-[linear-gradient(to_top,rgba(5,7,12,0.96),rgba(5,7,12,0.3)_55%,rgba(5,7,12,0.5))]" />
            <div className="absolute inset-x-0 top-0 p-4">
              <p className="text-[0.54rem] uppercase tracking-[0.28em] text-[rgba(226,200,127,0.75)]">{t.en}</p>
              <h3 className="display mt-1.5 text-xl text-gold-soft">{t.zh}</h3>
            </div>
            <div className="absolute inset-x-0 bottom-0 p-4">
              <p className="text-[0.74rem] italic text-[var(--color-ivory-dim)]">{t.tagline}</p>
              <p className="mt-2 text-[0.66rem] tracking-[0.12em] text-[var(--color-ash)]">{t.count} 部作品 →</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
