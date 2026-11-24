"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function AdminLoginForm() {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "sending" | "error">("idle");
  const [message, setMessage] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setState("sending");
    setMessage("");
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: String(fd.get("username") ?? ""),
          password: String(fd.get("password") ?? ""),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error ?? "登录失败");
      router.replace("/admin");
      router.refresh();
    } catch (err) {
      setState("error");
      setMessage(err instanceof Error ? err.message : "登录失败");
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-10 max-w-sm space-y-5">
      <label className="block">
        <span className="text-[0.68rem] uppercase tracking-[0.18em] text-[var(--color-ash-dim)]">管理员账号</span>
        <input name="username" required autoComplete="username" className="field mt-2 w-full" />
      </label>
      <label className="block">
        <span className="text-[0.68rem] uppercase tracking-[0.18em] text-[var(--color-ash-dim)]">密码</span>
        <input name="password" type="password" required autoComplete="current-password" className="field mt-2 w-full" />
      </label>
      <div className="flex items-center gap-4">
        <button type="submit" className="btn btn-primary" disabled={state === "sending"}>
          {state === "sending" ? "登录中…" : "登录后台"}
        </button>
        {message && <p className="text-[0.76rem] text-[#e0a3a3]">{message}</p>}
      </div>
    </form>
  );
}
