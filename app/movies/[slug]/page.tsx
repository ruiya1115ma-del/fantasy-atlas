import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminEditShortcut } from "@/components/AdminEditShortcut";
import { DetailActions } from "@/components/DetailActions";
import { MovieCard } from "@/components/MovieCard";
import { Poster } from "@/components/Poster";
import { KeyValue, Note, Pill, RatingBadge, TagPill } from "@/components/ui";
import { getMoviesRuntime } from "@/lib/admin/store-kv";
import { similarMovies } from "@/lib/similar";
import { COUNTRY_NAMES, FORMAT_LABELS, LANGUAGE_NAMES, MEDIA_TYPE_LABELS, TAG_GROUPS, tagLabel } from "@/lib/vocabulary";

// 详情页改为按请求渲染：后台改完简介/标签/海报，刷新就能看到（不再依赖重新构建）
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const movie = (await getMoviesRuntime()).find((m) => m.slug === slug || m.id === slug);
  if (!movie) return { title: "作品不存在" };
  return {
    title: `${movie.chineseTitle}（${movie.releaseYear}）`,
    description: movie.synopsis.slice(0, 120),
  };
}

const DATE = (iso: string | null | undefined) => (iso ? iso.slice(0, 10) : "未记录");

export default async function MoviePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const all = await getMoviesRuntime();
  const movie = all.find((m) => m.slug === slug || m.id === slug);
  if (!movie) notFound();

  const similar = similarMovies(movie, all, 5);
  const franchiseMovies =
    movie.franchise !== null ? all.filter((m) => m.franchise === movie.franchise).sort((a, b) => (a.seriesOrder ?? 0) - (b.seriesOrder ?? 0)) : [];

  const rating = movie.ratings[0] ?? null;

  const tagGroups = TAG_GROUPS.filter((g) => g.category !== "exclude").map((group) => ({
    group,
    tags: movie.tags[group.category as keyof typeof movie.tags] ?? [],
  }));

  return (
    <div className="shell pb-24 pt-8 md:pt-12">
      {/* 面包屑 */}
      <nav aria-label="面包屑" className="mb-8 flex flex-wrap items-center gap-2 text-[0.7rem] text-[var(--color-ash-dim)]">
        <Link href="/" className="hover:text-gold-soft">
          首页
        </Link>
        <span aria-hidden>/</span>
        <Link href="/explore" className="hover:text-gold-soft">
          探索
        </Link>
        <span aria-hidden>/</span>
        {movie.franchiseName && (
          <>
            <span>{movie.franchiseName}</span>
            <span aria-hidden>/</span>
          </>
        )}
        <span className="text-[var(--color-ivory-dim)]">{movie.chineseTitle}</span>
      </nav>

      <div className="grid gap-12 lg:grid-cols-[minmax(0,340px)_1fr] lg:gap-16">
        {/* ───────── 左栏：封面 + 一句话 ───────── */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="poster-frame aspect-[2/3] w-full">
            <Poster movie={movie} variant="hero" className="h-full w-full" />
          </div>
          {/* 我的记录：海报正下方，第一行状态、第二行评分 */}
          <DetailActions movieId={movie.id} title={movie.chineseTitle} />

          <blockquote className="mt-6 border-l border-[rgba(226,200,127,0.4)] pl-4">
            <p className="text-[0.9rem] leading-relaxed text-[var(--color-ivory-dim)]">{movie.recommendation}</p>
            <footer className="mt-2 text-[0.65rem] uppercase tracking-[0.16em] text-[var(--color-ash-dim)]">
              编辑推荐语
            </footer>
          </blockquote>
        </aside>

        {/* ───────── 右栏：正文 ───────── */}
        <article>
          <header>
            <p className="eyebrow">
              {MOVIE_EYEBROW(movie.mediaType, movie.format)} · {movie.releaseYear}
            </p>
            <h1 className="display mt-3 text-4xl leading-tight text-ivory md:text-[3.4rem]">{movie.chineseTitle}</h1>
            <p className="mt-2 text-sm tracking-[0.06em] text-[var(--color-ash)]">{movie.originalTitle}</p>

            <div className="mt-5 flex flex-wrap items-center gap-2">
              {movie.franchiseName && (
                <Pill>
                  {movie.franchiseName}
                  {movie.seriesOrder ? ` · 第 ${movie.seriesOrder} 部` : ""}
                </Pill>
              )}
              <Pill>{MEDIA_TYPE_LABELS[movie.mediaType] ?? movie.mediaType}</Pill>
              <Pill>{FORMAT_LABELS[movie.format] ?? movie.format}</Pill>
              <Pill tone={movie.tagConfidence === "high" ? "ok" : "warn"}>
                标签置信度：{movie.tagConfidence === "high" ? "高" : movie.tagConfidence === "medium" ? "中" : "低"}
              </Pill>
              {movie.provenance.needsReview && <Pill tone="warn">待人工复核</Pill>}
            </div>

            <div className="mt-6">
              <RatingBadge ratings={movie.ratings} />
              {movie.ratings.length === 0 && (
                <p className="text-[0.72rem] text-[var(--color-ash-dim)]">
                  尚未接入可核验的外部评分 —— 本站<span className="text-[var(--color-ivory-dim)]">不会为了填满页面而编造分数</span>。
                </p>
              )}
            </div>
          </header>

          <div className="hairline my-8" />

          {/* 剧照 */}
          {movie.stills && movie.stills.length > 0 && (
            <section aria-labelledby="stills" className="mt-0">
              <div className="mb-4 flex items-baseline justify-between gap-4">
                <h2 id="stills" className="display text-2xl text-ivory">
                  剧照
                </h2>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                {movie.stills.map((s) => (
                  <figure key={s.src} className="overflow-hidden border border-[var(--hairline)] bg-ink">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={s.src}
                      alt={`${movie.chineseTitle} 剧照`}
                      className="aspect-video w-full object-cover transition-transform duration-700 hover:scale-[1.03]"
                      loading="lazy"
                      decoding="async"
                    />
                  </figure>
                ))}
              </div>
            </section>
          )}

          {/* 剧情简介（豆瓣原文） */}
          {movie.doubanIntro && (
            <>
              <div className="hairline my-8" />
              <section aria-labelledby="plot">
                <div className="mb-4 flex flex-wrap items-center gap-3">
                  <h2 id="plot" className="display text-2xl text-ivory">
                    剧情简介
                  </h2>
                  <span className="chip chip-static text-[0.62rem] text-gold-soft">引用自豆瓣</span>
                </div>
                <div className="space-y-3 text-[0.9rem] leading-[1.9] text-[var(--color-ivory-dim)]">
                  {movie.doubanIntro.split(/\n+/).slice(0, 4).map((para, i) => (
                    <p key={i}>{para}</p>
                  ))}
                </div>
                <Note className="mt-3">
                  简介文字引用自{" "}
                  <a
                    href={movie.doubanUrl ?? movie.links.douban ?? "https://movie.douban.com/"}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-gold-soft underline decoration-dotted"
                  >
                    豆瓣电影条目
                  </a>
                  （版权归原作者/豆瓣所有，仅作个人查阅与引用）。本站另有一份自己写的「编辑视角」在上方。
                </Note>
              </section>
            </>
          )}

          <div className="hairline my-8" />

          {/* 编辑视角 */}
          <section aria-labelledby="editorial">
            <div className="mb-4 flex items-center gap-3">
              <h2 id="editorial" className="display text-2xl text-ivory">
                编辑视角
              </h2>
              <span className="chip chip-static text-[0.62rem] text-gold-soft">主观内容</span>
            </div>
            <p className="lede text-[0.95rem]">
              {movie.synopsis}
            </p>
            <Note className="mt-2">
              以上简介为本站撰写的原创内容（没有抄录维基百科或豆瓣简介），只交代设定与进入方式，不剧透结局。
            </Note>

            <div className="mt-7 grid gap-4 sm:grid-cols-2">
              <div className="panel-quiet p-4">
                <p className="text-[0.66rem] uppercase tracking-[0.16em] text-gold-soft">适合谁</p>
                <p className="mt-2 text-[0.82rem] leading-relaxed text-[var(--color-ivory-dim)]">{movie.audienceFit}</p>
              </div>
              <div className="panel-quiet p-4">
                <p className="text-[0.66rem] uppercase tracking-[0.16em] text-[var(--color-ash-dim)]">可能不适合</p>
                <p className="mt-2 text-[0.82rem] leading-relaxed text-[var(--color-ivory-dim)]">{movie.audienceMismatch}</p>
              </div>
            </div>
          </section>

          <div className="hairline my-8" />

          {/* 客观资料 */}
          <section aria-labelledby="facts">
            <div className="mb-4 flex items-center gap-3">
              <h2 id="facts" className="display text-2xl text-ivory">
                客观资料
              </h2>
              <span className="chip chip-static text-[0.62rem]">来自片单与公开事实</span>
            </div>
            <dl className="panel px-5 py-2">
              <KeyValue label="原始片名">{movie.originalTitle}</KeyValue>
              <KeyValue label="上映年份">{movie.releaseYear}</KeyValue>
              <KeyValue label="导演">
                {movie.directors.length ? movie.directors.join(" / ") : <span className="text-[var(--color-ash-dim)]">片单未记录</span>}
              </KeyValue>
              <KeyValue label="主演">
                {movie.cast.length ? movie.cast.join(" / ") : <span className="text-[var(--color-ash-dim)]">片单未记录</span>}
              </KeyValue>
              <KeyValue label="制作地区">
                {movie.country.length ? movie.country.map((c) => COUNTRY_NAMES[c] ?? c).join(" / ") : "未记录"}
              </KeyValue>
              <KeyValue label="语言">
                {movie.originalLanguage ? (LANGUAGE_NAMES[movie.originalLanguage] ?? movie.originalLanguage) : "未记录"}
              </KeyValue>
              {movie.mediaType === "movie" ? (
                <KeyValue label="片长">
                  {movie.runtimeMinutes ? `${movie.runtimeMinutes} 分钟` : <span className="text-[var(--color-ash-dim)]">未记录</span>}
                </KeyValue>
              ) : (
                <KeyValue label="季数">
                  {movie.seasons ? `${movie.seasons} 季` : <span className="text-[var(--color-ash-dim)]">未记录</span>}
                </KeyValue>
              )}
              {movie.franchiseName && (
                <KeyValue label="系列位置">
                  {movie.franchiseName}
                  {movie.seriesOrder ? ` · 第 ${movie.seriesOrder} 部` : ""}
                </KeyValue>
              )}
              <KeyValue label="外部评分">
                {rating ? (
                  <span>
                    {rating.source} {rating.rating_value}/{rating.rating_scale}
                    {rating.rating_count ? `（${rating.rating_count.toLocaleString("en-US")} 人）` : ""}
                  </span>
                ) : (
                  <span className="text-[var(--color-ash-dim)]">未接入（不编造）</span>
                )}
              </KeyValue>
            </dl>
          </section>

          <div className="hairline my-8" />

          {/* 标签 */}
          <section aria-labelledby="tags">
            <div className="mb-4 flex items-center gap-3">
              <h2 id="tags" className="display text-2xl text-ivory">
                标签
              </h2>
              <span className="chip chip-static text-[0.62rem]">按六类词表规范</span>
            </div>
            <div className="flex flex-col gap-4">
              {tagGroups.map(({ group, tags }) =>
                tags.length ? (
                  <div key={group.category} className="grid gap-2 sm:grid-cols-[7rem_1fr] sm:items-baseline">
                    <p className="text-[0.66rem] uppercase tracking-[0.14em] text-[var(--color-ash-dim)]">{group.zh}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {tags.map((t) => (
                        <Link
                          key={t}
                          href={`/explore?${group.category}=${encodeURIComponent(t)}`}
                          className="transition-opacity hover:opacity-80"
                          title={`查看所有带「${tagLabel(t)}」标签的作品`}
                        >
                          <TagPill tag={t} bucket={group.category as never} />
                        </Link>
                      ))}
                    </div>
                  </div>
                ) : null,
              )}
            </div>
            {movie.tags.exclude.length > 0 && (
              <div className="mt-5 rounded-sm border border-[rgba(201,162,39,0.25)] bg-[rgba(201,162,39,0.05)] p-4">
                <p className="text-[0.68rem] uppercase tracking-[0.14em] text-gold-soft">劝退点（编辑标注）</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {movie.tags.exclude.map((t) => (
                    <span key={t} className="chip chip-static text-[0.7rem]">
                      {tagLabel(t)}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <Note className="mt-3">标签由编辑按固定词表人工标注（不是算法抓取）。</Note>
          </section>

          {/* 管理员才会看到的编辑入口（客户端检测会话，不影响静态渲染） */}
          <AdminEditShortcut movieId={movie.id} slug={movie.slug} />

          {/* 同系列 */}
          {franchiseMovies.length > 1 && (
            <>
              <div className="hairline my-8" />
              <section aria-labelledby="franchise">
                <h2 id="franchise" className="display text-2xl text-ivory">
                  同系列作品
                </h2>
                <p className="lede mt-2 text-sm">
                  按系列内顺序排列，共 {franchiseMovies.length} 部。系列顺序来自创作者片单，不是上映顺序的推测。
                </p>
                <ol className="mt-5 flex flex-col gap-2">
                  {franchiseMovies.map((m) => (
                    <li key={m.id}>
                      <Link
                        href={`/movies/${m.slug}`}
                        className={`flex items-baseline justify-between gap-4 border-b border-[var(--hairline)] py-2.5 text-sm transition-colors hover:text-gold-soft ${
                          m.id === movie.id ? "text-gold-soft" : "text-[var(--color-ivory-dim)]"
                        }`}
                      >
                        <span>
                          <span className="mr-3 text-[0.7rem] text-[var(--color-ash-dim)]">
                            {String(m.seriesOrder ?? "·").padStart(2, "0")}
                          </span>
                          {m.chineseTitle}
                        </span>
                        <span className="text-[0.7rem] text-[var(--color-ash-dim)]">{m.releaseYear}</span>
                      </Link>
                    </li>
                  ))}
                </ol>
              </section>
            </>
          )}

          {/* 相似作品 */}
          {similar.length > 0 && (
            <>
              <div className="hairline my-8" />
              <section aria-labelledby="similar">
                <h2 id="similar" className="display text-2xl text-ivory">
                  相似作品
                </h2>
                <p className="lede mt-2 text-sm">
                  按标签重合度计算：美学 2 分 + 世界观 2 分 + 元素 1 分 + 氛围 1 分，且必须跨至少两个维度重合。
                </p>
                <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-5">
                  {similar.map(({ movie: m, shared }) => (
                    <div key={m.id}>
                      <MovieCard movie={m} />
                      <p className="mt-1.5 line-clamp-2 text-[0.65rem] leading-relaxed text-[var(--color-ash-dim)]">
                        共同标签：{shared.flatMap((s) => s.tags).map(tagLabel).join("、")}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}

          {/* 相似作品结束；来源与核对只在后台展示，前台不出现任何来源说明 */}
        </article>
      </div>
    </div>
  );
}

function MOVIE_EYEBROW(mediaType: string, format: string) {
  if (mediaType !== "movie") return `${MEDIA_TYPE_LABELS[mediaType] ?? mediaType} · ${FORMAT_LABELS[format] ?? format}`;
  return FORMAT_LABELS[format] ?? format;
}
