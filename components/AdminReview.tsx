"use client";

import { useState } from "react";

export interface AdminSubmission {
  id: string;
  chineseTitle: string;
  originalTitle?: string;
  releaseYear?: number;
  doubanUrl: string;
  note?: string;
  submitter?: string;
  status: string;
  createdAt: string;
  reviewedAt?: string;
  reviewNote?: string;
}

export function AdminReview({ initial }: { initial: AdminSubmission[] }) {
  const [token, setToken] = useState("");
  const [items, setItems] = useState(initial);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  async function refresh() {
    const res = await fetch(`/api/submissions?token=${encodeURIComponent(token)}`);
    const json = await res.json();
    if (!res.ok || !json.ok) {
      setMessage(json.error ?? "读取失败");
      return;
    }
    setItems(json.submissions);
    setMessage(`已刷新，共 ${json.submissions.length} 条`);
  }

  async function review(id: string, action: "approve" | "reject") {
    setBusy(id);
    try {
      const res = await fetch("/api/submissions/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action, token }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error ?? "操作失败");
      setMessage(json.hint ?? (action === "approve" ? "已通过" : "已驳回"));
      setItems((prev) =>
        prev.map((s) => (s.id === id ? { ...s, status: action === "approve" ? "approved" : "rejected" } : s))
      );
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "操作失败");
    } finally {
      setBusy(null);
    }
  }

  const pending = items.filter((s) => s.status === "pending");
  const reviewed = items.filter((s) => s.status !== "pending");

  return (
    <div className="mt-8">
      <div className="flex flex-wrap items-end gap-3 border border-[var(--hairline)] p-4">
        <label className="flex-1">
          <span className="text-[0.66rem] uppercase tracking-[0.18em] text-[var(--color-ash-dim)]">管理口令</span>
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            className="field mt-2 w-full"
            placeholder="ADMIN_TOKEN"
          />
        </label>
        <button type="button" onClick={refresh} className="btn btn-ghost btn-sm">
          刷新队列
        </button>
      </div>

      {message && <p className="mt-3 text-[0.76rem] text-gold-soft">{message}</p>}

      <h2 className="display mt-10 text-xl text-ivory">待审核 {pending.length} 条</h2>
      {pending.length === 0 ? (
        <p className="mt-3 text-[0.8rem] text-[var(--color-ash-dim)]">队列为空。</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {pending.map((s) => (
            <li key={s.id} className="border border-[var(--hairline)] p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <p className="text-[0.95rem] text-ivory">
                  {s.chineseTitle}
                  {s.releaseYear ? <span className="ml-2 text-[0.72rem] text-[var(--color-ash-dim)]">{s.releaseYear}</span> : null}
                </p>
                <span className="text-[0.62rem] tracking-[0.1em] text-[var(--color-ash-dim)]">
                  {new Date(s.createdAt).toLocaleString("zh-CN")}
                </span>
              </div>
              {s.originalTitle && <p className="mt-1 text-[0.72rem] text-[var(--color-ash-dim)]">{s.originalTitle}</p>}
              <a
                href={s.doubanUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="mt-2 inline-block text-[0.72rem] text-gold-soft underline decoration-dotted"
              >
                {s.doubanUrl}
              </a>
              {s.note && <p className="mt-2 text-[0.76rem] leading-relaxed text-[var(--color-ivory-dim)]">{s.note}</p>}
              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => review(s.id, "approve")}
                  disabled={busy === s.id || !token}
                  className="btn btn-primary btn-sm"
                >
                  通过
                </button>
                <button
                  type="button"
                  onClick={() => review(s.id, "reject")}
                  disabled={busy === s.id || !token}
                  className="btn btn-quiet btn-sm"
                >
                  驳回
                </button>
                {s.submitter && (
                  <span className="ml-2 text-[0.66rem] text-[var(--color-ash-dim)]">投稿人：{s.submitter}</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {reviewed.length > 0 && (
        <>
          <h2 className="display mt-10 text-xl text-ivory">已处理 {reviewed.length} 条</h2>
          <ul className="mt-4 space-y-2">
            {reviewed.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--hairline)] py-2">
                <span className="text-[0.82rem] text-[var(--color-ivory-dim)]">{s.chineseTitle}</span>
                <span
                  className={`text-[0.66rem] tracking-[0.12em] ${
                    s.status === "approved" ? "text-gold-soft" : "text-[var(--color-ash-dim)]"
                  }`}
                >
                  {s.status === "approved" ? "已通过" : "已驳回"}
                  {s.reviewedAt ? ` · ${new Date(s.reviewedAt).toLocaleString("zh-CN")}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
