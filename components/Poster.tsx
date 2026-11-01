import type { MediaCard } from "@/lib/types";
import { CATEGORIES } from "@/lib/curation";

/**
 * 封面：优先真实海报，缺失时回退程序化原创视觉。
 *
 * 真实海报来自各作品维基百科条目 infobox 的主图（维基以合理使用收录，版权仍在发行方），
 * 由 scripts/fetch-posters.mjs 抓取并记录来源/许可/抓取时间；详情页会逐条标注来源。
 *
 * 回退视觉（没有海报时）由作品 id + 标题 + 年份派生确定性哈希 →
 * 决定配色（来自所属分类）、构图变体、轨道数量、天体位置与装饰层类型。
 * 同一部作品永远是同一张图，服务端与客户端渲染结果一致。
 */

export type PosterSubject = Pick<
  MediaCard,
  "id" | "chineseTitle" | "releaseYear" | "tags" | "tagConfidence"
> & { poster?: MediaCard["poster"] };

export interface PosterProps {
  movie: PosterSubject;
  className?: string;
  variant?: "card" | "hero";
}

function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rng(seed: number) {
  let s = seed || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 4294967296;
  };
}

const FALLBACK_PALETTE = { from: "#0a1020", via: "#1b2438", to: "#05070c", ink: "#c9a227" };

/** 在分类配色基础上做极小的色相/明度偏移 —— 让同一分类下的封面不至于像同一张图 */
function hexToHsl(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  return [h * 360, s * 100, l * 100];
}

function hslToHex(h: number, s: number, l: number): string {
  const hh = ((h % 360) + 360) % 360;
  const ss = Math.min(100, Math.max(0, s)) / 100;
  const ll = Math.min(100, Math.max(0, l)) / 100;
  const c = (1 - Math.abs(2 * ll - 1)) * ss;
  const x = c * (1 - Math.abs(((hh / 60) % 2) - 1));
  const m = ll - c / 2;
  const seg = [[c, x, 0], [x, c, 0], [0, c, x], [0, x, c], [x, 0, c], [c, 0, x]][Math.floor(hh / 60) % 6];
  const to = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, "0");
  return `#${to(seg[0])}${to(seg[1])}${to(seg[2])}`;
}

function shiftColor(hex: string, dh: number, dl: number): string {
  const [h, s, l] = hexToHsl(hex);
  return hslToHex(h + dh, s, l + dl);
}

