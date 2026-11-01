"use client";

import { useEffect, useMemo, useRef, useState } from "react";

interface Match {
  doubanId: string;
  doubanUrl: string;
  chineseTitle: string;
  originalTitle: string;
  year: number | null;
  isTv: boolean;
  genres: string[];
  intro: string;
  rating: { value: number; scale: number; count: number | null } | null;
  poster: string | null;
  confidence: number;
  reason: string;
}

interface Item {
  id: string;
  query: string;
  status: "matched" | "needs_review" | "published" | "rejected";
  match: Match | null;
  themeSlug: string | null;
  tags: Record<string, string[]>;
  note: string;
  createdAt: string;
}

const THEMES = [
  { slug: "enchanted-worlds", zh: "魔法世界" },
  { slug: "dark-gothic", zh: "暗黑与哥特" },
  { slug: "epic-fantasy", zh: "史诗奇幻" },
  { slug: "surreal-dreams", zh: "超现实梦境" },
  { slug: "whimsical-tales", zh: "奇趣童话" },
];

const STATUS_LABEL: Record<Item["status"], string> = {
  matched: "已匹配",
  needs_review: "待审核",
  published: "已发布",
  rejected: "已驳回",
};

export function AdminImport() {
  const [token, setToken] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const saved = window.localStorage.getItem("fa:admin-token");
    if (saved) setToken(saved);
  }, []);

  useEffect(() => {
    if (token) window.localStorage.setItem("fa:admin-token", token);
  }, [token]);

  const counts = useMemo(() => {
    const c = { matched: 0, needs_review: 0, published: 0, rejected: 0 } as Record<Item["status"], number>;
    for (const i of items) c[i.status]++;
    return c;
  }, [items]);

  async function refresh() {
    if (!token) return setMessage("先填管理口令");
    const res = await fetch(`/api/admin/import?token=${encodeURIComponent(token)}`);
    const json = await res.json();
    if (!res.ok || !json.ok) return setMessage(json.error ?? "读取失败");
    setItems(json.items ?? []);
    setMessage(`队列共 ${(json.items ?? []).length} 条`);
  }

  async function startImport() {
    if (!token) return setMessage("先填管理口令");
    if (!text.trim()) return setMessage("先粘贴片名");
    setBusy(true);
    setMessage("正在逐条匹配豆瓣资料（串行，约 2–3 秒/部）…");
    try {
      const res = await fetch("/api/admin/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, text }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error ?? "导入失败");
      setItems(json.queue ?? []);
      setMessage(
        `新增 ${json.added} 条，跳过重复 ${json.skipped?.length ?? 0} 条；其中 ${
          (json.results ?? []).filter((r: { status: string }) => r.status === "matched").length
        } 条自动匹配成功。`
      );
      setText("");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "导入失败");
    } finally {
      setBusy(false);
    }
  }

  async function act(action: "publish" | "reject" | "delete", ids = selected) {
    if (!token) return setMessage("先填管理口令");
    if (!ids.length) return setMessage("先勾选条目");
    setBusy(true);
    try {
      const res = await fetch("/api/admin/import/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, ids, action }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error ?? "操作失败");
      setMessage(json.hint ?? `已处理 ${ids.length} 条`);
      await refresh();
      setSelected([]);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "操作失败");
    } finally {
      setBusy(false);
    }
  }

  async function saveEdit(item: Item, patch: Record<string, unknown>) {
    if (!token) return setMessage("先填管理口令");
    const res = await fetch("/api/admin/import/action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, ids: [item.id], action: "edit", patch }),
    });
    const json = await res.json();
    if (!res.ok || !json.ok) return setMessage(json.error ?? "保存失败");
    setItems((prev) => prev.map((i) => (i.id === item.id ? (json.item as Item) : i)));
    setMessage("已保存修改");
  }

  async function onFile(file: File) {
    const content = await file.text();
    setText(content);
    setMessage(`已读取 ${file.name}（${Math.round(content.length / 1024)} KB），确认后点「开始匹配」`);
  }

  const pending = items.filter((i) => i.status === "matched" || i.status === "needs_review");

  return (
    <section className="mt-12">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Bulk Import</p>
          <h2 className="display mt-2 text-2xl text-ivory">片单批量导入</h2>
        </div>
        <input
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="ADMIN_TOKEN"
          className="field w-56"
        />
      </div>

      <p className="mt-3 max-w-2xl text-[0.78rem] leading-relaxed text-[var(--color-ash)]">
        一行一部（可带年份，例如「潘神的迷宫 2006」），或直接拖入 CSV / JSON。
        系统只处理<strong className="text-[var(--color-ivory-dim)]">新提交</strong>的条目：已在库里的会被跳过，
        不重扫、不重写原有数据。匹配不到或不确定的会停在「待审核」，不会编造资料。
      </p>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={7}
        className="field mt-4 w-full font-mono text-[0.8rem]"
        placeholder={"潘神的迷宫 2006\n哈尔的移动城堡 2004\nCoraline 2009"}
      />

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button type="button" onClick={startImport} disabled={busy} className="btn btn-primary btn-sm">
          {busy ? "处理中…" : "开始匹配"}
        </button>
        <button type="button" onClick={() => fileRef.current?.click()} className="btn btn-ghost btn-sm">
          选择 CSV / JSON 文件
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,.json,.txt"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void onFile(f);
          }}
        />
        <button type="button" onClick={refresh} className="btn btn-quiet btn-sm">
          刷新队列
        </button>
        <span className="text-[0.7rem] text-[var(--color-ash-dim)]">
          待审核 {counts.needs_review} · 已匹配 {counts.matched} · 已发布 {counts.published}
        </span>
      </div>

      {message && <p className="mt-3 text-[0.76rem] text-gold-soft">{message}</p>}

      {pending.length > 0 && (
        <>
          <div className="mt-8 flex flex-wrap items-center gap-3 border-y border-[var(--hairline)] py-3">
            <label className="flex items-center gap-2 text-[0.72rem] text-[var(--color-ivory-dim)]">
              <input
                type="checkbox"
                checked={selected.length === pending.length && pending.length > 0}
                onChange={(e) => setSelected(e.target.checked ? pending.map((i) => i.id) : [])}
              />
              全选（{pending.length}）
            </label>
            <button type="button" onClick={() => act("publish")} disabled={busy} className="btn btn-primary btn-sm">
              发布选中
            </button>
            <button type="button" onClick={() => act("reject")} disabled={busy} className="btn btn-quiet btn-sm">
              驳回选中
            </button>
            <button type="button" onClick={() => act("delete")} disabled={busy} className="btn btn-quiet btn-sm">
              删除选中
            </button>
          </div>

          <ul className="mt-4 space-y-3">
            {pending.map((item) => {
              const m = item.match;
              const checked = selected.includes(item.id);
              return (
                <li key={item.id} className="border border-[var(--hairline)] p-4">
                  <div className="flex flex-wrap items-start gap-4">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={checked}
                      onChange={(e) =>
                        setSelected((prev) => (e.target.checked ? [...prev, item.id] : prev.filter((x) => x !== item.id)))
                      }
                    />
                    {m?.poster ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={m.poster} alt={m.chineseTitle} className="h-24 w-16 shrink-0 object-cover" loading="lazy" />
                    ) : (
                      <div className="flex h-24 w-16 shrink-0 items-center justify-center border border-[var(--hairline)] text-[0.6rem] text-[var(--color-ash-dim)]">
                        无图
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-2">
                        <input
                          defaultValue={m?.chineseTitle ?? item.query}
                          onBlur={(e) => m && e.target.value !== m.chineseTitle && saveEdit(item, { chineseTitle: e.target.value })}
                          className="field w-52 text-[0.86rem]"
                        />
                        <input
                          type="number"
                          defaultValue={m?.year ?? ""}
                          onBlur={(e) =>
                            m && Number(e.target.value) !== m.year && saveEdit(item, { year: Number(e.target.value) })
                          }
                          className="field w-24 text-[0.8rem]"
                        />
                        <span
                          className={`text-[0.64rem] tracking-[0.1em] ${
                            item.status === "matched" ? "text-gold-soft" : "text-[#e0b3a3]"
                          }`}
                        >
                          {STATUS_LABEL[item.status]}
                          {m ? ` · 置信度 ${m.confidence.toFixed(2)}` : ""}
                        </span>
                      </div>

                      {m && (
                        <p className="mt-1.5 text-[0.72rem] text-[var(--color-ash-dim)]">
                          {m.originalTitle} · {m.genres.join(" / ")} ·{" "}
                          {m.rating ? `豆瓣 ${m.rating.value.toFixed(1)}（${m.rating.count ?? "-"} 人）` : "无评分"}
                        </p>
                      )}
                      {m?.intro && (
                        <p className="mt-1.5 line-clamp-2 text-[0.74rem] leading-relaxed text-[var(--color-ivory-dim)]">
                          {m.intro}
                        </p>
                      )}
                      {item.note && <p className="mt-1 text-[0.68rem] text-[var(--color-ash-dim)]">{item.note}</p>}

                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <select
                          value={item.themeSlug ?? ""}
                          onChange={(e) => saveEdit(item, { themeSlug: e.target.value })}
                          className="field text-[0.74rem]"
                        >
                          <option value="">（未选主题）</option>
                          {THEMES.map((t) => (
                            <option key={t.slug} value={t.slug}>
                              {t.zh}
                            </option>
                          ))}
                        </select>
                        {m && (
                          <a
                            href={m.doubanUrl}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="text-[0.7rem] text-gold-soft underline decoration-dotted"
                          >
                            豆瓣条目 ↗
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}

      <p className="mt-6 text-[0.7rem] leading-relaxed text-[var(--color-ash-dim)]">
        说明：发布只会往 <code className="text-[var(--color-ivory-dim)]">data/raw/catalog-imported.json</code> 追加记录，
        绝不修改或重新生成已有电影；发布后运行一次 <code className="text-[var(--color-ivory-dim)]">npm run merge</code>{" "}
        即可在网站上看到新条目。图片来源为豆瓣条目海报，不使用任何 AI 生成图。
      </p>
    </section>
  );
}
