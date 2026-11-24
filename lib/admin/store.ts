/**
 * 电影库读写（仅服务端，供 /admin 使用）。
 *
 * 数据真相：data/catalog.json 是站点唯一数据源（由 scripts/merge-catalog.mjs 生成）。
 * 后台的每一次保存都会：
 *   1. 先把 catalog.json 备份到 data/backups/；
 *   2. 修改 catalog.json（原子写入）；
 *   3. 同步修改 data/raw/*.json 里对应的原始记录，保证重新 merge 不会丢改动。
 *
 * 注意：Vercel 的函数文件系统是只读的，后台写操作只在本机/自托管有效。
 * 部署到 Vercel 时接口会返回明确的中文错误，而不是假装保存成功。
 */
import fs from "node:fs";
import path from "node:path";
import type { CatalogFile, Movie, MovieTags } from "@/lib/types";
import { TAG_GROUPS } from "@/lib/vocabulary";

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, "data");
const CATALOG_PATH = path.join(DATA_DIR, "catalog.json");
const RAW_DIR = path.join(DATA_DIR, "raw");
const BACKUP_DIR = path.join(DATA_DIR, "backups");
const ADMIN_RAW = path.join(RAW_DIR, "catalog-admin.json");

export class StorageUnavailableError extends Error {
  constructor(message = "当前部署环境是只读文件系统，无法保存。请在本机或自托管环境运行后台。") {
    super(message);
    this.name = "StorageUnavailableError";
  }
}

function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
}

function atomicWrite(file: string, content: string) {
  try {
    fs.writeFileSync(`${file}.tmp`, content, "utf8");
    fs.renameSync(`${file}.tmp`, file);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException)?.code;
    if (code === "EROFS" || code === "EACCES" || code === "EPERM") throw new StorageUnavailableError();
    throw err;
  }
}

export function readCatalog(): CatalogFile {
  try {
    const parsed = JSON.parse(fs.readFileSync(CATALOG_PATH, "utf8")) as CatalogFile;
    return {
      generatedAt: parsed.generatedAt ?? new Date().toISOString(),
      count: Array.isArray(parsed.movies) ? parsed.movies.length : 0,
      movies: Array.isArray(parsed.movies) ? parsed.movies : [],
    };
  } catch {
    return { generatedAt: new Date().toISOString(), count: 0, movies: [] };
  }
}

function stamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

/** 备份 catalog.json，返回备份文件名。每次写入前都会调用。 */
export function backupCatalog(reason = "manual"): string {
  ensureDir(BACKUP_DIR);
  const name = `catalog-${stamp()}-${reason}.json`;
  const target = path.join(BACKUP_DIR, name);
  if (fs.existsSync(CATALOG_PATH)) fs.copyFileSync(CATALOG_PATH, target);
  // 只保留最近 40 份，避免无限增长
  const files = fs
    .readdirSync(BACKUP_DIR)
    .filter((f) => f.startsWith("catalog-") && f.endsWith(".json"))
    .sort();
  for (const f of files.slice(0, Math.max(0, files.length - 40))) {
    try {
      fs.unlinkSync(path.join(BACKUP_DIR, f));
    } catch {
      /* ignore */
    }
  }
  return name;
}

export function listBackups(): { name: string; size: number; mtime: string }[] {
  if (!fs.existsSync(BACKUP_DIR)) return [];
  return fs
    .readdirSync(BACKUP_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((name) => {
      const stat = fs.statSync(path.join(BACKUP_DIR, name));
      return { name, size: stat.size, mtime: stat.mtime.toISOString() };
    })
    .sort((a, b) => (a.mtime < b.mtime ? 1 : -1));
}

function writeCatalog(catalog: CatalogFile) {
  catalog.count = catalog.movies.length;
  catalog.generatedAt = new Date().toISOString();
  atomicWrite(CATALOG_PATH, JSON.stringify(catalog, null, 2));
}

/* ---------------- 原始记录同步 ---------------- */

interface RawRecord {
  catalog_key?: string;
  [key: string]: unknown;
}

function rawFiles(): string[] {
  if (!fs.existsSync(RAW_DIR)) return [];
  return fs
    .readdirSync(RAW_DIR)
    .filter((f) => f.startsWith("catalog-") && f.endsWith(".json"))
    .map((f) => path.join(RAW_DIR, f));
}

function readRawFile(file: string): RawRecord[] {
  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
    return Array.isArray(parsed) ? (parsed as RawRecord[]) : [];
  } catch {
    return [];
  }
}

/** 把 catalog 里的字段映射回 raw 契约（snake_case） */
function rawPatchFromMovie(movie: Movie): Partial<RawRecord> {
  return {
    chinese_title: movie.chineseTitle,
    original_title: movie.originalTitle,
    release_year: movie.releaseYear,
    media_type: movie.mediaType,
    format: movie.format,
    country: movie.country,
    director: movie.directors,
    cast: movie.cast,
    runtime_minutes: movie.runtimeMinutes,
    seasons: movie.seasons,
    original_language: movie.originalLanguage,
    tags: movie.tags,
    tag_confidence: movie.tagConfidence,
    synopsis_zh: movie.synopsis,
    recommendation_zh: movie.recommendation,
    audience_fit: movie.audienceFit,
    audience_mismatch: movie.audienceMismatch,
    watch_status: movie.watchStatus,
    franchise: movie.franchise,
    franchise_name: movie.franchiseName,
    series_order: movie.seriesOrder,
  };
}

