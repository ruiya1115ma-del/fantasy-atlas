"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

export interface AdminTagGroup {
  category: string;
  zh: string;
  terms: { id: string; zh: string; hint?: string }[];
}

export interface AdminMovieFormValue {
  id: string;
  chineseTitle: string;
  originalTitle: string;
  releaseYear: number;
  mediaType: "movie" | "series" | "miniseries";
  format: "live_action" | "animation";
  synopsis: string;
  recommendation: string;
  posterSrc: string;
  posterLicense: string;
  tags: Record<string, string[]>;
  directors: string[];
  cast: string[];
  country: string[];
  franchise: string;
  franchiseName: string;
  seriesOrder: string;
  audienceFit: string;
  audienceMismatch: string;
  watchStatus: "watched" | "wishlist" | "unknown";
}

const EMPTY: AdminMovieFormValue = {
  id: "",
  chineseTitle: "",
  originalTitle: "",
  releaseYear: new Date().getFullYear(),
  mediaType: "movie",
  format: "live_action",
  synopsis: "",
  recommendation: "",
  posterSrc: "",
  posterLicense: "",
  tags: {},
  directors: [],
  cast: [],
  country: [],
  franchise: "",
  franchiseName: "",
  seriesOrder: "",
  audienceFit: "",
  audienceMismatch: "",
  watchStatus: "watched",
};

function joined(list: string[]) {
  return list.join("、");
}

