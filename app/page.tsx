import Link from "next/link";
import { BrandHero, type BrandTile } from "@/components/BrandHero";
import { FateDraw, type FateFilm } from "@/components/FateDraw";
import { MotifGallery, type MotifCard } from "@/components/MotifGallery";
import { Reveal } from "@/components/Reveal";
import { ThemeGallery, type GalleryTheme } from "@/components/ThemeGallery";
import { getCategoryBuckets, getMovies, getStats } from "@/lib/data";
import { MOTIFS, matchesMotif } from "@/lib/motifs";
import { tagLabel } from "@/lib/vocabulary";

/**
 * 首页：品牌（绝对 C 位）→ 五个视觉风格画廊 → 八个叙事主题矩阵 → 命运随机抽取（整屏）。
 * 不放任何"介绍/指南/统计"区块。
 */
export default function HomePage() {
  const movies = getMovies();
  const stats = getStats();
  const categories = getCategoryBuckets();

  /* ---------- 1. 品牌底图：24 部互不相同、都有真实影像的作品 ---------- */
  const seen = new Set<string>();
  const tiles: BrandTile[] = [];
  for (const m of [...movies.filter((x) => x.backdrop?.src), ...movies.filter((x) => x.poster?.src)]) {
    if (seen.has(m.id)) continue;
    seen.add(m.id);
    tiles.push({ id: m.id, src: (m.backdrop ?? m.poster)!.src, title: m.chineseTitle });
    if (tiles.length >= 24) break;
  }

  /* ---------- 2. 主题画廊：五个主题，封面互不重复 ---------- */
  // 这两个主题的封面要有"人物站在画面中心"的电影海报（豆瓣竖版海报，清晰度足够）
  const CHARACTER_POSTER_FIRST: Record<string, string[]> = {
    "whimsical-tales": ["spirited-away", "my-neighbor-totoro-1988", "howls-moving-castle", "coraline"],
    "surreal-dreams": ["alice-in-wonderland-2010", "big-fish-2003", "charlie-and-the-chocolate-factory-2005", "coraline"],
  };

  const used = new Set<string>();
  const galleryThemes: GalleryTheme[] = categories.map(({ category, count, movies: matched }) => {
    const withImage = matched.filter((m) => m.backdrop?.src || m.poster?.src);
    const withPoster = matched.filter((m) => m.poster?.src);
    const signature = new Set(category.signatureTags);

    // 人物向封面：按指定顺序取第一部还没被别的主题用掉的豆瓣竖版海报
    let coverMovie: (typeof matched)[number] | undefined;
    const prefers = CHARACTER_POSTER_FIRST[category.slug];
    if (prefers) {
      for (const id of prefers) {
        const found = withPoster.find((m) => m.id === id && !used.has(m.id));
        if (found) {
          coverMovie = found;
          break;
        }
      }
      if (!coverMovie) coverMovie = withPoster.find((m) => !used.has(m.id));
    }

    if (!coverMovie) {
      const scored = withImage
        .map((m) => {
          const hits = [...m.tags.world, ...m.tags.aesthetic, ...m.tags.mood, ...m.tags.element].filter((t) =>
            signature.has(t)
          ).length;
          return { m, hits, used: used.has(m.id) };
        })
        .sort((a, b) => (a.used ? 1 : 0) - (b.used ? 1 : 0) || b.hits - a.hits);
      coverMovie = scored[0]?.m;
    }

    if (coverMovie) used.add(coverMovie.id);
    const posterPool = withImage.filter((m) => m.id !== coverMovie?.id && !used.has(m.id));
    for (const m of posterPool.slice(0, 4)) used.add(m.id);

    return {
      slug: category.slug,
      zh: category.zh,
      en: category.en,
      tagline: category.tagline,
      description: category.description,
      count,
      // 人物向主题用竖版海报（海报中心是人），其余主题优先用宽画幅剧照
      cover: prefers
        ? coverMovie?.poster?.src ?? coverMovie?.backdrop?.src ?? ""
        : coverMovie?.backdrop?.src ?? coverMovie?.poster?.src ?? "",
      posters: posterPool.slice(0, 4).map((m) => ({ id: m.id, src: (m.poster ?? m.backdrop)!.src, title: m.chineseTitle })),
      accent: category.palette.ink,
    };
  });

  /* ---------- 3. 八个叙事主题：真实标签 + 简介关键词筛选 ---------- */
  const motifUsed = new Set<string>();
  const motifCards: MotifCard[] = MOTIFS.map((motif) => {
    const matched = movies
      .filter((m) => matchesMotif(m, motif))
      .sort((a, b) => (b.ratings[0]?.rating_count ?? 0) - (a.ratings[0]?.rating_count ?? 0));
    const withImage = matched.filter((m) => m.poster?.src || m.backdrop?.src);
    const cover = withImage.find((m) => !motifUsed.has(m.id)) ?? withImage[0] ?? tiles[0];
    if (cover) motifUsed.add(cover.id);
    return {
      slug: motif.slug,
      zh: motif.zh,
      en: motif.en,
      tagline: motif.tagline,
      description: motif.description,
      count: matched.length,
      // 叙事类主题优先用竖版海报（人物在画面中心，尺寸也更清晰）
      image: cover?.poster?.src ?? cover?.backdrop?.src ?? "",
      ink: motif.ink,
    };
  });

  /* ---------- 4. 命运随机抽取的候选池 ---------- */
  const fateFilms: FateFilm[] = movies
    .filter((m) => m.poster?.src && m.backdrop?.src)
    .map((m) => ({
      id: m.id,
      slug: m.slug,
      title: m.chineseTitle,
      originalTitle: m.originalTitle,
      year: m.releaseYear,
      kind: m.mediaType === "series" ? ("series" as const) : ("movie" as const),
      poster: m.poster!.src,
      still: m.backdrop?.src ?? m.poster!.src,
      synopsis: m.synopsis,
      tags: [...m.tags.world.slice(0, 2), ...m.tags.aesthetic.slice(0, 2)].map((t) => tagLabel(t)),
      rating: m.ratings[0]
        ? `${m.ratings[0].source} ${m.ratings[0].rating_value}/${m.ratings[0].rating_scale}`
        : "暂无评分",
    }));

  return (
    <>
      <BrandHero tiles={tiles} count={stats.total} />

      {/* 五个视觉风格：横向展开画廊 */}
      <section className="relative py-10 md:py-16" aria-labelledby="gallery-heading">
        <h2 id="gallery-heading" className="sr-only">
          五个奇幻电影视觉风格
        </h2>
        <div className="shell">
          <ThemeGallery themes={galleryThemes} />
          <div className="mt-8 flex items-center justify-between gap-4 border-t border-[var(--hairline)] pt-5">
            <p className="text-[0.66rem] uppercase tracking-[0.24em] text-[var(--color-ash-dim)]">
              Five Worlds · {stats.total} Films
            </p>
            <Link
              href="/explore"
              className="text-[0.7rem] uppercase tracking-[0.2em] text-gold-soft transition-colors hover:text-ivory"
            >
              浏览全部作品 →
            </Link>
          </div>
        </div>
      </section>

      {/* 按主题寻找：八个叙事主题的大型图片矩阵 */}
      <section className="border-t border-[var(--hairline)] py-16 md:py-24" aria-labelledby="motif-heading">
        <div className="shell">
          <Reveal>
            <div className="mb-10 flex flex-wrap items-end justify-between gap-5">
              <div>
                <p className="eyebrow">By Theme</p>
                <h2 id="motif-heading" className="display mt-3 text-[2.1rem] leading-none text-ivory md:text-[3rem]">
                  按主题寻找
                </h2>
              </div>
              <p className="max-w-sm text-[0.78rem] leading-relaxed text-[var(--color-ash)]">
                八个叙事主题，与五个视觉风格并行：时空裂隙、禁忌契约、异兽图鉴、失落秘境、命运变形、魔法遗物、少年奇遇、怪奇日常。
                同一个故事可以同时属于好几个主题。
              </p>
            </div>
          </Reveal>
          <Reveal delay={80}>
            <MotifGallery items={motifCards} />
          </Reveal>
        </div>
      </section>

      {/* 命运随机抽取：整屏沉浸式 */}
      <div className="mt-8">
        <FateDraw films={fateFilms} />
      </div>
    </>
  );
}
