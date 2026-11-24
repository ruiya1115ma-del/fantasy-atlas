import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin/auth";
import { getKv } from "@/lib/admin/kv";
import { missingPosters, readCatalog } from "@/lib/admin/store";
import { getMoviesRuntime, missingPostersKv } from "@/lib/admin/store-kv";

export const metadata: Metadata = { title: "缺失海报", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AdminMediaPage() {
  if (!(await isAdmin())) redirect("/admin/login");

  const kv = await getKv();
  const missing = kv ? await missingPostersKv() : missingPosters();
  const total = kv ? (await getMoviesRuntime()).length : readCatalog().movies.length;

  return (
    <div>
      <p className="eyebrow">Admin · Images</p>
      <h1 className="display mt-3 text-3xl text-ivory">缺失海报检查</h1>
      <p className="lede mt-4 max-w-2xl text-[0.88rem]">
        全库 {total} 部，其中 {total - missing.length} 部有真实海报，{missing.length} 部还空着。
        点「补图」进入编辑页填海报 URL（推荐站内路径 <code className="text-[var(--color-ivory-dim)]">/posters/…</code>）。
        找不到可靠来源时请留空，不要用 AI 生成图冒充真实海报。
      </p>

      {missing.length === 0 ? (
        <p className="mt-10 border border-[rgba(140,200,150,0.3)] p-8 text-center text-[0.86rem] text-[#a9d6b0]">
          全部作品都有真实海报了。
        </p>
      ) : (
        <div className="mt-10 divide-y divide-[rgba(201,162,39,0.12)] border-y border-[rgba(201,162,39,0.12)]">
          {missing.map((movie) => (
            <div key={movie.id} className="flex items-center gap-4 py-3">
              <span className="h-14 w-10 shrink-0 border border-dashed border-[rgba(201,162,39,0.25)]" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[0.88rem] text-ivory">
                  {movie.chineseTitle}
                  <span className="ml-2 text-[0.72rem] text-[var(--color-ash-dim)]">{movie.releaseYear}</span>
                </p>
                <p className="truncate text-[0.7rem] italic text-[var(--color-ash-dim)]">{movie.originalTitle || "—"}</p>
              </div>
              <Link
                href={`/admin/movies/${movie.id}`}
                className="shrink-0 border border-[rgba(201,162,39,0.25)] px-4 py-2 text-[0.74rem] text-[var(--color-ivory-dim)] hover:border-[rgba(226,200,127,0.5)]"
              >
                补图
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
