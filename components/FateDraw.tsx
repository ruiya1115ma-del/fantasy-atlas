"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

export interface FateFilm {
  id: string;
  slug: string;
  title: string;
  originalTitle: string;
  year: number;
  kind: "movie" | "series";
  poster: string;
  still: string;
  synopsis: string;
  tags: string[];
  rating: string;
}

type Phase = "idle" | "drawing" | "result";

/**
 * 命运随机抽取：整屏沉浸式。
 * 左侧是文案与金色按钮，右侧是魔法星盘（纯 CSS/SVG 装饰）+ 月光与漂浮光点。
 * 抽取时不编造任何数据：结果全部来自 data/catalog.json 的真实条目。
 */
export function FateDraw({ films }: { films: FateFilm[] }) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [pick, setPick] = useState<FateFilm | null>(null);
  const [watched, setWatched] = useState<string[]>([]);
  const [allowRepeat, setAllowRepeat] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem("fantasy-atlas:library:v1");
      if (raw) {
        const lib = JSON.parse(raw) as { watched?: string[] };
        setWatched(Array.isArray(lib.watched) ? lib.watched : []);
      }
    } catch {
      /* localStorage 不可用时忽略 */
    }
  }, []);

  const pool = useMemo(() => {
    if (allowRepeat) return films;
    const rest = films.filter((f) => !watched.includes(f.id));
    return rest.length ? rest : films;
  }, [films, watched, allowRepeat]);

  const draw = useCallback(() => {
    if (phase === "drawing" || pool.length === 0) return;
    setPhase("drawing");
    const candidates = pool.length > 1 ? pool.filter((f) => f.id !== pick?.id) : pool;
    const next = candidates[Math.floor(Math.random() * candidates.length)] ?? pool[0];
    window.setTimeout(() => {
      setPick(next);
      setPhase("result");
    }, 1600);
  }, [phase, pool, pick]);

  const drawing = phase === "drawing";

  return (
    <section className="relative isolate overflow-hidden border-y border-[var(--hairline)]">
      {/* 背景：极暗的真实剧照 + 紫雾，保证不与前景打架 */}
      <div className="absolute inset-0">
        {(pick?.still || films[0]?.still) && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={pick?.still || films[0]?.still}
            alt=""
            aria-hidden
            className="h-full w-full object-cover opacity-40 transition-opacity duration-1000"
            style={{ filter: "saturate(0.95) brightness(0.34) blur(1px)" }}
          />
        )}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_72%_46%,rgba(52,38,86,0.55),transparent_58%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(100deg,rgba(5,7,12,0.96)_0%,rgba(5,7,12,0.7)_48%,rgba(5,7,12,0.9)_100%)]" />
      </div>

      <div className="shell relative z-10 grid min-h-[92svh] items-center gap-10 py-16 lg:grid-cols-[1fr_1fr] lg:gap-4 lg:py-20">
        {/* 左：标题 + 文案 + 抽取 */}
        <div>
          <p className="text-[0.62rem] uppercase tracking-[0.44em] text-[rgba(226,200,127,0.8)]">Fate Draw</p>
          <h2 className="display mt-5 text-[2.9rem] leading-[0.95] text-ivory sm:text-[4rem] lg:text-[4.6rem]">
            命运随机抽取
          </h2>

          <p
            className="mt-7 max-w-md text-[0.98rem] leading-[2.1] tracking-[0.06em] text-[var(--color-ivory-dim)]"
            style={{ fontFamily: '"Noto Serif SC","Songti SC","SimSun",serif' }}
          >
            闭上眼，交给命运 ——
            <br />
            让一部奇幻电影，带你去往未知的世界。
          </p>

          <div className="mt-10 flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={draw}
              disabled={drawing}
              className="group relative inline-flex items-center border border-[rgba(226,200,127,0.75)] bg-[linear-gradient(120deg,rgba(201,162,39,0.42),rgba(110,92,134,0.3))] px-12 py-5 shadow-[0_0_60px_-20px_rgba(226,200,127,0.8)] transition-all duration-500 hover:border-gold hover:bg-[linear-gradient(120deg,rgba(201,162,39,0.55),rgba(110,92,134,0.36))] hover:shadow-[0_0_90px_-14px_rgba(226,200,127,1)] disabled:cursor-wait disabled:opacity-70 sm:px-14 sm:py-6"
            >
              <span
                className="display text-[1.25rem] font-semibold tracking-[0.22em] text-transparent sm:text-[1.5rem]"
                style={{
                  backgroundImage: "linear-gradient(100deg,#f7e9bd 0%,#e2c87f 45%,#c9a227 100%)",
                  WebkitBackgroundClip: "text",
                  backgroundClip: "text",
                  textShadow: "0 0 24px rgba(226,200,127,0.3)",
                }}
              >
                {drawing ? "星辰流转…" : phase === "result" ? "再抽取一次" : "抽取一部"}
              </span>
            </button>

            <label className="flex items-center gap-2 text-[0.72rem] text-[var(--color-ash)]">
              <input
                type="checkbox"
                checked={allowRepeat}
                onChange={(e) => setAllowRepeat(e.target.checked)}
                className="h-3.5 w-3.5 accent-[var(--color-gold)]"
              />
              允许重复抽取
            </label>
          </div>

          <p className="mt-5 text-[0.68rem] leading-relaxed text-[var(--color-ash-dim)]">
            候选池 {pool.length} 部 · 默认排除你标记过「已看」的作品（{watched.length} 部）
            <br />
            抽到的每一部都来自真实片单与豆瓣资料，不随机编造。
          </p>
        </div>

        {/* 右：星盘（未抽中）或结果卡（抽中） */}
        <div className="relative flex min-h-[420px] items-center justify-center lg:min-h-[560px]">
          {/* 星盘：始终在，抽中后退到结果卡后面 */}
          <div
            className={`pointer-events-none absolute inset-0 flex items-center justify-center transition-opacity duration-700 ${
              phase === "result" ? "opacity-25" : "opacity-100"
            }`}
            aria-hidden
          >
            <div className={`fa-chart ${drawing ? "fa-chart--drawing" : ""}`}>
              <div className="fa-chart__glow" />
              <svg viewBox="0 0 400 400" className="fa-chart__svg">
                <defs>
                  <radialGradient id="faCore" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#f7e9bd" stopOpacity="0.55" />
                    <stop offset="38%" stopColor="#c9a227" stopOpacity="0.16" />
                    <stop offset="100%" stopColor="#c9a227" stopOpacity="0" />
                  </radialGradient>
                  <linearGradient id="faRing" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#e2c87f" stopOpacity="0.85" />
                    <stop offset="100%" stopColor="#6e5c86" stopOpacity="0.5" />
                  </linearGradient>
                </defs>

                {/* 中央月光 */}
                <circle cx="200" cy="200" r="96" fill="url(#faCore)" />

                {/* 同心轨道 + 刻度 */}
                {[186, 158, 128].map((r, i) => (
                  <g key={r} className="fa-ring" style={{ animationDuration: `${64 + i * 26}s` }}>
                    <circle
                      cx="200"
                      cy="200"
                      r={r}
                      fill="none"
                      stroke="url(#faRing)"
                      strokeWidth={i === 0 ? 0.9 : 0.6}
                      strokeDasharray={i === 1 ? "2 7" : i === 2 ? "1 5" : undefined}
                      opacity={0.85 - i * 0.16}
                    />
                    {Array.from({ length: i === 1 ? 24 : 12 }).map((_, k, arr) => {
                      const angle = (k / arr.length) * Math.PI * 2;
                      const inner = r - (i === 2 ? 7 : 10);
                      return (
                        <line
                          key={k}
                          x1={200 + Math.cos(angle) * r}
                          y1={200 + Math.sin(angle) * r}
                          x2={200 + Math.cos(angle) * inner}
                          y2={200 + Math.sin(angle) * inner}
                          stroke="#e2c87f"
                          strokeWidth="0.7"
                          opacity={0.5 - i * 0.1}
                        />
                      );
                    })}
                  </g>
                ))}

                {/* 星盘符号（抽象几何，不代表任何具体作品） */}
                <g className="fa-ring fa-ring--slow" opacity="0.75">
                  {Array.from({ length: 8 }).map((_, k) => {
                    const angle = (k / 8) * Math.PI * 2;
                    const x = 200 + Math.cos(angle) * 138;
                    const y = 200 + Math.sin(angle) * 138;
                    return <circle key={k} cx={x} cy={y} r={k % 2 === 0 ? 2.4 : 1.6} fill="#f7e9bd" opacity="0.8" />;
                  })}
                </g>

                {/* 指针 */}
                <g className="fa-ring fa-ring--fast" opacity="0.55">
                  <line x1="200" y1="200" x2="200" y2="62" stroke="#f3ecdf" strokeWidth="0.8" opacity="0.7" />
                  <line x1="200" y1="200" x2="316" y2="200" stroke="#e2c87f" strokeWidth="0.6" opacity="0.5" />
                </g>

                <circle cx="200" cy="200" r="3.2" fill="#f7e9bd" />
              </svg>

              {/* 漂浮光点 */}
              {Array.from({ length: 18 }).map((_, i) => (
                <span
                  key={i}
                  className="fa-mote"
                  style={{
                    left: `${12 + ((i * 37) % 76)}%`,
                    top: `${10 + ((i * 53) % 80)}%`,
                    animationDelay: `${(i % 9) * 0.7}s`,
                    animationDuration: `${6 + (i % 5) * 1.4}s`,
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 结果卡：原先的 1.5 倍大小，作为整屏遮罩居中展示，避免在半栏里被挤压换行 */}
      {phase === "result" && pick && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-[rgba(4,6,12,0.62)] px-4 py-10 backdrop-blur-[2px]">
          <div className="fa-result w-full max-w-[780px] border border-[rgba(226,200,127,0.45)] bg-[rgba(6,9,16,0.94)] p-7 shadow-[0_0_140px_-30px_rgba(226,200,127,0.8)] sm:p-9">
            <div className="flex flex-col items-center gap-7 sm:flex-row sm:items-start sm:gap-8">
              <div className="poster-frame aspect-[2/3] w-[190px] shrink-0 overflow-hidden border border-[rgba(226,200,127,0.3)] sm:w-[236px]">
                {pick.poster ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={pick.poster} alt={pick.title} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-[rgba(12,16,26,0.9)]">
                    <span className="display text-[1.6rem] text-[rgba(226,200,127,0.55)]">{pick.title.slice(0, 1)}</span>
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1 text-center sm:text-left">
                <p className="text-[0.74rem] uppercase tracking-[0.34em] text-[rgba(226,200,127,0.8)]">命运选中了你</p>
                <h3 className="display mt-2.5 text-[1.9rem] leading-[1.1] text-ivory sm:text-[2.4rem]">{pick.title}</h3>
                <p className="mt-2 text-[0.95rem] italic text-[var(--color-ivory-dim)]">{pick.originalTitle}</p>
                <p className="mt-2.5 text-[0.92rem] tracking-[0.06em] text-[var(--color-ash)]">
                  {pick.year} · {pick.kind === "series" ? "剧集" : "电影"} · {pick.rating}
                </p>
                <p className="mt-3.5 line-clamp-6 text-[0.98rem] leading-relaxed text-[var(--color-ash)]">
                  {pick.synopsis}
                </p>
                <div className="mt-3.5 flex flex-wrap justify-center gap-x-3 gap-y-1.5 sm:justify-start">
                  {pick.tags.slice(0, 4).map((t) => (
                    <span key={t} className="text-[0.82rem] tracking-[0.06em] text-[var(--color-ash-dim)]">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-4 sm:justify-start">
              <Link href={`/movies/${pick.slug}`} className="btn btn-primary px-7 py-3.5 text-[0.95rem]">
                查看电影
              </Link>
              <button type="button" onClick={draw} disabled={drawing} className="btn btn-ghost px-6 py-3.5 text-[0.95rem]">
                再抽取一次
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
