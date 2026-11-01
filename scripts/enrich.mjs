#!/usr/bin/env node
/**
 * Fantasy Atlas — 外部资料补全管线 (Wikidata + IMDb 公开数据集)
 *
 * 只读 data/raw/catalog-*.json，只写 data/derived/ 与 data/cache/。
 * 不引第三方依赖，仅用 Node 内置模块。
 *
 * 用法:
 *   node scripts/enrich.mjs                 # 完整抓取
 *   node scripts/enrich.mjs --offline       # 只用本地缓存，不发网络请求
 *   node scripts/enrich.mjs --limit=5       # 只跑前 5 条（调试）
 *   node scripts/enrich.mjs --selftest      # 用内置 3 条样例，写到临时文件
 *   node scripts/enrich.mjs --out=xxx.json  # 自定义输出路径
 */

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import readline from 'node:readline';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';

// ─────────────────────────────────────────────────────────────
// 常量与路径
// ─────────────────────────────────────────────────────────────

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, '..');
const RAW_DIR = process.env.FA_CATALOG_DIR
  ? path.resolve(process.env.FA_CATALOG_DIR)
  : path.join(ROOT, 'data', 'raw');
const DERIVED_DIR = path.join(ROOT, 'data', 'derived');
const CACHE_DIR = path.join(ROOT, 'data', 'cache');
const WD_CACHE_DIR = path.join(CACHE_DIR, 'wikidata');
const IMDB_CACHE_DIR = path.join(CACHE_DIR, 'imdb');
const IMDB_TSV = path.join(IMDB_CACHE_DIR, 'title.ratings.tsv.gz');
const IMDB_META = path.join(IMDB_CACHE_DIR, 'title.ratings.meta.json');
const IMDB_URL = 'https://datasets.imdbws.com/title.ratings.tsv.gz';
const IMDB_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const WD_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const WD_API = 'https://www.wikidata.org/w/api.php';
const USER_AGENT =
  'FantasyAtlasEnricher/1.0 (https://github.com/fantasy-atlas; personal non-commercial project) node';

const RATE_LIMIT_MS = 120;
const MAX_RETRIES = 2;
const REQ_TIMEOUT_MS = 25000;

const FILM_LIKE = {
  Q11424: 'film',
  Q202866: 'animated film',
  Q5398426: 'television series',
  Q1259759: 'miniseries',
  Q24856: 'film series',
};

const MEDIA_TYPE_P31 = {
  movie: ['Q11424', 'Q202866'],
  series: ['Q5398426'],
  miniseries: ['Q1259759'],
};

const THRESHOLD_MATCHED = 0.8;
const THRESHOLD_MIN = 0.55;

const NOTE_LANGS = 'en|zh|ja|fr|es|de|it|ko|ru';

// ─────────────────────────────────────────────────────────────
// CLI
// ─────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const opts = {
    offline: false,
    limit: Infinity,
    out: path.join(DERIVED_DIR, 'enrichment.json'),
    selftest: false,
    quiet: false,
    maxCandidates: 4,
  };
  for (const a of argv) {
    if (a === '--offline') opts.offline = true;
    else if (a === '--selftest' || a === '--self-test') opts.selftest = true;
    else if (a === '--quiet') opts.quiet = true;
    else if (a === '--help' || a === '-h') opts.help = true;
    else if (a.startsWith('--limit=')) {
      const n = Number(a.slice('--limit='.length));
      if (!Number.isInteger(n) || n <= 0) throw new Error('--limit requires a positive integer');
      opts.limit = n;
    } else if (a.startsWith('--out=')) {
      opts.out = path.resolve(ROOT, a.slice('--out='.length));
    } else {
      throw new Error(`unknown argument: ${a}`);
    }
  }
  return opts;
}

const log = (...a) => console.log(...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const stats = { requests: 0, cacheHits: 0, retries: 0, failures: 0, wikidataErrors: 0 };

// ─────────────────────────────────────────────────────────────
// 磁盘缓存（按 URL 哈希）
// ─────────────────────────────────────────────────────────────

function cacheKeyFor(url) {
  return crypto.createHash('sha1').update(url).digest('hex');
}

async function readCacheEntry(url, ttlMs) {
  const file = path.join(WD_CACHE_DIR, cacheKeyFor(url) + '.json');
  try {
    const raw = await fsp.readFile(file, 'utf8');
    const entry = JSON.parse(raw);
    if (!entry || typeof entry !== 'object' || !entry.body) return null;
    const age = Date.now() - Date.parse(entry.fetched_at);
    const fresh = Number.isFinite(age) && age >= 0 && age < ttlMs;
    return { body: entry.body, fetched_at: entry.fetched_at, fresh, file };
  } catch {
    return null;
  }
}

async function writeCacheEntry(url, body) {
  const file = path.join(WD_CACHE_DIR, cacheKeyFor(url) + '.json');
  const entry = { url, fetched_at: new Date().toISOString(), body };
  await fsp.mkdir(WD_CACHE_DIR, { recursive: true });
  const tmp = file + '.' + process.pid + '.tmp';
  await fsp.writeFile(tmp, JSON.stringify(entry));
  await fsp.rename(tmp, file);
}

// ─────────────────────────────────────────────────────────────
// 网络层：限速 + 指数退避重试 + 缓存
// ─────────────────────────────────────────────────────────────

async function fetchJson(url, { offline, ttlMs = WD_TTL_MS } = {}) {
  const cached = await readCacheEntry(url, ttlMs);

  if (offline) {
    if (cached) {
      stats.cacheHits++;
      return { ok: true, body: cached.body, fromCache: true, stale: !cached.fresh };
    }
    return { ok: false, error: 'offline: no cached response', body: null };
  }

  if (cached && cached.fresh) {
    stats.cacheHits++;
    return { ok: true, body: cached.body, fromCache: true, stale: false };
  }

  let lastErr = null;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      const backoff = 600 * Math.pow(2, attempt - 1);
      stats.retries++;
      await sleep(backoff);
    }
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'application/json',
          'Accept-Encoding': 'gzip',
        },
        signal: AbortSignal.timeout(REQ_TIMEOUT_MS),
      });
      stats.requests++;

      if (res.status === 429 || res.status >= 500) {
        const ra = Number(res.headers.get('retry-after'));
        lastErr = new Error(`HTTP ${res.status}`);
        if (Number.isFinite(ra) && ra > 0) await sleep(Math.min(ra * 1000, 8000));
        continue;
      }
      if (!res.ok) {
        lastErr = new Error(`HTTP ${res.status}`);
        const txt = await res.text().catch(() => '');
        lastErr.body = txt.slice(0, 300);
        break;
      }
      const body = await res.json();
      if (body && body.error) {
        const code = `${body.error.code || ''} ${body.error.info || ''}`;
        lastErr = new Error(`wikidata error: ${body.error.code || body.error.info}`);
        stats.wikidataErrors++;
        // 搜索后端偶发过载：这类错误值得重试，其它 API 错误直接放弃
        if (/cirrussearch|too.?busy|ratelimit|timeout|maxlag|backend/i.test(code)) continue;
        break;
      }
      await writeCacheEntry(url, body);
      return { ok: true, body, fromCache: false, stale: false };
    } catch (e) {
      lastErr = e;
    } finally {
      await sleep(RATE_LIMIT_MS);
    }
  }

  stats.failures++;
  if (cached) {
    stats.cacheHits++;
    return {
      ok: true,
      body: cached.body,
      fromCache: true,
      stale: true,
      error: String(lastErr && lastErr.message),
    };
  }
  return { ok: false, error: String(lastErr && lastErr.message), body: null };
}

