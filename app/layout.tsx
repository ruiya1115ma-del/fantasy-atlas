import type { Metadata, Viewport } from "next";
import "./globals.css";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { LibraryProvider } from "@/components/LibraryProvider";

export const metadata: Metadata = {
  title: {
    default: "Fantasy Atlas · 奇幻电影探索指南",
    template: "%s · Fantasy Atlas",
  },
  description:
    "Enter Another World. 一个以视觉与情绪为线索的奇幻电影探索指南：按世界观、美学、元素与氛围找到下一部值得进入的作品。",
  keywords: ["奇幻电影", "电影推荐", "奇幻电影清单", "fantasy movies", "visual aesthetic"],
  openGraph: {
    title: "Fantasy Atlas · 奇幻电影探索指南",
    description: "Enter Another World. 探索那些值得进入的幻想世界。",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#05070c",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-Hans">
      <head>
        {/* 字体：运行时从 Google Fonts 取（不进构建流程，断网也不会让 build 失败） */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400;1,600&family=Noto+Serif+SC:wght@300;400;500;600;700&display=swap"
        />
      </head>
      <body className="min-h-dvh antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:bg-gold focus:px-4 focus:py-2 focus:text-sm focus:text-[#191204]"
        >
          跳到主要内容
        </a>
        <LibraryProvider>
          <SiteHeader />
          <main id="main">{children}</main>
          <SiteFooter />
        </LibraryProvider>
      </body>
    </html>
  );
}
