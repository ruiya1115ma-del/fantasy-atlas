"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { useLibrary } from "@/components/LibraryProvider";
import { MovieCard } from "@/components/MovieCard";
import { EmptyState, Note } from "@/components/ui";
import type { MediaCard } from "@/lib/types";

type Tab = "favorites" | "watched" | "wishlist" | "rated" | "notes";

const TABS: { key: Tab; label: string; hint: string }[] = [
  { key: "favorites", label: "收藏", hint: "想留在这个世界里的" },
  { key: "watched", label: "已看过", hint: "打过勾的作品" },
  { key: "wishlist", label: "待看", hint: "还没进入的世界" },
  { key: "rated", label: "我评过分", hint: "你的个人评分，与 IMDb 无关" },
  { key: "notes", label: "我的笔记", hint: "你写下的片段" },
];

export function FavoritesClient({ movies }: { movies: MediaCard[] }) {
  const lib = useLibrary();
  const [tab, setTab] = useState<Tab>("favorites");
  const [message, setMessage] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const byId = useMemo(() => new Map(movies.map((m) => [m.id, m])), [movies]);
  const pick = (ids: string[]) => ids.map((id) => byId.get(id)).filter((m): m is MediaCard => Boolean(m));

  const favorited = pick(lib.favorites);
  const watched = pick(lib.watched);
  const wishlisted = pick(lib.wishlist);
  const rated = Object.entries(lib.personalRatings)
    .map(([id, score]) => ({ movie: byId.get(id), score }))
    .filter((x): x is { movie: MediaCard; score: number } => Boolean(x.movie))
    .sort((a, b) => b.score - a.score);
  const noted = Object.entries(lib.notes)
    .map(([id, note]) => ({ movie: byId.get(id), note }))
    .filter((x): x is { movie: MediaCard; note: string } => Boolean(x.movie) && x.note.trim().length > 0);

  const counts: Record<Tab, number> = {
    favorites: favorited.length,
    watched: watched.length,
    wishlist: wishlisted.length,
    rated: rated.length,
    notes: noted.length,
  };

  const download = () => {
    const blob = new Blob([lib.exportJson()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `fantasy-atlas-my-library-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setMessage("已导出我的记录（JSON）");
  };

  const onImport = async (file: File) => {
    const text = await file.text();
    const result = lib.importJson(text);
    setMessage(result.message);
  };

  const total = favorited.length + watched.length + wishlisted.length + rated.length;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="我的记录分类">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => setTab(t.key)}
              className={`btn btn-sm ${tab === t.key ? "btn-primary" : "btn-ghost"}`}
            >
              {t.label}
              <span className="ml-1.5 text-[0.68rem] opacity-70">{counts[t.key]}</span>
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={download} className="btn btn-quiet btn-sm" disabled={total === 0}>
            导出我的记录
          </button>
          <button type="button" onClick={() => fileRef.current?.click()} className="btn btn-quiet btn-sm">
            导入记录
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onImport(f);
              e.target.value = "";
            }}
          />
          {total > 0 && (
            <button
              type="button"
              onClick={() => {
                if (window.confirm("确定清空本机保存的全部收藏、已看、评分与笔记？此操作不可撤销。")) {
                  lib.clearAll();
                  setMessage("已清空本机记录");
                }
              }}
              className="btn btn-quiet btn-sm text-[var(--color-ash-dim)]"
            >
              清空
            </button>
          )}
        </div>
      </div>

      {message && (
        <p role="status" className="mt-4 rounded-sm border border-[rgba(226,200,127,0.3)] bg-[rgba(201,162,39,0.06)] px-4 py-2 text-[0.78rem] text-gold-soft">
          {message}
        </p>
      )}

      <div className="mt-8" role="tabpanel">
        {tab === "favorites" &&
          (favorited.length ? (
            <div className="grid grid-cols-2 gap-x-5 gap-y-9 sm:grid-cols-3 lg:grid-cols-5">
              {favorited.map((m) => (
                <MovieCard key={m.id} movie={m} />
              ))}
            </div>
          ) : (
            <EmptyState
              title="还没有收藏任何作品"
              description="在任意作品详情页点「加入收藏」，它就会出现在这里。收藏只保存在你这台设备的浏览器里。"
            >
              <Link href="/explore" className="btn btn-primary btn-sm">
                去探索
              </Link>
            </EmptyState>
          ))}

        {tab === "watched" &&
          (watched.length ? (
            <div className="grid grid-cols-2 gap-x-5 gap-y-9 sm:grid-cols-3 lg:grid-cols-5">
              {watched.map((m) => (
                <MovieCard key={m.id} movie={m} />
              ))}
            </div>
          ) : (
            <EmptyState title="还没有标记已看的作品" description="看完一部就在详情页点「标记为已看」，这里会慢慢长成你自己的观影地图。" />
          ))}

        {tab === "wishlist" &&
          (wishlisted.length ? (
            <div className="grid grid-cols-2 gap-x-5 gap-y-9 sm:grid-cols-3 lg:grid-cols-5">
              {wishlisted.map((m) => (
                <MovieCard key={m.id} movie={m} />
              ))}
            </div>
          ) : (
            <EmptyState title="待看清单是空的" description="遇到想进但还没进的世界，先放进待看清单。" />
          ))}

        {tab === "rated" &&
          (rated.length ? (
            <ul className="flex flex-col">
              {rated.map(({ movie, score }) => (
                <li key={movie.id}>
                  <Link
                    href={`/movies/${movie.slug}`}
                    className="flex items-center justify-between gap-4 border-b border-[var(--hairline)] py-3 text-sm transition-colors hover:text-gold-soft"
                  >
                    <span className="flex items-baseline gap-3">
                      <span className="text-gold-soft">{"★".repeat(score)}</span>
                      <span className="text-[var(--color-ivory-dim)]">{movie.chineseTitle}</span>
                      <span className="text-[0.7rem] text-[var(--color-ash-dim)]">{movie.releaseYear}</span>
                    </span>
                    <span className="text-[0.7rem] text-[var(--color-ash-dim)]">
                      {movie.ratings[0]
                        ? `IMDb ${movie.ratings[0].rating_value.toFixed(1)} · 我给的 ${score}/5`
                        : `我给的 ${score}/5`}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="还没有个人评分" description="个人评分只用来给你自己回看，不参与任何推荐排序。" />
          ))}

        {tab === "notes" &&
          (noted.length ? (
            <ul className="grid gap-4 sm:grid-cols-2">
              {noted.map(({ movie, note }) => (
                <li key={movie.id} className="panel p-5">
                  <Link href={`/movies/${movie.slug}`} className="display text-lg text-ivory hover:text-gold-soft">
                    {movie.chineseTitle}
                  </Link>
                  <p className="mt-1 text-[0.7rem] text-[var(--color-ash-dim)]">{movie.releaseYear}</p>
                  <p className="mt-3 whitespace-pre-wrap text-[0.82rem] leading-relaxed text-[var(--color-ivory-dim)]">{note}</p>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="还没有笔记" description="在详情页写下只属于你的那句话：它让你想起了什么、哪个画面还在。" />
          ))}
      </div>

      <Note className="mt-10">
        收藏、评分与笔记保存在本机浏览器的 localStorage 里（键名 fantasy-atlas:library:v1），
        <span className="text-[var(--color-ivory-dim)]">不会上传到服务器，也不会跨设备同步</span>
        。清浏览器数据会丢失，请用上面的「导出我的记录」做备份。
      </Note>
    </div>
  );
}
