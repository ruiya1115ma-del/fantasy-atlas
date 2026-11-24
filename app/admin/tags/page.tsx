import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin/auth";
import { getKv } from "@/lib/admin/kv";
import { tagUsage } from "@/lib/admin/store";
import { tagUsageKv } from "@/lib/admin/store-kv";

export const metadata: Metadata = { title: "标签管理", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const CATEGORY_ZH: Record<string, string> = {
  type: "类型",
  world: "世界观",
  aesthetic: "视觉美学",
  element: "奇幻元素",
  mood: "氛围",
  exclude: "劝退点",
};

export default async function AdminTagsPage() {
  if (!(await isAdmin())) redirect("/admin/login");

  const kv = await getKv();
  const tags = kv ? await tagUsageKv() : tagUsage();
  const categories = [...new Set(tags.map((t) => t.category))];

  return (
    <div>
      <p className="eyebrow">Admin · Tags</p>
      <h1 className="display mt-3 text-3xl text-ivory">分类标签</h1>
      <p className="lede mt-4 max-w-2xl text-[0.88rem]">
        标签来自 <code className="text-[var(--color-ivory-dim)]">lib/vocabulary.ts</code> 的词表。
        这里显示每个标签在库里被多少部作品使用——数量为 0 的是「空标签」，可以决定保留还是删掉；
        页面底部单独列出「库里有、词表没有」的历史标签，建议合并回词表，否则筛选不到它们。
        要改某部作品的标签，请在「电影资料」里编辑。
      </p>

      <div className="mt-10 space-y-10">
        {categories.map((category) => {
          const rows = tags.filter((t) => t.category === category);
          const unused = rows.filter((r) => r.unused).length;
          return (
            <section key={category}>
              <div className="flex items-baseline justify-between border-b border-[rgba(201,162,39,0.18)] pb-2">
                <h2 className="display text-xl text-ivory">{CATEGORY_ZH[category] ?? category}</h2>
                <span className="text-[0.7rem] text-[var(--color-ash-dim)]">
                  {rows.length} 个 · {unused} 个未使用
                </span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-x-8 gap-y-2 sm:grid-cols-3 lg:grid-cols-4">
                {rows.map((row) => (
                  <div key={`${row.category}-${row.tag}`} className="flex items-baseline justify-between gap-2 text-[0.8rem]">
                    <span className={row.unused ? "text-[var(--color-ash-dim)]" : "text-[var(--color-ivory-dim)]"}>{row.tag}</span>
                    <span className={`tabular-nums text-[0.72rem] ${row.count === 0 ? "text-[rgba(224,163,163,0.8)]" : "text-gold-soft"}`}>
                      {row.count}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
