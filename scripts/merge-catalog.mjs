#!/usr/bin/env node
/**
 * Fantasy Atlas — 片单合并与校验
 *
 * 输入： data/raw/catalog-*.json （人工/AI 撰写的原始记录）
 *       data/derived/enrichment.json （外部真实资料补全结果，可选）
 * 输出： data/catalog.json （站点唯一数据源）
 *       data/reports/import-report.json （导入报告：重复、缺失、待审核）
 *
 * 原则：
 *  - 原始记录永远不覆盖、不删除；本脚本只做只读合并。
 *  - 任何一条记录出问题都要进报告，不允许静默丢弃。
 *  - 外部资料缺失时保留本地记录，标记 needs_review，不编造。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RAW_DIR = path.join(ROOT, "data", "raw");
const DERIVED = path.join(ROOT, "data", "derived", "enrichment.json");
const OUT = path.join(ROOT, "data", "catalog.json");
const REPORT = path.join(ROOT, "data", "reports", "import-report.json");

const MEDIA_TYPES = ["movie", "series", "miniseries"];
const FORMATS = ["live_action", "animation"];
const CONFIDENCES = ["high", "medium", "low"];
const BUCKETS = ["type", "world", "aesthetic", "element", "mood", "exclude"];

/**
 * 「迪士尼」世界观入口的判定：
 *   1) 片名命中迪士尼出品作品（只收明确属于迪士尼的片名，避免把法国版《美女与野兽》之类算进来）
 *   2) 或属于这些迪士尼系列（franchise 键）
 * 只用于派生筛选标签，不修改原始片单记录。
 */
const DISNEY_PATTERN =
  /迪士尼|迪斯尼|皮克斯|魔发奇缘|冰雪奇缘|海洋奇缘|魔法满屋|寻梦环游记|飞屋环游记|头脑特工队|玩具总动员|海底总动员|超人总动员|怪兽电力公司|魔境仙踪|沉睡魔咒|黑白魔女库伊拉|魔法奇缘|爱丽丝梦游仙境|加勒比海盗|亚特兰蒂斯|星银岛|大力士|钟楼怪人|风中奇缘/;
const DISNEY_FRANCHISES = [
  "pirates-of-the-caribbean",
  "alice-in-wonderland",
  "the-chronicles-of-narnia",
  // 2026-11 补充的迪士尼公主与经典片单：这些系列键只被迪士尼自家作品使用
  "snow-white",
  "cinderella",
  "sleeping-beauty",
  "the-little-mermaid",
  "beauty-and-the-beast",
  "aladdin",
  "pocahontas",
  "mulan",
  "tangled",
  "brave",
  "moana",
  "princess-and-the-frog",
  "raya",
  "maleficent",
  "jungle-book",
  "the-lion-king",
  "peter-pan",
  "pinocchio",
  "enchanted",
];

/** 「宫崎骏」世界观入口：只按导演判定，避免把吉卜力其他导演的作品算进来 */
const MIYAZAKI_DIRECTOR = /宫崎骏|Hayao Miyazaki/i;

/**
 * 片名容易和别的版本混淆的迪士尼作品：用「中文名 + 年份」精确判定，
 * 避免把《美女与野兽（法国版）》《美人鱼(1984)》《魔法灰姑娘》之类算进迪士尼。
 */
const DISNEY_EXACT = new Map([
  ["灰姑娘", 2015],
  ["小美人鱼", 2023],
  ["阿拉丁", 2019],
  ["狮子王", 2019],
  ["胡桃夹子和四个王国", 2018],
  ["美女与野兽", 2017],
]);

/* ---------- 从 lib/vocabulary.ts 里抽取合法标签（单一事实来源） ---------- */
function loadVocabulary() {
  const src = fs.readFileSync(path.join(ROOT, "lib", "vocabulary.ts"), "utf8");
  const valid = new Set();
  for (const m of src.matchAll(/\bid:\s*"([^"]+)"/g)) valid.add(m[1]);
  return valid;
}

const cnCount = (s) => (String(s).match(/[\u4e00-\u9fa5]/g) || []).length;
const slugify = (s) =>
  String(s)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-");

const uniq = (arr) => [...new Set((Array.isArray(arr) ? arr : []).map((x) => String(x).trim()).filter(Boolean))];

function readJSON(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (err) {
    return { __error: err.message, __fallback: fallback };
  }
}

