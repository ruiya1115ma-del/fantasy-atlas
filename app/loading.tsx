export default function Loading() {
  return (
    <div className="shell py-20" aria-busy="true" aria-live="polite">
      <p className="eyebrow">Loading The Atlas</p>
      <div className="mt-6 h-10 w-2/3 max-w-md skeleton" />
      <div className="mt-4 h-4 w-1/2 max-w-sm skeleton" />
      <div className="mt-12 grid grid-cols-2 gap-x-5 gap-y-9 sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i}>
            <div className="skeleton aspect-[2/3] w-full" />
            <div className="mt-3 h-3 w-3/4 skeleton" />
            <div className="mt-2 h-2.5 w-1/2 skeleton" />
          </div>
        ))}
      </div>
      <span className="sr-only">正在加载作品图册</span>
    </div>
  );
}
