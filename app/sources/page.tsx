import type { Metadata } from "next";
import Link from "next/link";
import { KeyValue, Note, Pill } from "@/components/ui";
import { getMovies } from "@/lib/data";
import { MEDIA_TYPE_LABELS } from "@/lib/vocabulary";
import importReport from "@/data/reports/import-report.json";

export const metadata: Metadata = {
  title: "数据与授权",
  description: "Fantasy Atlas 的数据来源、评分口径、图片授权状态与更正方式，全部写在这里。",
};

const SOURCES = [
  {
    name: "创作者的原始片单",
    kind: "一手数据",
    license: "作者私有资料，本站内使用",
    usage: "只决定「收哪些片、系列顺序、看过没有」。导入后原始文件永不被覆盖。",
    url: null as string | null,
  },
  {
    name: "豆瓣电影（主数据来源）",
    kind: "评分 · 资料 · 简介 · 图片",
    license: "页面资料与评分引用自豆瓣公开页面；海报/剧照版权归发行方，仅个人非商业引用并标注来源",
    usage:
      "评分（10 分制，含评分人数）、导演、主演、类型、地区、片长、剧情简介、海报、剧照，全部来自每部作品的豆瓣条目。逐条记录条目 ID、抓取时间与链接。",
    url: "https://movie.douban.com/",
  },
  {
    name: "IMDb 公开数据集（备用交叉核对）",
    kind: "评分备份",
    license: "IMDb datasets — 仅限个人非商业用途，需署名",
    usage: "仅在豆瓣缺评分时作为第二来源展示，绝不与豆瓣评分加权平均。",
    url: "https://datasets.imdbws.com/",
  },
  {
    name: "Wikidata / 维基百科（备用核对）",
    kind: "事实交叉核对",
    license: "CC0 1.0 / CC BY-SA",
    usage: "用于校验 IMDb ID 与英文条目名；海报抓取脚本使用维基条目主图作为豆瓣抓不到时的兜底。",
    url: "https://www.wikidata.org/",
  },
  {
    name: "程序化封面（本站原创，兜底）",
    kind: "图像",
    license: "本站原创，随站点一同发布",
    usage: "豆瓣与维基都拿不到图时的兜底视觉：按分类与作品种子生成的抽象 SVG，不是官方海报。",
    url: null,
  },
];

