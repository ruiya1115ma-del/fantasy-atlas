"use client";

import { useState } from "react";
import { useLibrary } from "./LibraryProvider";

/** 详情页的"我的记录"：收藏 / 已看 / 想看 / 个人评分 / 笔记。全部存在本机浏览器。 */
export function DetailActions({ movieId, title }: { movieId: string; title: string }) {
  const lib = useLibrary();
  const [draft, setDraft] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const note = lib.notes[movieId] ?? "";
  const rating = lib.personalRatings[movieId] ?? null;

  const favorite = lib.isFavorite(movieId);
  const watched = lib.isWatched(movieId);
  const wishlisted = lib.isWishlisted(movieId);

  return (
    <section aria-labelledby="my-notes" className="panel p-6">
      <div className="flex items-baseline justify-between gap-4">
        <h2 id="my-notes" className="display text-xl text-ivory">
          我的记录
        </h2>
        <p className="text-[0.65rem] text-[var(--color-ash-dim)]">仅保存在本机浏览器</p>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => lib.toggleFavorite(movieId)}
          aria-pressed={favorite}
          className={`btn btn-sm ${favorite ? "btn-primary" : "btn-ghost"}`}
        >
          {favorite ? "★ 已收藏" : "☆ 加入收藏"}
        </button>
        <button
          type="button"
          onClick={() => lib.toggleWatched(movieId)}
          aria-pressed={watched}
          className={`btn btn-sm ${watched ? "btn-primary" : "btn-ghost"}`}
        >
          {watched ? "✓ 已看过" : "标记为已看"}
        </button>
        <button
          type="button"
          onClick={() => lib.toggleWishlist(movieId)}
          aria-pressed={wishlisted}
          className={`btn btn-sm ${wishlisted ? "btn-primary" : "btn-ghost"}`}
        >
          {wishlisted ? "✓ 在待看清单" : "加入待看"}
        </button>
      </div>

      <div className="mt-6">
        <p className="mb-2 text-[0.68rem] uppercase tracking-[0.14em] text-[var(--color-ash-dim)]">
          我的评分（与 IMDb 评分分开存储，不参与任何混算）
        </p>
        <div className="flex flex-wrap items-center gap-1.5">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => lib.setPersonalRating(movieId, rating === n ? null : n)}
              aria-pressed={rating === n}
              aria-label={`${n} 星`}
              className={`h-9 w-9 border text-sm transition-colors ${
                rating !== null && rating >= n
                  ? "border-gold bg-gold/20 text-gold-soft"
                  : "border-[var(--hairline)] text-[var(--color-ash-dim)] hover:border-[rgba(226,200,127,0.4)]"
              }`}
            >
              ★
            </button>
          ))}
          {rating !== null && (
            <button type="button" onClick={() => lib.setPersonalRating(movieId, null)} className="btn btn-quiet btn-sm ml-2">
              清除评分
            </button>
          )}
        </div>
      </div>

      <div className="mt-6">
        <label htmlFor={`note-${movieId}`} className="mb-2 block text-[0.68rem] uppercase tracking-[0.14em] text-[var(--color-ash-dim)]">
          我的笔记
        </label>
        <textarea
          id={`note-${movieId}`}
          value={draft ?? note}
          onChange={(e) => {
            setDraft(e.target.value);
            setSaved(false);
          }}
          rows={4}
          placeholder={`关于《${title}》，你想记住什么？`}
          className="field resize-y"
        />
        <div className="mt-2 flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              lib.setNote(movieId, draft ?? note);
              setDraft(null);
              setSaved(true);
            }}
            className="btn btn-quiet btn-sm"
          >
            保存笔记
          </button>
          {saved && <span className="text-[0.7rem] text-gold-soft">已保存</span>}
          {draft !== null && draft !== note && !saved && (
            <span className="text-[0.7rem] text-[var(--color-ash-dim)]">有未保存的修改</span>
          )}
        </div>
      </div>
    </section>
  );
}
