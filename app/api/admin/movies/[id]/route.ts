import { NextResponse } from "next/server";
import { errorResponse, requireAdminApi } from "@/lib/admin/api";
import { deleteMovie, getMovie, updateMovie } from "@/lib/admin/store";

/** GET /api/admin/movies/[id] */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const denied = await requireAdminApi();
  if (denied) return denied;
  const { id } = await context.params;
  const movie = getMovie(id);
  if (!movie) return NextResponse.json({ ok: false, error: "找不到这部作品" }, { status: 404 });
  return NextResponse.json({ ok: true, movie });
}

/** PATCH /api/admin/movies/[id] → 保存修改（先备份再写 catalog + raw） */
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const denied = await requireAdminApi();
  if (denied) return denied;
  const { id } = await context.params;

  try {
    const body = await request.json();
    const movie = updateMovie(id, {
      chineseTitle: body.chineseTitle,
      originalTitle: body.originalTitle,
      releaseYear: body.releaseYear === undefined ? undefined : Number(body.releaseYear),
      synopsis: body.synopsis,
      recommendation: body.recommendation,
      posterSrc: body.posterSrc === undefined ? undefined : body.posterSrc,
      tags: body.tags,
      directors: body.directors,
      cast: body.cast,
      country: body.country,
      franchise: body.franchise,
      franchiseName: body.franchiseName,
      seriesOrder: body.seriesOrder === undefined ? undefined : body.seriesOrder === null ? null : Number(body.seriesOrder),
      audienceFit: body.audienceFit,
      audienceMismatch: body.audienceMismatch,
      watchStatus: body.watchStatus,
    });
    return NextResponse.json({ ok: true, movie: { id: movie.id, updatedAt: movie.updatedAt } });
  } catch (err) {
    return errorResponse(err);
  }
}

/** DELETE /api/admin/movies/[id] → 删除（先备份，同时移出 raw 防止 merge 复活） */
export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const denied = await requireAdminApi();
  if (denied) return denied;
  const { id } = await context.params;
  try {
    deleteMovie(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
