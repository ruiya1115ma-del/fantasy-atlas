"use client";

import Link from "next/link";
import { useMemo, useState, useEffect } from "react";
import type { FilterState, SortKey } from "@/lib/filter";
import {
  DEFAULT_FILTERS,
  activeFilterCount,
  applyFilters,
  describeFilters,
  filtersToQuery,
} from "@/lib/filter";
import type { MediaCard } from "@/lib/types";
import { TAG_GROUPS, COUNTRY_NAMES, tagLabel } from "@/lib/vocabulary";
import { CATEGORIES, MOODS, MOOD_BY_SLUG, CATEGORY_BY_SLUG } from "@/lib/curation";
import { MovieGrid } from "./MovieCard";
import { EmptyState, Note } from "./ui";
import { useLibrary } from "./LibraryProvider";

const SORTS: { key: SortKey; label: string; hint: string }[] = [
  { key: "recommendation", label: "编辑推荐度", hint: "标签完整度 + 编辑片单入选 + 外部评分参考，不是客观评分" },
  { key: "year_desc", label: "年份：新 → 旧", hint: "按上映年份排序" },
  { key: "year_asc", label: "年份：旧 → 新", hint: "按上映年份排序" },
  { key: "rating", label: "外部评分", hint: "IMDb 评分换算到 10 分制，仅作参考" },
  { key: "title", label: "标题", hint: "按中文标题排序" },
];

const DECADES = [
  { label: "1980s", from: 1980, to: 1989 },
  { label: "1990s", from: 1990, to: 1999 },
  { label: "2000s", from: 2000, to: 2009 },
  { label: "2010s", from: 2010, to: 2019 },
  { label: "2020s", from: 2020, to: 2029 },
];

const RATING_STEPS = [
  { label: "≥ 8.0", min: 8, max: null },
  { label: "7.0 – 7.9", min: 7, max: 7.9 },
  { label: "6.0 – 6.9", min: 6, max: 6.9 },
  { label: "< 6.0", min: null, max: 5.9 },
];

