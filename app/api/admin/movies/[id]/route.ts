import { NextResponse } from "next/server";
import { errorResponse, requireAdminApi } from "@/lib/admin/api";
import { getKv } from "@/lib/admin/kv";
import { deleteMovie, getMovie, updateMovie } from "@/lib/admin/store";
import { deleteMovieKv, readCatalogKv, updateMovieKv, type MoviePatch } from "@/lib/admin/store-kv";

/** GET /api/admin/movies/[id] */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const denied = await requireAdminApi();
  if (denied) return denied;
  const { id } = await context.params;
  const kv = await getKv();
  if (kv) {
    const movie = (await readCatalogKv()).movies.find((m) => m.id === id || m.slug === id);
    if (!movie) return NextResponse.json({ ok: false, error: "找不到这部作品" }, { status: 404 });
    return NextResponse.json({ ok: true, movie, storage: "kv" });
  }
  const movie = getMovie(id);
  if (!movie) return NextResponse.json({ ok: false, error: "找不到这部作品" }, { status: 404 });
  return NextResponse.json({ ok: true, movie });
}

/** PATCH /api/admin/movies/[id] → 保存修改（线上写 KV；本机先备份再写 catalog + raw） */
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const denied = await requireAdminApi();
  if (denied) return denied;
  const { id } = await context.params;

  try {
    const body = await request.json();
    const patch = {
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
    };
    const kv = await getKv();
    const movie = kv ? await updateMovieKv(id, patch as MoviePatch) : updateMovie(id, patch);
    return NextResponse.json({ ok: true, movie: { id: movie.id, updatedAt: movie.updatedAt }, storage: kv ? "kv" : "file" });
  } catch (err) {
    return errorResponse(err);
  }
}

/** DELETE /api/admin/movies/[id] → 删除（线上删 KV，本机先备份并移出 raw） */
export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const denied = await requireAdminApi();
  if (denied) return denied;
  const { id } = await context.params;
  try {
    const kv = await getKv();
    if (kv) await deleteMovieKv(id);
    else deleteMovie(id);
    return NextResponse.json({ ok: true, storage: kv ? "kv" : "file" });
  } catch (err) {
    return errorResponse(err);
  }
}
