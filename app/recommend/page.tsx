import type { Metadata } from "next";
import Link from "next/link";
import { RecommendClient } from "@/components/RecommendClient";
import { getMovies } from "@/lib/data";

export const metadata: Metadata = {
  title: "为你推荐",
  description: "基于标签权重的可解释推荐：每一条都会告诉你为什么被推给你，以及为什么另一部排在它前面。",
};

const STEPS = [
  { n: "01", title: "先说你想要什么感觉", body: "氛围、世界或一部喜欢的作品 —— 任何一条都能开始，不需要填问卷。" },
  { n: "02", title: "标签按权重累加", body: "美学 3 分、世界观 3 分、元素 2 分、氛围 2 分、相似作品 2 分。分数就是理由。" },
  { n: "03", title: "结果带上解释与劝退", body: "每条推荐都会写明命中了哪些标签，也会告诉你它可能哪里不适合你。" },
];

export default function RecommendPage() {
  const movies = getMovies();

  return (
    <div className="shell pb-24 pt-10 md:pt-14">
      <nav aria-label="面包屑" className="mb-8 flex items-center gap-2 text-[0.76rem] text-[var(--color-ash-dim)]">
        <Link href="/explore" className="transition-colors hover:text-gold-soft">
          探索
        </Link>
        <span aria-hidden>/</span>
        <span className="text-[var(--color-ivory-dim)]">按偏好寻找电影</span>
      </nav>

      <p className="eyebrow">Find My Next World</p>
      <h1 className="display mt-3 max-w-3xl text-4xl leading-tight text-ivory md:text-[3.6rem]">
        根据我的喜好寻找电影
      </h1>
      <p className="lede mt-4 max-w-2xl text-[0.98rem]">
        这里没有黑箱。你选的东西会直接变成加分的标签，推荐结果会告诉你每一分是怎么来的。
      </p>

      <ol className="mt-8 grid gap-3 sm:grid-cols-3">
        {STEPS.map((s) => (
          <li key={s.n} className="border-t border-[var(--hairline)] pt-4">
            <p className="font-mono text-[0.68rem] text-gold-soft">{s.n}</p>
            <p className="mt-1 text-[0.86rem] text-[var(--color-ivory)]">{s.title}</p>
            <p className="mt-1 text-[0.74rem] leading-relaxed text-[var(--color-ash-dim)]">{s.body}</p>
          </li>
        ))}
      </ol>

      <div className="hairline my-10" />

      <RecommendClient movies={movies} />
    </div>
  );
}