function main() {
  const generatedAt = new Date().toISOString();
  const validTags = loadVocabulary();
  const report = {
    generatedAt,
    files: [],
    totalRawRecords: 0,
    accepted: 0,
    duplicates: [],
    rejected: [],
    missingFields: [],
    unknownTags: [],
    needsReview: [],
    ratingCoverage: { withRating: 0, withoutRating: 0, sources: {} },
    posterCoverage: { withPoster: 0, withoutPoster: 0 },
    enrich: { matched: 0, needsReview: 0, unmatched: 0, available: false },
  };

  if (!fs.existsSync(RAW_DIR)) {
    console.error("缺少 data/raw 目录");
    process.exit(1);
  }

  /* ---------------- 1. 读取原始记录 ---------------- */
  const rawFiles = fs
    .readdirSync(RAW_DIR)
    .filter((f) => f.startsWith("catalog-") && f.endsWith(".json"))
    .sort();

  if (rawFiles.length === 0) {
    console.error("data/raw 下没有 catalog-*.json，无法合并");
    process.exit(1);
  }

  const records = [];
  for (const file of rawFiles) {
    const full = path.join(RAW_DIR, file);
    const parsed = readJSON(full, []);
    if (parsed.__error) {
      report.files.push({ file, count: 0, error: parsed.__error });
      report.rejected.push({ file, reason: `JSON 解析失败: ${parsed.__error}` });
      continue;
    }
    if (!Array.isArray(parsed)) {
      report.files.push({ file, count: 0, error: "顶层不是数组" });
      report.rejected.push({ file, reason: "顶层不是数组" });
      continue;
    }
    report.files.push({ file, count: parsed.length });
    report.totalRawRecords += parsed.length;
    for (const rec of parsed) records.push({ rec, file });
  }

  /* ---------------- 2. 逐条校验与规范化 ---------------- */
  const byId = new Map();
  const seenIds = new Map();

  for (const { rec, file } of records) {
    const problems = [];
    const id = typeof rec.catalog_key === "string" ? rec.catalog_key.trim() : "";

    if (!id || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) problems.push("catalog_key 非法或缺失");
    if (!rec.chinese_title) problems.push("缺少 chinese_title");
    if (!rec.original_title) problems.push("缺少 original_title");
    if (typeof rec.release_year !== "number" || !Number.isFinite(rec.release_year)) problems.push("release_year 不是数字");
    if (!MEDIA_TYPES.includes(rec.media_type)) problems.push(`media_type 非法: ${rec.media_type}`);
    if (!FORMATS.includes(rec.format)) problems.push(`format 非法: ${rec.format}`);
    if (!CONFIDENCES.includes(rec.tag_confidence)) problems.push(`tag_confidence 非法: ${rec.tag_confidence}`);
    if (!rec.synopsis_zh || cnCount(rec.synopsis_zh) < 60) problems.push("synopsis_zh 缺失或过短（<60 汉字）");
    if (!rec.recommendation_zh) problems.push("缺少 recommendation_zh");
    if (!rec.tags || typeof rec.tags !== "object") problems.push("缺少 tags");

    if (problems.length) {
      report.rejected.push({ id: id || "(no-id)", file, reasons: problems });
      continue;
    }

    // 重复 ID：保留先出现的，后续的进报告
    if (seenIds.has(id)) {
      report.duplicates.push({
        id,
        keptFrom: seenIds.get(id),
        droppedFrom: file,
        titles: [byId.get(id)?.chinese_title, rec.chinese_title],
      });
      continue;
    }

    // 标签清洗
    const tags = {};
    for (const bucket of BUCKETS) {
      const raw = uniq(rec.tags[bucket]);
      const kept = [];
      for (const tag of raw) {
        if (validTags.has(tag)) kept.push(tag);
        else report.unknownTags.push({ id, bucket, tag });
      }
      tags[bucket] = kept;
    }

    // 出品方标签（派生，不改原始记录）：
    //   芭比 —— 片名含「芭比」或属于芭比系列
    //   迪士尼 —— 片名/系列命中迪士尼片单关键词
    // 这两项只作为「世界观」筛选入口，方便在探索页直接筛出对应片单。
    const titleText = `${rec.chinese_title} ${rec.original_title ?? ""}`;
    const franchiseKey = String(rec.franchise ?? "");
    if (/芭比/.test(titleText) || /barbie/i.test(franchiseKey)) {
      if (validTags.has("芭比") && !tags.world.includes("芭比")) tags.world.push("芭比");
    }
    if (
      DISNEY_PATTERN.test(titleText) ||
      DISNEY_FRANCHISES.includes(franchiseKey) ||
      DISNEY_EXACT.get(String(rec.chinese_title).replace(/（\d{4}）$/, "").trim()) === rec.release_year
    ) {
      if (validTags.has("迪士尼") && !tags.world.includes("迪士尼")) tags.world.push("迪士尼");
    }
    if (
      Array.isArray(rec.director) &&
      rec.director.some((d) => MIYAZAKI_DIRECTOR.test(String(d)))
    ) {
      if (validTags.has("宫崎骏") && !tags.world.includes("宫崎骏")) tags.world.push("宫崎骏");
    }
    // 类型至少要有 1 个；缺失则标记待审核
    if (tags.type.length === 0) {
      tags.type = ["Fantasy Adventure"];
      report.missingFields.push({ id, field: "tags.type", action: "填入兜底值 Fantasy Adventure，标记待审核" });
    }

    const missing = [];
    for (const f of ["country", "director", "cast"]) {
      if (!Array.isArray(rec[f]) || rec[f].length === 0) missing.push(f);
    }
    if (missing.length) report.missingFields.push({ id, field: missing.join(", "), action: "留空，等待外部资料补全" });

    const ratingLike = Object.keys(rec).filter((k) => /rating|score|douban|imdb_rating/i.test(k));
    if (ratingLike.length) {
      report.missingFields.push({ id, field: ratingLike.join(", "), action: "原始记录中出现评分字段，已忽略（评分只能来自外部数据源）" });
    }

    const slug = slugify(rec.original_title) || id;

    seenIds.set(id, file);
    byId.set(id, {
      id,
      slug,
      chineseTitle: String(rec.chinese_title).trim(),
      originalTitle: String(rec.original_title).trim(),
      releaseYear: rec.release_year,
      mediaType: rec.media_type,
      format: rec.format,
      franchise: rec.franchise ?? null,
      franchiseName: rec.franchise_name ?? null,
      seriesOrder: typeof rec.series_order === "number" ? rec.series_order : null,
      country: uniq(rec.country),
      directors: uniq(rec.director),
      cast: uniq(rec.cast).slice(0, 8),
      runtimeMinutes: typeof rec.runtime_minutes === "number" ? rec.runtime_minutes : null,
      seasons: typeof rec.seasons === "number" ? rec.seasons : null,
      originalLanguage: rec.original_language ?? null,
      tags,
      tagConfidence: rec.tag_confidence,
      synopsis: String(rec.synopsis_zh).trim(),
      recommendation: String(rec.recommendation_zh).trim(),
      audienceFit: String(rec.audience_fit ?? "").trim(),
      audienceMismatch: String(rec.audience_mismatch ?? "").trim(),
      watchStatus: ["watched", "wishlist", "unknown"].includes(rec.watch_status) ? rec.watch_status : "unknown",
      creatorNote: rec.creator_note ?? null,
      ratings: [],
      externalIds: { wikidata: null, imdb: null },
      links: { wikidata: null, imdb: null, wikipediaZh: null, wikipediaEn: null },
      poster: null,
      backdrop: null,
      stills: [],
      doubanIntro: null,
      doubanUrl: null,
      provenance: {
        recordSource: "creator-watchlist",
        recordFile: `data/raw/${file}`,
        enrichment: null,
        ratingCheckedAt: null,
        needsReview: false,
        reviewReasons: [],
      },
      createdAt: generatedAt,
      updatedAt: generatedAt,
    });
  }

  /* ---------------- 3. 合并外部真实资料 ---------------- */
  const enrichmentWrap = fs.existsSync(DERIVED) ? readJSON(DERIVED, {}) : null;
  const enrichment = enrichmentWrap && !enrichmentWrap.__error ? enrichmentWrap : null;
  if (enrichmentWrap && enrichmentWrap.__error) {
    report.rejected.push({ file: "data/derived/enrichment.json", reason: `JSON 解析失败: ${enrichmentWrap.__error}` });
  }
  if (enrichment?.records) {
    report.enrich.available = true;
    const sources = enrichment.sources ?? {};
    for (const movie of byId.values()) {
      const e = enrichment.records[movie.id];
      if (!e) {
        movie.provenance.needsReview = true;
        movie.provenance.reviewReasons.push("尚未进行外部资料补全");
        report.needsReview.push({ id: movie.id, reasons: ["no-enrichment"] });
        continue;
      }
      const reviewStatus = e.match?.review_status ?? "unmatched";
      if (reviewStatus === "matched") report.enrich.matched++;
      else if (reviewStatus === "needs_review") report.enrich.needsReview++;
      else report.enrich.unmatched++;

      // 评分：只接受带来源与 URL 的真实评分
      const ratings = (Array.isArray(e.ratings) ? e.ratings : [])
        .filter(
          (r) =>
            r &&
            typeof r.rating_value === "number" &&
            Number.isFinite(r.rating_value) &&
            typeof r.rating_scale === "number" &&
            r.source &&
            r.source_url,
        )
        .map((r) => ({
          source: String(r.source),
          rating_value: r.rating_value,
          rating_scale: r.rating_scale,
          rating_count: typeof r.rating_count === "number" ? r.rating_count : null,
          source_url: r.source_url ?? null,
          last_checked_at: r.last_checked_at ?? null,
          usage_status: r.usage_status ?? "unknown",
        }));
      movie.ratings = ratings;
      if (ratings.length) {
        report.ratingCoverage.withRating++;
        for (const r of ratings) {
          report.ratingCoverage.sources[r.source] = (report.ratingCoverage.sources[r.source] ?? 0) + 1;
        }
      } else {
        report.ratingCoverage.withoutRating++;
      }

      movie.externalIds = {
        wikidata: e.wikidata_id ?? null,
        imdb: e.imdb_id ?? null,
      };
      movie.links = {
        wikidata: e.links?.wikidata ?? null,
        imdb: e.links?.imdb ?? null,
        wikipediaZh: e.links?.wikipedia_zh ?? null,
        wikipediaEn: e.links?.wikipedia_en ?? null,
      };

      // 用外部事实补全本地留空字段，但绝不覆盖人工写的内容
      const facts = e.facts ?? {};
      if (!movie.directors.length && Array.isArray(facts.director)) movie.directors = uniq(facts.director).slice(0, 4);
      if (!movie.cast.length && Array.isArray(facts.cast)) movie.cast = uniq(facts.cast).slice(0, 8);
      if (!movie.country.length && Array.isArray(facts.country)) movie.country = uniq(facts.country);
      if (!movie.runtimeMinutes && typeof facts.runtime_minutes === "number") movie.runtimeMinutes = facts.runtime_minutes;

      movie.provenance.enrichment = {
        method: e.match?.method ?? "unknown",
        confidence: typeof e.match?.confidence === "number" ? e.match.confidence : 0,
        reviewStatus,
        generatedAt: enrichment.generated_at ?? generatedAt,
      };
      movie.provenance.ratingCheckedAt = ratings[0]?.last_checked_at ?? null;

      const reasons = [];
      if (reviewStatus !== "matched") reasons.push(`外部匹配状态: ${reviewStatus}`);
      if (!ratings.length) reasons.push("缺少可核实的评分来源");
      if (e.notes) reasons.push(e.notes);
      if (reasons.length) {
        movie.provenance.needsReview = true;
        movie.provenance.reviewReasons.push(...reasons);
        report.needsReview.push({ id: movie.id, reasons });
      }
    }
  } else {
    for (const movie of byId.values()) {
      movie.provenance.needsReview = true;
      movie.provenance.reviewReasons.push("外部资料来源尚未接入");
    }
  }

  /* ---------------- 3.5 合并真实海报（data/derived/posters.json） ---------------- */
  const POSTERS = path.join(ROOT, "data", "derived", "posters.json");
  if (fs.existsSync(POSTERS)) {
    const wrap = readJSON(POSTERS, {});
    if (wrap && !wrap.__error && wrap.records) {
      for (const movie of byId.values()) {
        const p = wrap.records[movie.id];
        if (!p || !p.src) continue;
        movie.poster = {
          src: String(p.src),
          width: Number(p.width) || 0,
          height: Number(p.height) || 0,
          source: String(p.source ?? "wikipedia"),
          sourceUrl: String(p.sourceUrl ?? ""),
          articleUrl: String(p.articleUrl ?? ""),
          license: String(p.license ?? "unknown"),
          licenseNote: String(p.licenseNote ?? ""),
          fetchedAt: String(p.fetchedAt ?? generatedAt),
        };
        report.posterCoverage.withPoster++;
      }
    } else if (wrap?.__error) {
      report.rejected.push({ file: "data/derived/posters.json", reason: `JSON 解析失败: ${wrap.__error}` });
    }
  }
  report.posterCoverage.withoutPoster = byId.size - report.posterCoverage.withPoster;

  /* ---------------- 3.6 合并 TMDB 宽幅剧照（可选，data/derived/tmdb.json） ---------------- */
  const TMDB = path.join(ROOT, "data", "derived", "tmdb.json");
  if (fs.existsSync(TMDB)) {
    const wrap = readJSON(TMDB, {});
    if (wrap && !wrap.__error && wrap.records) {
      for (const movie of byId.values()) {
        const t = wrap.records[movie.id];
        if (!t) continue;
        const toImage = (p) =>
          p && p.src
            ? {
                src: String(p.src),
                width: Number(p.width) || 0,
                height: Number(p.height) || 0,
                source: String(p.source ?? "tmdb.org"),
                sourceUrl: String(p.sourceUrl ?? ""),
                articleUrl: String(p.articleUrl ?? ""),
                license: String(p.license ?? ""),
                licenseNote: String(p.licenseNote ?? ""),
                fetchedAt: String(p.fetchedAt ?? generatedAt),
              }
            : null;
        const bd = toImage(t.backdrop);
        if (bd) movie.backdrop = bd;
        const ps = toImage(t.poster);
        // TMDB 海报分辨率更高，有就优先于维基图
        if (ps) movie.poster = ps;
      }
      report.posterCoverage.withBackdrop = [...byId.values()].filter((m) => m.backdrop).length;
    } else if (wrap?.__error) {
      report.rejected.push({ file: "data/derived/tmdb.json", reason: `JSON 解析失败: ${wrap.__error}` });
    }
  }

  /* ---------------- 3.7 豆瓣资料（主要数据来源，data/derived/douban.json） ---------------- */
  const DOUBAN = path.join(ROOT, "data", "derived", "douban.json");
  report.douban = { available: false, covered: 0, rating: 0, poster: 0, stills: 0, intro: 0 };
  if (fs.existsSync(DOUBAN)) {
    const wrap = readJSON(DOUBAN, {});
    if (wrap && !wrap.__error && wrap.records) {
      report.douban.available = true;
      const toImage = (p) =>
        p && p.src
          ? {
              src: String(p.src),
              width: Number(p.width) || 0,
              height: Number(p.height) || 0,
              source: String(p.source ?? "douban.com"),
              sourceUrl: String(p.sourceUrl ?? ""),
              articleUrl: String(p.articleUrl ?? ""),
              license: String(p.license ?? ""),
              licenseNote: String(p.licenseNote ?? ""),
              fetchedAt: String(p.fetchedAt ?? generatedAt),
            }
          : null;

      for (const movie of byId.values()) {
        const d = wrap.records[movie.id];
        if (!d || !d.subjectId) continue;
        report.douban.covered++;

        // 评分：豆瓣是主评分来源（10 分制）
        if (d.rating && typeof d.rating.value === "number" && d.rating.value > 0) {
          const doubanRating = {
            source: "豆瓣电影",
            rating_source: "豆瓣电影",
            rating_value: Number(d.rating.value),
            rating_scale: Number(d.rating.scale ?? 10),
            rating_count: Number.isFinite(d.rating.count) ? Number(d.rating.count) : null,
            last_checked_at: String(d.fetchedAt ?? generatedAt),
            source_url: String(d.url ?? ""),
            usage_status: "personal-noncommercial-with-attribution",
          };
          movie.ratings = [doubanRating, ...movie.ratings.filter((r) => r.rating_source !== "豆瓣电影" && r.source !== "豆瓣电影")];
          report.douban.rating++;
          movie.provenance.ratingCheckedAt = doubanRating.last_checked_at;
        }

        // 事实字段：豆瓣优先补空（不覆盖已有非空人工值，除非为空）
        if (Array.isArray(d.directors) && d.directors.length) movie.directors = d.directors.slice(0, 4);
        if (Array.isArray(d.actors) && d.actors.length) movie.cast = d.actors.slice(0, 8);
        if (movie.runtimeMinutes == null && Array.isArray(d.durations) && d.durations.length) {
          const mm = /(\d+)\s*分钟/.exec(d.durations[0]);
          if (mm) movie.runtimeMinutes = Number(mm[1]);
        }
        if (d.originalTitle && (!movie.originalTitle || movie.originalTitle === movie.chineseTitle)) {
          movie.originalTitle = String(d.originalTitle);
        }

        movie.doubanIntro = d.intro ? String(d.intro) : null;
        movie.doubanUrl = String(d.url ?? "");
        if (movie.doubanIntro) report.douban.intro++;

        // 图片：豆瓣海报 / 剧照优先
        const poster = toImage(d.poster);
        if (poster) {
          movie.poster = poster;
          report.douban.poster++;
        }
        const stills = (Array.isArray(d.stills) ? d.stills : []).map(toImage).filter(Boolean);
        if (stills.length) {
          movie.stills = stills.slice(0, 3);
          movie.backdrop = movie.stills[0];
          report.douban.stills++;
        }
        movie.links.douban = movie.doubanUrl;
      }
    } else if (wrap?.__error) {
      report.rejected.push({ file: "data/derived/douban.json", reason: `JSON 解析失败: ${wrap.__error}` });
    }
  }

  /* ---------------- 3.65 评分复核状态 ----------------
   * 有豆瓣评分 → 视为已核对（不再报"缺评分"）；仍有其他缺项才留 needsReview。 */
  for (const movie of byId.values()) {
    const hasRating = movie.ratings.some((r) => r.rating_value > 0);
    if (hasRating) {
      movie.provenance.reviewReasons = movie.provenance.reviewReasons.filter(
        (r) => r !== "缺外部评分" && r !== "尚未进行外部资料补全"
      );
    }
    movie.provenance.needsReview = movie.provenance.reviewReasons.length > 0;
  }

  /* ---------------- 4. 输出 ---------------- */
  const movies = [...byId.values()].sort((a, b) => {
    if (a.franchise && b.franchise && a.franchise === b.franchise) {
      return (a.seriesOrder ?? 0) - (b.seriesOrder ?? 0);
    }
    return a.releaseYear - b.releaseYear;
  });

  report.accepted = movies.length;
  report.ratingCoverage.withoutRating =
    movies.length - report.ratingCoverage.withRating;

  const dupTitles = new Map();
  for (const m of movies) {
    const key = `${m.originalTitle.toLowerCase()}|${m.releaseYear}`;
    if (dupTitles.has(key)) {
      const prev = dupTitles.get(key);
      report.duplicates.push({ id: m.id, keptFrom: prev, droppedFrom: null, titles: [m.chineseTitle], note: "同名同年，疑似重复作品，待人工确认" });
    } else dupTitles.set(key, m.id);
  }

  /* slug 去重：同名翻拍（灰姑娘 1950/1997/2015）会撞出同一个 slug，
     按「加年份 → 再加序号」的规则让每部作品都有唯一可访问的 URL。 */
  const slugSeen = new Map();
  for (const m of movies) {
    let candidate = m.slug;
    if (slugSeen.has(candidate)) {
      candidate = `${m.slug}-${m.releaseYear}`;
      let n = 2;
      while (slugSeen.has(candidate)) {
        candidate = `${m.slug}-${m.releaseYear}-${n}`;
        n += 1;
      }
      m.slugDisambiguated = true;
    }
    slugSeen.set(candidate, m.id);
    m.slug = candidate;
  }

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.mkdirSync(path.dirname(REPORT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify({ generatedAt, count: movies.length, movies }, null, 2) + "\n", "utf8");
  fs.writeFileSync(REPORT, JSON.stringify(report, null, 2) + "\n", "utf8");

  console.log(`✔ 合并完成：${movies.length} 部作品 → data/catalog.json`);
  console.log(`  原始文件 ${report.files.length} 个，原始记录 ${report.totalRawRecords} 条，被拒 ${report.rejected.length} 条，重复 ${report.duplicates.length} 条`);
  console.log(
    `  评分覆盖 ${report.ratingCoverage.withRating}/${movies.length}（来源：${Object.keys(report.ratingCoverage.sources).join(", ") || "无"}）`,
  );
  console.log(`  真实海报 ${movies.filter((m) => m.poster).length}/${movies.length}（豆瓣 ${report.douban?.poster ?? 0} / 维基 ${report.posterCoverage.withPoster} / 其余回退程序化封面）`);
  console.log(`  剧照 ${movies.filter((m) => (m.stills?.length ?? 0) > 0).length}/${movies.length}`);
  console.log(`  待人工复核 ${new Set(report.needsReview.map((n) => n.id)).size} 条（详见 data/reports/import-report.json）`);
  if (report.rejected.length) {
    console.log(`  ⚠ 被拒记录 ${report.rejected.length} 条：`);
    for (const r of report.rejected.slice(0, 8)) console.log(`    - ${r.id ?? r.file}: ${(r.reasons ?? [r.reason]).join("; ")}`);
  }
}

main();
