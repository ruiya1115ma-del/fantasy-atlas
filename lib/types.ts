/** Fantasy Atlas 数据结构定义（与 docs/DATABASE.md 保持一致） */

export type MediaType = "movie" | "series" | "miniseries";
export type WorkFormat = "live_action" | "animation";
export type WatchStatus = "watched" | "wishlist" | "unknown";
export type Confidence = "high" | "medium" | "low";
export type ReviewStatus = "matched" | "needs_review" | "unmatched";

export type TagBucket = "type" | "world" | "aesthetic" | "element" | "mood" | "exclude";

export type MovieTags = Record<TagBucket, string[]>;

/** 一条外部评分。不同来源必须分开存储，不做加权平均。 */
export interface Rating {
  source: string;
  rating_value: number;
  rating_scale: number;
  rating_count: number | null;
  source_url: string | null;
  last_checked_at: string | null;
  usage_status: string;
}

export interface MovieLinks {
  wikidata: string | null;
  imdb: string | null;
  wikipediaZh: string | null;
  wikipediaEn: string | null;
  /** 豆瓣条目页（主数据来源） */
  douban?: string | null;
}

export interface MovieProvenance {
  /** 原始片单文件，如 data/raw/catalog-a.json */
  recordSource: string;
  recordFile: string;
  /** 外部资料补全的结果（可能为 null，表示尚未补全） */
  enrichment: {
    method: string;
    confidence: number;
    reviewStatus: ReviewStatus;
    generatedAt: string;
  } | null;
  /** 评分最后核对时间 */
  ratingCheckedAt: string | null;
  /** 该记录是否需要人工复核 */
  needsReview: boolean;
  reviewReasons: string[];
}

/**
 * 真实海报（来自维基百科的条目主图）。
 *
 * 版权归发行方所有，维基百科以"合理使用"（fair use）收录于该条目。
 * 因此本站只在**个人非商业**场景下引用，并逐条记录来源、许可与抓取时间；
 * 不重新分发原图、不作为官方物料使用。
 */
export interface PosterImage {
  /** 本地路径，如 /posters/spirited-away.jpg */
  src: string;
  width: number;
  height: number;
  /** 图片托管方，如 en.wikipedia.org */
  source: string;
  /** 文件页（可核对许可） */
  sourceUrl: string;
  /** 条目页 */
  articleUrl: string;
  /** 许可短名，如 Fair use / CC BY-SA 4.0 */
  license: string;
  /** 使用说明（我方解释，用于页面展示） */
  licenseNote: string;
  fetchedAt: string;
}

export interface Movie {
  /** 稳定内部 ID = catalog_key */
  id: string;
  slug: string;
  chineseTitle: string;
  originalTitle: string;
  releaseYear: number;
  mediaType: MediaType;
  format: WorkFormat;
  franchise: string | null;
  franchiseName: string | null;
  seriesOrder: number | null;
  country: string[];
  directors: string[];
  cast: string[];
  runtimeMinutes: number | null;
  seasons: number | null;
  originalLanguage: string | null;
  tags: MovieTags;
  tagConfidence: Confidence;
  synopsis: string;
  recommendation: string;
  audienceFit: string;
  audienceMismatch: string;
  watchStatus: WatchStatus;
  creatorNote: string | null;
  ratings: Rating[];
  externalIds: { wikidata: string | null; imdb: string | null };
  links: MovieLinks;
  provenance: MovieProvenance;
  /** 真实海报（无授权图片时回退到程序化封面） */
  poster: PosterImage | null;
  /**
   * 宽幅剧照/背景图（TMDB backdrop 或豆瓣剧照）。
   * 首页轮播与详情页顶部优先用它铺满整屏；没有时用海报的虚化版本代替。
   */
  backdrop: PosterImage | null;
  /** 豆瓣剧照（最多 3 张），详情页展示 */
  stills: PosterImage[];
  /** 豆瓣剧情简介原文（引用，非本站原创），用于"真实剧情简介" */
  doubanIntro: string | null;
  /** 豆瓣条目链接（评分与资料出处） */
  doubanUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Franchise {
  id: string;
  name: string;
  movies: Movie[];
}

export interface CatalogFile {
  generatedAt: string;
  count: number;
  movies: Movie[];
}

/**
 * 列表/卡片/筛选所需的最小影片结构。
 * Movie 在结构上兼容它，因此同一个筛选函数既能跑在服务端的完整数据上，
 * 也能跑在客户端只为展示而传的轻量数据上（不必把简介、演员表塞进客户端）。
 */
/** 只依赖标签的匹配主体（分类/氛围规则用） */
export type TagMatchSubject = Pick<MediaCard, "tags" | "tagConfidence">;

export interface MediaCard {
  id: string;
  slug: string;
  chineseTitle: string;
  originalTitle: string;
  releaseYear: number;
  mediaType: MediaType;
  format: WorkFormat;
  franchise: string | null;
  franchiseName: string | null;
  seriesOrder: number | null;
  country: string[];
  /** 客户端轻量数据可能省略，服务端完整数据一定有 */
  directors?: string[];
  cast?: string[];
  tags: MovieTags;
  tagConfidence: Confidence;
  ratings: Rating[];
  /** 真实海报；客户端轻量数据可能省略 */
  poster?: PosterImage | null;
  /** 宽幅剧照/背景图；客户端轻量数据可能省略 */
  backdrop?: PosterImage | null;
  /** 豆瓣剧照；客户端轻量数据可能省略 */
  stills?: PosterImage[];
  /** 豆瓣简介原文；客户端轻量数据可能省略 */
  doubanIntro?: string | null;
  /** 豆瓣条目链接 */
  doubanUrl?: string | null;
  provenance?: {
    needsReview?: boolean;
    reviewReasons?: string[];
    enrichment?: { reviewStatus: ReviewStatus } | null;
  };
}

/** 推荐引擎输出的单条结果 —— 必须可解释 */
export interface RecommendationHit {
  movie: Movie;
  score: number;
  /** 归一化 0–100，便于展示 */
  strength: number;
  reasons: ReasonPart[];
  matchedTags: { tag: string; category: TagBucket; weight: number }[];
  similarTo: { id: string; title: string; sharedTags: string[] }[];
  caution: string[];
}

export interface ReasonPart {
  kind: "tag" | "similar" | "series" | "rating" | "penalty";
  text: string;
  weight: number;
}

export interface UserPreferences {
  /** 明确喜欢的作品（用于相似度） */
  likedMovieIds: string[];
  /** 明确不喜欢的作品 */
  dislikedMovieIds: string[];
  /** 明确喜欢的标签，按分类 */
  likedTags: Record<TagBucket, string[]>;
  /** 希望排除（降权/过滤）的标签 */
  avoidTags: string[];
  /** 排除已看作品 */
  excludeWatched: boolean;
  /** 排除已收藏作品 */
  excludeFavorite: boolean;
  /** 权重配置（可在推荐页调整） */
  weights: {
    type: number;
    world: number;
    aesthetic: number;
    element: number;
    mood: number;
    similar: number;
  };
  /** avoidTags 的处理方式 */
  avoidMode: "penalize" | "filter";
  updatedAt: string;
}

export interface LibraryState {
  favorites: string[];
  watched: string[];
  wishlist: string[];
  personalRatings: Record<string, number>;
  notes: Record<string, string>;
}
