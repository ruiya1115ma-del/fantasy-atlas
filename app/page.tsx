import Link from "next/link";
import { BrandHero, type BrandTile } from "@/components/BrandHero";
import { FateDraw, type FateFilm } from "@/components/FateDraw";
import { HomeExpandGallery, type ExpandTheme } from "@/components/HomeExpandGallery";
import { HomeThemes, type HomeThemeCard } from "@/components/HomeThemes";
import { Reveal } from "@/components/Reveal";
import { getStats } from "@/lib/data";
import { getMoviesRuntime } from "@/lib/admin/store-kv";
import { loadHomeConfigRuntime } from "@/lib/home-config-kv";
import { tagLabel } from "@/lib/vocabulary";

/** 首页内容（板块 / 主题卡片 / 电影归属）由后台 /admin/home 配置，保存后立即生效 */
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const movies = await getMoviesRuntime();
  const stats = getStats();
  const movieById = new Map(movies.map((m) => [m.id, m]));

  /* ---------- 1. 品牌底图：24 部互不相同、都有真实影像的作品 ---------- */
  const seen = new Set<string>();
  const tiles: BrandTile[] = [];
  for (const m of [...movies.filter((x) => x.backdrop?.src), ...movies.filter((x) => x.poster?.src)]) {
    if (seen.has(m.id)) continue;
    seen.add(m.id);
    tiles.push({ id: m.id, src: (m.backdrop ?? m.poster)!.src, title: m.chineseTitle });
    if (tiles.length >= 24) break;
  }

  /* ---------- 2. 板块：布局由配置决定（expand = 原来五个主题悬停展开；grid = 平铺网格） ---------- */
  const config = await loadHomeConfigRuntime();
  const sections = config.sections
    .filter((s) => !s.hidden)
    .map((section) => {
      const themes = section.themes
        .filter((t) => !t.hidden)
        .map((theme) => {
          const list = theme.movieIds
            .map((id) => movieById.get(id))
            .filter((m): m is (typeof movies)[number] => Boolean(m));
          const image =
            theme.image ||
            list.find((m) => m.poster?.src)?.poster?.src ||
            list.find((m) => m.backdrop?.src)?.backdrop?.src ||
            "";
          return { theme, list, image };
        })
        .filter((x) => x.list.length > 0);

      return { section, themes };
    })
    .filter((s) => s.themes.length > 0);

  /* ---------- 3. 命运随机抽取的候选池：始终是全库（不受首页配置影响） ---------- */
  const fateFilms: FateFilm[] = movies
    .filter((m) => Boolean(m.slug && (m.poster?.src || m.backdrop?.src)))
    .map((m) => ({
      id: m.id,
      slug: m.slug,
      title: m.chineseTitle,
      originalTitle: m.originalTitle,
      year: m.releaseYear,
      kind: m.mediaType === "series" ? ("series" as const) : ("movie" as const),
      poster: m.poster?.src ?? m.backdrop?.src ?? "",
      still: m.backdrop?.src ?? m.poster?.src ?? "",
      synopsis: m.synopsis,
      tags: [...m.tags.world.slice(0, 2), ...m.tags.aesthetic.slice(0, 2)].map((t) => tagLabel(t)),
      rating: m.ratings[0]
        ? `${m.ratings[0].source} ${m.ratings[0].rating_value}/${m.ratings[0].rating_scale}`
        : "暂无评分",
    }));

  return (
    <>
      <BrandHero tiles={tiles} count={stats.total} />

      {sections.map(({ section, themes }, index) => {
        const isExpand = section.layout === "expand";

        const cards: HomeThemeCard[] = themes.map(({ theme, list, image }) => ({
          id: theme.id,
          name: theme.name,
          image,
          count: list.length,
        }));

        const expandThemes: ExpandTheme[] = themes.map(({ theme, list, image }) => ({
          id: theme.id,
          name: theme.name,
          en: theme.en,
          cover: image,
          tagline: theme.tagline,
          description: theme.description,
          count: list.length,
          posters: list
            .filter((m) => m.poster?.src)
            .slice(0, 4)
            .map((m) => ({ id: m.id, src: m.poster!.src, title: m.chineseTitle })),
        }));

        return (
          <section
            key={section.id}
            className={
              index === 0 && isExpand
                ? "relative py-10 md:py-16"
                : "border-t border-[var(--hairline)] py-14 md:py-20"
            }
            aria-labelledby={`section-${section.id}`}
          >
            <div className="shell">
              {/* 展开式板块沿用原来的标题层级（视觉风格那栏只有 sr-only 标题） */}
              {isExpand ? (
                <>
                  <h2 id={`section-${section.id}`} className="sr-only">
                    {section.title}
                  </h2>
                  <HomeExpandGallery themes={expandThemes} />
                  <div className="mt-8 flex items-center justify-between gap-4 border-t border-[var(--hairline)] pt-5">
                    <p className="text-[0.66rem] uppercase tracking-[0.24em] text-[var(--color-ash-dim)]">
                      {section.id === "sec-visual-styles" ? "Five Worlds" : section.title} · {stats.total} Films
                    </p>
                    <Link
                      href="/explore"
                      className="text-[0.7rem] uppercase tracking-[0.2em] text-gold-soft transition-colors hover:text-ivory"
                    >
                      浏览全部作品 →
                    </Link>
                  </div>
                </>
              ) : (
                <>
                  <Reveal>
                    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
                      <div>
                        <p className="eyebrow">Collection</p>
                        <h2
                          id={`section-${section.id}`}
                          className="display mt-3 text-[1.9rem] leading-none text-ivory md:text-[2.6rem]"
                        >
                          {section.title}
                        </h2>
                        {section.subtitle && (
                          <p className="mt-3 max-w-[46ch] text-[0.86rem] leading-[1.9] text-[var(--color-ivory-dim)]">
                            {section.subtitle}
                          </p>
                        )}
                      </div>
                      <Link
                        href="/explore"
                        className="text-[0.7rem] uppercase tracking-[0.2em] text-gold-soft transition-colors hover:text-ivory"
                      >
                        浏览全部作品 →
                      </Link>
                    </div>
                  </Reveal>
                  <Reveal delay={80}>
                    <HomeThemes themes={cards} />
                  </Reveal>
                </>
              )}
            </div>
          </section>
        );
      })}

      {/* 命运随机抽取：整屏沉浸式 */}
      <div className="mt-8">
        <FateDraw films={fateFilms} />
      </div>
    </>
  );
}