// ─────────────────────────────────────────────────────────────
// Wikidata API 封装
// ─────────────────────────────────────────────────────────────

function qs(params) {
  return Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
}

async function searchEntities(term, opts) {
  const url = `${WD_API}?${qs({
    action: 'wbsearchentities',
    search: term,
    language: 'en',
    uselang: 'en',
    format: 'json',
    limit: 10,
    type: 'item',
  })}`;
  const r = await fetchJson(url, opts);
  if (!r.ok || !r.body) return { hits: [], error: r.error };
  if (r.body.error) return { hits: [], error: r.body.error.code || r.body.error.info };
  const hits = (r.body.search || [])
    .filter((h) => /^Q\d+$/.test(h.id || ''))
    .map((h) => ({
      id: h.id,
      label: h.label || '',
      description: h.description || '',
    }));
  return { hits, stale: r.stale };
}

async function getEntities(ids, { props = 'claims|labels', languages = 'en|zh', sitefilter = '', ...opts } = {}) {
  const out = new Map();
  const unique = [...new Set(ids)].filter((id) => /^Q\d+$/.test(id));
  for (let i = 0; i < unique.length; i += 50) {
    const chunk = unique.slice(i, i + 50);
    const params = {
      action: 'wbgetentities',
      ids: chunk.join('|'),
      props,
      languages,
      format: 'json',
    };
    if (sitefilter) params.sitefilter = sitefilter;
    const r = await fetchJson(`${WD_API}?${qs(params)}`, opts);
    if (!r.ok || !r.body || !r.body.entities) continue;
    for (const [id, ent] of Object.entries(r.body.entities)) {
      if (ent && !ent.missing) out.set(id, ent);
    }
  }
  return out;
}

async function getCountryCode(qid, opts) {
  const url = `${WD_API}?${qs({ action: 'wbgetclaims', entity: qid, property: 'P297', format: 'json' })}`;
  const r = await fetchJson(url, opts);
  if (!r.ok || !r.body || !r.body.claims) return null;
  for (const c of r.body.claims.P297 || []) {
    const v = c.mainsnak && c.mainsnak.datavalue && c.mainsnak.datavalue.value;
    if (typeof v === 'string' && /^[A-Z]{2}$/.test(v)) return v;
  }
  return null;
}

// ─────────────────────────────────────────────────────────────
// 标题规范化与相似度
// ─────────────────────────────────────────────────────────────

