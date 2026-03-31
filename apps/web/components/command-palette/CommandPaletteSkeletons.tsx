export function SkeletonRow() {
  return (
    <div className="flex items-center gap-2 px-2.5 py-1.5">
      <div className="h-4 w-4 rounded bg-white/[0.06] animate-pulse" />
      <div className="h-3 flex-1 rounded bg-white/[0.06] animate-pulse" />
    </div>
  );
}

export function SkeletonGroup({ heading, rows = 3 }: { heading: string; rows?: number }) {
  return (
    <div className="overflow-hidden p-1">
      <div className="px-3 py-1.5 text-[11px] font-medium uppercase tracking-wider text-white/30">
        {heading}
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonRow key={i} />
      ))}
    </div>
  );
}
