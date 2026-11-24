import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminHomeManager } from "@/components/admin/AdminHomeManager";
import { Note } from "@/components/ui";
import { isAdmin } from "@/lib/admin/auth";
import { getKv } from "@/lib/admin/kv";
import { getMoviesRuntime } from "@/lib/admin/store-kv";
import { loadHomeConfig } from "@/lib/home-config";
import { loadHomeConfigRuntime } from "@/lib/home-config-kv";

export const metadata: Metadata = { title: "首页内容管理", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AdminHomePage() {
  if (!(await isAdmin())) redirect("/admin/login");

  const kv = await getKv();
  const config = kv ? await loadHomeConfigRuntime() : loadHomeConfig();
  const library = (await getMoviesRuntime()).map((m) => ({
    id: m.id,
    title: m.chineseTitle,
    originalTitle: m.originalTitle,
    year: m.releaseYear,
    poster: m.poster?.src ?? m.backdrop?.src ?? "",
  }));

  return (
    <div>
      <AdminHomeManager initialConfig={config} libraryCount={library.length} library={library} />

      <div className="mt-10 space-y-3 border-t border-[var(--hairline)] pt-6">
        <Note>
          首页板块与主题卡片完全来自这份配置（<code>data/home-config.json</code>），不再写死在代码里。
          隐藏的板块 / 主题只从前台消失，配置仍在后台，随时可以恢复；删除会永久移除配置与关联，
          但电影原始资料（{library.length} 部）不受影响，每次保存前还会在 <code>data/backups</code> 留一份配置备份。
        </Note>
        <Note>
          探索页的多标签筛选、详情页、收藏都不读这份配置，所以在这里怎么改都不会影响它们。
          主题卡片的图片建议用 <code>/posters-douban/…</code> 下的真实海报；不填时会自动用该主题第一部电影的海报。
        </Note>
        <p className="text-[0.78rem] text-[var(--color-ivory-dim)]">
          前台效果：
          <Link href="/" className="ml-1 text-gold-soft underline-offset-4 hover:underline">
            打开首页 →
          </Link>
        </p>
      </div>
    </div>
  );
}
