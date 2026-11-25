import catalogSource from "@/data/catalog.json";
import { kvReadJson, kvWriteJson, KV_KEYS } from "@/lib/admin/kv";
import { readCatalog } from "@/lib/admin/store";
import type { CatalogFile, Movie, MovieTags } from "@/lib/types";
import { TAG_GROUPS } from "@/lib/vocabulary";

/**
 * KV 版数据读写（线上 Cloudflare Workers 用）。
 * 逻辑与 lib/admin/store.ts 一致，只是把「文件」换成 KV，并且不再同步 raw 文件
 * （Workers 上是只读文件系统，raw 同步只在本机开发时由文件版完成）。
 */

const bundled = catalogSource as unknown as CatalogFile;

/**
 * 进程内缓存：Workers 同一个 isolate 会连续处理多个请求，
 * 每次请求都从 KV 取回 1.3MB 的 catalog 再 JSON.parse 非常耗 CPU，
 * 在免费额度（10ms/请求）下会直接超限返回 503。
 * 缓存 20 秒；后台写入时立即失效，跨 isolate 最多 20 秒延迟。
 */
const MEMO_TTL_MS = 20_000;
let catalogMemo: { catalog: CatalogFile; at: number } | null = null;

export function invalidateCatalogMemo(): void {
  catalogMemo = null;
}

export function bundledCatalog(): CatalogFile {
  return {
    generatedAt: bundled.generatedAt ?? new Date().toISOString(),
    count: Array.isArray(bundled.movies) ? bundled.movies.length : 0,
    movies: Array.isArray(bundled.movies) ? bundled.movies : [],
  };
}

/** 读线上目录：KV 里有就用 KV；本地没有 KV 时读文件；两者都没有就用构建时打包的那份 */
export async function readCatalogKv(): Promise<CatalogFile> {
  const now = Date.now();
  if (catalogMemo && now - catalogMemo.at < MEMO_TTL_MS) return catalogMemo.catalog;

  const fromKv = await kvReadJson<CatalogFile>(KV_KEYS.catalog);
  if (fromKv && Array.isArray(fromKv.movies) && fromKv.movies.length > 0) {
    const catalog = { ...fromKv, count: fromKv.movies.length };
    catalogMemo = { catalog, at: now };
    return catalog;
  }
  try {
    const local = readCatalog();
    if (local.movies.length > 0) {
      catalogMemo = { catalog: local, at: now };
      return local;
    }
  } catch {
    /* 没有文件系统（Workers）时忽略 */
  }
  const fallback = bundledCatalog();
  catalogMemo = { catalog: fallback, at: now };
  return fallback;
}

export async function writeCatalogKv(catalog: CatalogFile): Promise<void> {
  await kvWriteJson(KV_KEYS.catalog, { ...catalog, count: catalog.movies.length });
  invalidateCatalogMemo();
}

/** 前台/后台读取用的目录：KV 优先，未改过时就是构建时打包的那份 */
export async function getMoviesRuntime(): Promise<Movie[]> {
  return (await readCatalogKv()).movies;
}

export async function getMovieKv(id: string): Promise<Movie | undefined> {
  return (await readCatalogKv()).movies.find((m) => m.id === id || m.slug === id);
}

export async function searchMoviesKv(query: string, limit = 40): Promise<Movie[]> {
  const q = query.trim().toLowerCase();
  const movies = await getMoviesRuntime();
  if (!q) return movies.slice(0, limit);
  return movies
    .filter((m) =>
      [m.chineseTitle, m.originalTitle, String(m.releaseYear), m.id, ...m.directors]
        .join(" ")
        .toLowerCase()
        .includes(q),
    )
    .slice(0, limit);
}

export interface TagUsage {
  category: string;
  categoryZh: string;
  tag: string;
  count: number;
  unused: boolean;
}

