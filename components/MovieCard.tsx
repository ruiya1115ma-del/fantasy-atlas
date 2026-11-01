import Link from "next/link";
import type { MediaCard } from "@/lib/types";
import { Poster } from "./Poster";
import { ratingOnTen } from "@/lib/filter";
import { MEDIA_TYPE_LABELS } from "@/lib/vocabulary";

export function MovieCard({ movie, priority = false }: { movie: MediaCard; priority?: boolean }) {
  const rating = ratingOnTen(movie);
  const seriesLabel =
    movie.franchise && movie.seriesOrder
      ? `${movie.franchiseName ?? "系列"} · 第 ${movie.seriesOrder} 部`
      : movie.mediaType !== "movie"
        ? MEDIA_TYPE_LABELS[movie.mediaType]
        : null;

  return (
    <Link href={`/movies/${movie.slug}`} className="group card-link">
      <article>
        <div className="poster-frame aspect-[2/3]">
          <Poster movie={movie} className="poster-art h-full w-full" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 bg-gradient-to-t from-[#05070c] via-[#05070c]/70 to-transparent p-3">
            <span className="text-[0.66rem] uppercase tracking-[0.14em] text-[var(--color-ivory-dim)]">
              {movie.releaseYear}
            </span>
            {rating !== null && (
              <span className="text-[0.66rem] tracking-[0.06em] text-gold-soft">
                IMDb {rating.toFixed(1)}
              </span>
            )}
          </div>
        </div>
        <div className="mt-3">
          <h3 className="text-[0.95rem] leading-snug text-ivory transition-colors group-hover:text-gold-soft">
            {movie.chineseTitle}
          </h3>
          <p className="mt-1 truncate text-[0.7rem] tracking-[0.04em] text-[var(--color-ash-dim)]">
            {seriesLabel ?? movie.originalTitle}
          </p>
        </div>
      </article>
    </Link>
  );
}

export function MovieGrid({ movies, emptyHint }: { movies: MediaCard[]; emptyHint?: string }) {
  if (!movies.length) {
    return <p className="py-12 text-center text-sm text-[var(--color-ash-dim)]">{emptyHint ?? "这里还没有作品。"}</p>;
  }
  return (
    <div className="grid grid-cols-2 gap-x-5 gap-y-9 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {movies.map((m) => (
        <MovieCard key={m.id} movie={m} />
      ))}
    </div>
  );
}

/** 横向滚动条带（首页各区块用） */
export function MovieRail({ movies }: { movies: MediaCard[] }) {
  return (
    <div className="scroll-x -mx-5 px-5 pb-3 md:-mx-8 md:px-8">
      <div className="flex w-max gap-5">
        {movies.map((m) => (
          <div key={m.id} className="w-[42vw] max-w-[210px] shrink-0 sm:w-[190px]">
            <MovieCard movie={m} />
          </div>
        ))}
      </div>
    </div>
  );
}
