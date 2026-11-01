import type { Metadata } from "next";
import Link from "next/link";
import { SubmitForm } from "@/components/SubmitForm";
import { Note } from "@/components/ui";

export const metadata: Metadata = {
  title: "投稿补充",
  description: "提交电影、海报或资料补充。所有投稿进入待审核队列，管理员通过后才会进入正式片单。",
};

export default function SubmitPage() {
  return (
    <div className="shell max-w-3xl pb-24 pt-12">
      <p className="eyebrow">Contribute</p>
      <h1 className="display mt-4 text-4xl leading-tight text-ivory md:text-[3.2rem]">投稿补充</h1>
      <p className="lede mt-5 text-[0.95rem]">
        这份片单是私人的：收什么、怎么排序由站主决定。但资料可以一起校对 ——
        发现缺片、错年份、错海报，都可以提交。**所有投稿先进入待审核队列**，通过后才会进入正式库。
      </p>

      <SubmitForm />

      <div className="hairline my-12" />

      <section className="space-y-4">
        <h2 className="display text-xl text-ivory">规则（很短）</h2>
        <ul className="space-y-3 text-[0.82rem] leading-relaxed text-[var(--color-ivory-dim)]">
          <li className="border-l-2 border-[rgba(226,200,127,0.45)] pl-4">
            <span className="text-ivory">必须给豆瓣条目链接。</span>本站的评分、海报、剧照、简介都按豆瓣条目核对，
            没有条目就无法验证 —— 也不会为了凑数而编造。
          </li>
          <li className="border-l-2 border-[rgba(226,200,127,0.45)] pl-4">
            <span className="text-ivory">不要上传 AI 生成图。</span>找不到真实海报的条目宁可暂时缺图，也不用假图顶替。
          </li>
          <li className="border-l-2 border-[rgba(226,200,127,0.45)] pl-4">
            <span className="text-ivory">不修改原始片单。</span>投稿只会变成待审核记录；创作者的原始文件不会被改动。
          </li>
        </ul>
      </section>

      <Note className="mt-10">
        审核队列在 <Link href="/admin" className="text-gold-soft underline decoration-dotted">/admin</Link>
        （需要管理口令，默认本地口令见 `.env.example` 里的 `ADMIN_TOKEN`）。
      </Note>
    </div>
  );
}
