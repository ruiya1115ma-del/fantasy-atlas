import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { AdminMovieEditor } from "@/components/admin/AdminMovieEditor";
import { isAdmin } from "@/lib/admin/auth";
import { getMovie } from "@/lib/admin/store";
import { TAG_GROUPS } from "@/lib/vocabulary";

export const metadata: Metadata = { title: "编辑作品", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AdminMovieEditPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) redirect("/admin/login");

  const { id } = await params;
  const movie = getMovie(id);
  if (!movie) notFound();

  const tagGroups = TAG_GROUPS.map((group) => ({
    category: group.category,
    zh: group.zh,
    terms: group.terms.map((term) => ({ id: term.id, zh: term.zh, hint: term.hint })),
  }));

  return (
    <div>
      <p className="eyebrow">Admin · Edit</p>
      <h1 className="display mt-3 text-3xl text-ivory">编辑《{movie.chineseTitle}》</h1>
      <p className="mt-3 text-[0.78rem] text-[var(--color-ash-dim)]">
        最后更新：{new Date(movie.updatedAt).toLocaleString("zh-CN")} · 来源：{movie.provenance.recordFile}
      </p>
      <AdminMovieEditor
        tagGroups={tagGroups}
        initial={{
          id: movie.id,
          chineseTitle: movie.chineseTitle,
          originalTitle: movie.originalTitle,
          releaseYear: movie.releaseYear,
          mediaType: movie.mediaType,
          format: movie.format,
          synopsis: movie.synopsis,
          recommendation: movie.recommendation,
          posterSrc: movie.poster?.src ?? "",
          posterLicense: movie.poster?.license ?? "",
          tags: movie.tags as unknown as Record<string, string[]>,
          directors: movie.directors,
          cast: movie.cast,
          country: movie.country,
          franchise: movie.franchise ?? "",
          franchiseName: movie.franchiseName ?? "",
          seriesOrder: movie.seriesOrder === null ? "" : String(movie.seriesOrder),
          audienceFit: movie.audienceFit,
          audienceMismatch: movie.audienceMismatch,
          watchStatus: movie.watchStatus,
        }}
      />
    </div>
  );
}
