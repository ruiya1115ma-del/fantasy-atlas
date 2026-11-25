import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin/auth";
import { readTraffic } from "@/lib/traffic";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "访问统计",
  robots: { index: false, follow: false },
};

const WEEKDAY = ["日", "一", "二", "三", "四", "五", "六"];

export default async function AdminTrafficPage() {
  if (!(await isAdmin())) redirect("/admin/login");

  const stats = await readTraffic(14);
  const today = stats[stats.length - 1];
  const last7 = stats.slice(-7);
  const sum7 = last7.reduce((acc, d) => ({ pv: acc.pv + d.pv, uv: acc.uv + d.uv }), { pv: 0, uv: 0 });
  const max = Math.max(1, ...stats.map((d) => d.pv));
  const allZero = stats.every((d) => d.pv === 0 && d.uv === 0);

  return (
    <div className="space-y-10">
      <header>
        <p className="eyebrow">Admin · Traffic</p>
        <h1 className="display mt-3 text-3xl text-ivory">访问统计</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--color-ash)]">
          这里只统计「打开页面」的次数，不装任何第三方统计脚本、不记录 IP、不记录设备指纹。
          同一浏览器当天第一次打开记 1 个访客（靠一枚当天有效的 cookie），所以人数是去重后的近似值。
          图片、脚本、接口请求都不计入。
        </p>
      </header>

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="panel px-5 py-4">
          <p className="admin-label">今天浏览</p>
          <p className="display mt-2 text-1xl text-ivory">{today?.pv ?? 0}</p>
        </div>
        <div className="panel px-5 py-4">
          <p className="admin-label">今天访客</p>
          <p className="display mt-2 text-1xl text-ivory">{today?.uv ?? 0}</p>
        </div>
        <div className="panel px-5 py-4">
          <p className="admin-label">近 7 天浏览</p>
          <p className="display mt-2 text-1xl text-ivory">{sum7.pv}</p>
        </div>
        <div className="panel px-5 py-4">
          <p className="admin-label">近 7 天访客（人次）</p>
          <p className="display mt-2 text-1xl text-ivory">{sum7.uv}</p>
        </div>
      </section>

      <section>
        <h2 className="display text-xl text-ivory">最近 14 天</h2>
        {allZero ? (
          <p className="mt-4 text-sm text-[var(--color-ash)]">
            还没有数据。上线后第一次有人打开页面就会开始记录；计数每 10 分钟写入一次存储，
            所以刚访问完最多等 10 分钟才会出现在这里。
          </p>
        ) : (
          <div className="mt-5 space-y-2">
            {stats.map((day) => {
              const pct = Math.round((day.pv / max) * 100);
              const d = new Date(`${day.date}T00:00:00Z`);
              return (
                <div key={day.date} className="flex items-center gap-3 text-xs">
                  <span className="w-24 shrink-0 text-[var(--color-ash-dim)]">
                    {day.date.slice(5)} 周{WEEKDAY[d.getUTCDay()]}
                  </span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-[rgba(255,255,255,0.06)]">
                    <div
                      className="h-full rounded-full bg-[linear-gradient(90deg,rgba(201,162,39,0.55),rgba(226,200,127,0.95))]"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="w-32 shrink-0 text-right text-[var(--color-ivory-dim)]">
                    {day.pv} 浏览 / {day.uv} 人
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="panel px-5 py-4">
        <h2 className="text-sm text-ivory">这套统计的边界</h2>
        <ul className="mt-2 list-inside list-disc space-y-1 text-xs leading-relaxed text-[var(--color-ash)]">
          <li>只统计页面打开（首页、探索、详情、主题页等），下载图片、加载脚本不算。</li>
          <li>同一浏览器同一台设备当天只算 1 个访客；换设备、清 cookie 会被重复计为访客。</li>
          <li>计数先在内存里累积、每 10 分钟落盘一次；服务器若在落盘前被回收，可能丢个位数。</li>
          <li>想看更严格的流量数据（含带宽、状态码、国家分布），Cloudflare 后台的 Analytics 里有官方版本。</li>
        </ul>
      </section>
    </div>
  );
}
