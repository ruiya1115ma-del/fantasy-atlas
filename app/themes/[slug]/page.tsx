import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MovieCard } from "@/components/MovieCard";
import { Note, TagPill } from "@/components/ui";
import { getCategoryBuckets, getMovies } from "@/lib/data";
import { CATEGORY_BY_SLUG } from "@/lib/curation";
import { tagLabel } from "@/lib/vocabulary";

export const dynamicParams = false;

export function generateStaticParams() {
  return getCategoryBuckets().map(({ category }) => ({ slug: category.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const cat = CATEGORY_BY_SLUG[slug];
  if (!cat) return { title: "主题不存在" };
  return {
    title: `${cat.zh} · 主题片单`,
    description: `${cat.tagline}｜${cat.description}`,
  };
}

export default async function ThemePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const cat = CATEGORY_BY_SLUG[slug];
  if (!cat) notFound();

  const movies = getMovies();
  const buckets = getCategoryBuckets();
  const bucket = buckets.find((b) => b.category.slug === slug);

  // 每部作品只归入一个分类：这里用同一份互斥归属结果
  const matched = bucket?.movies ?? [];
  const sorted = matched.slice().sort((a, b) => (b.ratings[0]?.rating_count ?? 0) - (a.ratings[0]?.rating_count ?? 0));

  // 页头大图：优先用分类封面（与首页画廊同一张），其次找有剧照的作品
  const coverMovie = bucket?.coverCandidates.find((m) => m.poster?.src || m.backdrop?.src);
  const cover =
    coverMovie?.backdrop?.src ??
    coverMovie?.poster?.src ??
    matched.find((m) => m.backdrop?.src)?.backdrop?.src ??
    matched.find((m) => m.poster?.src)?.poster?.src;

  const otherThemes = buckets
    .filter((b) => b.category.slug !== slug)
    .slice(0, 4);

  return (
    <>
      {/* 主题头图：真实剧照铺满，暗金衬线标题 */}
      <section className="relative isolate flex min-h-[54svh] items-end overflow-hidden border-b border-[var(--hairline)]">
        {cover && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={cover}
              alt=""
              aria-hidden
              className="absolute inset-0 h-full w-full object-cover"
              style={{ filter: "saturate(1.05) contrast(1.03) brightness(0.85)" }}
            />
            <div className="absolute inset-0 bg-[linear-gradient(105deg,rgba(5,7,12,0.94)_0%,rgba(5,7,12,0.8)_38%,rgba(5,7,12,0.35)_72%,rgba(5,7,12,0.85)_100%)]" />
            <div className="absolute inset-x-0 bottom-0 h-2/3 bg-[linear-gradient(to_top,rgba(5,7,12,0.98),transparent)]" />
          </>
        )}

        <div className="shell relative z-10 py-14">
          <nav className="text-[0.68rem] tracking-[0.1em] text-[var(--color-ash-dim)]">
            <Link href="/" className="transition-colors hover:text-gold-soft">
              首页
            </Link>
            <span aria-hidden className="mx-2">
              /
            </span>
            <Link href="/explore" className="transition-colors hover:text-gold-soft">
              探索
            </Link>
            <span aria-hidden className="mx-2">
              /
            </span>
            <span className="text-[var(--color-ivory-dim)]">{cat.zh}</span>
          </nav>

          <p className="mt-8 text-[0.6rem] uppercase tracking-[0.34em] text-[rgba(226,200,127,0.8)]">{cat.en}</p>
          <h1 className="display mt-4 text-[2.6rem] leading-none text-ivory sm:text-[3.6rem] lg:text-[4.4rem]">
            {cat.zh}
          </h1>
          <p className="mt-4 max-w-xl text-[0.9rem] italic text-[var(--color-ivory-dim)]">{cat.tagline}</p>
          <p className="mt-5 max-w-2xl text-[0.86rem] leading-relaxed text-[var(--color-ash)]">{cat.description}</p>

          <div className="mt-7 flex flex-wrap items-center gap-2">
            {cat.signatureTags.map((t) => (
              <span key={t} className="chip chip-static text-[0.66rem]">
                {tagLabel(t)}
              </span>
            ))}
            <span className="ml-2 text-[0.68rem] tracking-[0.12em] text-[var(--color-ivory-dim)]">
              共 {matched.length} 部
            </span>
          </div>
        </div>
      </section>

      {/* 该主题的全部作品（真实海报 + 名称 + 年份 + 标签） */}
      <section className="shell py-16">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-[var(--hairline)] pb-5">
          <h2 className="display text-2xl text-ivory">这个主题下的 {matched.length} 部作品</h2>
          <Link
            href={`/explore?category=${cat.slug}`}
            className="text-[0.7rem] uppercase tracking-[0.18em] text-gold-soft transition-colors hover:text-ivory"
          >
            在筛选器里打开 →
          </Link>
        </div>

        {matched.length === 0 ? (
          <p className="py-16 text-center text-sm text-[var(--color-ash-dim)]">这个主题下暂时还没有作品。</p>
        ) : (
          <div className="grid grid-cols-2 gap-x-5 gap-y-10 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {sorted.map((m) => (
              <div key={m.id}>
                <MovieCard movie={m} />
                <div className="mt-2 flex flex-wrap gap-x-2.5 gap-y-1">
                  {[...m.tags.mood.slice(0, 2), ...m.tags.element.slice(0, 1)].map((t) => (
                    <span key={t} className="text-[0.6rem] tracking-[0.06em] text-[var(--color-ash-dim)]">
                      {tagLabel(t)}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 其他主题 */}
      <section className="shell pb-24">
        <div className="hairline mb-8" />
        <p className="eyebrow">Other Worlds</p>
        <div className="mt-5 flex flex-wrap gap-3">
          {otherThemes.map(({ category, count }) => (
            <Link
              key={category.slug}
              href={`/themes/${category.slug}`}
              className="group flex items-baseline gap-3 border border-[var(--hairline)] px-5 py-3 transition-colors hover:border-[rgba(226,200,127,0.45)]"
            >
              <span className="display text-lg text-ivory transition-colors group-hover:text-gold-soft">
                {category.zh}
              </span>
              <span className="text-[0.64rem] tracking-[0.12em] text-[var(--color-ash-dim)]">{count} 部 →</span>
            </Link>
          ))}
        </div>
        <Note className="mt-8">
          主题是按标签规则（世界观 / 类型 / 美学 / 情绪）实时筛出来的，不是人工硬编的名单；
          同一部作品可能同时属于多个主题 —— 因为好电影本来就不止一种看法。
        </Note>
      </section>
    </>
  );
}
