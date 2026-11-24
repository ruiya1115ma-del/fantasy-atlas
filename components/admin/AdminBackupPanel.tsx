"use client";

import { useState } from "react";

export function AdminBackupPanel() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function snapshot() {
    setBusy(true);
    setMessage("");
    try {
      const res = await fetch("/api/admin/backup", { method: "POST" });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error ?? "备份失败");
      setMessage(`已生成备份：${json.name}`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "备份失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-4">
      <a
        href="/api/admin/backup"
        className="btn btn-primary !px-6 !py-3 !text-[0.8rem]"
        download
      >
        导出整库 JSON
      </a>
      <button type="button" onClick={() => void snapshot()} disabled={busy} className="btn !px-6 !py-3 !text-[0.8rem]">
        {busy ? "备份中…" : "立即生成一份备份"}
      </button>
      {message && <p className="text-[0.78rem] text-gold-soft">{message}</p>}
    </div>
  );
}
