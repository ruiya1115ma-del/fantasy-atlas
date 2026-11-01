import Link from "next/link";

export default function NotFound() {
  return (
    <div className="shell flex min-h-[70vh] flex-col items-center justify-center py-24 text-center">
      <p className="eyebrow">404 · Lost World</p>
      <h1 className="display mt-4 text-5xl text-ivory md:text-6xl">这个世界地图上没有</h1>
      <p className="lede mt-5 max-w-md text-[0.95rem]">
        你要找的页面不在图册里 —— 可能是链接旧了，也可能这部作品还没被收录。幻想世界很多，先回到有路的地方。
      </p>
      <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
        <Link href="/" className="btn btn-primary">
          回到首页
        </Link>
        <Link href="/explore" className="btn btn-ghost">
          探索全部作品
        </Link>
      </div>
    </div>
  );
}
