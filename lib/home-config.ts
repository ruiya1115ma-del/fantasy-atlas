/**
 * 首页内容配置（板块 / 主题卡片 / 电影归属）。
 *
 * 这是后台「首页内容管理」的唯一数据真相，保存在 data/home-config.json。
 * 前台首页只读它来生成板块与主题卡片；探索页的多标签筛选、详情页、收藏等
 * 仍然走原有的代码规则，互不影响。
 *
 * 首次读取时若文件不存在，会用当前的「五个视觉风格 + 六个叙事主题」自动生成一份初始配置
 * （电影归属取现有规则算出的结果），之后完全由管理员在后台决定。
 */
import fs from "node:fs";
import path from "node:path";
import configSource from "@/data/home-config.json";
import { CATEGORIES } from "@/lib/curation";
import { assignStyle } from "@/lib/style-assignments";
import { MOTIFS, classifyMovie } from "@/lib/motifs";
import { getMovies } from "@/lib/data";
import { StorageUnavailableError } from "@/lib/admin/store";

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, "data");
const CONFIG_PATH = path.join(DATA_DIR, "home-config.json");
const BACKUP_DIR = path.join(DATA_DIR, "backups");

export interface HomeTheme {
  id: string;
  name: string;
  /** 卡片图片；为空时前台回退到该主题第一部有海报的电影 */
  image: string;
  /** 英文副标题（可选，不展示也没关系） */
  en?: string;
  /** 展开式画廊里的一句话（可选） */
  tagline?: string;
  /** 展开式画廊里的说明（可选） */
  description?: string;
  hidden: boolean;
  /** 电影 id 列表，按添加顺序 */
  movieIds: string[];
}

export interface HomeSection {
  id: string;
  title: string;
  /** 板块副标题（可选） */
  subtitle?: string;
  /**
   * 卡片布局：
   * - "expand"：原来的五个主题并排 + 悬停展开（视觉风格板块用的就是这个）
   * - "grid"：平铺网格（按主题寻找用的）
   */
  layout: "expand" | "grid";
  hidden: boolean;
  themes: HomeTheme[];
}

export interface HomeConfig {
  version: 1;
  updatedAt: string;
  sections: HomeSection[];
}

const CONFIG_VERSION = 1 as const;

function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function newSectionId(): string {
  return uid("sec");
}

export function newThemeId(): string {
  return uid("thm");
}

/** 初始配置：五个视觉风格 + 六个叙事主题，电影归属沿用现有规则 */
export function buildSeedConfig(): HomeConfig {
  const movies = getMovies();
  const now = new Date().toISOString();

  // 初始封面沿用原来的精选封面，避免第一张卡片取到随机成员的杂图
  const SEED_COVERS: Record<string, string> = {
    "style-enchanted-worlds": "the-nutcracker-and-the-four-realms-2018",
    "style-dark-gothic": "twilight",
    "style-epic-fantasy": "the-lord-of-the-rings-the-fellowship-of-the-ring",
    "style-surreal-dreams": "alice-in-wonderland-2010",
    "style-whimsical-tales": "coraline",
    "motif-time-rift": "stranger-things-2016",
    "motif-magic-world": "harry-potter-and-the-philosophers-stone",
    "motif-strange-everyday": "edward-scissorhands",
    "motif-fantasy-creatures": "princess-mononoke-1997",
    "motif-dark-fairytale": "pans-labyrinth",
    "motif-epic-quest": "the-lord-of-the-rings-the-fellowship-of-the-ring",
  };
  const coverOf = (key: string): string => {
    const id = SEED_COVERS[key];
    const movie = id ? movies.find((m) => m.id === id) : undefined;
    return movie?.poster?.src ?? "";
  };

  const styleSection: HomeSection = {
    id: "sec-visual-styles",
    title: "五个视觉风格",
    subtitle: "先按画面和气质挑一个方向",
    layout: "expand",
    hidden: false,
    themes: CATEGORIES.map((cat) => ({
      id: `style-${cat.slug}`,
      name: cat.zh,
      en: cat.en,
      tagline: cat.tagline,
      description: cat.description,
      image: coverOf(`style-${cat.slug}`),
      hidden: false,
      movieIds: movies.filter((m) => assignStyle(m) === cat.slug).map((m) => m.id),
    })),
  };

  const motifSection: HomeSection = {
    id: "sec-narrative-themes",
    title: "按主题寻找",
    subtitle: "同一个故事世界，不同的入口",
    layout: "grid",
    hidden: false,
    themes: MOTIFS.map((motif) => {
      const list = movies.filter((m) => classifyMovie(m) === motif.slug);
      return {
        id: `motif-${motif.slug}`,
        name: motif.zh,
        en: motif.en,
        description: motif.description,
        image: coverOf(`motif-${motif.slug}`),
        hidden: false,
        movieIds: list.map((m) => m.id),
      };
    }),
  };

  return { version: CONFIG_VERSION, updatedAt: now, sections: [styleSection, motifSection] };
}

/**
 * 规范化：补齐 id、去掉重复 id、按同一板块内「一部电影只能属于一个主题」去重
 * （按主题在板块内的顺序，先出现的保留），并清理不存在的电影引用。
 * 返回 { config, droppedMovies, duplicates }
 */
