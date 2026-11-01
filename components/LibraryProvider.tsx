"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { LibraryState } from "@/lib/types";

/**
 * 个人收藏库（收藏 / 已看 / 想看 / 个人评分 / 笔记）。
 *
 * 说明与边界：
 * - v1 没有账号系统，数据存在浏览器 localStorage，不上传、不联网。
 * - 因此换设备、清缓存会丢失 —— 收藏页会明确告知，并提供导出 JSON 的入口。
 * - 个人评分与外部 IMDb 评分分开存储，永不混合计算。
 */

const STORAGE_KEY = "fantasy-atlas:library:v1";

const EMPTY: LibraryState = {
  favorites: [],
  watched: [],
  wishlist: [],
  personalRatings: {},
  notes: {},
};

export interface LibraryValue extends LibraryState {
  ready: boolean;
  isFavorite: (id: string) => boolean;
  isWatched: (id: string) => boolean;
  isWishlisted: (id: string) => boolean;
  toggleFavorite: (id: string) => void;
  toggleWatched: (id: string) => void;
  toggleWishlist: (id: string) => void;
  setPersonalRating: (id: string, rating: number | null) => void;
  setNote: (id: string, note: string) => void;
  exportJson: () => string;
  importJson: (raw: string) => { ok: boolean; message: string };
  clearAll: () => void;
}

const LibraryContext = createContext<LibraryValue | null>(null);

function read(): LibraryState {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<LibraryState>;
    return {
      favorites: Array.isArray(parsed.favorites) ? parsed.favorites : [],
      watched: Array.isArray(parsed.watched) ? parsed.watched : [],
      wishlist: Array.isArray(parsed.wishlist) ? parsed.wishlist : [],
      personalRatings: parsed.personalRatings && typeof parsed.personalRatings === "object" ? parsed.personalRatings : {},
      notes: parsed.notes && typeof parsed.notes === "object" ? parsed.notes : {},
    };
  } catch {
    return EMPTY;
  }
}

function write(state: LibraryState) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    window.dispatchEvent(new CustomEvent("fantasy-atlas:library-change"));
  } catch {
    /* 隐私模式下写入会失败，功能降级但不报错 */
  }
}

const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

export function LibraryProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<LibraryState>(EMPTY);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setState(read());
    setReady(true);
    const sync = () => setState(read());
    window.addEventListener("storage", sync);
    window.addEventListener("fantasy-atlas:library-change", sync as EventListener);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("fantasy-atlas:library-change", sync as EventListener);
    };
  }, []);

  const update = useCallback((fn: (prev: LibraryState) => LibraryState) => {
    setState((prev) => {
      const next = fn(prev);
      write(next);
      return next;
    });
  }, []);

  const value = useMemo<LibraryValue>(
    () => ({
      ...state,
      ready,
      isFavorite: (id) => state.favorites.includes(id),
      isWatched: (id) => state.watched.includes(id),
      isWishlisted: (id) => state.wishlist.includes(id),
      toggleFavorite: (id) => update((p) => ({ ...p, favorites: toggle(p.favorites, id) })),
      toggleWatched: (id) => update((p) => ({ ...p, watched: toggle(p.watched, id) })),
      toggleWishlist: (id) => update((p) => ({ ...p, wishlist: toggle(p.wishlist, id) })),
      setPersonalRating: (id, rating) =>
        update((p) => {
          const next = { ...p.personalRatings };
          if (rating === null) delete next[id];
          else next[id] = rating;
          return { ...p, personalRatings: next };
        }),
      setNote: (id, note) =>
        update((p) => {
          const next = { ...p.notes };
          if (!note.trim()) delete next[id];
          else next[id] = note;
          return { ...p, notes: next };
        }),
      exportJson: () => JSON.stringify(state, null, 2),
      importJson: (raw) => {
        try {
          const parsed = JSON.parse(raw) as Partial<LibraryState>;
          if (!parsed || typeof parsed !== "object") return { ok: false, message: "JSON 结构不正确。 " };
          const merged: LibraryState = {
            favorites: Array.isArray(parsed.favorites) ? parsed.favorites : state.favorites,
            watched: Array.isArray(parsed.watched) ? parsed.watched : state.watched,
            wishlist: Array.isArray(parsed.wishlist) ? parsed.wishlist : state.wishlist,
            personalRatings:
              parsed.personalRatings && typeof parsed.personalRatings === "object"
                ? parsed.personalRatings
                : state.personalRatings,
            notes: parsed.notes && typeof parsed.notes === "object" ? parsed.notes : state.notes,
          };
          update(() => merged);
          return { ok: true, message: "已导入。请刷新页面确认。" };
        } catch {
          return { ok: false, message: "不是合法 JSON，导入失败。" };
        }
      },
      clearAll: () => update(() => EMPTY),
    }),
    [state, ready, update],
  );

  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>;
}

export function useLibrary(): LibraryValue {
  const ctx = useContext(LibraryContext);
  if (!ctx) throw new Error("useLibrary 必须在 LibraryProvider 内使用");
  return ctx;
}
