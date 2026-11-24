import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminImport } from "@/components/AdminImport";
import { Note } from "@/components/ui";
import { isAdmin } from "@/lib/admin/auth";

export const metadata: Metadata = { title: "批量导入", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AdminImportPage() {
  if (!(await isAdmin())) redirect("/admin/login");

  return (
    <div>
      <p className="eyebrow">Admin · Import</p>
      <h1 className="display mt-3 text-3xl text-ivory">批量导入（旧工具）</h1>
      <p className="lede mt-4 max-w-2xl text-[0.88rem]">
        粘贴片单批量匹配豆瓣条目，进入审核队列后再发布。发布只会向
        <code className="mx-1 text-[var(--color-ivory-dim)]">data/raw/catalog-imported.json</code>
        追加记录，不会覆盖已有作品；跑一次 <code className="text-[var(--color-ivory-dim)]">npm run merge</code> 才进入正式库。
      </p>

      <AdminImport />

      <div className="mt-10">
        <Note>
          这个工具沿用旧的
          <code className="mx-1">ADMIN_TOKEN</code>
          口令机制（与本页登录口令相互独立）。如果只需要偶尔补几部作品，用「电影资料 → 新增作品」更直接。
        </Note>
      </div>
    </div>
  );
}
