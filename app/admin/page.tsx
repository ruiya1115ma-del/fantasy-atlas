import type { Metadata } from "next";
import { AdminImport } from "@/components/AdminImport";
import { AdminReview, type AdminSubmission } from "@/components/AdminReview";
import { Note } from "@/components/ui";
import { listSubmissions } from "@/lib/submissions";

export const metadata: Metadata = {
  title: "投稿审核",
  description: "管理员审核投稿：通过后才会进入正式片单。",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default function AdminPage() {
  const submissions = listSubmissions();
  const initial: AdminSubmission[] = submissions.map((s) => ({
    id: s.id,
    chineseTitle: s.chineseTitle,
    originalTitle: s.originalTitle,
    releaseYear: s.releaseYear,
    doubanUrl: s.doubanUrl,
    note: s.note,
    submitter: s.submitter,
    status: s.status,
    createdAt: s.createdAt,
    reviewedAt: s.reviewedAt,
    reviewNote: s.reviewNote,
  }));

  return (
    <div className="shell max-w-4xl pb-24 pt-12">
      <p className="eyebrow">Admin · Review Queue</p>
      <h1 className="display mt-4 text-4xl text-ivory">投稿审核</h1>
      <p className="lede mt-4 max-w-2xl text-[0.92rem]">
        这里只做一件事：把投稿放进「待审核」，由你决定收不收。通过后不会自动进库 ——
        还要跑一次 <code className="text-[var(--color-ivory-dim)]">node scripts/promote-submissions.mjs</code>{" "}
        生成草稿、补标签与简介，再 <code className="text-[var(--color-ivory-dim)]">npm run merge</code>。
      </p>

      <AdminReview initial={initial} />

      <div className="hairline my-14" />

      <AdminImport />

      <div className="hairline my-14" />

      <Note>
        有两个队列，作用不同：上面是「用户投稿」，下面是「批量导入」。两者都不会直接改动原始片单，
        发布时只向 <code className="text-[var(--color-ivory-dim)]">data/raw/catalog-imported.json</code> 追加记录，
        跑一次 <code className="text-[var(--color-ivory-dim)]">npm run merge</code> 后才进入网站。
        安全：所有写操作都要 `ADMIN_TOKEN`（默认值只适合本地），公网部署请改口令并给 `/admin` 加访问控制。
      </Note>
    </div>
  );
}
