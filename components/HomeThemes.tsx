import Link from "next/link";

export interface HomeThemeCard {
  id: string;
  name: string;
  image: string;
  count: number;
}

/**
 * 首页板块内的主题卡片：只展示「主题名称 + 图片 + 电影数量」。
 * 结构由后台配置决定（板块数量、每板块主题数量都不设上限）。
 */
export function HomeThemes({ themes }: { themes: HomeThemeCard[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 md:gap-5">
      {themes.map((t, i) => (
        <Link
          key={t.id}
          href={`/collections/${t.id}`}
          className="group relative block overflow-hidden border border-[var(--hairline)] transition-[border-color,box-shadow] duration-500 hover:border-[rgba(226,200,127,0.75)] hover:shadow-[0_0_70px_-18px_rgba(226,200,127,0.6)]"
          style={{ marginTop: i % 3 === 1 ? "clamp(0px, 3.2vw, 48px)" : 0 }}
        >
          <div className="relative aspect-[3/4] overflow-hidden">
            {t.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={t.image}
                alt={`${t.name}主题代表画面`}
                className="h-full w-full object-cover transition-transform duration-[1400ms] ease-out group-hover:scale-[1.06]"
                style={{ filter: "saturate(1.04) contrast(1.02) brightness(0.88)" }}
                loading={i < 3 ? "eager" : "lazy"}
                decoding="async"
              />
            ) : (
              <div className="h-full w-full bg-[linear-gradient(160deg,rgba(20,24,36,0.9),rgba(8,10,16,0.95))]" />
            )}
            <div className="absolute inset-0 bg-[linear-gradient(to_top,rgba(4,6,11,0.96)_0%,rgba(4,6,11,0.84)_18%,rgba(4,6,11,0.34)_46%,rgba(4,6,11,0.02)_70%,rgba(4,6,11,0.5)_100%)]" />

            <div className="absolute inset-x-0 top-0 p-4 sm:p-5">
              <h3
                className="display text-[1.4rem] leading-none sm:text-[1.75rem]"
                style={{ color: "#e6cd8d", textShadow: "0 2px 18px rgba(5,7,12,0.9)" }}
              >
                {t.name}
              </h3>
            </div>

            <div className="absolute inset-x-0 bottom-0 flex items-end justify-between p-4 sm:p-5">
              <span className="text-[0.72rem] tracking-[0.08em] text-[rgba(240,235,224,0.82)]">{t.count} 部作品</span>
              <span className="text-[0.56rem] uppercase tracking-[0.24em] text-[rgba(226,200,127,0.7)] transition-colors group-hover:text-[rgba(240,214,148,0.95)]">
                进入主题 →
              </span>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
