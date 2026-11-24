import Link from "next/link";
import type { ReactNode } from "react";
import { AdminLogoutButton } from "./AdminLogoutButton";
import { isAdmin } from "@/lib/admin/auth";

const LINKS = [
  { href: "/admin", label: "总览" },
  { href: "/admin/home", label: "首页内容" },
  { href: "/admin/submissions", label: "投稿审核" },
  { href: "/admin/movies", label: "电影资料" },
  { href: "/admin/tags", label: "标签" },
  { href: "/admin/media", label: "缺海报" },
  { href: "/admin/data", label: "数据与备份" },
  { href: "/admin/sources", label: "数据与授权" },
];

/** 后台外壳：未登录时只渲染 children（登录页复用同一 layout）。 */
export async function AdminShell({ children }: { children: ReactNode }) {
  const admin = await isAdmin();
  if (!admin) return <>{children}</>;

  return (
    <div className="min-h-screen bg-[var(--color-ink)]">
      <div className="border-b border-[rgba(201,162,39,0.18)] bg-[rgba(8,9,14,0.9)]">
        <div className="shell flex flex-wrap items-center justify-between gap-4 py-5">
          <div className="flex items-baseline gap-4">
            <span className="display text-lg text-ivory">Fantasy Atlas</span>
            <span className="text-[0.66rem] uppercase tracking-[0.2em] text-gold-soft">Admin</span>
          </div>
          <div className="flex flex-wrap items-center gap-5">
            {LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="text-[0.76rem] tracking-[0.04em] text-[var(--color-ivory-dim)] transition-colors hover:text-gold-soft"
              >
                {l.label}
              </Link>
            ))}
            <Link href="/" className="text-[0.72rem] text-[var(--color-ash-dim)] hover:text-gold-soft">
              回到网站
            </Link>
            <AdminLogoutButton />
          </div>
        </div>
      </div>
      <main className="shell pb-24 pt-10">{children}</main>
    </div>
  );
}
