import Link from "next/link";

export interface MotifCard {
  slug: string;
  zh: string;
  en: string;
  tagline: string;
  description: string;
  count: number;
  image: string;
  ink: string;
}

/**
 * 八个叙事主题的大型图片矩阵：4 列 × 2 行，隔列错落（奇数列下沉），
 * 悬停时图片轻微放大 + 金色边缘发光 + 浮出简介。
 */
export function MotifGallery({ items }: { items: MotifCard[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
      {items.map((it, i) => (
        <Link
          key={it.slug}
          href={`/motifs/${it.slug}`}
          className="group relative block overflow-hidden border border-[var(--hairline)] transition-[border-color,box-shadow,transform] duration-500 hover:border-[rgba(226,200,127,0.75)] hover:shadow-[0_0_60px_-16px_rgba(226,200,127,0.55)]"
          style={{
            marginTop: i % 2 === 1 ? "clamp(0px, 3vw, 40px)" : 0,
          }}
        >
          <div className="relative aspect-[3/4] overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={it.image}
              alt={`${it.zh}主题代表画面`}
              className="h-full w-full object-cover transition-transform duration-[1400ms] ease-out group-hover:scale-[1.07]"
              style={{ filter: "saturate(1.04) contrast(1.02) brightness(0.86)" }}
              loading={i < 4 ? "eager" : "lazy"}
              decoding="async"
            />
            {/* 上下渐变：保证暗金标题与文案在任意海报上都可读 */}
            <div className="absolute inset-0 bg-[linear-gradient(to_top,rgba(5,7,12,0.96)_0%,rgba(5,7,12,0.6)_32%,rgba(5,7,12,0.05)_62%,rgba(5,7,12,0.45)_100%)]" />
            <div className="absolute inset-x-0 top-0 h-1/3 bg-[linear-gradient(to_bottom,rgba(5,7,12,0.72),transparent)]" />

            {/* 英文小标 + 暗金主题名 */}
            <div className="absolute inset-x-0 top-0 p-4 sm:p-5">
              <p className="text-[0.54rem] uppercase tracking-[0.3em] text-[rgba(226,200,127,0.78)]">{it.en}</p>
              <h3
                className="display mt-1.5 text-[1.35rem] leading-none sm:text-[1.6rem]"
                style={{ color: it.ink, textShadow: "0 2px 18px rgba(5,7,12,0.9)" }}
              >
                {it.zh}
              </h3>
            </div>

            {/* 简介：默认缩起，悬停展开 */}
            <div className="absolute inset-x-0 bottom-0 p-4 sm:p-5">
              <p className="text-[0.72rem] italic text-[var(--color-ivory-dim)]">{it.tagline}</p>
              <div className="grid transition-all duration-500 [grid-template-rows:0fr] group-hover:[grid-template-rows:1fr]">
                <div className="overflow-hidden">
                  <p className="pt-2 text-[0.74rem] leading-relaxed text-[var(--color-ash)]">{it.description}</p>
                </div>
              </div>
              <p className="mt-2.5 text-[0.62rem] uppercase tracking-[0.2em] text-[rgba(226,200,127,0.85)]">
                {it.count} 部作品 →
              </p>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