export function normalizeConfig(input: HomeConfig): {
  config: HomeConfig;
  droppedMovies: number;
  duplicates: number;
} {
  const validIds = new Set(getMovies().map((m) => m.id));
  const seenSectionIds = new Set<string>();
  const seenThemeIds = new Set<string>();
  let droppedMovies = 0;
  let duplicates = 0;

  // 兼容旧配置：按 id 找回原来的 tagline / description / en
  const styleMeta = new Map(CATEGORIES.map((c) => [`style-${c.slug}`, c]));
  const motifMeta = new Map(MOTIFS.map((m) => [`motif-${m.slug}`, m]));

  const sections = (Array.isArray(input.sections) ? input.sections : [])
    .filter((s) => s && typeof s === "object")
    .map((section) => {
      let id = typeof section.id === "string" && section.id.trim() ? section.id.trim() : newSectionId();
      while (seenSectionIds.has(id)) id = newSectionId();
      seenSectionIds.add(id);

      // 同一板块内：一部电影只能归属一个主题
      const claimed = new Set<string>();

      const themes = (Array.isArray(section.themes) ? section.themes : [])
        .filter((t) => t && typeof t === "object")
        .map((theme) => {
          let themeId = typeof theme.id === "string" && theme.id.trim() ? theme.id.trim() : newThemeId();
          while (seenThemeIds.has(themeId)) themeId = newThemeId();
          seenThemeIds.add(themeId);

          const movieIds: string[] = [];
          for (const raw of Array.isArray(theme.movieIds) ? theme.movieIds : []) {
            const movieId = String(raw);
            if (!validIds.has(movieId)) {
              droppedMovies += 1;
              continue;
            }
            if (claimed.has(movieId)) {
              duplicates += 1;
              continue;
            }
            claimed.add(movieId);
            movieIds.push(movieId);
          }

          const style = styleMeta.get(themeId);
          const motif = motifMeta.get(themeId);

          return {
            id: themeId,
            name: typeof theme.name === "string" && theme.name.trim() ? theme.name.trim() : "未命名主题",
            image: typeof theme.image === "string" ? theme.image.trim() : "",
            en: (typeof theme.en === "string" && theme.en.trim()) || style?.en || motif?.en || undefined,
            tagline: (typeof theme.tagline === "string" && theme.tagline.trim()) || style?.tagline || undefined,
            description:
              (typeof theme.description === "string" && theme.description.trim()) || style?.description || motif?.description || undefined,
            hidden: Boolean(theme.hidden),
            movieIds,
          };
        });

      return {
        id,
        title: typeof section.title === "string" && section.title.trim() ? section.title.trim() : "未命名板块",
        subtitle: typeof section.subtitle === "string" ? section.subtitle.trim() : undefined,
        // 旧配置里没有 layout 字段：默认把「五个视觉风格」视为并排展开，其余平铺
        layout:
          section.layout === "expand"
            ? ("expand" as const)
            : section.layout === "grid"
              ? ("grid" as const)
              : id === "sec-visual-styles"
                ? ("expand" as const)
                : ("grid" as const),
        hidden: Boolean(section.hidden),
        themes,
      };
    });

  return {
    config: { version: CONFIG_VERSION, updatedAt: new Date().toISOString(), sections },
    droppedMovies,
    duplicates,
  };
}

function atomicWrite(file: string, content: string) {
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(`${file}.tmp`, content, "utf8");
    fs.renameSync(`${file}.tmp`, file);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException)?.code;
    if (code === "EROFS" || code === "EACCES" || code === "EPERM") throw new StorageUnavailableError();
    throw err;
  }
}

/** 读取配置；不存在时用当前规则生成一份并落盘（只做一次） */
export function loadHomeConfig(): HomeConfig {
  try {
    const parsed = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8")) as HomeConfig;
    if (!parsed || !Array.isArray(parsed.sections)) return buildSeedConfig();
    return normalizeConfig(parsed).config;
  } catch {
    // 没有文件系统（Cloudflare Workers 等）：用构建时打进 bundle 的配置快照
    try {
      const bundled = configSource as unknown as HomeConfig;
      if (bundled && Array.isArray(bundled.sections)) {
        return normalizeConfig(bundled).config;
      }
    } catch {
      /* 忽略，继续用 seed */
    }
    const seed = buildSeedConfig();
    try {
      atomicWrite(CONFIG_PATH, JSON.stringify(seed, null, 2));
    } catch {
      /* 只读环境：仍然返回内存里的初始配置，前台可正常展示 */
    }
    return seed;
  }
}

function backupCurrent(): string | null {
  try {
    if (!fs.existsSync(CONFIG_PATH)) return null;
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
    const name = `home-config-${stamp}.json`;
    fs.copyFileSync(CONFIG_PATH, path.join(BACKUP_DIR, name));
    return name;
  } catch {
    return null;
  }
}

/** 保存整份配置（结构变更），写入前自动备份，写入后返回规范化结果 */
export function saveHomeConfig(input: HomeConfig): {
  config: HomeConfig;
  droppedMovies: number;
  duplicates: number;
  backup: string | null;
} {
  const { config, droppedMovies, duplicates } = normalizeConfig(input);
  const backup = backupCurrent();
  atomicWrite(CONFIG_PATH, JSON.stringify(config, null, 2));
  return { config, droppedMovies, duplicates, backup };
}
