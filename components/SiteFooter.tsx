import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-[var(--hairline)] bg-[rgba(5,7,12,0.6)]">
      <div className="shell py-14">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1.2fr]">
          <div>
            <p className="display text-xl text-ivory">Fantasy Atlas</p>
            <p className="mt-3 max-w-xs text-[0.8rem] leading-relaxed text-[var(--color-ash-dim)]">
              一个人的奇幻电影探索指南。偏向画面、情绪与世界观的整理方式，而不是评分排行榜。
            </p>
            <p className="mt-4 text-[0.7rem] leading-relaxed text-[var(--color-ash-dim)]">
              《Enter Another World.》 —— 探索那些值得进入的幻想世界。
            </p>
          </div>

          <nav aria-label="页脚导航" className="flex flex-col gap-2.5 text-[0.8rem]">
            <p className="eyebrow mb-1">浏览</p>
            <Link href="/explore" className="text-[var(--color-ivory-dim)] transition-colors hover:text-gold-soft">
              探索全部作品
            </Link>
            <Link href="/recommend" className="text-[var(--color-ivory-dim)] transition-colors hover:text-gold-soft">
              按偏好推荐
            </Link>
            <Link href="/favorites" className="text-[var(--color-ivory-dim)] transition-colors hover:text-gold-soft">
              我的收藏与笔记
            </Link>
            <Link href="/submit" className="text-[var(--color-ivory-dim)] transition-colors hover:text-gold-soft">
              投稿补充资料
            </Link>
          </nav>

          <div className="text-[0.7rem] leading-relaxed text-[var(--color-ash-dim)]">
            <p className="eyebrow mb-2">数据声明</p>
            <p>
              评分、导演、主演、类型、片长、简介、海报与剧照均来自各作品的{" "}
              <a
                href="https://movie.douban.com/"
                target="_blank"
                rel="noreferrer"
                className="text-gold-soft underline underline-offset-4"
              >
                豆瓣
              </a>{" "}
              条目（个人非商业引用，逐条标注条目链接与抓取时间）。IMDb 数据集与 Wikidata 仅作交叉核对与兜底。
            </p>
            <p className="mt-2">
              海报与剧照版权归发行方所有，本站不主张任何权利，也不将其作为官方物料使用；抓不到图的条目使用程序化生成的原创封面。
            </p>
            <p className="mt-2">这是个人使用的手册，不提供下载、不做商业分发。</p>
          </div>
        </div>

        <div className="hairline my-9" />
        <div className="flex flex-col gap-3 text-[0.68rem] text-[var(--color-ash-dim)] md:flex-row md:items-center md:justify-between">
          <p>© {new Date().getFullYear()} Fantasy Atlas · 个人非商业项目</p>
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span>
              资料与评分来源{" "}
              <a href="https://movie.douban.com/" target="_blank" rel="noreferrer" className="text-gold-soft underline underline-offset-4">
                豆瓣电影
              </a>
            </span>
            <span aria-hidden>·</span>
            <span>
              备份核对{" "}
              <a href="https://www.imdb.com/" target="_blank" rel="noreferrer" className="text-gold-soft underline underline-offset-4">
                IMDb
              </a>
              /
              <a href="https://www.wikidata.org/" target="_blank" rel="noreferrer" className="text-gold-soft underline underline-offset-4">
                Wikidata
              </a>
            </span>
            <span aria-hidden>·</span>
            <Link href="/admin" className="text-[var(--color-ash-dim)] transition-colors hover:text-gold-soft">
              管理入口
            </Link>
          </p>
        </div>
      </div>
    </footer>
  );
}
