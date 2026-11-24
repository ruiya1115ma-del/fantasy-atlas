import { NextResponse } from "next/server";
import { errorResponse, requireAdminApi } from "@/lib/admin/api";
import { createMovie, readCatalog } from "@/lib/admin/store";

/** GET /api/admin/movies?q= → 列表（供后台搜索） */
export async function GET(request: Request) {
  const denied = await requireAdminApi();
  if (denied) return denied;

  const q = new URL(request.url).searchParams.get("q") ?? "";
  const movies = readCatalog().movies;
  const filtered = q
    ? movies.filter((m) =>
        [m.chineseTitle, m.originalTitle, String(m.releaseYear), ...m.directors].join(" ").includes(q),
      )
    : movies;

  return NextResponse.json({
    ok: true,
    total: movies.length,
    count: filtered.length,
    movies: filtered.slice(0, 60).map((m) => ({
      id: m.id,
      chineseTitle: m.chineseTitle,
      originalTitle: m.originalTitle,
      releaseYear: m.releaseYear,
      hasPoster: Boolean(m.poster?.src),
      poster: m.poster?.src ?? null,
    })),
  });
}

/** POST /api/admin/movies → 新增作品（同时写 catalog 与 raw） */
export async function POST(request: Request) {
  const denied = await requireAdminApi();
  if (denied) return denied;

  try {
    const body = await request.json();
    const movie = createMovie({
      chineseTitle: String(body.chineseTitle ?? ""),
      originalTitle: String(body.originalTitle ?? ""),
      releaseYear: Number(body.releaseYear),
      mediaType:
        body.mediaType === "series" ? "series" : body.mediaType === "miniseries" ? "miniseries" : "movie",
      format: body.format === "animation" ? "animation" : "live_action",
      synopsis: String(body.synopsis ?? ""),
      recommendation: String(body.recommendation ?? ""),
      posterSrc: body.posterSrc ? String(body.posterSrc) : undefined,
      tags: body.tags,
      directors: Array.isArray(body.directors) ? body.directors : [],
      cast: Array.isArray(body.cast) ? body.cast : [],
      country: Array.isArray(body.country) ? body.country : [],
    });
    return NextResponse.json({ ok: true, movie: { id: movie.id, chineseTitle: movie.chineseTitle } });
  } catch (err) {
    return errorResponse(err);
  }
}
