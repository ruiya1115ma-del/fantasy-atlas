import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminMovieEditor } from "@/components/admin/AdminMovieEditor";
import { isAdmin } from "@/lib/admin/auth";
import { TAG_GROUPS } from "@/lib/vocabulary";

export const metadata: Metadata = { title: "新增作品", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AdminNewMoviePage({
  searchParams,
}: {
  searchParams: Promise<{ title?: string; year?: string; original?: string }>;
}) {
  if (!(await isAdmin())) redirect("/admin/login");

  const sp = await searchParams;
  const tagGroups = TAG_GROUPS.map((group) => ({
    category: group.category,
    zh: group.zh,
    terms: group.terms.map((term) => ({ id: term.id, zh: term.zh, hint: term.hint })),
  }));

  return (
    <div>
      <p className="eyebrow">Admin · New</p>
      <h1 className="display mt-3 text-3xl text-ivory">新增作品</h1>
      <p className="lede mt-4 max-w-2xl text-[0.88rem]">
        保存后会同时写入 <code className="text-[var(--color-ivory-dim)]">data/catalog.json</code> 与
        <code className="mx-1 text-[var(--color-ivory-dim)]">data/raw/catalog-admin.json</code>，网站立刻能看到。
        简介与推荐语建议写满，否则列表页会显得空。
      </p>
      <AdminMovieEditor
        tagGroups={tagGroups}
        defaults={{
          chineseTitle: sp.title ?? "",
          originalTitle: sp.original ?? "",
          releaseYear: sp.year ? Number(sp.year) : new Date().getFullYear(),
        }}
      />
    </div>
  );
}
