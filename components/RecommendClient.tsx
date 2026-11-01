"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useLibrary } from "@/components/LibraryProvider";
import { MovieCard } from "@/components/MovieCard";
import { EmptyState, Note, Pill, TagPill } from "@/components/ui";
import { CATEGORIES, MOODS } from "@/lib/curation";
import { DEFAULT_PREFERENCES, recommend, summarizePreferences } from "@/lib/recommend";
import { tagLabel } from "@/lib/vocabulary";
import type { Movie, TagBucket, UserPreferences } from "@/lib/types";

const BUCKETS: { key: Exclude<TagBucket, "exclude">; label: string; hint: string }[] = [
  { key: "world", label: "世界观", hint: "故事发生在什么样的地方" },
  { key: "aesthetic", label: "视觉美学", hint: "如果只看画面，它长什么样" },
  { key: "element", label: "核心元素", hint: "里面一定会出现的东西" },
  { key: "mood", label: "情绪氛围", hint: "看完之后留下的感觉" },
  { key: "type", label: "奇幻类型", hint: "作品在奇幻光谱上的位置" },
];

export function RecommendClient({ movies }: { movies: Movie[] }) {
  const lib = useLibrary();
  const [prefs, setPrefs] = useState<UserPreferences>(DEFAULT_PREFERENCES);
  const [showAllTags, setShowAllTags] = useState(false);
  const [step, setStep] = useState(0);

  const toggleTag = (bucket: TagBucket, tag: string) => {
    setPrefs((p) => {
      const current = p.likedTags[bucket];
      const next = current.includes(tag) ? current.filter((t) => t !== tag) : [...current, tag];
      return { ...p, likedTags: { ...p.likedTags, [bucket]: next }, updatedAt: new Date().toISOString() };
    });
  };

  const toggleMovie = (id: string) => {
    setPrefs((p) => {
      const liked = p.likedMovieIds.includes(id)
        ? p.likedMovieIds.filter((x) => x !== id)
        : p.likedMovieIds.length >= 5
          ? p.likedMovieIds
          : [...p.likedMovieIds, id];
      return { ...p, likedMovieIds: liked, updatedAt: new Date().toISOString() };
    });
  };

  const applyMood = (slug: string) => {
    const mood = MOODS.find((m) => m.slug === slug);
    if (!mood) return;
    setPrefs((p) => {
      const liked = { ...p.likedTags };
      for (const tag of mood.preset.tags) {
        const bucket = bucketOfTag(tag, movies);
        if (bucket && !liked[bucket].includes(tag)) liked[bucket] = [...liked[bucket], tag];
      }
      return { ...p, likedTags: liked, updatedAt: new Date().toISOString() };
    });
  };

  const result = useMemo(() => recommend(movies, prefs, lib, 9), [movies, prefs, lib]);
  const summary = useMemo(() => summarizePreferences(prefs, movies), [prefs, movies]);
  const top = result.hits[0] ?? null;
  const hasPreference = summary.length > 0;

  const tagCount = Object.values(prefs.likedTags).reduce((n, arr) => n + arr.length, 0);

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,320px)_1fr] lg:gap-14">
      {/* ───────── 左：偏好设置 ───────── */}
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <div className="panel p-5">
          <p className="eyebrow">Step {step + 1} / 3</p>
          <h2 className="display mt-2 text-2xl text-ivory">告诉我你的口味</h2>
          <p className="mt-2 text-[0.78rem] leading-relaxed text-[var(--color-ash-dim)]">
            所有输入都会成为推荐理由的一部分。没有神秘排序，只有标签和一横一竖的分数。
          </p>

          <div className="mt-5 space-y-3">
            <div>
              <p className="mb-2 text-[0.66rem] uppercase tracking-[0.14em] text-[var(--color-ash-dim)]">① 凭感觉选一个氛围</p>
              <div className="flex flex-wrap gap-1.5">
                {MOODS.map((m) => (
                  <button key={m.slug} type="button" onClick={() => applyMood(m.slug)} className="chip chip-action">
                    {m.title}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 text-[0.66rem] uppercase tracking-[0.14em] text-[var(--color-ash-dim)]">
                ② 选出喜欢的世界（可选，最多 5 部）
              </p>
              <select
                value=""
                onChange={(e) => {
                  if (e.target.value) toggleMovie(e.target.value);
                  e.target.value = "";
                }}
                className="field"
                aria-label="添加一部喜欢的作品"
              >
                <option value="">添加一部你喜欢的作品…</option>
                {movies
                  .filter((m) => !prefs.likedMovieIds.includes(m.id))
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.chineseTitle}（{m.releaseYear}）
                    </option>
                  ))}
              </select>
              {prefs.likedMovieIds.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {prefs.likedMovieIds.map((id) => {
                    const m = movies.find((x) => x.id === id);
                    if (!m) return null;
                    return (
                      <button key={id} type="button" onClick={() => toggleMovie(id)} className="chip chip-on" title="点击移除">
                        {m.chineseTitle} ✕
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div>
              <p className="mb-2 text-[0.66rem] uppercase tracking-[0.14em] text-[var(--color-ash-dim)]">
                ③ 或者直接挑标签（已选 {tagCount}）
              </p>
              <div className="max-h-64 overflow-y-auto pr-1">
                {(showAllTags ? BUCKETS : BUCKETS.slice(0, 2)).map((b) => (
                  <div key={b.key} className="mb-3">
                    <p className="mb-1.5 text-[0.68rem] text-[var(--color-ivory-dim)]">
                      {b.label}
                      <span className="ml-2 text-[0.62rem] text-[var(--color-ash-dim)]">{b.hint}</span>
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {tagsOfBucket(b.key, movies).map((tag) => {
                        const on = prefs.likedTags[b.key].includes(tag);
                        return (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => toggleTag(b.key, tag)}
                            className={`chip ${on ? "chip-on" : "chip-action"}`}
                          >
                            {tagLabel(tag)}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
              <button type="button" onClick={() => setShowAllTags((v) => !v)} className="text-[0.7rem] text-gold-soft underline underline-offset-4">
                {showAllTags ? "收起标签" : "展开全部五类标签"}
              </button>
            </div>

            <div className="space-y-2 border-t border-[var(--hairline)] pt-3">
              <label className="flex items-center gap-2 text-[0.76rem] text-[var(--color-ivory-dim)]">
                <input
                  type="checkbox"
                  checked={prefs.excludeWatched}
                  onChange={(e) => setPrefs((p) => ({ ...p, excludeWatched: e.target.checked }))}
                  className="accent-[var(--color-gold)]"
                />
                不要推荐我已看过的
              </label>
              <label className="flex items-center gap-2 text-[0.76rem] text-[var(--color-ivory-dim)]">
                <input
                  type="checkbox"
                  checked={prefs.excludeFavorite}
                  onChange={(e) => setPrefs((p) => ({ ...p, excludeFavorite: e.target.checked }))}
                  className="accent-[var(--color-gold)]"
                />
                不要推荐我已收藏的
              </label>
            </div>

            {tagCount > 0 && (
              <button
                type="button"
                onClick={() => setPrefs((p) => ({ ...DEFAULT_PREFERENCES, weights: p.weights }))}
                className="btn btn-quiet btn-sm w-full"
              >
                清空偏好
              </button>
            )}
          </div>
        </div>

        <Note className="mt-4">
          偏好不会上传。推荐在浏览器里算完就结束 —— 没有账号、没有埋点、没有“猜你喜欢”的远端模型。
        </Note>
      </aside>

      {/* ───────── 右：结果 ───────── */}
      <div>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">Your Matches</p>
            <h2 className="display mt-2 text-3xl text-ivory">
              {hasPreference ? `${result.hits.length} 部推荐` : "先告诉我一点口味"}
            </h2>
          </div>
          {hasPreference && (
            <button type="button" onClick={() => setStep((s) => (s + 1) % 3)} className="btn btn-quiet btn-sm">
              换个问法
            </button>
          )}
        </div>

        {hasPreference && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-[0.68rem] uppercase tracking-[0.14em] text-[var(--color-ash-dim)]">你的偏好</span>
            {summary.map((s) => (
              <Pill key={s}>{s}</Pill>
            ))}
          </div>
        )}

        {!hasPreference && (
          <div className="mt-8">
            <EmptyState
              title="还没有足够的信息来推荐"
              description="左侧选一个氛围、或挑几个标签、或加入一部喜欢的作品，推荐就会立刻出现。故意不做「随便给你点什么」—— 那样出来的结果没有解释价值。"
            />
            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {CATEGORIES.map((c) => (
                <Link
                  key={c.slug}
                  href={`/explore?${bucketQueryFor(c.signatureTags[0], movies)}`}
                  className="panel-quiet p-4 transition-colors hover:border-[rgba(226,200,127,0.35)]"
                >
                  <p className="display text-lg text-ivory">{c.zh}</p>
                  <p className="mt-1 text-[0.76rem] text-[var(--color-ash-dim)]">{c.tagline}</p>
                </Link>
              ))}
            </div>
          </div>
        )}

        {hasPreference && result.empty === "filtered-out" && (
          <div className="mt-8">
            <EmptyState
              title="筛选之后没有可推荐的作品"
              description={`你的偏好匹配到了作品，但「排除已看 / 已收藏」把 ${result.filteredCount} 部都排除了。可以取消这些排除条件，或再补充一点偏好。`}
            />
          </div>
        )}

        {hasPreference && result.hits.length > 0 && (
          <div className="mt-8 space-y-8">
            {result.hits.map((hit, index) => {
              const missingVsTop =
                top && index > 0
                  ? top.matchedTags
                      .filter((t) => !hit.matchedTags.some((h) => h.tag === t.tag))
                      .map((t) => t.tag)
                      .slice(0, 4)
                  : [];
              return (
                <article key={hit.movie.id} className="panel p-5 sm:p-6">
                  <div className="flex gap-5">
                    <div className="w-24 shrink-0 sm:w-28">
                      <MovieCard movie={hit.movie} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-2">
                        <h3 className="display text-xl text-ivory">
                          <Link href={`/movies/${hit.movie.slug}`} className="hover:text-gold-soft">
                            {hit.movie.chineseTitle}
                          </Link>
                        </h3>
                        <span className="text-[0.72rem] text-[var(--color-ash-dim)]">{hit.movie.releaseYear}</span>
                        <span className="ml-auto font-display text-lg text-gold-soft">{hit.strength}</span>
                        <span className="text-[0.6rem] uppercase tracking-[0.14em] text-[var(--color-ash-dim)]">匹配度</span>
                      </div>

                      <div className="mt-2 h-1 w-full overflow-hidden bg-[rgba(255,255,255,0.06)]">
                        <div className="h-full bg-gold" style={{ width: `${Math.max(4, hit.strength)}%` }} />
                      </div>

                      <ul className="mt-3 space-y-1">
                        {hit.reasons.slice(0, 5).map((r, i) => (
                          <li key={i} className="flex items-baseline gap-2 text-[0.78rem] leading-relaxed text-[var(--color-ivory-dim)]">
                            <span className="w-8 shrink-0 text-right font-mono text-[0.66rem] text-gold-soft">
                              +{r.weight.toFixed(0)}
                            </span>
                            <span>{r.text}</span>
                          </li>
                        ))}
                      </ul>

                      {hit.matchedTags.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {hit.matchedTags.slice(0, 8).map((t) => (
                            <TagPill key={t.tag} tag={t.tag} bucket={t.category} />
                          ))}
                        </div>
                      )}

                      {hit.caution.length > 0 && (
                        <p className="mt-3 text-[0.74rem] leading-relaxed text-[var(--color-ash-dim)]">
                          <span className="text-[var(--color-ivory-dim)]">但要提醒你：</span>
                          {hit.caution.join("；")}
                        </p>
                      )}

                      {missingVsTop.length > 0 && (
                        <p className="mt-2 text-[0.7rem] leading-relaxed text-[var(--color-ash-dim)]">
                          相比第 1 名，少了这些你选过的标签：{missingVsTop.map(tagLabel).join("、")}
                        </p>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        <Note className="mt-10">
          匹配规则：美学 3 分 / 世界观 3 分 / 元素 2 分 / 氛围 2 分 / 相似作品 2 分，奇幻类型 1 分；
          外部 IMDb 评分只用于同分时的 ±0.2 微调，
          <span className="text-[var(--color-ivory-dim)]">不参与主排序，也不会让低分好片消失</span>。
          每一条推荐都附带「为什么要推给你」，理由是分数本身。
        </Note>
      </div>
    </div>
  );
}

function bucketOfTag(tag: string, movies: Movie[]): TagBucket | null {
  for (const m of movies) {
    for (const bucket of ["type", "world", "aesthetic", "element", "mood"] as const) {
      if (m.tags[bucket].includes(tag)) return bucket;
    }
  }
  return null;
}

function tagsOfBucket(bucket: Exclude<TagBucket, "exclude">, movies: Movie[]): string[] {
  const counts = new Map<string, number>();
  for (const m of movies) for (const t of m.tags[bucket]) counts.set(t, (counts.get(t) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t);
}

/** 把一个标签翻译成探索页可用的查询串 */
function bucketQueryFor(tag: string, movies: Movie[]): string {
  const bucket = bucketOfTag(tag, movies) ?? "world";
  return `${bucket}=${encodeURIComponent(tag)}`;
}
