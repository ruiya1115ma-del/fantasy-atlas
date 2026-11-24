import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminBackupPanel } from "@/components/admin/AdminBackupPanel";
import { Note } from "@/components/ui";
import { isAdmin } from "@/lib/admin/auth";
import { getKv } from "@/lib/admin/kv";
import { listBackups } from "@/lib/admin/store";
import { listSubmissionsWithFlags } from "@/lib/admin/submissions";
import { getMoviesRuntime } from "@/lib/admin/store-kv";
import { listSubmissionsWithFlagsKv } from "@/lib/submissions-kv";

export const metadata: Metadata = { title: "数据与备份", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

function formatSize(bytes: number) {
  if (bytes > 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.round(bytes / 1024)} KB`;
}

export default async function AdminDataPage() {
  if (!(await isAdmin())) redirect("/admin/login");

  const kv = await getKv();
  const backups = kv ? [] : listBackups();
  const submissions = kv
    ? await listSubmissionsWithFlagsKv(
        (await getMoviesRuntime()).map((m) => ({
          id: m.id,
          chineseTitle: m.chineseTitle,
          originalTitle: m.originalTitle,
          releaseYear: m.releaseYear,
        })),
      )
    : listSubmissionsWithFlags();

  return (
    <div>
      <p className="eyebrow">Admin · Data</p>
      <h1 className="display mt-3 text-3xl text-ivory">数据导出与备份</h1>
      <p className="lede mt-4 max-w-2xl text-[0.88rem]">
        每次在后台保存（新增 / 修改 / 删除）之前，系统都会先把
        <code className="mx-1 text-[var(--color-ivory-dim)]">data/catalog.json</code>
        复制到 <code className="text-[var(--color-ivory-dim)]">data/backups/</code>，最多保留最近 40 份。
        下面的按钮可以随时手动备份，或把整库导出成 JSON 带走。
      </p>

      <div className="mt-8">
        <AdminBackupPanel />
      </div>

      <section className="mt-12">
        <h2 className="display text-xl text-ivory">备份列表</h2>
        {backups.length === 0 ? (
          <p className="mt-4 text-[0.82rem] text-[var(--color-ash-dim)]">还没有备份。第一次保存时会自动生成。</p>
        ) : (
          <div className="mt-4 divide-y divide-[rgba(201,162,39,0.12)] border-y border-[rgba(201,162,39,0.12)]">
            {backups.slice(0, 20).map((backup) => (
              <div key={backup.name} className="flex flex-wrap items-center justify-between gap-3 py-3 text-[0.78rem]">
                <span className="text-[var(--color-ivory-dim)]">{backup.name}</span>
                <span className="text-[var(--color-ash-dim)]">
                  {new Date(backup.mtime).toLocaleString("zh-CN")} · {formatSize(backup.size)}
                </span>
              </div>
            ))}
          </div>
        )}
        <p className="mt-4 text-[0.72rem] leading-relaxed text-[var(--color-ash-dim)]">
          恢复到某个备份：在本机把 <code>data/backups/&lt;文件名&gt;</code> 复制回
          <code className="mx-1">data/catalog.json</code> 即可（建议先另存当前版本）。
        </p>
      </section>

      <section className="mt-12">
        <h2 className="display text-xl text-ivory">投稿数据</h2>
        <p className="mt-3 text-[0.82rem] text-[var(--color-ivory-dim)]">
          共 {submissions.length} 条：待处理 {submissions.filter((s) => s.status === "pending").length} ·
          已收录 {submissions.filter((s) => s.status === "approved").length} ·
          暂不收录 {submissions.filter((s) => s.status === "rejected").length}。
        </p>
        <p className="mt-2 text-[0.74rem] text-[var(--color-ash-dim)]">
          数据文件：<code>data/submissions/submissions.json</code>
        </p>
      </section>

      <div className="mt-12">
        <Note>
          线上（Vercel）的函数文件系统是只读的，因此后台的保存会返回「只读」提示——这不是权限问题，
          而是部署方式决定。要在线编辑，需要把数据层换到数据库（Supabase / Vercel KV），或把站点部署到
          可以写文件的服务器。站内阅读、筛选、收藏、笔记不受影响。
        </Note>
      </div>
    </div>
  );
}
