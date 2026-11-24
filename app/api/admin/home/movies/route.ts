import { NextResponse } from "next/server";
import { errorResponse, requireAdminApi } from "@/lib/admin/api";
import { getMovies } from "@/lib/data";

/** GET /api/admin/home/movies?q=关键词 → 从 274 部电影库里搜索，供后台挑片加片 */
export async function GET(request: Request) {
  const denied = await requireAdminApi();
  if (denied) return denied;

  try {
    const q = (new URL(request.url).searchParams.get("q") ?? "").trim().toLowerCase();
    const movies = getMovies();

    const matched = (q
      ? movies.filter((m) =>
          [m.chineseTitle, m.originalTitle, String(m.releaseYear), ...(m.directors ?? [])]
            .join(" ")
            .toLowerCase()
            .includes(q)
        )
      : movies
    ).slice(0, 40);

    return NextResponse.json({
      ok: true,
      total: movies.length,
      results: matched.map((m) => ({
        id: m.id,
        title: m.chineseTitle,
        originalTitle: m.originalTitle,
        year: m.releaseYear,
        poster: m.poster?.src ?? m.backdrop?.src ?? "",
        slug: m.slug,
      })),
    });
  } catch (err) {
    return errorResponse(err);
  }
}
