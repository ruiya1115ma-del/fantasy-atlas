import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MovieGrid } from "@/components/MovieCard";
import { Note, SectionHeading } from "@/components/ui";
import { EDITORIAL_BY_SLUG, EDITORIAL_LISTS } from "@/lib/curation";
import { getMovies } from "@/lib/data";

// 只允许 catalog 里存在的 slug：其余路径直接 404，而不是先流式输出 200 再报错
export const dynamicParams = false;

export function generateStaticParams() {
  return EDITORIAL_LISTS.map((l) => ({ slug: l.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const list = EDITORIAL_BY_SLUG[slug];
  if (!list) return { title: "片单不存在" };
  return { title: list.title, description: list.intro };
}

export default async function CuratedPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const list = EDITORIAL_BY_SLUG[slug];
  if (!list) notFound();

  const movies = getMovies();
  const picked = list.pick(movies).slice(0, list.limit);
  const others = EDITORIAL_LISTS.filter((l) => l.slug !== slug);

  return (
    <div className="shell pb-24 pt-10 md:pt-14">
      <Link href="/" className="eyebrow hover:text-gold-soft">
        ← 返回首页
      </Link>

      <header className="mt-6 max-w-3xl">
        <p className="eyebrow">{list.en}</p>
        <h1 className="display mt-3 text-4xl leading-tight text-ivory md:text-[3.6rem]">{list.title}</h1>
        <p className="lede mt-4 text-[0.98rem]">{list.intro}</p>
      </header>

      <Note className="mt-6 max-w-3xl">
        这个片单是<span className="text-[var(--color-ivory-dim)]">规则生成 + 编辑撰写导语</span>
        ，不是人工逐条排的榜单。挑选规则写在 lib/curation.ts 里，可以逐行复核；排序在部分片单里参考了
        IMDb 公开评分，但只作为排序的次要依据，不单独决定去留。
      </Note>

      <div className="mt-10">
        <MovieGrid movies={picked} />
      </div>

      <div className="hairline my-14" />

      <section aria-labelledby="other-lists">
        <SectionHeading eyebrow="More Lists" title="其他编辑片单" id="other-lists" />
        <ul className="mt-6 grid gap-3 sm:grid-cols-2">
          {others.map((l) => (
            <li key={l.slug}>
              <Link
                href={`/curated/${l.slug}`}
                className="panel-quiet block p-5 transition-colors hover:border-[rgba(226,200,127,0.35)]"
              >
                <p className="text-[0.62rem] uppercase tracking-[0.18em] text-[var(--color-ash-dim)]">{l.en}</p>
                <p className="display mt-1 text-lg text-ivory">{l.title}</p>
                <p className="mt-1 line-clamp-2 text-[0.78rem] leading-relaxed text-[var(--color-ash-dim)]">{l.intro}</p>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
