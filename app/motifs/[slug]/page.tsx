import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MovieCard } from "@/components/MovieCard";
import { Note } from "@/components/ui";
import { getMovies } from "@/lib/data";
import { MOTIFS, MOTIF_BY_SLUG, matchesMotif, motifsOf } from "@/lib/motifs";
import { tagLabel } from "@/lib/vocabulary";

export const dynamicParams = false;

export function generateStaticParams() {
  return MOTIFS.map((m) => ({ slug: m.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const motif = MOTIF_BY_SLUG[slug];
  if (!motif) return { title: "主题不存在" };
  return { title: `${motif.zh} · 叙事主题`, description: `${motif.tagline}｜${motif.description}` };
}

export default async function MotifPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const motif = MOTIF_BY_SLUG[slug];
  if (!motif) notFound();

  const movies = getMovies();
  const matched = movies.filter((m) => matchesMotif(m, motif));
  const sorted = matched
    .slice()
    .sort((a, b) => (b.ratings[0]?.rating_count ?? 0) - (a.ratings[0]?.rating_count ?? 0));

  const cover =
    matched.find((m) => m.backdrop?.src)?.backdrop?.src ?? matched.find((m) => m.poster?.src)?.poster?.src ?? "";

  const others = MOTIFS.filter((m) => m.slug !== slug)
    .map((m) => ({ motif: m, count: movies.filter((x) => matchesMotif(x, m)).length }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 4);

  return (
    <>
      {/* 头图：真实剧照 + 暗金标题 */}
      <section className="relative isolate flex min-h-[52svh] items-end overflow-hidden border-b border-[var(--hairline)]">
        {cover && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={cover}
              alt=""
              aria-hidden
              className="absolute inset-0 h-full w-full object-cover"
              style={{ filter: "saturate(1.05) contrast(1.03) brightness(0.82)" }}
            />
            <div className="absolute inset-0 bg-[linear-gradient(105deg,rgba(5,7,12,0.95)_0%,rgba(5,7,12,0.78)_40%,rgba(5,7,12,0.35)_74%,rgba(5,7,12,0.86)_100%)]" />
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
            <span className="text-[var(--color-ivory-dim)]">{motif.zh}</span>
          </nav>

          <p className="mt-8 text-[0.6rem] uppercase tracking-[0.34em] text-[rgba(226,200,127,0.8)]">{motif.en}</p>
          <h1 className="display mt-4 text-[2.6rem] leading-none sm:text-[3.6rem] lg:text-[4.4rem]" style={{ color: motif.ink }}>
            {motif.zh}
          </h1>
          <p className="mt-4 max-w-xl text-[0.9rem] italic text-[var(--color-ivory-dim)]">{motif.tagline}</p>
          <p className="mt-5 max-w-2xl text-[0.86rem] leading-relaxed text-[var(--color-ash)]">{motif.description}</p>
          <p className="mt-6 text-[0.68rem] uppercase tracking-[0.2em] text-[var(--color-ivory-dim)]">
            共 {matched.length} 部 · 与五个视觉风格分类并行
          </p>
        </div>
      </section>

      {/* 该主题下的全部作品 */}
      <section className="shell py-16">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-[var(--hairline)] pb-5">
          <h2 className="display text-2xl text-ivory">{motif.zh}：{matched.length} 部作品</h2>
          <Link
            href="/explore"
            className="text-[0.7rem] uppercase tracking-[0.18em] text-gold-soft transition-colors hover:text-ivory"
          >
            在筛选器里浏览 →
          </Link>
        </div>

        {matched.length === 0 ? (
          <p className="py-16 text-center text-sm text-[var(--color-ash-dim)]">这个主题下暂时还没有匹配到作品。</p>
        ) : (
          <div className="grid grid-cols-2 gap-x-5 gap-y-10 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {sorted.map((m) => (
              <div key={m.id}>
                <MovieCard movie={m} />
                <div className="mt-2 flex flex-wrap gap-x-2.5 gap-y-1">
                  {motifsOf(m)
                    .filter((x) => x.slug !== motif.slug)
                    .slice(0, 2)
                    .map((x) => (
                      <span key={x.slug} className="text-[0.6rem] tracking-[0.06em] text-[var(--color-ash-dim)]">
                        {x.zh}
                      </span>
                    ))}
                  {[...m.tags.element.slice(0, 1), ...m.tags.world.slice(0, 1)].map((t) => (
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

      {/* 其他叙事主题 */}
      <section className="shell pb-24">
        <div className="hairline mb-8" />
        <p className="eyebrow">Other Themes</p>
        <div className="mt-5 flex flex-wrap gap-3">
          {others.map(({ motif: m, count }) => (
            <Link
              key={m.slug}
              href={`/motifs/${m.slug}`}
              className="group flex items-baseline gap-3 border border-[var(--hairline)] px-5 py-3 transition-colors hover:border-[rgba(226,200,127,0.45)]"
            >
              <span className="display text-lg text-ivory transition-colors group-hover:text-gold-soft">{m.zh}</span>
              <span className="text-[0.64rem] tracking-[0.12em] text-[var(--color-ash-dim)]">{count} 部 →</span>
            </Link>
          ))}
        </div>
        <Note className="mt-8">
          这些叙事主题是按「标签 + 简介关键词」实时筛出来的，和五个视觉风格分类并行：
          同一部电影可以既属于「暗黑与哥特」，又属于「禁忌契约」。
        </Note>
      </section>
    </>
  );
}