function syncRaw(movie: Movie): boolean {
  for (const file of rawFiles()) {
    const records = readRawFile(file);
    const index = records.findIndex((r) => r.catalog_key === movie.id);
    if (index < 0) continue;
    records[index] = { ...records[index], ...rawPatchFromMovie(movie) };
    atomicWrite(file, JSON.stringify(records, null, 2));
    return true;
  }
  return false;
}

function removeFromRaw(id: string): boolean {
  for (const file of rawFiles()) {
    const records = readRawFile(file);
    const index = records.findIndex((r) => r.catalog_key === id);
    if (index < 0) continue;
    const next = records.filter((r) => r.catalog_key !== id);
    atomicWrite(file, JSON.stringify(next, null, 2));
    return true;
  }
  return false;
}

/* ---------------- 读 ---------------- */

export function getMovie(id: string): Movie | undefined {
  return readCatalog().movies.find((m) => m.id === id || m.slug === id);
}

export function searchMovies(query: string, limit = 40): Movie[] {
  const q = query.trim().toLowerCase();
  const movies = readCatalog().movies;
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
  /** 词表里有、但库里没人用 */
  unused: boolean;
}

export function tagUsage(): TagUsage[] {
  const movies = readCatalog().movies;
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
      out.push({
        category: group.category,
        categoryZh: group.zh,
        tag: term.id,
        count: counts.get(`${group.category}|${term.id}`) ?? 0,
        unused: (counts.get(`${group.category}|${term.id}`) ?? 0) === 0,
      });
    }
  }
  // 库里出现但词表没有的标签（历史遗留），单独列出，方便合并
  for (const [key, count] of counts) {
    const [category, tag] = key.split("|");
    const known = TAG_GROUPS.some((g) => g.category === category && g.terms.some((t) => t.id === tag));
    if (!known) out.push({ category, categoryZh: category, tag, count, unused: false });
  }
  return out.sort((a, b) => b.count - a.count);
}

export function missingPosters(): Movie[] {
  return readCatalog()
    .movies.filter((m) => !m.poster?.src)
    .sort((a, b) => b.releaseYear - a.releaseYear);
}

export function exportPayload() {
  const catalog = readCatalog();
  return {
    exportedAt: new Date().toISOString(),
    count: catalog.movies.length,
    generatedAt: catalog.generatedAt,
    movies: catalog.movies,
  };
}

/* ---------------- 写 ---------------- */

export interface MoviePatch {
  chineseTitle?: string;
  originalTitle?: string;
  releaseYear?: number;
  synopsis?: string;
  recommendation?: string;
  posterSrc?: string | null;
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
}

function patchPoster(movie: Movie, src: string | null | undefined) {
  if (src === undefined) return;
  if (!src) {
    movie.poster = null;
    return;
  }
  const trimmed = src.trim();
  if (!trimmed) {
    movie.poster = null;
    return;
  }
  const isInternal = trimmed.startsWith("/");
  movie.poster = {
    src: trimmed,
    width: movie.poster?.width ?? 500,
    height: movie.poster?.height ?? 750,
    source: isInternal ? "admin-upload" : "admin-url",
    sourceUrl: trimmed,
    articleUrl: trimmed,
    license: movie.poster?.license ?? "待确认（管理员手动填写）",
    licenseNote: "由管理员在后台手动设置，请自行确认图片授权。",
    fetchedAt: new Date().toISOString(),
  };
}

export function updateMovie(id: string, patch: MoviePatch): Movie {
  const catalog = readCatalog();
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

  backupCatalog("update");
  writeCatalog(catalog);
  syncRaw(movie);
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

export function createMovie(input: NewMovieInput): Movie {
  const title = input.chineseTitle?.trim();
  if (!title) throw new Error("请填写中文片名");
  const year = Number(input.releaseYear);
  if (!Number.isFinite(year) || year < 1900 || year > 2100) throw new Error("年份需要在 1900–2100 之间");

  const catalog = readCatalog();
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
      recordFile: "data/raw/catalog-admin.json",
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

  backupCatalog("create");
  catalog.movies.push(movie);
  writeCatalog(catalog);

  // 同时写入 raw，保证重新 merge 时不会丢
  ensureDir(RAW_DIR);
  const records = fs.existsSync(ADMIN_RAW) ? readRawFile(ADMIN_RAW) : [];
  records.push({
    catalog_key: movie.id,
    chinese_title: movie.chineseTitle,
    original_title: movie.originalTitle,
    release_year: movie.releaseYear,
    media_type: movie.mediaType,
    format: movie.format,
    country: movie.country,
    director: movie.directors,
    cast: movie.cast,
    runtime_minutes: null,
    seasons: null,
    original_language: null,
    tags: movie.tags,
    tag_confidence: movie.tagConfidence,
    synopsis_zh: movie.synopsis || "（待补充：简介不少于 60 字）",
    recommendation_zh: movie.recommendation || "（待补充：编辑推荐语）",
    audience_fit: "",
    audience_mismatch: "",
    watch_status: movie.watchStatus,
    franchise: movie.franchise,
    franchise_name: movie.franchiseName,
    series_order: null,
  });
  atomicWrite(ADMIN_RAW, JSON.stringify(records, null, 2));

  return movie;
}

export function deleteMovie(id: string): void {
  const catalog = readCatalog();
  const index = catalog.movies.findIndex((m) => m.id === id || m.slug === id);
  if (index < 0) throw new Error("找不到这部作品");
  backupCatalog("delete");
  const [removed] = catalog.movies.splice(index, 1);
  writeCatalog(catalog);
  removeFromRaw(removed.id);
}
