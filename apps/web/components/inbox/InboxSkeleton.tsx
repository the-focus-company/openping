"use client";

import { Skeleton } from "@/components/ui/skeleton";

const ROWS = [
  { titleWidth: "w-32", subtitleWidth: "w-48" },
  { titleWidth: "w-24", subtitleWidth: "w-56" },
  { titleWidth: "w-36", subtitleWidth: "w-40" },
  { titleWidth: "w-28", subtitleWidth: "w-52" },
  { titleWidth: "w-20", subtitleWidth: "w-44" },
];

export function InboxSkeleton() {
  return (
    <div className="animate-fade-in">
      {/* Header skeleton */}
      <div className="flex items-center gap-3 border-b border-subtle px-4 py-2">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-24" />
      </div>

      {/* Inbox card rows */}
      {ROWS.map((row, i) => (
        <div
          key={i}
          className="flex items-center gap-3 border-b border-subtle px-4 py-3"
        >
          {/* Left colored border strip */}
          <Skeleton className="h-10 w-1 shrink-0 rounded-full" />

          {/* Avatar circle */}
          <Skeleton className="h-7 w-7 shrink-0 rounded-full" />

          {/* Text lines */}
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <Skeleton className={`h-3 ${row.titleWidth}`} />
            <Skeleton className={`h-2.5 ${row.subtitleWidth}`} />
          </div>

          {/* Badge placeholder */}
          <Skeleton className="h-5 w-10 shrink-0 rounded-full" />
        </div>
      ))}
    </div>
  );
}
