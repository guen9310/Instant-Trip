export function HomeSkeleton() {
  return (
    <>
      {/* 축제 스켈레톤 */}
      <div className="mb-6">
        <div className="h-5 w-24 rounded bg-muted animate-pulse mb-3" />
        <div className="flex gap-3 overflow-hidden">
          {[0, 1].map((i) => (
            <div key={i} className="shrink-0 w-52 rounded-xl bg-muted animate-pulse aspect-3/4" />
          ))}
        </div>
      </div>
      {/* 장소 스켈레톤 */}
      <div>
        <div className="h-5 w-24 rounded bg-muted animate-pulse mb-3" />
        <div className="flex gap-2 mb-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-7 w-14 rounded-full bg-muted animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="rounded-xl bg-muted animate-pulse aspect-4/5" />
          ))}
        </div>
      </div>
    </>
  );
}
