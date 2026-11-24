import Link from "next/link";

export interface MotifCard {
  slug: string;
  zh: string;
  en: string;
  hint: string;
  image: string;
  ink: string;
}

/**
 * 六个叙事主题的大型图片矩阵：3 列 × 2 行，隔列错落（中列下沉）。
 * 卡片上只有「主题名 + 一行小字 + 图片」，不显示作品数量。
 */
export function MotifGallery({ items }: { items: MotifCard[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 md:gap-5">
      {items.map((it, i) => (
        <Link
          key={it.slug}
          href={`/motifs/${it.slug}`}
          className="group relative block overflow-hidden border border-[var(--hairline)] transition-[border-color,box-shadow] duration-500 hover:border-[rgba(226,200,127,0.75)] hover:shadow-[0_0_70px_-18px_rgba(226,200,127,0.6)]"
          style={{
            marginTop: i % 3 === 1 ? "clamp(0px, 3.2vw, 48px)" : 0,
          }}
        >
          <div className="relative aspect-[3/4] overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={it.image}
              alt={`${it.zh}主题代表画面`}
              className="h-full w-full object-cover transition-transform duration-[1400ms] ease-out group-hover:scale-[1.06]"
              style={{ filter: "saturate(1.04) contrast(1.02) brightness(0.88)" }}
              loading={i < 3 ? "eager" : "lazy"}
              decoding="async"
            />
            {/* 上下渐变：保证暗金标题与底部小字在任意海报上都可读 */}
            <div className="absolute inset-0 bg-[linear-gradient(to_top,rgba(4,6,11,0.98)_0%,rgba(4,6,11,0.94)_20%,rgba(4,6,11,0.5)_42%,rgba(4,6,11,0.04)_68%,rgba(4,6,11,0.58)_100%)]" />

            <div className="absolute inset-x-0 top-0 p-4 sm:p-5">
              <p className="text-[0.54rem] uppercase tracking-[0.3em] text-[rgba(226,200,127,0.78)]">{it.en}</p>
              <h3
                className="display mt-1.5 text-[1.4rem] leading-none sm:text-[1.75rem]"
                style={{ color: it.ink, textShadow: "0 2px 18px rgba(5,7,12,0.9)" }}
              >
                {it.zh}
              </h3>
            </div>

            <div className="absolute inset-x-0 bottom-0 p-4 sm:p-5">
              <p
                className="text-[0.72rem] leading-[1.6] tracking-[0.06em] whitespace-nowrap text-[#e6cd8d]"
                style={{ textShadow: "0 2px 14px rgba(4,6,11,0.95)" }}
              >
                {it.hint}
              </p>
              <span className="mt-2 block text-[0.56rem] uppercase tracking-[0.26em] text-[rgba(226,200,127,0.62)] transition-colors group-hover:text-[rgba(240,214,148,0.95)]">
                进入主题 →
              </span>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
