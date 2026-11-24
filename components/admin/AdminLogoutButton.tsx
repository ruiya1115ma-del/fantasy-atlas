"use client";

import { useRouter } from "next/navigation";

export function AdminLogoutButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      className="text-[0.72rem] uppercase tracking-[0.16em] text-[var(--color-ash-dim)] transition-colors hover:text-gold-soft"
      onClick={async () => {
        await fetch("/api/admin/logout", { method: "POST" });
        router.replace("/admin/login");
        router.refresh();
      }}
    >
      退出登录
    </button>
  );
}
