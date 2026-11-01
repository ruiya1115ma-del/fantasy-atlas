import type { Metadata } from "next";
import { ExploreClient } from "@/components/ExploreClient";
import { HeroCarousel, type HeroSlide } from "@/components/HeroCarousel";
import { RecommendEntry } from "@/components/RecommendEntry";
import { getEditorialPicks, getMovies } from "@/lib/data";
import { toMediaCard, filtersFromQuery, DEFAULT_FILTERS } from "@/lib/filter";
import type { Movie } from "@/lib/types";
import { tagLabel } from "@/lib/vocabulary";

export const metadata: Metadata = {
  title: "电影探索",
  description: "用类型、世界观、美学、元素与氛围的标签组合筛选奇幻作品，支持按年份、评分、系列与个人收藏筛选。",
};

const RUNTIME = (m: Movie) =>
  m.mediaType === "movie"
    ? m.runtimeMinutes
      ? `${m.runtimeMinutes} 分钟`
      : null
    : m.seasons
      ? `${m.seasons} 季`
      : null;

/** 豆瓣简介取首段，控制长度（轮播只显示三行） */
function firstParagraph(text: string): string {
  const para = text.split(/\n+/).map((s) => s.trim()).find((s) => s.length > 40) ?? text.trim();
  return para.length > 150 ? `${para.slice(0, 148)}…` : para;
}

function toSlide(m: Movie): HeroSlide | null {
  if (!m.poster?.src) return null;
  const meta = [
    String(m.releaseYear),
    m.directors[0] ? `导演 ${m.directors[0]}` : null,
    RUNTIME(m),
    m.ratings[0] ? `${m.ratings[0].source} ${m.ratings[0].rating_value.toFixed(1)}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return {
    id: m.id,
    slug: m.slug,
    chineseTitle: m.chineseTitle,
    originalTitle: m.originalTitle,
    releaseYear: m.releaseYear,
    backdropSrc: m.backdrop?.src ?? m.poster.src,
    posterSrc: m.poster.src,
    synopsis: (m.doubanIntro ? firstParagraph(m.doubanIntro) : m.synopsis) ?? m.synopsis,
    recommendation: m.recommendation,
    tags: [m.tags.type[0], m.tags.world[0], m.tags.mood[0]].filter(Boolean).map((t) => tagLabel(t)),
    meta,
  };
}

function buildSlides(movies: Movie[]): HeroSlide[] {
  const picks = getEditorialPicks().flatMap((p) => p.movies) as Movie[];
  const pool = [
    ...picks.filter((m) => m.backdrop?.src && m.poster?.src),
    ...movies.filter((m) => m.backdrop?.src && m.poster?.src),
    ...picks.filter((m) => m.poster?.src),
    ...movies.filter((m) => m.poster?.src),
  ];
  const out: HeroSlide[] = [];
  const seen = new Set<string>();
  for (const m of pool) {
    if (seen.has(m.id)) continue;
    seen.add(m.id);
    const s = toSlide(m);
    if (s) out.push(s);
    if (out.length >= 10) break;
  }
  return out;
}

export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(sp)) {
    if (typeof value === "string") params.set(key, value);
  }

  const full = getMovies();
  const slides = buildSlides(full);
  const movies = full.map(toMediaCard);
  const initial = movies.length ? filtersFromQuery(params) : { ...DEFAULT_FILTERS };

  return (
    <>
      {slides.length > 0 && <HeroCarousel slides={slides} heightClass="h-[76svh]" />}
      <RecommendEntry />
      <ExploreClient movies={movies} initial={initial} />
    </>
  );
}
