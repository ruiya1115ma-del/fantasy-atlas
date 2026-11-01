import Link from "next/link";
import type { ReactNode } from "react";
import { tagLabel } from "@/lib/vocabulary";
import type { Rating, TagBucket } from "@/lib/types";

/** 可复用的展示型基础组件（全部是服务端组件，无状态）。 */

export function SectionHeading({
  eyebrow,
  title,
  description,
  action,
  id,
}: {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  action?: { href: string; label: string };
  id?: string;
}) {
  return (
    <div className="mb-10 flex flex-col gap-5 md:mb-14 md:flex-row md:items-end md:justify-between">
      <div className="max-w-2xl">
        {eyebrow && <p className="eyebrow mb-3">{eyebrow}</p>}
        <h2 id={id} className="display text-3xl leading-tight text-ivory md:text-[2.75rem]">
          {title}
        </h2>
        {description && <p className="lede mt-4 text-sm md:text-[0.95rem]">{description}</p>}
      </div>
      {action && (
        <Link
          href={action.href}
          className="group inline-flex shrink-0 items-center gap-2 text-xs uppercase tracking-[0.18em] text-gold-soft transition-colors hover:text-ivory"
        >
          {action.label}
          <span aria-hidden className="transition-transform group-hover:translate-x-1">
            →
          </span>
        </Link>
      )}
    </div>
  );
}

const BUCKET_STYLE: Record<TagBucket, string> = {
  type: "chip chip-static chip-type",
  world: "chip chip-static border-[rgba(185,198,230,0.28)] text-[var(--color-ivory-dim)]",
  aesthetic: "chip chip-static border-[rgba(217,168,191,0.26)]",
  element: "chip chip-static",
  mood: "chip chip-static border-[rgba(151,160,174,0.28)]",
  exclude: "chip chip-static",
};

/** 标签只做展示，不带点击态 —— 需要交互的地方用 components/TagButton */
export function TagPill({
  tag,
  bucket = "element",
  className = "",
}: {
  tag: string;
  bucket?: TagBucket;
  className?: string;
}) {
  return <span className={`${BUCKET_STYLE[bucket]} ${className}`}>{tagLabel(tag)}</span>;
}

export function TagRow({
  tags,
  bucket,
  max,
  className = "",
}: {
  tags: string[];
  bucket: TagBucket;
  max?: number;
  className?: string;
}) {
  const shown = max ? tags.slice(0, max) : tags;
  return (
    <div className={`flex flex-wrap gap-1.5 ${className}`}>
      {shown.map((t) => (
        <TagPill key={t} tag={t} bucket={bucket} />
      ))}
      {max && tags.length > max && (
        <span className="chip chip-static text-[var(--color-ash-dim)]">+{tags.length - max}</span>
      )}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  children,
}: {
  title: string;
  description?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="panel flex flex-col items-center justify-center gap-4 px-6 py-16 text-center md:py-24">
      <div aria-hidden className="mb-1 text-2xl text-gold/50">
        ✦
      </div>
      <h3 className="display text-2xl text-ivory">{title}</h3>
      {description && <p className="lede max-w-md text-sm">{description}</p>}
      {children && <div className="mt-2 flex flex-wrap items-center justify-center gap-3">{children}</div>}
    </div>
  );
}

export function Note({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <p className={`text-[0.72rem] leading-relaxed text-[var(--color-ash-dim)] ${className}`}>{children}</p>;
}

export function Stat({ value, label }: { value: ReactNode; label: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="display text-2xl text-ivory md:text-3xl">{value}</span>
      <span className="text-[0.68rem] uppercase tracking-[0.16em] text-[var(--color-ash-dim)]">{label}</span>
    </div>
  );
}

/** 外部评分：不同来源分开显示，绝不做加权平均 */
export function RatingBadge({ ratings }: { ratings: Rating[] }) {
  if (!ratings.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {ratings.map((r) => (
        <span
          key={r.source}
          className="chip chip-static border-[rgba(201,162,39,0.3)] text-gold-soft"
          title={`${r.source} 评分 ${r.rating_value}/${r.rating_scale}${
            r.rating_count ? `，${r.rating_count.toLocaleString("en-US")} 人评分` : ""
          }${r.last_checked_at ? `，核对于 ${r.last_checked_at.slice(0, 10)}` : ""}`}
        >
          <span className="text-[0.62rem] uppercase tracking-[0.12em] opacity-70">{r.source}</span>
          <span className="font-medium">
            {r.rating_value}/{r.rating_scale}
          </span>
        </span>
      ))}
    </div>
  );
}

export function KeyValue({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[5.5rem_1fr] gap-3 border-b border-[var(--hairline)] py-3 last:border-0 md:grid-cols-[7rem_1fr]">
      <dt className="text-[0.72rem] uppercase tracking-[0.14em] text-[var(--color-ash-dim)]">{label}</dt>
      <dd className="text-sm leading-relaxed text-[var(--color-ivory-dim)]">{children}</dd>
    </div>
  );
}

export function Pill({ children, tone = "default" }: { children: ReactNode; tone?: "default" | "warn" | "ok" }) {
  const toneClass =
    tone === "warn"
      ? "border-[rgba(201,162,39,0.45)] text-gold-soft bg-[rgba(201,162,39,0.08)]"
      : tone === "ok"
        ? "border-[rgba(126,180,142,0.4)] text-[#a8cfb4] bg-[rgba(126,180,142,0.08)]"
        : "";
  return <span className={`chip chip-static ${toneClass}`}>{children}</span>;
}
