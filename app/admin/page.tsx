import Link from "next/link";
import { redirect } from "next/navigation";
import { Note } from "@/components/ui";
import { isAdmin, usingDefaultPassword } from "@/lib/admin/auth";
import { getKv } from "@/lib/admin/kv";
import { listBackups, missingPosters, readCatalog, tagUsage } from "@/lib/admin/store";
import { getMoviesRuntime, missingPostersKv, tagUsageKv } from "@/lib/admin/store-kv";
import { listSubmissionsWithFlags } from "@/lib/admin/submissions";
import { loadHomeConfig } from "@/lib/home-config";
import { loadHomeConfigRuntime } from "@/lib/home-config-kv";
import { listSubmissionsWithFlagsKv } from "@/lib/submissions-kv";

export const dynamic = "force-dynamic";

export default async function AdminHome() {
  if (!(await isAdmin())) redirect("/admin/login");

  const kv = await getKv();
  const catalogMovies = kv ? await getMoviesRuntime() : readCatalog().movies;
  const missing = kv ? await missingPostersKv() : missingPosters();
  const submissions = kv
    ? await listSubmissionsWithFlagsKv(
        catalogMovies.map((m) => ({
          id: m.id,
          chineseTitle: m.chineseTitle,
          originalTitle: m.originalTitle,
          releaseYear: m.releaseYear,
        })),
      )
    : listSubmissionsWithFlags();
  const pending = submissions.filter((s) => s.status === "pending");
  const backups = kv ? [] : listBackups();
  const tags = kv ? await tagUsageKv() : tagUsage();
  const unusedTags = tags.filter((t) => t.unused);
  const homeConfig = kv ? await loadHomeConfigRuntime() : loadHomeConfig();
  const homeThemes = homeConfig.sections.flatMap((s) => s.themes);
  const homeLinks = homeThemes.reduce((acc, t) => acc + t.movieIds.length, 0);
  const firstSectionId = homeConfig.sections[0]?.id;

  const cards = [
    {
      href: "/admin/submissions",
      kicker: "Review",
      title: "投稿审核",
      value: `${pending.length} 条待处理`,
      desc: "查看投稿人写的推荐理由、喜爱程度，以及这部是否已经在库里。",
    },
    {
      href: "/admin/movies",
      kicker: "Library",
      title: "电影资料",
      value: `${catalogMovies.length} 部作品`,
      desc: "新增、修改、删除作品：片名、年份、简介、海报、分类标签，保存即写入正式数据库。",
    },
    {
      href: "/admin/tags",
      kicker: "Tags",
      title: "分类标签",
      value: `${tags.length} 个标签 · ${unusedTags.length} 个未使用`,
      desc: "看清每个标签在库里被用了多少次，发现空标签与历史遗留标签。",
    },
    {
      href: "/admin/media",
      kicker: "Images",
      title: "缺失海报检查",
      value: `${missing.length} 部缺图`,
      desc: "还没有真实海报的作品集中列出，可直接跳去补图。",
    },
    {
      href: "/admin/data",
      kicker: "Data",
      title: "数据导出与备份",
      value: `${backups.length} 份备份`,
      desc: "一键导出整库 JSON；每次修改前系统都会自动备份。",
    },
    {
      href: "/admin/import",
      kicker: "Import",
      title: "批量导入（旧工具）",
      value: "豆瓣匹配",
      desc: "粘贴片单批量匹配豆瓣条目，经过队列再发布。需要 ADMIN_TOKEN。",
    },
  ];

  return (
    <div>
      <p className="eyebrow">Admin · Overview</p>
      <h1 className="display mt-3 text-4xl text-ivory">后台总览</h1>
      <p className="lede mt-4 max-w-2xl text-[0.9rem]">
        这是一个只给作者用的轻量后台：不做用户系统、不做权限角色，只有「登录」与「不登录」两种状态。
        所有读写都在服务端完成，普通访客无法访问这些接口。
      </p>

      {usingDefaultPassword() && (
        <div className="mt-8 border border-[rgba(224,163,163,0.35)] bg-[rgba(224,163,163,0.06)] p-5 text-[0.82rem] leading-relaxed text-[#e8c4c4]">
          当前还在使用内置的开发口令。部署到公网前，请在环境变量里设置
          <code className="mx-1 text-ivory">ADMIN_USER</code>、
          <code className="mx-1 text-ivory">ADMIN_PASSWORD</code>、
          <code className="mx-1 text-ivory">ADMIN_SECRET</code>。
        </div>
      )}

      {/* 首页内容管理：主要功能模块，直接给出三块管理入口 */}
      <section
        aria-labelledby="admin-home-heading"
        className="mt-10 border border-[rgba(201,162,39,0.28)] bg-[rgba(10,12,19,0.6)] p-6"
      >
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[0.62rem] uppercase tracking-[0.24em] text-gold-soft">Home</p>
            <h2 id="admin-home-heading" className="display mt-2 text-2xl text-ivory">
              首页内容管理
            </h2>
            <p className="mt-2 max-w-xl text-[0.8rem] leading-relaxed text-[var(--color-ivory-dim)]">
              首页现在有 {homeConfig.sections.length} 个板块、{homeThemes.length} 个主题卡片、{homeLinks} 条电影归属。
              板块数量、主题名称、图片、顺序、哪些电影进哪个主题，都在这里改。
            </p>
          </div>
          <Link
            href="/admin/home"
            className="border border-[rgba(226,200,127,0.6)] bg-[rgba(226,200,127,0.12)] px-4 py-2 text-[0.76rem] text-gold-soft transition-colors hover:bg-[rgba(226,200,127,0.2)]"
          >
            打开首页内容管理 →
          </Link>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <Link
            href="/admin/home#sections"
            className="group border border-[var(--hairline)] p-4 transition-colors hover:border-[rgba(226,200,127,0.5)]"
          >
            <p className="text-[0.6rem] uppercase tracking-[0.22em] text-gold-soft">Sections</p>
            <p className="mt-1.5 text-[0.95rem] text-ivory">板块管理</p>
            <p className="mt-1 text-[0.72rem] text-[var(--color-ash-dim)]">
              新增 / 删除 / 隐藏 / 改名 / 排序，切换并排展开或平铺布局
            </p>
          </Link>
          <Link
            href={firstSectionId ? `/admin/home#themes-${firstSectionId}` : "/admin/home#sections"}
            className="group border border-[var(--hairline)] p-4 transition-colors hover:border-[rgba(226,200,127,0.5)]"
          >
            <p className="text-[0.6rem] uppercase tracking-[0.22em] text-gold-soft">Theme Cards</p>
            <p className="mt-1.5 text-[0.95rem] text-ivory">主题管理</p>
            <p className="mt-1 text-[0.72rem] text-[var(--color-ash-dim)]">
              增删主题、改名称与图片、排序、移动到其它板块
            </p>
          </Link>
          <Link
            href="/admin/home#movies"
            className="group border border-[var(--hairline)] p-4 transition-colors hover:border-[rgba(226,200,127,0.5)]"
          >
            <p className="text-[0.6rem] uppercase tracking-[0.22em] text-gold-soft">Movies</p>
            <p className="mt-1.5 text-[0.95rem] text-ivory">电影管理</p>
            <p className="mt-1 text-[0.72rem] text-[var(--color-ash-dim)]">
              搜索 274 部电影，批量加入主题或移除（只解除关联）
            </p>
          </Link>
        </div>
      </section>

      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="group border border-[rgba(201,162,39,0.18)] p-6 transition-colors hover:border-[rgba(226,200,127,0.5)]"
          >
            <p className="text-[0.62rem] uppercase tracking-[0.24em] text-gold-soft">{card.kicker}</p>
            <h2 className="display mt-2 text-2xl text-ivory">{card.title}</h2>
            <p className="mt-2 text-[0.82rem] text-[var(--color-ivory-dim)]">{card.value}</p>
            <p className="mt-3 text-[0.76rem] leading-relaxed text-[var(--color-ash-dim)]">{card.desc}</p>
            <span className="mt-4 inline-block text-[0.76rem] text-gold-soft opacity-0 transition-opacity group-hover:opacity-100">
              进入 →
            </span>
          </Link>
        ))}
      </div>

      <div className="mt-12">
        <Note>
          保存会真的改数据：每次写入前先把 <code>data/catalog.json</code> 备份到
          <code className="mx-1">data/backups/</code>，再同时更新 <code>data/catalog.json</code> 与
          <code className="mx-1">data/raw/*.json</code> 里对应的原始记录，所以重新 merge 也不会丢改动。
          Vercel 的函数文件系统是只读的，线上后台保存会返回「只读」提示；要在线编辑，需要把数据层
          换到数据库或自托管服务器（见 docs/ADMIN.md）。
        </Note>
      </div>
    </div>
  );
}
