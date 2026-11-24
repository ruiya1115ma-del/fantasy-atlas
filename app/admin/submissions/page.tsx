import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminSubmissions } from "@/components/admin/AdminSubmissions";
import { isAdmin } from "@/lib/admin/auth";

export const metadata: Metadata = { title: "投稿审核", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AdminSubmissionsPage() {
  if (!(await isAdmin())) redirect("/admin/login");

  return (
    <div>
      <p className="eyebrow">Admin · Review</p>
      <h1 className="display mt-3 text-3xl text-ivory">投稿审核</h1>
      <p className="lede mt-4 max-w-2xl text-[0.88rem]">
        每条投稿都会显示：推荐理由、投稿人的喜爱程度、以及「库里是否已经有这一部」。
        「收录」只是把这条标记为已收录，真正入库请在「电影资料」里新建或编辑——那样才会写进正式数据。
      </p>
      <AdminSubmissions />
    </div>
  );
}
