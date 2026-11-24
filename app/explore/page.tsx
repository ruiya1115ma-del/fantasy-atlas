import type { Metadata } from "next";
import { ExploreClient } from "@/components/ExploreClient";
import type { HeroSlide } from "@/components/HeroCarousel";
import { StableHeroSlides } from "@/components/StableHeroSlides";
import { RecommendEntry } from "@/components/RecommendEntry";
import { getMoviesRuntime } from "@/lib/admin/store-kv";
import { toMediaCard, filtersFromQuery, DEFAULT_FILTERS } from "@/lib/filter";
import { pickHeroMovies } from "@/lib/hero-picks";
import type { Movie } from "@/lib/types";
import { tagLabel } from "@/lib/vocabulary";

export const metadata: Metadata = {
  title: "电影探索",
  description: "用类型、世界观、美学、元素与氛围的标签组合筛选奇幻作品，支持按年份、评分、系列与个人收藏筛选。",
};

/**
 * 顶部轮播每次请求都重新抽取（见 lib/hero-picks.ts）：
 * 因此这里必须强制动态渲染，不能被打成静态页面。
 */
export const dynamic = "force-dynamic";
export const revalidate = 0;

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
  // 每次渲染都从完整库重新抽：跨系列、去重、类型/年代/世界观尽量分散
  const picked = pickHeroMovies(movies, { count: 10 });
  const out: HeroSlide[] = [];
  const seen = new Set<string>();
  for (const m of picked) {
    if (seen.has(m.id)) continue;
    seen.add(m.id);
    const s = toSlide(m);
    if (s) out.push(s);
  }
  // 极端情况下（例如海报缺失）候选不足时，用其余作品补齐，保证轮播不塌
  if (out.length < 5) {
    for (const m of movies) {
      if (out.length >= 10) break;
      if (seen.has(m.id)) continue;
      const s = toSlide(m);
      if (!s) continue;
      seen.add(m.id);
      out.push(s);
    }
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

  const full = await getMoviesRuntime();
  const slides = buildSlides(full);
  const movies = full.map(toMediaCard);
  const initial = movies.length ? filtersFromQuery(params) : { ...DEFAULT_FILTERS };

  return (
    <>
      {slides.length > 0 && <StableHeroSlides slides={slides} heightClass="h-[76svh]" />}
      <RecommendEntry />
      <ExploreClient movies={movies} initial={initial} />
    </>
  );
}
