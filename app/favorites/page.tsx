import type { Metadata } from "next";
import { FavoritesClient } from "@/components/FavoritesClient";
import { toMediaCard } from "@/lib/filter";
import { getMovies } from "@/lib/data";

export const metadata: Metadata = {
  title: "我的收藏",
  description: "收藏、已看、待看、个人评分与笔记 —— 全部只保存在你自己的浏览器里。",
};

export default function FavoritesPage() {
  const movies = getMovies().map(toMediaCard);
  return (
    <div className="shell pb-24 pt-10 md:pt-14">
      <p className="eyebrow">My Library</p>
      <h1 className="display mt-3 text-4xl leading-tight text-ivory md:text-[3.6rem]">我的收藏</h1>
      <p className="lede mt-4 max-w-2xl text-[0.98rem]">
        这里记录你与这些世界的关系：留住的、看过的、想进的、打过分的、写下过什么的。
      </p>

      <div className="mt-10">
        <FavoritesClient movies={movies} />
      </div>
    </div>
  );
}
