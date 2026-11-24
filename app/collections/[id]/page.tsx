import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MovieCard } from "@/components/MovieCard";
import { Note } from "@/components/ui";
import { getMovies } from "@/lib/data";
import { loadHomeConfig } from "@/lib/home-config";

export const dynamic = "force-dynamic";

function findTheme(themeId: string) {
  const config = loadHomeConfig();
  for (const section of config.sections) {
    const theme = section.themes.find((t) => t.id === themeId);
    if (theme) return { config, section, theme };
  }
  return null;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const found = findTheme(id);
  if (!found) return { title: "主题不存在" };
  return { title: `${found.theme.name} · ${found.section.title}`, description: `${found.section.title} / ${found.theme.name}` };
}

/** 首页主题卡片点进来看到的片单：完全由后台配置的电影归属决定 */
export default async function CollectionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const found = findTheme(id);
  if (!found) notFound();
  const { section, theme } = found;

  if (theme.hidden || section.hidden) notFound();

  const byId = new Map(getMovies().map((m) => [m.id, m]));
  const list = theme.movieIds.map((movieId) => byId.get(movieId)).filter(Boolean) as ReturnType<typeof getMovies>;
  const coverImage =
    theme.image || list.find((m) => m.backdrop?.src)?.backdrop?.src || list.find((m) => m.poster?.src)?.poster?.src || "";

  const others = found.config.sections
    .filter((s) => !s.hidden && s.id === section.id)
    .flatMap((s) => s.themes)
    .filter((t) => !t.hidden && t.id !== theme.id)
    .slice(0, 6);

  return (
    <>
      <section className="relative isolate flex min-h-[48svh] items-end overflow-hidden border-b border-[var(--hairline)]">
        {coverImage && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={coverImage} alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover" style={{ filter: "brightness(0.55) saturate(0.95)" }} />
            <div className="absolute inset-0 bg-[linear-gradient(to_top,rgba(6,8,14,0.96),rgba(6,8,14,0.5)_60%,rgba(6,8,14,0.75))]" />
          </>
        )}
        <div className="shell relative z-10 pb-12 pt-28">
          <nav aria-label="面包屑" className="mb-6 flex items-center gap-2 text-[0.7rem] tracking-[0.08em] text-[var(--color-ash-dim)]">
            <Link href="/" className="transition-colors hover:text-gold-soft">
              首页
            </Link>
            <span aria-hidden>/</span>
            <span>{section.title}</span>
          </nav>
          <p className="eyebrow">{section.title}</p>
          <h1 className="display mt-3 text-[2.4rem] leading-none text-ivory md:text-[3.6rem]">{theme.name}</h1>
          <p className="mt-4 text-[0.78rem] uppercase tracking-[0.2em] text-gold-soft">共 {list.length} 部作品</p>
        </div>
      </section>

      <section className="py-12 md:py-16">
        <div className="shell">
          {list.length ? (
            <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {list.map((movie) => (
                <MovieCard key={movie.id} movie={movie} />
              ))}
            </div>
          ) : (
            <Note>这个主题下还没有电影。可以在后台「首页内容管理」里添加。</Note>
          )}

          {others.length > 0 && (
            <div className="mt-14 border-t border-[var(--hairline)] pt-8">
              <p className="eyebrow mb-4">Same Section</p>
              <div className="flex flex-wrap gap-3">
                {others.map((t) => (
                  <Link
                    key={t.id}
                    href={`/collections/${t.id}`}
                    className="border border-[var(--hairline)] px-4 py-2 text-[0.78rem] text-[var(--color-ivory-dim)] transition-colors hover:border-[rgba(226,200,127,0.6)] hover:text-gold-soft"
                  >
                    {t.name}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
