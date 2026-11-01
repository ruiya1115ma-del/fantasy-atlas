import Link from "next/link";

/**
 * 探索页顶部的「按偏好寻找电影」入口卡。
 *
 * 只是一个入口：不内嵌推荐逻辑，点击后进入独立的 /recommend 页面。
 * 视觉上刻意做得比探索页的筛选区更「亮」一点，作为探索页的主入口之一。
 */
export function RecommendEntry() {
  return (
    <div className="shell mt-10 md:mt-12">
      <Link
        href="/recommend"
        className="group relative isolate block overflow-hidden rounded-[2px] border border-[rgba(201,162,39,0.28)] transition-colors duration-500 hover:border-[rgba(226,200,127,0.62)] focus-visible:border-[rgba(226,200,127,0.62)]"
        aria-label="按偏好寻找电影：根据你的审美、世界观与故事偏好，寻找下一部电影"
      >
        {/* 底光：左侧金色微光 + 右侧星尘 */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 opacity-80 transition-opacity duration-700 group-hover:opacity-100"
          style={{
            background:
              "radial-gradient(120% 160% at 12% 50%, rgba(201,162,39,0.16) 0%, rgba(201,162,39,0.05) 38%, rgba(5,7,12,0) 70%), linear-gradient(100deg, rgba(10,13,22,0.92) 0%, rgba(7,9,16,0.86) 58%, rgba(12,14,24,0.92) 100%)",
          }}
        />
        {/* 星尘：一串很小的金点，随悬停微微放大 */}
        <span aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          {[
            { x: "62%", y: "26%", s: 2, o: 0.5 },
            { x: "70%", y: "62%", s: 1, o: 0.38 },
            { x: "78%", y: "34%", s: 1.5, o: 0.44 },
            { x: "86%", y: "70%", s: 2, o: 0.3 },
            { x: "91%", y: "40%", s: 1, o: 0.5 },
            { x: "96%", y: "60%", s: 1.5, o: 0.26 },
          ].map((d, i) => (
            <span
              key={i}
              className="absolute rounded-full bg-gold-soft transition-transform duration-700 group-hover:scale-150"
              style={{
                left: d.x,
                top: d.y,
                width: d.s,
                height: d.s,
                opacity: d.o,
                boxShadow: "0 0 6px rgba(226,200,127,0.7)",
              }}
            />
          ))}
        </span>

        <span className="relative flex flex-col gap-6 px-6 py-7 sm:px-9 sm:py-8 md:flex-row md:items-center md:justify-between md:gap-10">
          <span className="block">
            <span className="eyebrow text-gold-soft">Personal Recommendation</span>
            <span className="display mt-2 block text-[1.6rem] leading-tight text-ivory sm:text-[2rem] md:text-[2.4rem]">
              按偏好寻找电影
            </span>
            <span className="mt-2 block max-w-xl text-[0.86rem] leading-relaxed text-[var(--color-ivory-dim)] sm:text-[0.92rem]">
              根据你的审美、世界观与故事偏好，寻找下一部电影
            </span>
          </span>

          <span className="flex shrink-0 items-center gap-3">
            <span className="hidden text-right text-[0.72rem] leading-relaxed text-[var(--color-ash-dim)] sm:block">
              选几条你喜欢的
              <br />
              剩下的交给标签
            </span>
            <span className="inline-flex items-center gap-2 rounded-[2px] border border-[rgba(226,200,127,0.42)] px-5 py-3 text-[0.82rem] tracking-[0.06em] text-gold-soft transition-all duration-500 group-hover:border-[var(--color-gold-soft)] group-hover:bg-[rgba(201,162,39,0.12)]">
              开始偏好匹配
              <span aria-hidden className="transition-transform duration-500 group-hover:translate-x-1">
                →
              </span>
            </span>
          </span>
        </span>
      </Link>
    </div>
  );
}
