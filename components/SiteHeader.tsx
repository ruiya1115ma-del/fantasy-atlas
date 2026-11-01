"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const NAV = [
  { href: "/", label: "首页", en: "Home" },
  { href: "/explore", label: "探索", en: "Explore" },
  { href: "/favorites", label: "我的收藏", en: "Library" },
  { href: "/submit", label: "投稿补充", en: "Contribute" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <header
      className={`sticky top-0 z-50 transition-all duration-500 ${
        scrolled ? "border-b border-[var(--hairline)] bg-[rgba(5,7,12,0.86)] backdrop-blur-xl" : "bg-transparent"
      }`}
    >
      <div className="shell flex h-16 items-center justify-between gap-6 md:h-20">
        <Link href="/" className="group flex flex-col leading-none" aria-label="Fantasy Atlas 首页">
          <span className="display text-lg tracking-[0.02em] text-ivory transition-colors group-hover:text-gold-soft md:text-xl">
            Fantasy Atlas
          </span>
          <span className="mt-1 text-[0.58rem] uppercase tracking-[0.32em] text-[var(--color-ash-dim)]">
            奇幻电影探索指南
          </span>
        </Link>

        <nav aria-label="主导航" className="hidden items-center gap-7 md:flex">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`relative py-2 text-[0.78rem] tracking-[0.1em] transition-colors ${
                isActive(item.href) ? "text-gold-soft" : "text-[var(--color-ivory-dim)] hover:text-ivory"
              }`}
            >
              {item.label}
              <span
                aria-hidden
                className={`absolute inset-x-0 -bottom-0.5 h-px origin-left bg-gold transition-transform duration-500 ${
                  isActive(item.href) ? "scale-x-100" : "scale-x-0"
                }`}
              />
            </Link>
          ))}
        </nav>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="mobile-nav"
          className="flex h-9 w-9 items-center justify-center border border-[var(--hairline)] text-ivory md:hidden"
        >
          <span className="sr-only">{open ? "关闭菜单" : "打开菜单"}</span>
          <span aria-hidden className="relative block h-3 w-4">
            <span
              className={`absolute inset-x-0 top-0 h-px bg-current transition-transform duration-300 ${
                open ? "translate-y-1.5 rotate-45" : ""
              }`}
            />
            <span
              className={`absolute inset-x-0 top-1.5 h-px bg-current transition-opacity duration-300 ${
                open ? "opacity-0" : ""
              }`}
            />
            <span
              className={`absolute inset-x-0 top-3 h-px bg-current transition-transform duration-300 ${
                open ? "-translate-y-1.5 -rotate-45" : ""
              }`}
            />
          </span>
        </button>
      </div>

      {open && (
        <div id="mobile-nav" className="border-t border-[var(--hairline)] bg-[rgba(5,7,12,0.97)] backdrop-blur-xl md:hidden">
          <nav aria-label="移动端导航" className="shell flex flex-col py-3">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-baseline justify-between border-b border-[var(--hairline)] py-3 text-sm last:border-0 ${
                  isActive(item.href) ? "text-gold-soft" : "text-[var(--color-ivory-dim)]"
                }`}
              >
                <span>{item.label}</span>
                <span className="text-[0.6rem] uppercase tracking-[0.2em] text-[var(--color-ash-dim)]">{item.en}</span>
              </Link>
            ))}
          </nav>
        </div>
      )}
    </header>
  );
}
