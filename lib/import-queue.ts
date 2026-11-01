/**
 * 增量导入队列（仅服务端）。
 *
 * 设计要点：
 *   - 只处理"新提交"的条目：已存在于正式库或队列的条目直接跳过（去重）。
 *   - 去重键优先级：豆瓣条目 ID（唯一）→ IMDb ID（若匹配到）→ 「片名+年份」；
 *     不以片名单独判重（同名不同片很常见）。
 *   - 匹配不确定的条目不进正式库，停在 needs_review，等管理员决定。
 *   - 发布 = 追加写入 data/raw/catalog-imported.json，**从不覆盖**已有记录。
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const DIR = path.join(ROOT, "data", "admin");
const FILE = path.join(DIR, "import-queue.json");
const IMPORTED_RAW = path.join(ROOT, "data", "raw", "catalog-imported.json");
const CATALOG = path.join(ROOT, "data", "catalog.json");

export type ImportStatus = "matched" | "needs_review" | "published" | "rejected";

export interface ImportMatch {
  doubanId: string;
  doubanUrl: string;
  chineseTitle: string;
  originalTitle: string;
  year: number | null;
  isTv: boolean;
  genres: string[];
  countries: string[];
  durations: string[];
  directors: string[];
  actors: string[];
  intro: string;
  rating: { value: number; scale: number; count: number | null } | null;
  poster: string | null;
  still: string | null;
  confidence: number;
  reason: string;
}

export interface ImportItem {
  id: string;
  query: string;
  status: ImportStatus;
  match: ImportMatch | null;
  /** 管理员选定的主题（分类 slug），可改 */
  themeSlug: string | null;
  /** 自动生成的标签（可改） */
  tags: { type: string[]; world: string[]; aesthetic: string[]; element: string[]; mood: string[]; exclude: string[] };
  note: string;
  createdAt: string;
  updatedAt: string;
  publishedKey?: string;
}

interface Store {
  items: ImportItem[];
  updatedAt: string;
}

function ensure() {
  fs.mkdirSync(DIR, { recursive: true });
  if (!fs.existsSync(FILE)) {
    fs.writeFileSync(FILE, JSON.stringify({ items: [], updatedAt: new Date().toISOString() }, null, 2), "utf8");
  }
}

export function readQueue(): Store {
  ensure();
  try {
    const raw = JSON.parse(fs.readFileSync(FILE, "utf8")) as Store;
    return { items: Array.isArray(raw.items) ? raw.items : [], updatedAt: raw.updatedAt ?? "" };
  } catch {
    return { items: [], updatedAt: "" };
  }
}

function writeQueue(store: Store) {
  ensure();
  store.updatedAt = new Date().toISOString();
  const tmp = `${FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(store, null, 2), "utf8");
  fs.renameSync(tmp, FILE);
}

/** 正式库里已存在的去重键 */
export function existingKeys(): Set<string> {
  const keys = new Set<string>();
  if (!fs.existsSync(CATALOG)) return keys;
  try {
    const catalog = JSON.parse(fs.readFileSync(CATALOG, "utf8"));
    for (const m of catalog.movies ?? []) {
      if (m.id) keys.add(`id:${m.id}`);
      if (m.externalIds?.imdb) keys.add(`imdb:${m.externalIds.imdb}`);
      keys.add(`title:${String(m.chineseTitle).trim()}|${m.releaseYear}`);
      keys.add(`title:${String(m.originalTitle).trim().toLowerCase()}|${m.releaseYear}`);
    }
  } catch {
    /* 读不到就当空 */
  }
  return keys;
}

export function addItems(queries: string[]): { added: ImportItem[]; skipped: string[] } {
  const store = readQueue();
  const keys = existingKeys();
  for (const item of store.items) {
    if (item.match?.doubanId) keys.add(`douban:${item.match.doubanId}`);
    if (item.match) keys.add(`title:${item.match.chineseTitle.trim()}|${item.match.year ?? ""}`);
  }

  const added: ImportItem[] = [];
  const skipped: string[] = [];
  const now = new Date().toISOString();

  for (const raw of queries) {
    const q = raw.trim();
    if (!q) continue;
    const lower = q.toLowerCase();
    // 文本输入可能是「片名 年份」或「片名(2001)」
    const yearMatch = /(19\d{2}|20\d{2})/.exec(q);
    const year = yearMatch ? Number(yearMatch[1]) : null;
    const title = q.replace(/[（(]?\s*(19\d{2}|20\d{2})\s*[)）]?/g, "").trim();
    const titleKey = `title:${title}|${year ?? ""}`;
    if (keys.has(titleKey) || keys.has(`title:${title}|`)) {
      skipped.push(q);
      continue;
    }
    keys.add(titleKey);

    added.push({
      id: `imp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      query: q,
      status: "needs_review",
      match: null,
      themeSlug: null,
      tags: { type: [], world: [], aesthetic: [], element: [], mood: [], exclude: [] },
      note: "",
      createdAt: now,
      updatedAt: now,
    });
    void lower;
  }

  store.items = [...added, ...store.items].slice(0, 800);
  writeQueue(store);
  return { added, skipped };
}

