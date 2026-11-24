"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

export interface AdminSubmissionRow {
  id: string;
  chineseTitle: string;
  originalTitle: string;
  releaseYear?: number;
  doubanUrl: string;
  reason: string;
  affection?: "loved" | "liked" | "meh";
  note: string;
  submitter: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  reviewedAt?: string;
  alreadyInLibrary: boolean;
  matchedId: string | null;
  matchedTitle: string | null;
}

const AFFECTION_ZH: Record<string, string> = {
  loved: "非常喜欢",
  liked: "喜欢",
  meh: "一般",
};

const TABS = [
  { id: "pending", label: "待处理" },
  { id: "approved", label: "已收录" },
  { id: "rejected", label: "暂不收录" },
  { id: "all", label: "全部" },
] as const;

export function AdminSubmissions() {
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("pending");
  const [rows, setRows] = useState<AdminSubmissionRow[]>([]);
  const [counts, setCounts] = useState({ pending: 0, approved: 0, rejected: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async (which: typeof tab) => {
    setLoading(true);
    setError("");
    try {
      const query = which === "all" ? "" : `?status=${which}`;
      const res = await fetch(`/api/admin/submissions${query}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error ?? "读取失败");
      setRows(json.submissions as AdminSubmissionRow[]);
      setCounts(json.counts);
    } catch (err) {
      setError(err instanceof Error ? err.message : "读取失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(tab);
  }, [tab, load]);

  async function review(id: string, action: "approve" | "reject") {
    setBusy(id);
    setError("");
    try {
      const res = await fetch(`/api/admin/submissions/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error ?? "操作失败");
      await load(tab);
    } catch (err) {
      setError(err instanceof Error ? err.message : "操作失败");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <div className="mt-8 flex flex-wrap gap-3">
        {TABS.map((t) => {
          const count =
            t.id === "pending" ? counts.pending : t.id === "approved" ? counts.approved : t.id === "rejected" ? counts.rejected : counts.pending + counts.approved + counts.rejected;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`border px-4 py-2 text-[0.78rem] transition-colors ${
                tab === t.id
                  ? "border-[rgba(226,200,127,0.6)] text-gold-soft"
                  : "border-[rgba(201,162,39,0.18)] text-[var(--color-ivory-dim)] hover:border-[rgba(226,200,127,0.4)]"
              }`}
            >
              {t.label} <span className="ml-1 text-[var(--color-ash-dim)]">{count}</span>
            </button>
          );
        })}
      </div>

      {error && <p className="mt-6 text-[0.8rem] text-[#e0a3a3]">{error}</p>}
      {loading && <p className="mt-6 text-[0.8rem] text-[var(--color-ash-dim)]">读取中…</p>}

      {!loading && rows.length === 0 && (
        <p className="mt-10 border border-dashed border-[rgba(201,162,39,0.2)] p-10 text-center text-[0.84rem] text-[var(--color-ash-dim)]">
          这一类还没有投稿。
        </p>
      )}

      <div className="mt-8 space-y-4">
        {rows.map((row) => (
          <article key={row.id} className="border border-[rgba(201,162,39,0.16)] p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h3 className="display text-xl text-ivory">
                  {row.chineseTitle}
                  {row.releaseYear ? <span className="ml-2 text-[0.8rem] text-[var(--color-ash-dim)]">{row.releaseYear}</span> : null}
                </h3>
                {row.originalTitle && (
                  <p className="mt-1 text-[0.76rem] italic text-[var(--color-ash-dim)]">{row.originalTitle}</p>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2 text-[0.7rem]">
                {row.affection && (
                  <span className="border border-[rgba(226,200,127,0.35)] px-2 py-1 text-gold-soft">
                    {AFFECTION_ZH[row.affection]}
                  </span>
                )}
                {row.alreadyInLibrary ? (
                  <span className="border border-[rgba(140,200,150,0.4)] px-2 py-1 text-[#a9d6b0]">
                    已在库{row.matchedTitle ? `：${row.matchedTitle}` : ""}
                  </span>
                ) : (
                  <span className="border border-[rgba(201,162,39,0.25)] px-2 py-1 text-[var(--color-ash-dim)]">库中没有</span>
                )}
                <span className="text-[var(--color-ash-dim)]">{new Date(row.createdAt).toLocaleString("zh-CN")}</span>
              </div>
            </div>

            {row.reason && (
              <blockquote className="mt-4 border-l border-[rgba(226,200,127,0.4)] pl-4 text-[0.84rem] leading-relaxed text-[var(--color-ivory-dim)]">
                {row.reason}
              </blockquote>
            )}
            {row.note && <p className="mt-3 text-[0.78rem] text-[var(--color-ash-dim)]">补充：{row.note}</p>}

            <div className="mt-4 flex flex-wrap items-center gap-4 text-[0.74rem]">
              <a href={row.doubanUrl} target="_blank" rel="noreferrer" className="text-gold-soft underline underline-offset-4">
                豆瓣条目 ↗
              </a>
              <span className="text-[var(--color-ash-dim)]">投稿人：{row.submitter || "anonymous"}</span>
              {row.status !== "pending" && (
                <span className="text-[var(--color-ash-dim)]">
                  已{row.status === "approved" ? "收录" : "驳回"}
                  {row.reviewedAt ? ` · ${new Date(row.reviewedAt).toLocaleString("zh-CN")}` : ""}
                </span>
              )}
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              {row.status !== "approved" && (
                <button
                  type="button"
                  disabled={busy === row.id}
                  onClick={() => void review(row.id, "approve")}
                  className="btn btn-primary !px-5 !py-2 !text-[0.76rem]"
                >
                  {busy === row.id ? "处理中…" : "收录"}
                </button>
              )}
              {row.status !== "rejected" && (
                <button
                  type="button"
                  disabled={busy === row.id}
                  onClick={() => void review(row.id, "reject")}
                  className="btn !px-5 !py-2 !text-[0.76rem]"
                >
                  暂不收录
                </button>
              )}
              {row.alreadyInLibrary && row.matchedId && (
                <Link
                  href={`/admin/movies/${row.matchedId}`}
                  className="border border-[rgba(201,162,39,0.25)] px-4 py-2 text-[0.76rem] text-[var(--color-ivory-dim)] hover:border-[rgba(226,200,127,0.5)]"
                >
                  编辑库里这条 →
                </Link>
              )}
              {!row.alreadyInLibrary && (
                <Link
                  href={`/admin/movies/new?title=${encodeURIComponent(row.chineseTitle)}&year=${row.releaseYear ?? ""}&original=${encodeURIComponent(row.originalTitle)}`}
                  className="border border-[rgba(201,162,39,0.25)] px-4 py-2 text-[0.76rem] text-[var(--color-ivory-dim)] hover:border-[rgba(226,200,127,0.5)]"
                >
                  用这条新建作品 →
                </Link>
              )}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
