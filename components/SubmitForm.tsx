"use client";

import { useState } from "react";

export function SubmitForm() {
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const payload = {
      chineseTitle: String(fd.get("chineseTitle") ?? ""),
      originalTitle: String(fd.get("originalTitle") ?? ""),
      releaseYear: fd.get("releaseYear") ? Number(fd.get("releaseYear")) : undefined,
      doubanUrl: String(fd.get("doubanUrl") ?? ""),
      note: String(fd.get("note") ?? ""),
      submitter: String(fd.get("submitter") ?? ""),
    };

    setState("sending");
    setMessage("");
    try {
      const res = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error ?? "提交失败");
      setState("done");
      setMessage("已收到投稿，进入待审核队列。通过后才会出现在正式片单里。");
      form.reset();
    } catch (err) {
      setState("error");
      setMessage(err instanceof Error ? err.message : "提交失败");
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="block">
          <span className="text-[0.68rem] uppercase tracking-[0.18em] text-[var(--color-ash-dim)]">中文片名 *</span>
          <input name="chineseTitle" required className="field mt-2 w-full" placeholder="例如：潘神的迷宫" />
        </label>
        <label className="block">
          <span className="text-[0.68rem] uppercase tracking-[0.18em] text-[var(--color-ash-dim)]">原文片名</span>
          <input name="originalTitle" className="field mt-2 w-full" placeholder="例如：El laberinto del fauno" />
        </label>
        <label className="block">
          <span className="text-[0.68rem] uppercase tracking-[0.18em] text-[var(--color-ash-dim)]">上映年份</span>
          <input name="releaseYear" type="number" min={1900} max={2100} className="field mt-2 w-full" placeholder="2006" />
        </label>
        <label className="block">
          <span className="text-[0.68rem] uppercase tracking-[0.18em] text-[var(--color-ash-dim)]">你的署名（可留空）</span>
          <input name="submitter" className="field mt-2 w-full" placeholder="anonymous" />
        </label>
      </div>

      <label className="block">
        <span className="text-[0.68rem] uppercase tracking-[0.18em] text-[var(--color-ash-dim)]">豆瓣条目链接 *</span>
        <input
          name="doubanUrl"
          required
          className="field mt-2 w-full"
          placeholder="https://movie.douban.com/subject/1767042/"
        />
        <span className="mt-2 block text-[0.66rem] leading-relaxed text-[var(--color-ash-dim)]">
          为什么必须给豆瓣链接：本站的资料与图片都按豆瓣条目核对，没有条目就无法验证，也不会编造。
        </span>
      </label>

      <label className="block">
        <span className="text-[0.68rem] uppercase tracking-[0.18em] text-[var(--color-ash-dim)]">补充说明</span>
        <textarea name="note" rows={4} className="field mt-2 w-full" placeholder="为什么想把它加进来？或者要更正哪条资料？" />
      </label>

      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" className="btn btn-primary" disabled={state === "sending"}>
          {state === "sending" ? "提交中…" : "提交投稿"}
        </button>
        {message && (
          <p className={`text-[0.76rem] ${state === "error" ? "text-[#e0a3a3]" : "text-gold-soft"}`}>{message}</p>
        )}
      </div>
    </form>
  );
}
