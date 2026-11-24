import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin/auth";
import { getKv } from "@/lib/admin/kv";
import { readCatalog, searchMovies } from "@/lib/admin/store";
import { getMoviesRuntime, searchMoviesKv } from "@/lib/admin/store-kv";

export const metadata: Metadata = { title: "电影资料", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AdminMoviesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  if (!(await isAdmin())) redirect("/admin/login");

  const { q = "" } = await searchParams;
  const kv = await getKv();
  const allCount = kv ? (await getMoviesRuntime()).length : readCatalog().movies.length;
  const movies = kv ? await searchMoviesKv(q, 80) : searchMovies(q, 80);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="eyebrow">Admin · Library</p>
          <h1 className="display mt-3 text-3xl text-ivory">电影资料</h1>
          <p className="mt-3 text-[0.82rem] text-[var(--color-ivory-dim)]">
            共 {allCount} 部作品，当前显示 {movies.length} 条。
          </p>
        </div>
        <Link href="/admin/movies/new" className="btn btn-primary !px-6 !py-3 !text-[0.8rem]">
          + 新增作品
        </Link>
      </div>

      <form className="mt-8 flex max-w-xl gap-3" action="/admin/movies">
        <input
          name="q"
          defaultValue={q}
          placeholder="搜索片名 / 原名 / 年份"
          className="field w-full"
        />
        <button type="submit" className="btn !px-5 !py-2 !text-[0.78rem]">
          搜索
        </button>
      </form>

      <div className="mt-10 divide-y divide-[rgba(201,162,39,0.12)] border-y border-[rgba(201,162,39,0.12)]">
        {movies.map((movie) => (
          <div key={movie.id} className="flex items-center gap-4 py-3">
            <div className="h-16 w-11 shrink-0 overflow-hidden bg-[rgba(255,255,255,0.04)]">
              {movie.poster?.src ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={movie.poster.src} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="flex h-full items-center justify-center text-[0.55rem] text-[var(--color-ash-dim)]">缺图</span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[0.9rem] text-ivory">
                {movie.chineseTitle}
                <span className="ml-2 text-[0.72rem] text-[var(--color-ash-dim)]">{movie.releaseYear}</span>
              </p>
              <p className="truncate text-[0.72rem] italic text-[var(--color-ash-dim)]">
                {movie.originalTitle || "—"} · {movie.id}
              </p>
            </div>
            <div className="hidden text-[0.7rem] text-[var(--color-ash-dim)] sm:block">
              {movie.tags.type[0] ?? "未分类"}
            </div>
            <Link
              href={`/admin/movies/${movie.id}`}
              className="shrink-0 border border-[rgba(201,162,39,0.25)] px-4 py-2 text-[0.74rem] text-[var(--color-ivory-dim)] hover:border-[rgba(226,200,127,0.5)]"
            >
              编辑
            </Link>
          </div>
        ))}
        {movies.length === 0 && (
          <p className="py-12 text-center text-[0.84rem] text-[var(--color-ash-dim)]">没有匹配的作品。</p>
        )}
      </div>
    </div>
  );
}