export function updateItem(id: string, patch: Partial<ImportItem>): ImportItem | null {
  const store = readQueue();
  const item = store.items.find((i) => i.id === id);
  if (!item) return null;
  Object.assign(item, patch, { updatedAt: new Date().toISOString() });
  writeQueue(store);
  return item;
}

export function bulkUpdate(ids: string[], patch: Partial<ImportItem>): number {
  const store = readQueue();
  let n = 0;
  for (const item of store.items) {
    if (!ids.includes(item.id)) continue;
    Object.assign(item, patch, { updatedAt: new Date().toISOString() });
    n++;
  }
  writeQueue(store);
  return n;
}

export function removeItems(ids: string[]): number {
  const store = readQueue();
  const before = store.items.length;
  store.items = store.items.filter((i) => !ids.includes(i.id));
  writeQueue(store);
  return before - store.items.length;
}

/** 发布：只在 raw 里新增记录，绝不覆盖已有条目 */
export function publishItems(ids: string[]): { published: number; skipped: number } {
  const store = readQueue();
  const imported: unknown[] = fs.existsSync(IMPORTED_RAW) ? JSON.parse(fs.readFileSync(IMPORTED_RAW, "utf8")) : [];
  const existingRaw = new Set(imported.map((r) => (r as { catalog_key?: string }).catalog_key));
  const catalogKeys = existingKeys();

  let published = 0;
  let skipped = 0;

  for (const item of store.items) {
    if (!ids.includes(item.id) || item.status !== "matched" || !item.match) continue;
    const m = item.match;
    const key = `douban-${m.doubanId}`;
    if (existingRaw.has(key) || catalogKeys.has(`id:${key}`)) {
      skipped++;
      continue;
    }

    const synopsis = m.intro.replace(/\s+/g, " ").trim();
    const rec = {
      catalog_key: key,
      chinese_title: m.chineseTitle,
      original_title: m.originalTitle || m.chineseTitle,
      release_year: m.year ?? 0,
      media_type: m.isTv ? "series" : "movie",
      format: (m.genres.includes("动画") ? "animation" : "live_action") as "animation" | "live_action",
      franchise: null,
      franchise_name: null,
      series_order: null,
      country: [],
      director: m.directors.slice(0, 3),
      cast: m.actors.slice(0, 6),
      runtime_minutes: null,
      seasons: null,
      original_language: null,
      watch_status: "wishlist",
      creator_note: null,
      wikidata_hint: null,
      wikipedia_page_en: null,
      external_title_hints: [],
      tags: item.tags,
      tag_confidence: m.confidence >= 0.8 ? "medium" : "low",
      synopsis_zh: synopsis,
      recommendation_zh: `来自豆瓣条目的新收录：《${m.chineseTitle}》。`,
      audience_fit: "见豆瓣简介自行判断。",
      audience_mismatch: "见豆瓣简介自行判断。",
      _imported_douban_id: m.doubanId,
      _imported_at: new Date().toISOString(),
    };

    imported.push(rec);
    existingRaw.add(key);
    item.status = "published";
    item.publishedKey = key;
    item.updatedAt = new Date().toISOString();
    published++;
  }

  fs.mkdirSync(path.dirname(IMPORTED_RAW), { recursive: true });
  const tmp = `${IMPORTED_RAW}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(imported, null, 2), "utf8");
  fs.renameSync(tmp, IMPORTED_RAW);
  writeQueue(store);

  return { published, skipped };
}