export async function tagUsageKv(): Promise<TagUsage[]> {
  const movies = await getMoviesRuntime();
  const counts = new Map<string, number>();
  for (const movie of movies) {
    for (const [category, values] of Object.entries(movie.tags ?? {})) {
      for (const tag of (values as string[]) ?? []) {
        const key = `${category}|${tag}`;
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }
  }
  const out: TagUsage[] = [];
  for (const group of TAG_GROUPS) {
    for (const term of group.terms) {
      const count = counts.get(`${group.category}|${term.id}`) ?? 0;
      out.push({
        category: group.category,
        categoryZh: group.zh,
        tag: term.id,
        count,
        unused: count === 0,
      });
    }
  }
  for (const [key, count] of counts) {
    const [category, tag] = key.split("|");
    const known = TAG_GROUPS.some((g) => g.category === category && g.terms.some((t) => t.id === tag));
    if (!known) out.push({ category, categoryZh: category, tag, count, unused: false });
  }
  return out.sort((a, b) => b.count - a.count);
}

export async function missingPostersKv(): Promise<Movie[]> {
  return (await getMoviesRuntime()).filter((m) => !m.poster?.src).sort((a, b) => b.releaseYear - a.releaseYear);
}

export interface MoviePatch {
  chineseTitle?: string;
  originalTitle?: string;
  releaseYear?: number;
  synopsis?: string;
  recommendation?: string;
  tags?: MovieTags;
  directors?: string[];
  cast?: string[];
  country?: string[];
  franchise?: string | null;
  franchiseName?: string | null;
  seriesOrder?: number | null;
  audienceFit?: string;
  audienceMismatch?: string;
  watchStatus?: Movie["watchStatus"];
  posterSrc?: string | null;
}

function patchPoster(movie: Movie, src: string | null | undefined) {
  if (src === undefined) return;
  const trimmed = (src ?? "").trim();
  if (!trimmed) {
    movie.poster = null;
    return;
  }
  movie.poster = {
    src: trimmed,
    width: movie.poster?.width ?? 500,
    height: movie.poster?.height ?? 750,
    source: trimmed.startsWith("/") ? "admin-upload" : "admin-url",
    sourceUrl: trimmed,
    articleUrl: trimmed,
    license: movie.poster?.license ?? "待确认（管理员手动填写）",
    licenseNote: "由管理员在后台手动设置，请自行确认图片授权。",
    fetchedAt: new Date().toISOString(),
  };
}

export async function updateMovieKv(id: string, patch: MoviePatch): Promise<Movie> {
  const catalog = await readCatalogKv();
  const movie = catalog.movies.find((m) => m.id === id || m.slug === id);
  if (!movie) throw new Error("找不到这部作品");

  if (patch.chineseTitle !== undefined) {
    const v = patch.chineseTitle.trim();
    if (!v) throw new Error("中文片名不能为空");
    movie.chineseTitle = v;
  }
  if (patch.originalTitle !== undefined) movie.originalTitle = patch.originalTitle.trim();
  if (patch.releaseYear !== undefined) {
    const y = Number(patch.releaseYear);
    if (!Number.isFinite(y) || y < 1900 || y > 2100) throw new Error("年份需要在 1900–2100 之间");
    movie.releaseYear = Math.round(y);
  }
  if (patch.synopsis !== undefined) movie.synopsis = patch.synopsis.trim();
  if (patch.recommendation !== undefined) movie.recommendation = patch.recommendation.trim();
  if (patch.tags !== undefined) movie.tags = patch.tags;
  if (patch.directors !== undefined) movie.directors = patch.directors.map((d) => d.trim()).filter(Boolean);
  if (patch.cast !== undefined) movie.cast = patch.cast.map((c) => c.trim()).filter(Boolean);
  if (patch.country !== undefined) movie.country = patch.country.map((c) => c.trim()).filter(Boolean);
  if (patch.franchise !== undefined) movie.franchise = patch.franchise || null;
  if (patch.franchiseName !== undefined) movie.franchiseName = patch.franchiseName || null;
  if (patch.seriesOrder !== undefined) movie.seriesOrder = patch.seriesOrder ?? null;
  if (patch.audienceFit !== undefined) movie.audienceFit = patch.audienceFit.trim();
  if (patch.audienceMismatch !== undefined) movie.audienceMismatch = patch.audienceMismatch.trim();
  if (patch.watchStatus !== undefined) movie.watchStatus = patch.watchStatus;
  patchPoster(movie, patch.posterSrc);
  movie.updatedAt = new Date().toISOString();

  await writeCatalogKv(catalog);
  return movie;
}

export interface NewMovieInput {
  chineseTitle: string;
  originalTitle?: string;
  releaseYear: number;
  mediaType?: Movie["mediaType"];
  format?: Movie["format"];
  synopsis?: string;
  recommendation?: string;
  posterSrc?: string;
  tags?: Partial<MovieTags>;
  directors?: string[];
  cast?: string[];
  country?: string[];
  franchise?: string | null;
  franchiseName?: string | null;
}

function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-");
}