export function ExploreClient({ movies, initial }: { movies: MediaCard[]; initial: FilterState }) {
  const library = useLibrary();
  const [f, setF] = useState<FilterState>({ ...DEFAULT_FILTERS, ...initial });
  const [showFilters, setShowFilters] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ type: true, world: true, aesthetic: true });

  // URL 同步：筛选条件可分享、可刷新保持。
  // 用 history.replaceState 而不是 router.replace：后者会触发一次服务端重新渲染，
  // 遇到 force-dynamic 的探索页会把顶部轮播重新随机一遍，造成「加载一秒后换片」的闪烁。
  useEffect(() => {
    if (typeof window === "undefined") return;
    const qs = filtersToQuery(f);
    const url = qs ? `/explore?${qs}` : "/explore";
    if (window.location.pathname + window.location.search === url) return;
    window.history.replaceState(null, "", url);
  }, [f]);

  const facetCounts = useMemo(() => {
    const out: Record<string, Record<string, number>> = {};
    for (const g of TAG_GROUPS) {
      const per: Record<string, number> = {};
      for (const m of movies) {
        for (const t of m.tags[g.category as keyof MediaCard["tags"]] ?? []) per[t] = (per[t] ?? 0) + 1;
      }
      out[g.category] = per;
    }
    return out;
  }, [movies]);

  const countryCounts = useMemo(() => {
    const per: Record<string, number> = {};
    for (const m of movies) for (const c of m.country) per[c] = (per[c] ?? 0) + 1;
    return per;
  }, [movies]);

  const results = useMemo(() => {
    const mood = f.moodEntry ? MOOD_BY_SLUG[f.moodEntry] : null;
    const category = f.category ? CATEGORY_BY_SLUG[f.category] : null;
    return applyFilters(
      movies,
      f,
      library,
      mood ? (m) => mood.match(m) : undefined,
      category ? (m) => category.match(m) : undefined,
    );
  }, [movies, f, library]);

  const set = <K extends keyof FilterState>(key: K, value: FilterState[K]) => setF((prev) => ({ ...prev, [key]: value }));

  const toggleTag = (bucket: "type" | "world" | "aesthetic" | "element" | "mood", tag: string) =>
    setF((prev) => {
      const current = prev[bucket];
      return {
        ...prev,
        [bucket]: current.includes(tag) ? current.filter((t) => t !== tag) : [...current, tag],
      };
    });

  const clearAll = () => setF({ ...DEFAULT_FILTERS });
  const activeCount = activeFilterCount(f);
  const chips = describeFilters(f);

  const filterPanel = (
    <div className="flex flex-col gap-7">
      <div>
        <label htmlFor="explore-q" className="sr-only">
          搜索作品
        </label>
        <div className="relative">
          <input
            id="explore-q"
            type="search"
            value={f.q}
            onChange={(e) => set("q", e.target.value)}
            placeholder="搜索片名、导演、演员或标签…"
            className="field pr-9"
          />
          <span aria-hidden className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[var(--color-ash-dim)]">
            ⌕
          </span>
        </div>
      </div>

      {/* 标签维度 */}
      {TAG_GROUPS.filter((g) => ["type", "world", "aesthetic", "element", "mood"].includes(g.category)).map((group) => {
        const bucket = group.category as "type" | "world" | "aesthetic" | "element" | "mood";
        const selected = f[bucket];
        const count = facetCounts[group.category] ?? {};
        const open = expanded[bucket] ?? bucket === "mood";
        // 只展示词表里真实有条目的标签，避免空筛选
        const terms = group.terms.filter((t) => (count[t.id] ?? 0) > 0);
        const visible = open ? terms : terms.slice(0, 8);
        return (
          <div key={group.category}>
            <button
              type="button"
              onClick={() => setExpanded((p) => ({ ...p, [bucket]: !open }))}
              className="flex w-full items-baseline justify-between gap-3 text-left"
              aria-expanded={open}
            >
              <span className="text-[0.72rem] uppercase tracking-[0.16em] text-[var(--color-ivory)]">
                {group.zh}
                <span className="ml-2 text-[0.62rem] tracking-[0.08em] text-[var(--color-ash-dim)]">{group.blurb}</span>
              </span>
              <span aria-hidden className="text-xs text-[var(--color-ash-dim)]">
                {open ? "−" : "+"}
              </span>
            </button>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {visible.map((term) => {
                const on = selected.includes(term.id);
                return (
                  <button
                    key={term.id}
                    type="button"
                    onClick={() => toggleTag(bucket, term.id)}
                    aria-pressed={on}
                    title={term.hint}
                    className={`chip chip-action ${on ? "chip-on" : ""}`}
                  >
                    {term.zh}
                    <span className="text-[0.62rem] opacity-60">{count[term.id]}</span>
                  </button>
                );
              })}
            </div>
            {terms.length > 8 && (
              <button
                type="button"
                onClick={() => setExpanded((p) => ({ ...p, [bucket]: !open }))}
                className="mt-2 text-[0.68rem] text-[var(--color-ash-dim)] underline-offset-4 hover:text-gold-soft hover:underline"
              >
                {open ? "收起" : `展开全部 ${terms.length} 个`}
              </button>
            )}
          </div>
        );
      })}

      <div className="hairline" />

      {/* 更多条件 */}
      <div className="flex flex-col gap-5">
        <p className="text-[0.72rem] uppercase tracking-[0.16em] text-[var(--color-ivory)]">更多条件</p>

        <Segmented
          label="媒体形式"
          value={f.media}
          options={[
            { value: "all", label: "全部" },
            { value: "movie", label: "电影" },
            { value: "series", label: "剧集" },
          ]}
          onChange={(v) => set("media", v as FilterState["media"])}
        />

        <Segmented
          label="呈现方式"
          value={f.format}
          options={[
            { value: "all", label: "全部" },
            { value: "live_action", label: "真人" },
            { value: "animation", label: "动画" },
          ]}
          onChange={(v) => set("format", v as FilterState["format"])}
        />

        <Segmented
          label="系列关系"
          value={f.franchise}
          options={[
            { value: "all", label: "全部" },
            { value: "series", label: "系列作" },
            { value: "standalone", label: "独立作" },
          ]}
          onChange={(v) => set("franchise", v as FilterState["franchise"])}
        />

        <div>
          <p className="mb-2 text-[0.66rem] uppercase tracking-[0.14em] text-[var(--color-ash-dim)]">上映年代</p>
          <div className="flex flex-wrap gap-1.5">
            {DECADES.map((d) => {
              const on = f.yearFrom === d.from && f.yearTo === d.to;
              return (
                <button
                  key={d.label}
                  type="button"
                  onClick={() => setF((p) => ({ ...p, yearFrom: on ? null : d.from, yearTo: on ? null : d.to }))}
                  aria-pressed={on}
                  className={`chip chip-action ${on ? "chip-on" : ""}`}
                >
                  {d.label}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <p className="mb-2 text-[0.66rem] uppercase tracking-[0.14em] text-[var(--color-ash-dim)]">
            外部评分（IMDb 换算 / 10）
          </p>
          <div className="flex flex-wrap gap-1.5">
            {RATING_STEPS.map((r) => {
              const on = f.ratingMin === r.min && f.ratingMax === r.max;
              return (
                <button
                  key={r.label}
                  type="button"
                  onClick={() => setF((p) => ({ ...p, ratingMin: on ? null : r.min, ratingMax: on ? null : r.max }))}
                  aria-pressed={on}
                  className={`chip chip-action ${on ? "chip-on" : ""}`}
                >
                  {r.label}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <p className="mb-2 text-[0.66rem] uppercase tracking-[0.14em] text-[var(--color-ash-dim)]">制作地区</p>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(countryCounts)
              .sort((a, b) => b[1] - a[1])
              .map(([code, n]) => {
                const on = f.country.includes(code);
                return (
                  <button
                    key={code}
                    type="button"
                    onClick={() =>
                      setF((p) => ({
                        ...p,
                        country: on ? p.country.filter((c) => c !== code) : [...p.country, code],
                      }))
                    }
                    aria-pressed={on}
                    className={`chip chip-action ${on ? "chip-on" : ""}`}
                  >
                    {COUNTRY_NAMES[code] ?? code}
                    <span className="text-[0.62rem] opacity-60">{n}</span>
                  </button>
                );
              })}
          </div>
        </div>

        <Segmented
          label="我的库"
          value={f.library}
          options={[
            { value: "all", label: "全部" },
            { value: "unwatched", label: "未看" },
            { value: "watched", label: "已看" },
            { value: "favorite", label: "收藏" },
          ]}
          onChange={(v) => set("library", v as FilterState["library"])}
        />
        <Note>「我的库」筛选基于本机浏览器保存的收藏与已看记录，不需要登录。</Note>
      </div>
    </div>
  );

  return (
    <div className="shell pb-24 pt-10 md:pt-14">
      {/* 标题区 */}
      <div className="mb-8 flex flex-col gap-4 md:mb-10 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="eyebrow">Explore The Atlas</p>
          <h1 className="display mt-3 text-4xl text-ivory md:text-5xl">探索全部作品</h1>
          <p className="lede mt-3 max-w-xl text-sm">
            用标签组合找片。同一类标签之间是「或」，不同类之间是「与」—— 例如「魔法学院 + 哥特建筑」会同时要求两个条件。
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => setShowFilters(true)} className="btn btn-ghost btn-sm lg:hidden">
            筛选{activeCount > 0 ? `（${activeCount}）` : ""}
          </button>
          <label className="flex items-center gap-2 whitespace-nowrap text-[0.7rem] text-[var(--color-ash-dim)]">
            排序
            <select
              value={f.sort}
              onChange={(e) => set("sort", e.target.value as SortKey)}
              className="field w-auto py-1.5 text-[0.75rem]"
              title={SORTS.find((s) => s.key === f.sort)?.hint}
            >
              {SORTS.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="grid gap-10 lg:grid-cols-[280px_1fr] lg:gap-12">
        {/* 桌面端筛选面板 */}
        <aside className="hidden lg:block">
          <div className="sticky top-24 max-h-[calc(100dvh-7rem)] overflow-y-auto pr-2">
            {filterPanel}
            <button type="button" onClick={clearAll} className="btn btn-quiet mt-6 w-full">
              清除全部筛选
            </button>
          </div>
        </aside>

        {/* 移动端抽屉 */}
        {showFilters && (
          <div className="fixed inset-0 z-[70] lg:hidden">
            <button
              type="button"
              aria-label="关闭筛选"
              onClick={() => setShowFilters(false)}
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            />
            <div className="absolute inset-y-0 right-0 flex w-[86%] max-w-sm flex-col border-l border-[var(--hairline)] bg-[#070a10]">
              <div className="flex items-center justify-between border-b border-[var(--hairline)] px-5 py-4">
                <p className="text-sm text-ivory">筛选</p>
                <button type="button" onClick={() => setShowFilters(false)} className="btn btn-quiet">
                  完成
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-5 py-5">{filterPanel}</div>
              <div className="border-t border-[var(--hairline)] p-4">
                <button type="button" onClick={clearAll} className="btn btn-ghost w-full">
                  清除全部筛选
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 结果区 */}
        <section aria-live="polite">
          <div className="mb-5 flex flex-wrap items-center gap-3 border-b border-[var(--hairline)] pb-4">
            <p className="text-sm text-[var(--color-ivory)]">
              共 <span className="text-gold-soft">{results.length}</span> 部作品
            </p>
            <span className="text-[0.7rem] text-[var(--color-ash-dim)]">（目录共 {movies.length} 部）</span>
            {f.sort === "recommendation" && (
              <span
                className="chip chip-static text-[0.65rem]"
                title="编辑推荐度 = 标签完整度 + 是否入选编辑片单 + 外部评分的小幅参考，不是网站给作品打的分"
              >
                按编辑推荐度排序 · 非客观评分
              </span>
            )}
            {activeCount > 0 && (
              <button
                type="button"
                onClick={clearAll}
                className="ml-auto text-[0.7rem] text-[var(--color-ash-dim)] underline-offset-4 hover:text-gold-soft hover:underline"
              >
                清除筛选（{activeCount}）
              </button>
            )}
          </div>

          {chips.length > 0 && (
            <div className="mb-6 flex flex-wrap items-center gap-1.5">
              {chips.map((c) => (
                <span key={c.kind} className="chip chip-static border-[rgba(226,200,127,0.28)] text-[0.7rem]">
                  {c.label}
                </span>
              ))}
            </div>
          )}

          {results.length > 0 ? (
            <>
              <MovieGrid movies={results} />
              {f.library === "favorite" && results.length === 0 && (
                <Note className="mt-6">还没有收藏。在详情页点「加入收藏」后，这里就会显示。</Note>
              )}
            </>
          ) : (
            <EmptyState
              title="这个组合暂时没有作品"
              description={
                activeCount > 0
                  ? "把条件放宽一点，或者去掉一个标签试试。标签之间是「与」的关系，叠加越多越容易变空。"
                  : "目录里还没有符合条件的内容。"
              }
            >
              <button type="button" onClick={clearAll} className="btn btn-primary btn-sm">
                清除全部筛选
              </button>
              <Link href="/recommend" className="btn btn-ghost btn-sm">
                用偏好推荐试试
              </Link>
            </EmptyState>
          )}

          {/* 快捷入口：从标签跳到氛围/分类 */}
          {(f.moodEntry || f.category) && (
            <div className="mt-8 flex flex-wrap items-center gap-3 border-t border-[var(--hairline)] pt-6">
              <span className="text-[0.7rem] text-[var(--color-ash-dim)]">
                当前入口：
                {f.moodEntry ? MOOD_BY_SLUG[f.moodEntry]?.title : CATEGORY_BY_SLUG[f.category ?? ""]?.zh}
              </span>
              <button
                type="button"
                onClick={() => setF((p) => ({ ...p, moodEntry: null, category: null }))}
                className="btn btn-quiet btn-sm"
              >
                退出该入口
              </button>
            </div>
          )}
        </section>
      </div>

      {/* 底部：全部入口 */}
      <div className="mt-16 border-t border-[var(--hairline)] pt-10">
        <p className="eyebrow mb-4">Jump Back In</p>
        <div className="flex flex-wrap gap-2">
          {MOODS.map((m) => (
            <button
              key={m.slug}
              type="button"
              onClick={() => setF((p) => ({ ...p, moodEntry: m.slug, category: null }))}
              className="chip chip-action"
            >
              {m.title}
            </button>
          ))}
          {CATEGORIES.map((c) => (
            <button
              key={c.slug}
              type="button"
              onClick={() => setF((p) => ({ ...p, category: c.slug, moodEntry: null }))}
              className="chip chip-action"
            >
              {c.zh}
            </button>
          ))}
        </div>
      </div>

      <p className="mt-10 text-[0.68rem] leading-relaxed text-[var(--color-ash-dim)]">
        标签：{tagLabel("Epic Fantasy")}、{tagLabel("魔法学院")}… 全部经过词表规范化；资料与图片均标注来源与许可。
      </p>
    </div>
  );
}

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <p className="mb-2 text-[0.66rem] uppercase tracking-[0.14em] text-[var(--color-ash-dim)]">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            aria-pressed={value === o.value}
            className={`chip chip-action ${value === o.value ? "chip-on" : ""}`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