export default function SourcesPage() {
  const movies = getMovies();
  const rated = movies.filter((m) => m.ratings.length > 0);
  const ratingSources = [...new Set(movies.flatMap((m) => m.ratings.map((r) => r.source)))];
  const matched = movies.filter((m) => m.provenance.enrichment?.reviewStatus === "matched").length;
  const needsReview = movies.filter((m) => m.provenance.enrichment?.reviewStatus === "needs_review").length;
  const lastChecked = movies
    .map((m) => m.provenance.ratingCheckedAt)
    .filter((x): x is string => Boolean(x))
    .sort()
    .at(-1);

  return (
    <div className="shell pb-24 pt-10 md:pt-14">
      <p className="eyebrow">Data & Licensing</p>
      <h1 className="display mt-3 max-w-3xl text-4xl leading-tight text-ivory md:text-[3.6rem]">数据与授权</h1>
      <p className="lede mt-4 max-w-2xl text-[0.98rem]">
        这一页只有一个目的：让你能判断站里每个数字是从哪来的、有没有被编造、能不能商用。
      </p>

      <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="panel p-5">
          <p className="font-display text-3xl text-ivory">{movies.length}</p>
          <p className="mt-1 text-[0.7rem] text-[var(--color-ash-dim)]">收录作品</p>
        </div>
        <div className="panel p-5">
          <p className="font-display text-3xl text-ivory">
            {rated.length}
            <span className="text-base text-[var(--color-ash-dim)]">/{movies.length}</span>
          </p>
          <p className="mt-1 text-[0.7rem] text-[var(--color-ash-dim)]">有可核验评分的作品</p>
        </div>
        <div className="panel p-5">
          <p className="font-display text-3xl text-ivory">{matched}</p>
          <p className="mt-1 text-[0.7rem] text-[var(--color-ash-dim)]">外部资料已匹配</p>
        </div>
        <div className="panel p-5">
          <p className="font-display text-3xl text-ivory">{needsReview}</p>
          <p className="mt-1 text-[0.7rem] text-[var(--color-ash-dim)]">待人工复核</p>
        </div>
      </div>

      <section className="mt-14" aria-labelledby="sources">
        <h2 id="sources" className="display text-2xl text-ivory">
          数据来源
        </h2>
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-left text-[0.8rem]">
            <thead>
              <tr className="border-b border-[var(--hairline)] text-[0.64rem] uppercase tracking-[0.14em] text-[var(--color-ash-dim)]">
                <th className="py-2 pr-4 font-normal">来源</th>
                <th className="py-2 pr-4 font-normal">用途</th>
                <th className="py-2 pr-4 font-normal">许可 / 限制</th>
                <th className="py-2 font-normal">用于</th>
              </tr>
            </thead>
            <tbody>
              {SOURCES.map((s) => (
                <tr key={s.name} className="border-b border-[var(--hairline)] align-top">
                  <td className="py-3 pr-4 text-[var(--color-ivory)]">
                    {s.url ? (
                      <a href={s.url} target="_blank" rel="noreferrer" className="text-gold-soft underline underline-offset-4">
                        {s.name}
                      </a>
                    ) : (
                      s.name
                    )}
                  </td>
                  <td className="py-3 pr-4 text-[var(--color-ash-dim)]">{s.kind}</td>
                  <td className="py-3 pr-4 text-[var(--color-ivory-dim)]">{s.license}</td>
                  <td className="py-3 text-[var(--color-ash-dim)]">{s.usage}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Note className="mt-4">
          评分来源：{ratingSources.length ? ratingSources.join(" / ") : "暂无"}。最后核对时间：
          {lastChecked ? lastChecked.slice(0, 10) : "未记录"}。IMDb 数据仅用于个人非商业展示，页面底部已标注署名（
          <span className="text-[var(--color-ivory-dim)]">Ratings data courtesy of IMDb</span>）。
        </Note>
      </section>

      <div className="hairline my-14" />

      <section aria-labelledby="nofake">
        <h2 id="nofake" className="display text-2xl text-ivory">
          本站明确不做的事
        </h2>
        <ul className="mt-5 space-y-3 text-[0.84rem] leading-relaxed text-[var(--color-ivory-dim)]">
          <li className="border-l-2 border-[rgba(226,200,127,0.5)] pl-4">
            <span className="text-ivory">不抓取豆瓣。</span>
            豆瓣只在作者人工核对时作为参考，站点没有、也不会有豆瓣的批量抓取或接口调用。
          </li>
          <li className="border-l-2 border-[rgba(226,200,127,0.5)] pl-4">
            <span className="text-ivory">不编造评分。</span>
            没有可信来源的作品，评分字段留空并在页面上写明「未接入」，绝不用估算值填充。
          </li>
          <li className="border-l-2 border-[rgba(226,200,127,0.5)] pl-4">
            <span className="text-ivory">不抄简介。</span>
            每一条简介都是本站原创撰写的（≥60 汉字），不复制维基百科、豆瓣或官方文案。
          </li>
          <li className="border-l-2 border-[rgba(226,200,127,0.5)] pl-4">
            <span className="text-ivory">不声称拥有海报版权。</span>
            站内海报取自各作品的维基百科条目主图（维基以合理使用收录，版权仍在发行方）；
            每条详情页都标注了来源条目与许可，仅供个人非商业查看。没有可用海报的条目回退到程序化封面。
          </li>
          <li className="border-l-2 border-[rgba(226,200,127,0.5)] pl-4">
            <span className="text-ivory">不伪造「最近更新」。</span>
            数据里没有逐条入库时间戳，因此「最近收录」按上映年份排列，并明确说明这一点。
          </li>
        </ul>
      </section>

      <div className="hairline my-14" />

      <section aria-labelledby="contract">
        <h2 id="contract" className="display text-2xl text-ivory">
          评分字段的口径（契约）
        </h2>
        <p className="lede mt-2 max-w-2xl text-sm">
          每条评分必须同时具备以下 7 个字段，缺任意一个都会被导入脚本拒绝 —— 只有一个数字的「评分」在这套结构里无法通过校验。
        </p>
        <dl className="panel mt-4 px-5 py-2">
          <KeyValue label="rating_source">例如 IMDb。必须可追溯到具体来源。</KeyValue>
          <KeyValue label="rating_value">数值本身（IMDb 为 0–10）。</KeyValue>
          <KeyValue label="rating_scale">量纲，10 或 5，避免把 8.1/10 与 4.1/5 混为一谈。</KeyValue>
          <KeyValue label="rating_count">评分人数；没有就留空，不能猜。</KeyValue>
          <KeyValue label="last_checked_at">最后一次核对的 ISO 时间。</KeyValue>
          <KeyValue label="source_url">可点开的原始页面。</KeyValue>
          <KeyValue label="usage_status">
            使用状态：
            <Pill tone="warn">personal-noncommercial-attribution-required</Pill> 或 <Pill tone="ok">free</Pill>
          </KeyValue>
        </dl>
      </section>

      <div className="hairline my-14" />

      <section aria-labelledby="tags">
        <h2 id="tags" className="display text-2xl text-ivory">
          标签从哪来
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="panel p-5">
            <p className="text-[0.68rem] uppercase tracking-[0.14em] text-gold-soft">当前状态：人工标注</p>
            <p className="mt-2 text-[0.84rem] leading-relaxed text-[var(--color-ivory-dim)]">
              全部 {movies.length} 部作品的标签由编辑按固定词表
              （docs/CATALOG_RECORD_SCHEMA.md 中的六类词表）标注，模型不参与生成，因此没有「AI 幻觉标签」的风险。
            </p>
          </div>
          <div className="panel p-5">
            <p className="text-[0.68rem] uppercase tracking-[0.14em] text-gold-soft">若引入 AI 标注的规则</p>
            <p className="mt-2 text-[0.84rem] leading-relaxed text-[var(--color-ivory-dim)]">
              字段已预留：tag_source（human / ai-assist / imported）、tag_model、tag_prompt_version、tag_confidence、
              review_status。AI 生成的标签必须标记为未审核，需人工确认后才进入推荐计算。
            </p>
          </div>
        </div>
      </section>

      <div className="hairline my-14" />

      <section aria-labelledby="fix">
        <h2 id="fix" className="display text-2xl text-ivory">
          发现错了怎么改
        </h2>
        <ol className="mt-4 space-y-2 text-[0.84rem] leading-relaxed text-[var(--color-ivory-dim)]">
          <li>
            ① 修改 <code className="text-gold-soft">data/raw/catalog-*.json</code> 里对应的原始记录（不要改{" "}
            <code className="text-gold-soft">data/catalog.json</code>，它是生成物）。
          </li>
          <li>
            ② 运行 <code className="text-gold-soft">npm run merge</code> 重新导入校验，再运行{" "}
            <code className="text-gold-soft">npm run enrich</code> 更新外部资料与评分。
          </li>
          <li>③ 校验结果会写入 data/reports/import-report.json，被拒记录与待复核原因都能在里面查到。</li>
        </ol>
        <Note className="mt-4">
          导入脚本的完整字段契约见仓库里的 <code className="text-gold-soft">docs/CATALOG_RECORD_SCHEMA.md</code>
          （25 个字段与六类标签词表是这个项目的数据地基）。当前导入报告：
          {importReport.totalRawRecords} 条原始记录 / 接受 {importReport.accepted} / 重复{" "}
          {Array.isArray(importReport.duplicates) ? importReport.duplicates.length : importReport.duplicates} / 被拒{" "}
          {Array.isArray(importReport.rejected) ? importReport.rejected.length : importReport.rejected}。
        </Note>
      </section>

      <div className="hairline my-14" />

      <section aria-labelledby="env">
        <h2 id="env" className="display text-2xl text-ivory">
          环境变量
        </h2>
        <p className="lede mt-2 max-w-2xl text-sm">
          v1 不需要任何密钥即可完整运行 —— 数据在构建期读本地 JSON，推荐在浏览器里计算。以下变量都是可选的，且只放在
          .env.local（已被 .gitignore 忽略），不会出现在客户端包里。
        </p>
        <dl className="panel mt-4 px-5 py-2">
          <KeyValue label="TMDB_API_KEY">可选。仅用于将来补充官方剧照；当前未接入，缺少它不影响任何功能。</KeyValue>
          <KeyValue label="OMDB_API_KEY">可选。备用评分来源；当前评分只取自 IMDb 公开数据集。</KeyValue>
          <KeyValue label="NEXT_PUBLIC_SITE_URL">可选。用于生成绝对 URL（sitemap / OG 图）。</KeyValue>
        </dl>
        <Note className="mt-3">
          媒体类型分布：{Object.entries(
            movies.reduce<Record<string, number>>((acc, m) => {
              acc[m.mediaType] = (acc[m.mediaType] ?? 0) + 1;
              return acc;
            }, {}),
          )
            .map(([k, v]) => `${MEDIA_TYPE_LABELS[k] ?? k} ${v}`)
            .join(" · ")}
        </Note>
      </section>
    </div>
  );
}