function fold(s) {
  return String(s ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/['\u2019\u2018`\u00b4]/g, '')
    .replace(/[^a-z0-9\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** 去掉冠词 / 括号注解 / 副标题后的若干变体 */
function titleVariants(title) {
  const base = String(title ?? '');
  const noParen = base.replace(/[([\uff08\u3010][^)\]\uff09\u3011]*[)\]\uff09\u3011]/g, ' ');
  const noSub = noParen.split(/\s*[:\uff1a]\s*/)[0];
  const noDash = noSub.split(/\s+[-\u2013\u2014]\s+/)[0];
  const out = new Set();
  for (const raw of [base, noParen, noSub, noDash]) {
    const f = fold(raw);
    if (!f) continue;
    out.add(f);
    out.add(f.replace(/^(the|a|an)\s+/, ''));
  }
  return [...out].filter(Boolean);
}

function titleMatchKind(candidateTitle, originalTitle) {
  const a = fold(candidateTitle);
  const b = fold(originalTitle);
  if (!a || !b) return { kind: 'none', bonus: 0 };
  if (a === b) return { kind: 'exact', bonus: 0.2 };
  const va = titleVariants(candidateTitle);
  const vb = titleVariants(originalTitle);
  for (const x of va) {
    for (const y of vb) {
      if (x === y) return { kind: 'similar', bonus: 0.1 };
      if (x.length >= 8 && y.length >= 8 && (x.includes(y) || y.includes(x))) {
        return { kind: 'similar', bonus: 0.1 };
      }
    }
  }
  return { kind: 'none', bonus: 0 };
}

// ─────────────────────────────────────────────────────────────
// 声明（claims）读取
// ─────────────────────────────────────────────────────────────

function claimStatements(entity, prop) {
  const arr = (entity && entity.claims && entity.claims[prop]) || [];
  return arr.filter(
    (c) => c && c.rank !== 'deprecated' && c.mainsnak && c.mainsnak.snaktype === 'value' && c.mainsnak.datavalue,
  );
}

function claimItemIds(entity, prop) {
  const ids = [];
  for (const c of claimStatements(entity, prop)) {
    const v = c.mainsnak.datavalue.value;
    if (v && v['entity-type'] === 'item' && /^Q\d+$/.test(v.id || '')) ids.push(v.id);
  }
  return [...new Set(ids)];
}

function parseWdTime(value) {
  if (!value || typeof value.time !== 'string') return null;
  const m = /^([+-])(\d{4})-(\d{2})-(\d{2})T/.exec(value.time);
  if (!m) return null;
  const year = Number(m[2]) * (m[1] === '-' ? -1 : 1);
  const month = Number(m[3]);
  const day = Number(m[4]);
  const precision = typeof value.precision === 'number' ? value.precision : 11;
  return { year, month, day, precision };
}

function claimDates(entity, prop) {
  const out = [];
  for (const c of claimStatements(entity, prop)) {
    const d = parseWdTime(c.mainsnak.datavalue.value);
    if (d) out.push({ ...d, rank: c.rank || 'normal' });
  }
  return out;
}

function claimQuantity(entity, prop) {
  for (const c of claimStatements(entity, prop)) {
    const dv = c.mainsnak.datavalue;
    const v = dv && dv.value;
    if (!dv || dv.type !== 'quantity' || !v || typeof v.amount !== 'string') continue;
    const n = Number(v.amount);
    if (!Number.isFinite(n)) continue;
    const unit = String(v.unit || '');
    if (unit === '1') continue;
    return { value: Math.abs(n), unit, unitQid: (unit.match(/Q\d+$/) || [])[0] || '' };
  }
  return null;
}

function claimString(entity, prop) {
  for (const c of claimStatements(entity, prop)) {
    const v = c.mainsnak.datavalue.value;
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return null;
}

// ─────────────────────────────────────────────────────────────
// P31 类型归一化
// ─────────────────────────────────────────────────────────────

const typeClassCache = new Map();

async function classifyTypes(ids, opts) {
  const missing = ids.filter((id) => !typeClassCache.has(id));
  if (missing.length) {
    const ents = await getEntities(missing, { props: 'claims|labels', languages: 'en', ...opts });
    for (const id of missing) {
      const ent = ents.get(id);
      if (!ent) {
        typeClassCache.set(id, { label: '', filmLikeId: null });
        continue;
      }
      const label = (ent.labels && ent.labels.en && ent.labels.en.value) || '';
      let filmLikeId = FILM_LIKE[id] ? id : null;
      if (!filmLikeId) {
        for (const parent of claimItemIds(ent, 'P279')) {
          if (FILM_LIKE[parent]) {
            filmLikeId = parent;
            break;
          }
        }
      }
      typeClassCache.set(id, { label, filmLikeId });
    }
  }
  return ids.map((id) => ({ id, ...(typeClassCache.get(id) || { label: '', filmLikeId: null }) }));
}

// ─────────────────────────────────────────────────────────────
// 候选打分
// ─────────────────────────────────────────────────────────────

function scoreCandidate(rec, entity, typeInfo = new Map()) {
  const notes = [];
  let conf = 0;

  const typeIds = claimItemIds(entity, 'P31');
  const filmLikeIds = typeIds
    .map((t) => (typeInfo.get(t) ? typeInfo.get(t).filmLikeId : FILM_LIKE[t] ? t : null))
    .filter(Boolean);
  const typeHit = filmLikeIds[0] || null;
  if (typeHit) {
    conf += 0.35;
  } else if (typeIds.length) {
    const shown = typeIds
      .slice(0, 2)
      .map((t) => (typeInfo.get(t) && typeInfo.get(t).label) || t)
      .join('|');
    notes.push(`p31 not film-like (${shown})`);
  } else {
    notes.push('no P31');
  }

  const dates = claimDates(entity, 'P577');
  const years = dates.map((d) => d.year);
  let yearDelta = null;
  if (!years.length) {
    notes.push('no release date');
  } else if (years.includes(rec.release_year)) {
    conf += 0.35;
    yearDelta = 0;
  } else {
    const min = Math.min(...years.map((y) => Math.abs(y - rec.release_year)));
    yearDelta = min;
    if (min === 1) conf += 0.2;
    else notes.push(`year mismatch (wikidata ${years.slice(0, 4).join('/')} vs catalog ${rec.release_year})`);
  }

  const labels = Object.values(entity.labels || {})
    .map((l) => l && l.value)
    .filter(Boolean);
  let best = { kind: 'none', bonus: 0 };
  for (const l of labels) {
    const m = titleMatchKind(l, rec.original_title);
    if (m.bonus > best.bonus) best = m;
  }
  if (best.bonus > 0) conf += best.bonus;
  else notes.push('title mismatch');

  if (typeHit) {
    const accepted = MEDIA_TYPE_P31[rec.media_type] || [];
    if (accepted.includes(typeHit)) conf += 0.1;
    else notes.push(`media_type mismatch (wikidata ${FILM_LIKE[typeHit]} vs catalog ${rec.media_type})`);
  }

  conf = Math.min(1, conf);
  if (yearDelta !== null && yearDelta >= 2) conf *= 0.5;

  return { score: Math.round(conf * 100) / 100, notes, yearDelta, typeHit, labelKind: best.kind };
}

/** 搜索阶段粗排，决定对哪些候选真正去拉 claims */
function preRank(hit, rec, aliases) {
  const desc = (hit.description || '').toLowerCase();
  let s = 0;
  if (/\bfilm\b|\bmovie\b|television series|miniseries|tv series/.test(desc)) s += 0.5;
  if (desc.includes(String(rec.release_year))) s += 0.3;
  const k = titleMatchKind(hit.label, rec.original_title).kind;
  if (k === 'exact') s += 0.4;
  else if (k === 'similar') s += 0.2;
  for (const a of aliases) {
    if (titleMatchKind(hit.label, a).kind === 'exact') s += 0.3;
  }
  return s;
}

// ─────────────────────────────────────────────────────────────
// catalog 读取
// ─────────────────────────────────────────────────────────────

async function discoverCatalogFiles() {
  let names = [];
  try {
    names = await fsp.readdir(RAW_DIR);
  } catch {
    return [];
  }
  const files = names
    .filter((n) => /^catalog-.*\.json$/i.test(n))
    .sort((a, b) => a.localeCompare(b))
    .map((n) => path.join(RAW_DIR, n));
  const out = [];
  for (const f of files) {
    try {
      const raw = await fsp.readFile(f, 'utf8');
      const data = JSON.parse(raw);
      if (!Array.isArray(data)) {
        log(`! ${path.basename(f)} top-level is not an array, skipped`);
        continue;
      }
      out.push({ file: f, name: path.basename(f), records: data });
    } catch (e) {
      log(`! ${path.basename(f)} parse failed (maybe being written), skipped: ${e.message}`);
    }
  }
  return out;
}

function validateRecord(rec) {
  if (!rec || typeof rec !== 'object') return 'not an object';
  if (typeof rec.catalog_key !== 'string' || !rec.catalog_key.trim()) return 'missing catalog_key';
  if (typeof rec.original_title !== 'string' || !rec.original_title.trim()) return 'missing original_title';
  if (!Number.isInteger(rec.release_year)) return 'release_year not an integer';
  if (!['movie', 'series', 'miniseries'].includes(rec.media_type)) return 'bad media_type';
  return null;
}

// ─────────────────────────────────────────────────────────────
// 匹配一条记录
// ─────────────────────────────────────────────────────────────

async function matchRecord(rec, ctx) {
  const aliases = Array.isArray(rec.external_title_hints) ? rec.external_title_hints.filter(Boolean) : [];
  const tried = [];
  const found = new Map();

  const addHits = (hits, via) => {
    for (const h of hits) {
      if (!found.has(h.id)) {
        found.set(h.id, { id: h.id, label: h.label, description: h.description || '', via });
      }
    }
  };

  let searchError = null;
  if (rec.wikidata_hint && /^Q\d+$/.test(rec.wikidata_hint)) {
    found.set(rec.wikidata_hint, { id: rec.wikidata_hint, label: '', description: '', via: 'hint' });
  } else {
    const s1 = await searchEntities(rec.original_title, ctx.opts);
    tried.push(`search:"${rec.original_title}"=${s1.hits.length}`);
    if (s1.error) {
      searchError = s1.error;
      ctx.searchErrors.push({ key: rec.catalog_key, reason: s1.error });
    }
    addHits(s1.hits, 'title');

    if (s1.hits.length < 3) {
      for (const alias of aliases) {
        if (!alias || fold(alias) === fold(rec.original_title)) continue;
        const s2 = await searchEntities(alias, ctx.opts);
        tried.push(`search:"${alias}"=${s2.hits.length}`);
        if (s2.error && !searchError) {
          searchError = s2.error;
          ctx.searchErrors.push({ key: rec.catalog_key, reason: s2.error });
        }
        addHits(s2.hits, 'alias');
        if (found.size >= 6) break;
      }
    }
  }

  if (!found.size) {
    const note = searchError ? `wikidata search failed: ${searchError}` : 'no wikidata candidate';
    return { best: null, scored: [], notes: [note], tried };
  }

  const ranked = [...found.values()]
    .map((c) => ({ ...c, pre: preRank({ label: c.label, description: c.description }, rec, aliases) }))
    .sort((a, b) => b.pre - a.pre || a.id.localeCompare(b.id));

  const hintEntry = [...found.values()].find((c) => c.via === 'hint');
  const shortlist = [];
  if (hintEntry) shortlist.push(hintEntry);
  for (const c of ranked) {
    if (shortlist.length >= ctx.opts.maxCandidates + (hintEntry ? 1 : 0)) break;
    if (!shortlist.some((x) => x.id === c.id)) shortlist.push(c);
  }

  const entities = await getEntities(
    shortlist.map((c) => c.id),
    { props: 'claims|labels', languages: NOTE_LANGS, ...ctx.opts },
  );

  const allTypeIds = [];
  for (const c of shortlist) {
    const ent = entities.get(c.id);
    if (!ent) continue;
    for (const t of claimItemIds(ent, 'P31')) if (!allTypeIds.includes(t)) allTypeIds.push(t);
  }
  const typeList = allTypeIds.length ? await classifyTypes(allTypeIds, ctx.opts) : [];
  const typeInfo = new Map(typeList.map((t) => [t.id, t]));

  const scored = [];
  for (const c of shortlist) {
    const ent = entities.get(c.id);
    if (!ent) continue;
    const s = scoreCandidate(rec, ent, typeInfo);
    scored.push({
      id: c.id,
      label: (ent.labels && ent.labels.en && ent.labels.en.value) || c.label || '',
      score: s.score,
      via: c.via,
      notes: s.notes,
      yearDelta: s.yearDelta,
      typeHit: s.typeHit,
      labelKind: s.labelKind,
      entity: ent,
    });
  }

  scored.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  const notes = scored.length ? [] : ['candidate entities unavailable (wikidata fetch failed or offline cache miss)'];
  return { best: scored[0] || null, scored, notes, tried };
}

// ─────────────────────────────────────────────────────────────
// IMDb 公开数据集
// ─────────────────────────────────────────────────────────────

async function getFileAgeMs(file) {
  try {
    const st = await fsp.stat(file);
    return Date.now() - st.mtimeMs;
  } catch {
    return Infinity;
  }
}

async function ensureImdbDataset(opts) {
  await fsp.mkdir(IMDB_CACHE_DIR, { recursive: true });
  const age = await getFileAgeMs(IMDB_TSV);
  const exists = Number.isFinite(age);
  const fresh = exists && age < IMDB_TTL_MS;

  if (opts.offline) {
    return exists
      ? { ok: true, path: IMDB_TSV, fresh, note: fresh ? null : 'offline: using cached IMDb dataset' }
      : { ok: false, note: 'offline: no cached IMDb dataset' };
  }
  if (fresh) return { ok: true, path: IMDB_TSV, fresh: true, note: null };

  const tmp = IMDB_TSV + '.part';
  try {
    log(`  downloading IMDb dataset (${exists ? 'cache expired' : 'first run'}) ...`);
    const t0 = Date.now();
    const res = await fetch(IMDB_URL, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(180000),
    });
    stats.requests++;
    if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
    await pipeline(Readable.fromWeb(res.body), fs.createWriteStream(tmp));
    const sz = (await fsp.stat(tmp)).size;
    if (sz < 1_000_000) throw new Error(`downloaded file too small (${sz} bytes)`);
    await fsp.rename(tmp, IMDB_TSV);
    await fsp.writeFile(
      IMDB_META,
      JSON.stringify(
        {
          url: IMDB_URL,
          fetched_at: new Date().toISOString(),
          bytes: sz,
          etag: res.headers.get('etag') || null,
          last_modified: res.headers.get('last-modified') || null,
        },
        null,
        2,
      ),
    );
    log(`  ok ${(sz / 1024 / 1024).toFixed(1)}MB in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
    return { ok: true, path: IMDB_TSV, fresh: true, note: null };
  } catch (e) {
    await fsp.rm(tmp, { force: true }).catch(() => {});
    if (exists) {
      return { ok: true, path: IMDB_TSV, fresh: false, note: `IMDb dataset download failed, using stale cache (${e.message})` };
    }
    return { ok: false, note: `IMDb dataset unavailable: ${e.message}` };
  }
}

/** 流式扫描 gz，只保留需要的 tconst */
async function readImdbRatings(file, wanted) {
  const found = new Map();
  let skipped = 0;
  const input = fs.createReadStream(file).pipe(zlib.createGunzip());
  const rl = readline.createInterface({ input, crlfDelay: Infinity });
  try {
    for await (const line of rl) {
      if (!line) continue;
      if (line.startsWith('tconst')) continue;
      const i1 = line.indexOf('\t');
      if (i1 <= 0) {
        skipped++;
        continue;
      }
      const tconst = line.slice(0, i1);
      if (!wanted.has(tconst)) continue;
      const i2 = line.indexOf('\t', i1 + 1);
      if (i2 < 0) {
        skipped++;
        continue;
      }
      const avg = Number(line.slice(i1 + 1, i2));
      const votes = Number(line.slice(i2 + 1));
      if (!Number.isFinite(avg)) {
        skipped++;
        continue;
      }
      found.set(tconst, { rating: avg, votes: Number.isFinite(votes) ? votes : null });
      if (found.size === wanted.size) break;
    }
  } finally {
    rl.close();
    input.destroy();
  }
  return { found, skipped };
}

// ─────────────────────────────────────────────────────────────
// 输出记录
// ─────────────────────────────────────────────────────────────

function emptyEntry() {
  return {
    wikidata_id: null,
    imdb_id: null,
    match: { method: 'none', confidence: 0, review_status: 'unmatched', candidates: [] },
    facts: { director: [], cast: [], country: [], runtime_minutes: null, release_date: null },
    ratings: [],
    links: { wikidata: null, imdb: null, wikipedia_en: null, wikipedia_zh: null },
    notes: '',
  };
}

function pickReleaseDate(entity, releaseYear) {
  const dates = claimDates(entity, 'P577').filter((d) => d.precision >= 11 && d.month >= 1 && d.day >= 1);
  if (!dates.length) return null;
  const sameYear = dates.filter((d) => d.year === releaseYear);
  const chosen = (sameYear.length ? sameYear : dates)[0];
  const mm = String(chosen.month).padStart(2, '0');
  const dd = String(chosen.day).padStart(2, '0');
  return `${String(chosen.year).padStart(4, '0')}-${mm}-${dd}`;
}

// ─────────────────────────────────────────────────────────────
// 内置自测样例（仅在 --selftest 时使用）
// ─────────────────────────────────────────────────────────────

function sampleBase(over) {
  return {
    catalog_key: null,
    chinese_title: '',
    original_title: '',
    release_year: null,
    media_type: 'movie',
    format: 'live_action',
    franchise: null,
    franchise_name: null,
    series_order: null,
    country: [],
    director: [],
    cast: [],
    runtime_minutes: null,
    seasons: null,
    original_language: 'en',
    watch_status: 'unknown',
    creator_note: null,
    wikidata_hint: null,
    external_title_hints: [],
    tags: { type: [], world: [], aesthetic: [], element: [], mood: [], exclude: [] },
    tag_confidence: 'low',
    synopsis_zh: '',
    recommendation_zh: '',
    audience_fit: '',
    audience_mismatch: '',
    ...over,
  };
}

const SELFTEST_RECORDS = [
  sampleBase({
    catalog_key: 'selftest-harry-potter-1',
    chinese_title: '哈利·波特与魔法石',
    original_title: "Harry Potter and the Philosopher's Stone",
    release_year: 2001,
    franchise: 'harry-potter',
    franchise_name: '哈利·波特系列',
    series_order: 1,
    external_title_hints: ["Harry Potter and the Sorcerer's Stone"],
  }),
  sampleBase({
    catalog_key: 'selftest-lotr-fellowship',
    chinese_title: '指环王：护戒使者',
    original_title: 'The Lord of the Rings: The Fellowship of the Ring',
    release_year: 2001,
    franchise: 'the-lord-of-the-rings',
    franchise_name: '指环王系列',
    series_order: 1,
    external_title_hints: ['The Fellowship of the Ring'],
  }),
  sampleBase({
    catalog_key: 'selftest-spirited-away',
    chinese_title: '千与千寻',
    original_title: 'Spirited Away',
    release_year: 2001,
    format: 'animation',
    original_language: 'ja',
    external_title_hints: ['Sen to Chihiro no Kamikakushi'],
  }),
];

// ─────────────────────────────────────────────────────────────
// 主流程
// ─────────────────────────────────────────────────────────────

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    log('usage: node scripts/enrich.mjs [--offline] [--limit=N] [--selftest] [--out=path] [--quiet]');
    return;
  }

  const tStart = Date.now();
  await fsp.mkdir(DERIVED_DIR, { recursive: true });
  await fsp.mkdir(WD_CACHE_DIR, { recursive: true });
  await fsp.mkdir(IMDB_CACHE_DIR, { recursive: true });

  let catalogFiles = [];
  let inputMode = 'catalog';
  if (opts.selftest) {
    inputMode = 'selftest';
    catalogFiles = [{ file: '<builtin>', name: 'builtin-selftest', records: SELFTEST_RECORDS }];
    if (!process.argv.some((a) => a.startsWith('--out='))) {
      opts.out = path.join(DERIVED_DIR, 'enrichment.selftest.json');
    }
  } else {
    catalogFiles = await discoverCatalogFiles();
    if (!catalogFiles.length) {
      log(`no catalog-*.json under ${path.relative(ROOT, RAW_DIR) || '.'}; writing empty result.`);
      log('hint: use --selftest to validate the pipeline with 3 builtin samples.');
    }
  }

  const records = [];
  const seen = new Set();
  for (const cf of catalogFiles) {
    for (const rec of cf.records) {
      const bad = validateRecord(rec);
      if (bad) {
        log(`! ${cf.name}: skip one invalid record (${bad})`);
        continue;
      }
      if (seen.has(rec.catalog_key)) {
        log(`! duplicate catalog_key "${rec.catalog_key}" in ${cf.name}, keeping the first one`);
        continue;
      }
      seen.add(rec.catalog_key);
      records.push({ rec, source: cf.name });
    }
  }

  const total = records.length;
  const toProcess = records.slice(0, Number.isFinite(opts.limit) ? opts.limit : records.length);

  log(`Fantasy Atlas enrichment — ${inputMode} mode${opts.offline ? ' / offline' : ''}`);
  log(`catalog files: ${catalogFiles.length}, records: ${total}, processing: ${toProcess.length}`);
  log('-'.repeat(72));

  const ctx = { opts, searchErrors: [] };
  const results = [];
  let i = 0;
  for (const item of toProcess) {
    i++;
    let m;
    try {
      m = await matchRecord(item.rec, ctx);
    } catch (e) {
      m = { best: null, scored: [], notes: [`wikidata error: ${e.message}`], tried: [] };
      stats.wikidataErrors++;
    }
    results.push({ ...item, ...m });
    if (!opts.quiet && (i % 10 === 0 || i === toProcess.length)) {
      log(`   . ${i}/${toProcess.length} searched (${((Date.now() - tStart) / 1000).toFixed(0)}s)`);
    }
  }

  // 冲突去重
  const byQid = new Map();
  for (const r of results) {
    if (!r.best) continue;
    const list = byQid.get(r.best.id) || [];
    list.push(r);
    byQid.set(r.best.id, list);
  }
  const conflicts = new Map();
  for (const [qid, list] of byQid) {
    if (list.length < 2) continue;
    list.sort(
      (a, b) => b.best.score - a.best.score || String(a.rec.catalog_key).localeCompare(String(b.rec.catalog_key)),
    );
    for (const loser of list.slice(1)) {
      conflicts.set(
        loser.rec.catalog_key,
        `wikidata id conflict (${qid} already used by ${list[0].rec.catalog_key})`,
      );
    }
  }

  const winners = results.filter(
    (r) => r.best && r.best.score >= THRESHOLD_MIN && !conflicts.has(r.rec.catalog_key),
  );

  const referenced = new Set();
  const winnerQids = winners.map((r) => r.best.id);
  for (const r of winners) {
    for (const p of ['P57', 'P161', 'P495', 'P136', 'P179']) {
      for (const id of claimItemIds(r.best.entity, p)) referenced.add(id);
    }
  }
  for (const id of winnerQids) referenced.delete(id);

  const labelMap = new Map();
  if (referenced.size) {
    log(`   resolving ${referenced.size} related entity labels ...`);
    const ents = await getEntities([...referenced], {
      props: 'labels|sitelinks',
      languages: 'en|zh',
      sitefilter: 'enwiki',
      ...opts,
    });
    for (const [id, ent] of ents) {
      const en = ent.labels && ent.labels.en && ent.labels.en.value;
      // 少数演员条目没有英文 label，退用英维条目名（同一实体的官方英文名）
      const sitelink = ent.sitelinks && ent.sitelinks.enwiki && ent.sitelinks.enwiki.title;
      const anyLabel = Object.values(ent.labels || {})
        .map((l) => l && l.value)
        .filter(Boolean)[0];
      const chosen = en || sitelink || anyLabel || '';
      if (chosen) labelMap.set(id, chosen);
    }
  }

  const countryQids = new Set();
  for (const r of winners) for (const id of claimItemIds(r.best.entity, 'P495')) countryQids.add(id);
  const countryCodes = new Map();
  for (const qid of countryQids) {
    const code = await getCountryCode(qid, opts);
    if (code) countryCodes.set(qid, code);
  }

  const sitelinks = new Map();
  if (winnerQids.length) {
    log(`   fetching wikipedia links for ${winnerQids.length} items ...`);
    const ents = await getEntities(winnerQids, {
      props: 'sitelinks',
      languages: 'en',
      sitefilter: 'enwiki|zhwiki',
      ...opts,
    });
    for (const [id, ent] of ents) {
      const sl = ent.sitelinks || {};
      sitelinks.set(id, {
        en: sl.enwiki && sl.enwiki.title ? sl.enwiki.title : null,
        zh: sl.zhwiki && sl.zhwiki.title ? sl.zhwiki.title : null,
      });
    }
  }

  // 组装
  const outRecords = {};
  const unmatched = [];
  const reviewList = [];

  for (const r of results) {
    const rec = r.rec;
    const entry = emptyEntry();
    const noteList = [];
    if (r.notes && r.notes.length) noteList.push(...r.notes);

    const b = r.best;
    if (!b) {
      entry.match = {
        method: 'none',
        confidence: 0,
        review_status: 'unmatched',
        candidates: (r.scored || []).slice(0, 3).map((c) => ({ id: c.id, label: c.label, score: c.score })),
      };
      if (!noteList.length) noteList.push('no wikidata candidate');
      entry.notes = [...new Set(noteList)].join('; ');
      outRecords[rec.catalog_key] = entry;
      unmatched.push(rec.catalog_key);
      continue;
    }

    const candidates = (r.scored || []).slice(0, 3).map((c) => ({ id: c.id, label: c.label, score: c.score }));
    const conf = b.score;
    const status = conf >= THRESHOLD_MATCHED ? 'matched' : conf >= THRESHOLD_MIN ? 'needs_review' : 'unmatched';
    const method =
      b.via === 'hint' ? 'wikidata-hint' : b.via === 'alias' ? 'wikidata-alias+year' : 'wikidata-label+year';

    entry.match = { method, confidence: conf, review_status: status, candidates };
    if (b.notes && b.notes.length) noteList.push(...b.notes);

    if (conflicts.has(rec.catalog_key)) {
      noteList.push(conflicts.get(rec.catalog_key));
      entry.match.review_status = 'needs_review';
      entry.notes = [...new Set(noteList)].join('; ');
      outRecords[rec.catalog_key] = entry;
      reviewList.push({ key: rec.catalog_key, status: 'needs_review', conf, notes: entry.notes });
      continue;
    }

    if (status !== 'unmatched') {
      const ent = b.entity;
      entry.wikidata_id = b.id;

      const dir = claimItemIds(ent, 'P57')
        .slice(0, 3)
        .map((id) => labelMap.get(id))
        .filter(Boolean);
      const cast = claimItemIds(ent, 'P161')
        .slice(0, 10)
        .map((id) => labelMap.get(id))
        .filter(Boolean);
      const cIds = claimItemIds(ent, 'P495').slice(0, 6);
      const countries = cIds.map((id) => countryCodes.get(id)).filter(Boolean);
      if (cIds.length && !countries.length) noteList.push('country codes unresolved');

      const rt = claimQuantity(ent, 'P2047');
      let runtime = null;
      if (rt && (rt.unitQid === 'Q7727' || !rt.unitQid)) {
        const v = Math.round(rt.value);
        if (v > 0 && v <= 1200) runtime = v;
      }

      entry.facts = {
        director: dir,
        cast,
        country: [...new Set(countries)],
        runtime_minutes: runtime,
        release_date: pickReleaseDate(ent, rec.release_year),
      };
      if (!dir.length) noteList.push('no director in wikidata');
      if (!cast.length) noteList.push('no cast in wikidata');
      if (!entry.facts.release_date && claimDates(ent, 'P577').length) {
        noteList.push('wikidata release date is year-only');
      }
      // 剧集的 P2047 常被写成整季总时长，标注出来交给人判断
      if (rec.media_type !== 'movie' && runtime) {
        noteList.push(`series runtime ${runtime}min from P2047 (may be season total)`);
      }

      const imdbRaw = claimString(ent, 'P345');
      if (imdbRaw && /^tt\d{7,10}$/.test(imdbRaw)) entry.imdb_id = imdbRaw;
      else if (imdbRaw) noteList.push('malformed P345');

      entry.links.wikidata = `https://www.wikidata.org/wiki/${b.id}`;
      entry.links.imdb = entry.imdb_id ? `https://www.imdb.com/title/${entry.imdb_id}/` : null;
      const sl = sitelinks.get(b.id) || {};
      entry.links.wikipedia_en = sl.en
        ? `https://en.wikipedia.org/wiki/${encodeURI(sl.en.replace(/ /g, '_'))}`
        : null;
      entry.links.wikipedia_zh = sl.zh
        ? `https://zh.wikipedia.org/wiki/${encodeURI(sl.zh.replace(/ /g, '_'))}`
        : null;

      if (status === 'needs_review') noteList.push(`low confidence (${conf.toFixed(2)})`);
    } else {
      if (!noteList.length) noteList.push(`low confidence (${conf.toFixed(2)})`);
      unmatched.push(rec.catalog_key);
    }

    entry.notes = [...new Set(noteList)].join('; ');
    outRecords[rec.catalog_key] = entry;
    if (entry.match.review_status !== 'matched') {
      reviewList.push({ key: rec.catalog_key, status: entry.match.review_status, conf, notes: entry.notes });
    }
  }

  // IMDb 评分
  const imdbIds = new Map();
  for (const [key, e] of Object.entries(outRecords)) {
    if (!e.imdb_id) continue;
    const list = imdbIds.get(e.imdb_id) || [];
    list.push(key);
    imdbIds.set(e.imdb_id, list);
  }

  const generatedAt = new Date().toISOString();
  let ratingsCovered = 0;
  let imdbNote = null;

  if (imdbIds.size) {
    const ds = await ensureImdbDataset(opts);
    if (!ds.ok) {
      imdbNote = ds.note || 'IMDb dataset unavailable';
      log(`  ! ${imdbNote}`);
      for (const keys of imdbIds.values()) {
        for (const k of keys) {
          outRecords[k].notes = [outRecords[k].notes, 'imdb ratings unavailable'].filter(Boolean).join('; ');
        }
      }
    } else {
      log(`   scanning IMDb dataset (${imdbIds.size} tconsts wanted) ...`);
      const t0 = Date.now();
      let found = new Map();
      try {
        const parsed = await readImdbRatings(ds.path, new Set(imdbIds.keys()));
        found = parsed.found;
        log(`  ok ${found.size}/${imdbIds.size} ratings in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
      } catch (e) {
        imdbNote = `IMDb dataset parse failed: ${e.message}`;
        log(`  ! ${imdbNote}`);
      }
      if (ds.note) imdbNote = imdbNote || ds.note;

      for (const [imdbId, keys] of imdbIds) {
        const hit = found.get(imdbId);
        if (!hit) {
          for (const k of keys) {
            outRecords[k].notes = [outRecords[k].notes, 'imdb rating not in dataset'].filter(Boolean).join('; ');
          }
          continue;
        }
        ratingsCovered += keys.length;
        for (const k of keys) {
          outRecords[k].ratings = [
            {
              source: 'IMDb',
              rating_value: hit.rating,
              rating_scale: 10,
              rating_count: hit.votes,
              source_url: `https://www.imdb.com/title/${imdbId}/`,
              last_checked_at: generatedAt,
              usage_status: 'personal-noncommercial-attribution-required',
            },
          ];
        }
      }
    }
  } else if (Object.keys(outRecords).length) {
    imdbNote = 'no imdb ids resolved';
  }

  const output = {
    generated_at: generatedAt,
    sources: {
      wikidata: {
        name: 'Wikidata',
        license: 'CC0 1.0',
        url: 'https://www.wikidata.org/',
        usage_status: 'free',
      },
      imdb: {
        name: 'IMDb public datasets',
        license: 'IMDb datasets — personal & non-commercial use only',
        url: 'https://datasets.imdbws.com/',
        usage_status: 'personal-noncommercial-attribution-required',
        attribution: 'Ratings data courtesy of IMDb (https://www.imdb.com/). Non-commercial use.',
      },
    },
    records: outRecords,
    unmatched,
  };

  await fsp.mkdir(path.dirname(opts.out), { recursive: true });
  const tmpOut = opts.out + '.' + process.pid + '.tmp';
  await fsp.writeFile(tmpOut, JSON.stringify(output, null, 2) + '\n');
  await fsp.rename(tmpOut, opts.out);

  if (!opts.quiet) {
    const all = Object.entries(outRecords);
    let n = 0;
    for (const [key, e] of all) {
      n++;
      if (!(all.length <= 10 || n % 10 === 0 || n === all.length)) continue;
      log(
        `[${n}/${all.length}] ${e.match.review_status} ${key} conf=${e.match.confidence.toFixed(2)} imdb=${
          e.imdb_id || '-'
        }`,
      );
    }
  }

  const keys = Object.keys(outRecords);
  const matched = keys.filter((k) => outRecords[k].match.review_status === 'matched').length;
  const needsReview = keys.filter((k) => outRecords[k].match.review_status === 'needs_review').length;
  const unmatchedCount = keys.filter((k) => outRecords[k].match.review_status === 'unmatched').length;
  const elapsed = (Date.now() - tStart) / 1000;

  log('-'.repeat(72));
  log('summary');
  log(`  records        : ${keys.length}`);
  log(`  matched        : ${matched}`);
  log(`  needs_review   : ${needsReview}`);
  log(`  unmatched      : ${unmatchedCount}`);
  log(`  ratings covered: ${ratingsCovered}/${keys.length}`);
  log(
    `  wikidata reqs  : ${stats.requests} (cache hits ${stats.cacheHits}, retries ${stats.retries}, failures ${stats.failures})`,
  );
  log(`  elapsed        : ${elapsed.toFixed(1)}s`);
  log(`  output         : ${path.relative(ROOT, opts.out)}`);
  if (reviewList.length) {
    log('human review queue:');
    for (const r of reviewList) log(`  - ${r.key} [${r.status}] ${r.notes}`);
  }
  if (imdbNote) log(`  note: ${imdbNote}`);
  if (ctx.searchErrors.length) {
    log(`  search failed  : ${ctx.searchErrors.length} time(s) (${ctx.searchErrors[0].reason})`);
  }
}

main().catch((e) => {
  console.error('FATAL', e && e.stack ? e.stack : e);
  process.exitCode = 1;
});