function split(value: string) {
  return value
    .split(/[、,，;；\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function AdminMovieEditor({
  initial,
  tagGroups,
  defaults,
}: {
  initial?: AdminMovieFormValue;
  tagGroups: AdminTagGroup[];
  defaults?: Partial<AdminMovieFormValue>;
}) {
  const router = useRouter();
  const isNew = !initial;
  const [form, setForm] = useState<AdminMovieFormValue>({ ...EMPTY, ...defaults, ...initial });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [ok, setOk] = useState(false);

  const tagValues = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const group of tagGroups) map[group.category] = form.tags[group.category] ?? [];
    return map;
  }, [form.tags, tagGroups]);

  function update<K extends keyof AdminMovieFormValue>(key: K, value: AdminMovieFormValue[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function toggleTag(category: string, tag: string) {
    setForm((prev) => {
      const current = prev.tags[category] ?? [];
      const next = current.includes(tag) ? current.filter((t) => t !== tag) : [...current, tag];
      return { ...prev, tags: { ...prev.tags, [category]: next } };
    });
  }

  async function save() {
    if (!form.chineseTitle.trim()) {
      setMessage("请先填中文片名");
      setOk(false);
      return;
    }
    setSaving(true);
    setMessage("");
    const payload = {
      chineseTitle: form.chineseTitle,
      originalTitle: form.originalTitle,
      releaseYear: Number(form.releaseYear),
      mediaType: form.mediaType,
      format: form.format,
      synopsis: form.synopsis,
      recommendation: form.recommendation,
      posterSrc: form.posterSrc.trim() || null,
      tags: { ...form.tags, exclude: form.tags.exclude ?? [] },
      directors: form.directors,
      cast: form.cast,
      country: form.country,
      franchise: form.franchise.trim() || null,
      franchiseName: form.franchiseName.trim() || null,
      seriesOrder: form.seriesOrder.trim() ? Number(form.seriesOrder) : null,
      audienceFit: form.audienceFit,
      audienceMismatch: form.audienceMismatch,
      watchStatus: form.watchStatus,
    };

    try {
      const res = await fetch(isNew ? "/api/admin/movies" : `/api/admin/movies/${initial!.id}`, {
        method: isNew ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error ?? "保存失败");
      setOk(true);
      setMessage("已保存，并写入正式数据库（catalog.json + raw）。");
      if (isNew && json.movie?.id) {
        router.replace(`/admin/movies/${json.movie.id}`);
        router.refresh();
        return;
      }
      router.refresh();
    } catch (err) {
      setOk(false);
      setMessage(err instanceof Error ? err.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!initial) return;
    if (!window.confirm(`确定要删除《${initial.chineseTitle}》吗？系统会先自动备份。`)) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/movies/${initial.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error ?? "删除失败");
      router.replace("/admin/movies");
      router.refresh();
    } catch (err) {
      setOk(false);
      setMessage(err instanceof Error ? err.message : "删除失败");
      setSaving(false);
    }
  }

  return (
    <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_300px]">
      <div className="space-y-8">
        <div className="grid gap-5 sm:grid-cols-2">
          <label className="block">
            <span className="admin-label">中文片名 *</span>
            <input className="field mt-2 w-full" value={form.chineseTitle} onChange={(e) => update("chineseTitle", e.target.value)} />
          </label>
          <label className="block">
            <span className="admin-label">原文片名</span>
            <input className="field mt-2 w-full" value={form.originalTitle} onChange={(e) => update("originalTitle", e.target.value)} />
          </label>
          <label className="block">
            <span className="admin-label">上映年份 *</span>
            <input
              className="field mt-2 w-full"
              type="number"
              min={1900}
              max={2100}
              value={form.releaseYear}
              onChange={(e) => update("releaseYear", Number(e.target.value))}
            />
          </label>
          <label className="block">
            <span className="admin-label">个人状态</span>
            <select
              className="field mt-2 w-full"
              value={form.watchStatus}
              onChange={(e) => update("watchStatus", e.target.value as AdminMovieFormValue["watchStatus"])}
            >
              <option value="watched">已看</option>
              <option value="wishlist">想看</option>
              <option value="unknown">未标记</option>
            </select>
          </label>
          <label className="block">
            <span className="admin-label">作品形态</span>
            <select
              className="field mt-2 w-full"
              value={form.mediaType}
              onChange={(e) => update("mediaType", e.target.value as AdminMovieFormValue["mediaType"])}
            >
              <option value="movie">电影</option>
              <option value="series">剧集</option>
              <option value="miniseries">迷你剧</option>
            </select>
          </label>
          <label className="block">
            <span className="admin-label">拍摄形式</span>
            <select
              className="field mt-2 w-full"
              value={form.format}
              onChange={(e) => update("format", e.target.value as AdminMovieFormValue["format"])}
            >
              <option value="live_action">真人</option>
              <option value="animation">动画</option>
            </select>
          </label>
        </div>

        <label className="block">
          <span className="admin-label">剧情简介（客观资料）</span>
          <textarea rows={4} className="field mt-2 w-full" value={form.synopsis} onChange={(e) => update("synopsis", e.target.value)} />
        </label>

        <label className="block">
          <span className="admin-label">编辑推荐语（主观内容）</span>
          <textarea rows={3} className="field mt-2 w-full" value={form.recommendation} onChange={(e) => update("recommendation", e.target.value)} />
        </label>

        <div className="grid gap-5 sm:grid-cols-2">
          <label className="block">
            <span className="admin-label">适合谁</span>
            <textarea rows={2} className="field mt-2 w-full" value={form.audienceFit} onChange={(e) => update("audienceFit", e.target.value)} />
          </label>
          <label className="block">
            <span className="admin-label">可能不适合谁</span>
            <textarea rows={2} className="field mt-2 w-full" value={form.audienceMismatch} onChange={(e) => update("audienceMismatch", e.target.value)} />
          </label>
        </div>

        <div className="grid gap-5 sm:grid-cols-3">
          <label className="block">
            <span className="admin-label">导演（顿号分隔）</span>
            <input className="field mt-2 w-full" value={joined(form.directors)} onChange={(e) => update("directors", split(e.target.value))} />
          </label>
          <label className="block">
            <span className="admin-label">主演（顿号分隔）</span>
            <input className="field mt-2 w-full" value={joined(form.cast)} onChange={(e) => update("cast", split(e.target.value))} />
          </label>
          <label className="block">
            <span className="admin-label">国家/地区（顿号分隔）</span>
            <input className="field mt-2 w-full" value={joined(form.country)} onChange={(e) => update("country", split(e.target.value))} />
          </label>
        </div>

        <div className="grid gap-5 sm:grid-cols-3">
          <label className="block">
            <span className="admin-label">系列 ID（英文短横线）</span>
            <input className="field mt-2 w-full" value={form.franchise} onChange={(e) => update("franchise", e.target.value)} placeholder="harry-potter" />
          </label>
          <label className="block">
            <span className="admin-label">系列显示名</span>
            <input className="field mt-2 w-full" value={form.franchiseName} onChange={(e) => update("franchiseName", e.target.value)} placeholder="哈利·波特系列" />
          </label>
          <label className="block">
            <span className="admin-label">系列第几部</span>
            <input className="field mt-2 w-full" value={form.seriesOrder} onChange={(e) => update("seriesOrder", e.target.value)} placeholder="1" />
          </label>
        </div>

        <div>
          <p className="admin-label">分类标签</p>
          <p className="mt-1 text-[0.7rem] text-[var(--color-ash-dim)]">点选即切换；标签来自站内词表，保证筛选真的生效。</p>
          <div className="mt-4 space-y-4">
            {tagGroups.map((group) => (
              <div key={group.category}>
                <p className="text-[0.72rem] text-[var(--color-ivory-dim)]">
                  {group.zh}
                  <span className="ml-2 text-[0.62rem] uppercase tracking-[0.18em] text-[var(--color-ash-dim)]">{group.category}</span>
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {group.terms.map((term) => {
                    const active = (tagValues[group.category] ?? []).includes(term.id);
                    return (
                      <button
                        key={term.id}
                        type="button"
                        onClick={() => toggleTag(group.category, term.id)}
                        title={term.hint}
                        className={`border px-3 py-1.5 text-[0.74rem] transition-colors ${
                          active
                            ? "border-[rgba(226,200,127,0.65)] bg-[rgba(226,200,127,0.12)] text-gold-soft"
                            : "border-[rgba(201,162,39,0.18)] text-[var(--color-ivory-dim)] hover:border-[rgba(226,200,127,0.4)]"
                        }`}
                      >
                        {term.id}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <aside className="space-y-6">
        <div>
          <p className="admin-label">海报 URL</p>
          <input
            className="field mt-2 w-full"
            value={form.posterSrc}
            onChange={(e) => update("posterSrc", e.target.value)}
            placeholder="/posters/xxx.jpg 或 https://…"
          />
          <p className="mt-2 text-[0.68rem] leading-relaxed text-[var(--color-ash-dim)]">
            建议用站内路径 <code>/posters/…</code>。填外链会直接引用外部图片，请自行确认授权。
          </p>
        </div>
        <div className="aspect-[2/3] w-full overflow-hidden border border-[rgba(201,162,39,0.2)] bg-[rgba(255,255,255,0.03)]">
          {form.posterSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={form.posterSrc} alt="海报预览" className="h-full w-full object-cover" />
          ) : (
            <p className="flex h-full items-center justify-center text-[0.7rem] text-[var(--color-ash-dim)]">暂无海报</p>
          )}
        </div>

        <div className="space-y-3">
          <button type="button" onClick={() => void save()} disabled={saving} className="btn btn-primary w-full !py-3 !text-[0.8rem]">
            {saving ? "保存中…" : isNew ? "创建并写入数据库" : "保存修改"}
          </button>
          {!isNew && (
            <button type="button" onClick={() => void remove()} disabled={saving} className="btn w-full !py-3 !text-[0.78rem]">
              删除这部作品
            </button>
          )}
        </div>

        {message && <p className={`text-[0.76rem] leading-relaxed ${ok ? "text-gold-soft" : "text-[#e0a3a3]"}`}>{message}</p>}

        {!isNew && (
          <div className="border border-[rgba(201,162,39,0.16)] p-4 text-[0.7rem] leading-relaxed text-[var(--color-ash-dim)]">
            <p>内部 ID：{initial!.id}</p>
            <a
              href={`/movies/${initial!.id}`}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-block text-gold-soft underline underline-offset-4"
            >
              在网站中查看 ↗
            </a>
          </div>
        )}
      </aside>
    </div>
  );
}