function emptyTags(): MovieTags {
  return { type: [], world: [], aesthetic: [], element: [], mood: [], exclude: [] };
}

export async function createMovieKv(input: NewMovieInput): Promise<Movie> {
  const title = input.chineseTitle?.trim();
  if (!title) throw new Error("请填写中文片名");
  const year = Number(input.releaseYear);
  if (!Number.isFinite(year) || year < 1900 || year > 2100) throw new Error("年份需要在 1900–2100 之间");

  const catalog = await readCatalogKv();
  if (catalog.movies.some((m) => m.chineseTitle === title && m.releaseYear === year)) {
    throw new Error("库里已经有同名同年的作品了");
  }

  const baseSlug = slugify(input.originalTitle || title) || `film-${year}`;
  let id = baseSlug;
  let n = 2;
  while (catalog.movies.some((m) => m.id === id || m.slug === id)) {
    id = `${baseSlug}-${n}`;
    n += 1;
  }

  const now = new Date().toISOString();
  const tags = emptyTags();
  for (const key of Object.keys(tags) as (keyof MovieTags)[]) {
    const value = input.tags?.[key];
    if (Array.isArray(value)) tags[key] = value.filter(Boolean);
  }

  const movie: Movie = {
    id,
    slug: id,
    chineseTitle: title,
    originalTitle: (input.originalTitle ?? "").trim(),
    releaseYear: Math.round(year),
    mediaType: input.mediaType ?? "movie",
    format: input.format ?? "live_action",
    franchise: input.franchise ?? null,
    franchiseName: input.franchiseName ?? null,
    seriesOrder: null,
    country: (input.country ?? []).filter(Boolean),
    directors: (input.directors ?? []).filter(Boolean),
    cast: (input.cast ?? []).filter(Boolean),
    runtimeMinutes: null,
    seasons: null,
    originalLanguage: null,
    tags,
    tagConfidence: "medium",
    synopsis: (input.synopsis ?? "").trim(),
    recommendation: (input.recommendation ?? "").trim(),
    audienceFit: "",
    audienceMismatch: "",
    watchStatus: "unknown",
    creatorNote: null,
    ratings: [],
    externalIds: { wikidata: null, imdb: null },
    links: { wikidata: null, imdb: null, wikipediaZh: null, wikipediaEn: null },
    provenance: {
      recordSource: "admin",
      recordFile: "kv:catalog-admin",
      enrichment: null,
      ratingCheckedAt: null,
      needsReview: true,
      reviewReasons: ["后台手动新增，资料待补全"],
    },
    poster: null,
    backdrop: null,
    stills: [],
    doubanIntro: null,
    doubanUrl: null,
    createdAt: now,
    updatedAt: now,
  };
  if (input.posterSrc) patchPoster(movie, input.posterSrc);

  catalog.movies.push(movie);
  await writeCatalogKv(catalog);
  return movie;
}

export async function deleteMovieKv(id: string): Promise<void> {
  const catalog = await readCatalogKv();
  const index = catalog.movies.findIndex((m) => m.id === id || m.slug === id);
  if (index < 0) throw new Error("找不到这部作品");
  catalog.movies.splice(index, 1);
  await writeCatalogKv(catalog);
}
