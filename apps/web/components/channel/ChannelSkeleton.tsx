"use client";

import { Skeleton } from "@/components/ui/skeleton";

const MESSAGE_WIDTHS: [string, string][] = [
  ["w-[60%]", "w-[40%]"],
  ["w-[80%]", "w-[50%]"],
  ["w-[40%]", "w-[30%]"],
  ["w-[70%]", "w-[60%]"],
  ["w-[55%]", "w-[35%]"],
  ["w-[65%]", "w-[45%]"],
];

export function ChannelSkeleton() {
  return (
    <div className="flex h-full animate-fade-in flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-subtle px-4 py-2.5">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-48" />
      </div>

      {/* Messages */}
      <div className="flex flex-1 flex-col gap-4 overflow-hidden px-4 py-4">
        {MESSAGE_WIDTHS.map(([line1, line2], i) => (
          <div key={i} className="flex items-start gap-3">
            <Skeleton className="h-7 w-7 shrink-0 rounded-full" />
            <div className="flex flex-1 flex-col gap-1.5">
              <Skeleton className={`h-3 ${line1}`} />
              <Skeleton className={`h-2.5 ${line2}`} />
            </div>
          </div>
        ))}
      </div>

      {/* Composer */}
      <div className="border-t border-subtle px-4 py-3">
        <Skeleton className="h-9 w-full rounded-md" />
      </div>
    </div>
  );
}