export function Poster({ movie, className = "", variant = "card" }: PosterProps) {
  // ── 有真实海报时直接用真实海报（版权说明见详情页「数据来源与核对」） ──
  if (movie.poster?.src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={movie.poster.src}
        alt={`${movie.chineseTitle}（${movie.releaseYear}）海报`}
        width={movie.poster.width}
        height={movie.poster.height}
        loading={variant === "hero" ? "eager" : "lazy"}
        decoding="async"
        className={`${className} bg-[#0a1020] object-cover`}
      />
    );
  }

  const seed = hash(`${movie.id}|${movie.chineseTitle}|${movie.releaseYear}`);
  const rand = rng(seed);
  const category = CATEGORIES.find((c) => {
    try {
      return c.match(movie);
    } catch {
      return false;
    }
  });
  const basePalette = category?.palette ?? FALLBACK_PALETTE;
  // 每部作品 ±14° 色相、±3% 明度，保持分类识别度的同时避免封面同质化
  const dh = ((seed % 29) - 14) * 1;
  const dl = ((seed >> 5) % 7) - 3;
  const palette = {
    from: shiftColor(basePalette.from, dh, dl),
    via: shiftColor(basePalette.via, dh, dl),
    to: basePalette.to,
    ink: shiftColor(basePalette.ink, ((seed >> 9) % 17) - 8, dl),
  };
  const motif = category?.motif ?? "arch";
  const uid = `p${seed.toString(36)}`;
  const large = variant === "hero";
  const W = large ? 640 : 420;
  const H = large ? 900 : 630;

  // ── 构图参数（全部由种子决定） ──
  const variantIndex = seed % 3; // 0 居中 / 1 偏置 / 2 破格
  const cxBase = W * (variantIndex === 0 ? 0.5 : variantIndex === 1 ? 0.32 + rand() * 0.14 : 0.6 + rand() * 0.16);
  const horizon = H * (0.56 + rand() * 0.18);
  const orbX = W * (0.12 + rand() * 0.76);
  const orbY = H * (0.12 + rand() * 0.42);
  const orbR = W * (0.07 + rand() * 0.11);
  const tilt = -14 + rand() * 28;
  const ringCount = 2 + Math.floor(rand() * 4);
  const ringScale = 0.3 + rand() * 0.28;
  const accent = Math.floor(rand() * 4);
  const bars = 3 + Math.floor(rand() * 5);

  const stars = Array.from({ length: large ? 40 : 26 }, () => ({
    x: rand() * W,
    y: rand() * H * 0.72,
    r: 0.5 + rand() * (large ? 1.8 : 1.4),
    o: 0.12 + rand() * 0.5,
  }));

  const barsData = Array.from({ length: bars }, (_, i) => ({
    x: W * (0.08 + i * 0.14 + rand() * 0.03),
    w: 1 + rand() * 3,
    h: H * (0.16 + rand() * 0.34),
    o: 0.1 + rand() * 0.22,
  }));

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className={className}
      role="img"
      aria-label={`${movie.chineseTitle} 的程序化抽象封面（原创视觉，非官方海报）`}
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        <linearGradient id={`${uid}-bg`} x1="0.1" y1="0" x2="0.7" y2="1">
          <stop offset="0%" stopColor={palette.from} />
          <stop offset="52%" stopColor={palette.via} />
          <stop offset="100%" stopColor={palette.to} />
        </linearGradient>
        <radialGradient id={`${uid}-orb`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={palette.ink} stopOpacity="0.85" />
          <stop offset="55%" stopColor={palette.ink} stopOpacity="0.28" />
          <stop offset="100%" stopColor={palette.ink} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${uid}-veil`} x1="0" y1="1" x2="0" y2="0.2">
          <stop offset="0%" stopColor="#05070c" stopOpacity="0.9" />
          <stop offset="48%" stopColor="#05070c" stopOpacity="0.26" />
          <stop offset="100%" stopColor="#05070c" stopOpacity="0" />
        </linearGradient>
        <filter id={`${uid}-soft`}>
          <feGaussianBlur stdDeviation={large ? 14 : 9} />
        </filter>
      </defs>

      <rect width={W} height={H} fill={`url(#${uid}-bg)`} />

      {/* 天体 */}
      <circle cx={orbX} cy={orbY} r={orbR * 3.2} fill={`url(#${uid}-orb)`} opacity="0.55" />
      <circle cx={orbX} cy={orbY} r={orbR} fill={palette.ink} opacity="0.3" filter={`url(#${uid}-soft)`} />
      <circle cx={orbX} cy={orbY} r={orbR * 0.32} fill={palette.ink} opacity="0.72" />

      {stars.map((s, i) => (
        <circle key={i} cx={s.x} cy={s.y} r={s.r} fill={palette.ink} opacity={s.o} />
      ))}

      {/* 装饰层 A：竖直光带 */}
      {accent === 0 &&
        barsData.map((b, i) => (
          <rect key={i} x={b.x} y={H - b.h} width={b.w} height={b.h} fill={palette.ink} opacity={b.o} />
        ))}

      {/* 装饰层 B：同心轨道 */}
      {accent === 1 && (
        <g transform={`rotate(${tilt} ${W / 2} ${horizon})`} opacity="0.5">
          {Array.from({ length: ringCount + 2 }, (_, i) => (
            <ellipse
              key={i}
              cx={W / 2}
              cy={horizon * 0.92}
              rx={W * (0.14 + i * 0.12)}
              ry={H * (0.06 + i * 0.05)}
              fill="none"
              stroke={palette.ink}
              strokeWidth="1"
              opacity={0.6 - i * 0.07}
            />
          ))}
        </g>
      )}

      {/* 装饰层 C：横向层积 */}
      {accent === 2 && (
        <g opacity="0.5">
          {Array.from({ length: 5 }, (_, i) => {
            const y = H * (0.44 + i * 0.075);
            return (
              <path
                key={i}
                d={`M 0 ${y} Q ${W * 0.3} ${y - H * 0.05} ${W * 0.55} ${y} T ${W} ${y - H * 0.015}`}
                stroke={palette.ink}
                strokeWidth="1"
                fill="none"
                opacity={0.55 - i * 0.08}
              />
            );
          })}
        </g>
      )}

      {/* 装饰层 D：斜向分割面 */}
      {accent === 3 && (
        <g opacity="0.34">
          <polygon points={`0,${horizon} ${W},${horizon - H * 0.22} ${W},${H} 0,${H}`} fill={palette.ink} opacity="0.14" />
          <line x1="0" y1={horizon} x2={W} y2={horizon - H * 0.22} stroke={palette.ink} strokeWidth="1" />
        </g>
      )}

      {/* 主体 motif */}
      {motif === "arch" && (
        <g stroke={palette.ink} fill="none" opacity="0.78">
          {Array.from({ length: ringCount + 2 }, (_, i) => {
            const r = W * ringScale * (0.3 + i * 0.17);
            const rise = 0.8 + ((seed >> (i + 2)) % 40) / 100;
            return (
              <path
                key={i}
                d={`M ${cxBase - r} ${horizon} L ${cxBase - r} ${horizon - r * rise} A ${r} ${r} 0 0 1 ${cxBase + r} ${horizon - r * rise} L ${cxBase + r} ${horizon}`}
                strokeWidth={i === 0 ? 2 : 1.2}
                opacity={0.95 - i * 0.13}
              />
            );
          })}
        </g>
      )}

      {motif === "spire" && (
        <g opacity="0.8">
          <path
            d={`M ${cxBase} ${H * 0.14} L ${cxBase + W * 0.14} ${horizon} L ${cxBase - W * 0.14} ${horizon} Z`}
            fill="none"
            stroke={palette.ink}
            strokeWidth="1.4"
          />
          <path d={`M ${cxBase} ${H * 0.07} L ${cxBase} ${H * 0.15}`} stroke={palette.ink} strokeWidth="1" />
          <path
            d={`M ${cxBase - W * 0.26} ${horizon} L ${cxBase + W * 0.26} ${horizon}`}
            stroke={palette.ink}
            strokeWidth="1"
            opacity="0.55"
          />
          <path
            d={`M ${cxBase - W * 0.09} ${horizon - W * 0.06} L ${cxBase + W * 0.09} ${horizon - W * 0.06}`}
            stroke={palette.ink}
            strokeWidth="0.8"
            opacity="0.4"
          />
        </g>
      )}

      {motif === "peak" && (
        <g>
          <path d={`M 0 ${horizon} L ${W * 0.24} ${H * 0.32} L ${W * 0.44} ${horizon} Z`} fill={palette.ink} opacity="0.16" />
          <path d={`M ${W * 0.22} ${horizon} L ${W * 0.58} ${H * 0.2} L ${W} ${horizon} Z`} fill={palette.ink} opacity="0.24" />
          <path
            d={`M ${W * 0.58} ${H * 0.2} L ${W * 0.5} ${H * 0.38}`}
            stroke={palette.ink}
            strokeWidth="1"
            opacity="0.6"
            fill="none"
          />
        </g>
      )}

      {motif === "moon" && (
        <g>
          <circle cx={cxBase} cy={H * 0.3} r={W * 0.16} fill={palette.ink} opacity="0.16" filter={`url(#${uid}-soft)`} />
          <circle cx={cxBase} cy={H * 0.3} r={W * 0.085} fill={palette.ink} opacity="0.85" />
          <path
            d={`M 0 ${horizon} Q ${W * 0.45} ${horizon - H * 0.12} ${W} ${horizon}`}
            stroke={palette.ink}
            strokeWidth="1"
            fill="none"
            opacity="0.45"
          />
          <path
            d={`M 0 ${horizon + H * 0.1} Q ${W * 0.5} ${horizon - H * 0.02} ${W} ${horizon + H * 0.1}`}
            stroke={palette.ink}
            strokeWidth="1"
            fill="none"
            opacity="0.24"
          />
        </g>
      )}

      {motif === "bloom" && (
        <g transform={`rotate(${tilt} ${cxBase} ${horizon})`} opacity="0.68">
          {Array.from({ length: 8 }, (_, i) => (
            <ellipse
              key={i}
              cx={cxBase}
              cy={horizon - W * 0.06 - i * W * 0.028}
              rx={W * (0.05 + i * 0.026)}
              ry={W * 0.028}
              fill="none"
              stroke={palette.ink}
              strokeWidth="1.2"
              opacity={0.78 - i * 0.07}
            />
          ))}
        </g>
      )}

      {/* 地平线 */}
      <rect x="0" y={horizon} width={W} height={H - horizon} fill="#05070c" opacity="0.2" />
      <line x1="0" y1={horizon} x2={W} y2={horizon} stroke={palette.ink} strokeWidth="1" opacity="0.28" />

      {/* 底部渐隐，保证标题文字可读 */}
      <rect width={W} height={H} fill={`url(#${uid}-veil)`} />
    </svg>
  );
}
