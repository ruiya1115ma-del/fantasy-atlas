"use client";

import { useState } from "react";
import { useLibrary } from "./LibraryProvider";

/**
 * 详情页左栏的「我的记录」：已看 / 收藏 / 待看 + 个人评分 + 笔记。
 * 全部存在本机浏览器（localStorage），不上传服务器。
 * 放在海报正下方，第一行三个状态按钮，第二行评分（与上一行同宽），不设总标题。
 */
export function DetailActions({ movieId, title }: { movieId: string; title: string }) {
  const lib = useLibrary();
  const [draft, setDraft] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const note = lib.notes[movieId] ?? "";
  const rating = lib.personalRatings[movieId] ?? null;

  const favorite = lib.isFavorite(movieId);
  const watched = lib.isWatched(movieId);
  const wishlisted = lib.isWishlisted(movieId);

  const stateButton = (active: boolean) => `btn btn-sm w-full justify-center ${active ? "btn-primary" : "btn-ghost"}`;

  return (
    <section aria-label="我的记录" className="mt-5">
      <div className="grid grid-cols-3 gap-2">
        <button type="button" onClick={() => lib.toggleWatched(movieId)} aria-pressed={watched} className={stateButton(watched)}>
          {watched ? "✓ 已看" : "已看"}
        </button>
        <button type="button" onClick={() => lib.toggleFavorite(movieId)} aria-pressed={favorite} className={stateButton(favorite)}>
          {favorite ? "★ 已收藏" : "收藏"}
        </button>
        <button type="button" onClick={() => lib.toggleWishlist(movieId)} aria-pressed={wishlisted} className={stateButton(wishlisted)}>
          {wishlisted ? "✓ 待看" : "待看"}
        </button>
      </div>

      <div role="group" aria-label="我的评分" className="mt-2 grid grid-cols-5 gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => lib.setPersonalRating(movieId, rating === n ? null : n)}
            aria-pressed={rating === n}
            aria-label={`${n} 星`}
            className={`h-9 border text-sm transition-colors ${
              rating !== null && rating >= n
                ? "border-gold bg-gold/20 text-gold-soft"
                : "border-[var(--hairline)] text-[var(--color-ash-dim)] hover:border-[rgba(226,200,127,0.4)]"
            }`}
          >
            ★
          </button>
        ))}
      </div>

      {rating !== null && (
        <button type="button" onClick={() => lib.setPersonalRating(movieId, null)} className="mt-1.5 text-[0.68rem] text-[var(--color-ash-dim)] underline decoration-dotted hover:text-gold-soft">
          清除评分
        </button>
      )}

      <div className="mt-3">
        <textarea
          aria-label="我的笔记"
          value={draft ?? note}
          onChange={(e) => {
            setDraft(e.target.value);
            setSaved(false);
          }}
          rows={3}
          placeholder={`关于《${title}》，你想记住什么？`}
          className="field resize-y text-[0.82rem]"
        />
        <div className="mt-1.5 flex items-center gap-3">
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
          {draft !== null && draft !== note && !saved && <span className="text-[0.7rem] text-[var(--color-ash-dim)]">未保存</span>}
        </div>
      </div>
    </section>
  );
}
