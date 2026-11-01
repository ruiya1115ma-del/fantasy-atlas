import Link from "next/link";

export interface AtmosphereCard {
  slug: string;
  zh: string;
  en: string;
  hint: string;
  count: number;
  image: string;
  href: string;
}

/**
 * 按氛围寻找：杂志式拼贴（一大四小、错落尺寸），与主题画廊的等宽并排刻意区分。
 */
export function MoodStrip({ items }: { items: AtmosphereCard[] }) {
  const [lead, ...rest] = items;
  if (!lead) return null;
  const small = rest.slice(0, 4);
  const wide = rest[4];

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:grid-rows-[210px_210px_auto]">
      {/* 主卡：跨两行两列 */}
      <Link
        href={lead.href}
        className="group relative col-span-2 row-span-2 min-h-[300px] overflow-hidden border border-[var(--hairline)] md:min-h-0"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={lead.image}
          alt={`${lead.zh}氛围代表画面`}
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-[1800ms] ease-out group-hover:scale-[1.05]"
          style={{ filter: "saturate(1.05) contrast(1.02) brightness(0.86)" }}
          loading="lazy"
        />
        <div className="absolute inset-0 bg-[linear-gradient(to_top,rgba(5,7,12,0.94),rgba(5,7,12,0.25)_58%,rgba(5,7,12,0.5))]" />
        <div className="absolute inset-x-0 bottom-0 p-6 sm:p-8">
          <p className="text-[0.58rem] uppercase tracking-[0.34em] text-[rgba(226,200,127,0.8)]">{lead.en}</p>
          <h3 className="display mt-2 text-[2rem] leading-none text-ivory sm:text-[2.6rem]">{lead.zh}</h3>
          <p className="mt-3 max-w-sm text-[0.8rem] leading-relaxed text-[var(--color-ash)]">{lead.hint}</p>
          <span className="mt-4 inline-flex items-center gap-2 text-[0.68rem] uppercase tracking-[0.2em] text-gold-soft">
            {lead.count} 部作品 <span aria-hidden className="transition-transform duration-500 group-hover:translate-x-1">→</span>
          </span>
        </div>
      </Link>

      {/* 四张小卡：与主卡形成错落 */}
      {small.map((it) => (
        <Link key={it.slug} href={it.href} className="group relative min-h-[150px] overflow-hidden border border-[var(--hairline)] md:min-h-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={it.image}
            alt={`${it.zh}氛围代表画面`}
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-[1600ms] ease-out group-hover:scale-[1.06]"
            style={{ filter: "saturate(1.02) brightness(0.8)" }}
            loading="lazy"
          />
          <div className="absolute inset-0 bg-[linear-gradient(to_top,rgba(5,7,12,0.92),rgba(5,7,12,0.18)_70%)]" />
          <div className="absolute inset-x-0 bottom-0 p-4">
            <p className="display text-[1.15rem] leading-none text-ivory">{it.zh}</p>
            <p className="mt-1.5 text-[0.6rem] uppercase tracking-[0.22em] text-[rgba(226,200,127,0.72)]">
              {it.count} 部 →
            </p>
          </div>
        </Link>
      ))}

      {/* 第六种氛围：整幅横向条，构图与上方卡片完全不同 */}
      {wide && (
        <Link
          href={wide.href}
          className="group relative col-span-2 overflow-hidden border border-[var(--hairline)] md:col-span-4"
        >
          <div className="grid md:grid-cols-[0.42fr_1fr]">
            <div className="relative h-[130px] overflow-hidden md:h-[170px]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={wide.image}
                alt={`${wide.zh}氛围代表画面`}
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-[1600ms] ease-out group-hover:scale-[1.05]"
                style={{ filter: "saturate(1.02) brightness(0.82)" }}
                loading="lazy"
              />
              <div className="absolute inset-0 bg-[linear-gradient(to_right,transparent,rgba(5,7,12,0.85))]" />
            </div>
            <div className="flex flex-col justify-center gap-2 bg-[rgba(8,11,18,0.72)] px-5 py-6 md:px-8">
              <p className="text-[0.56rem] uppercase tracking-[0.34em] text-[rgba(226,200,127,0.75)]">{wide.en}</p>
              <h3 className="display text-[1.6rem] leading-none text-ivory md:text-[2rem]">{wide.zh}</h3>
              <p className="max-w-md text-[0.78rem] leading-relaxed text-[var(--color-ash)]">{wide.hint}</p>
              <span className="mt-1 text-[0.66rem] uppercase tracking-[0.2em] text-gold-soft">
                {wide.count} 部作品 →
              </span>
            </div>
          </div>
        </Link>
      )}
    </div>
  );
}
