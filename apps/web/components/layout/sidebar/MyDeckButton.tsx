"use client";

import { useRouter } from "next/navigation";
import { Inbox } from "lucide-react";
import { cn } from "@/lib/utils";

interface MyDeckButtonProps {
  href: string;
  badge?: number;
  isActive: boolean;
}

export function MyDeckButton({ href, badge, isActive }: MyDeckButtonProps) {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => router.push(href)}
      className={cn(
        "flex w-full items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium",
        "transition-colors duration-100",
        isActive
          ? "border-ping-purple/30 bg-ping-purple/15 text-foreground"
          : "border-subtle bg-surface-2 text-foreground hover:border-ping-purple/20 hover:bg-ping-purple/10",
      )}
    >
      <Inbox className={cn("h-4 w-4 shrink-0", isActive ? "text-ping-purple" : "text-foreground/60")} />
      <span className="flex-1 text-left truncate">My Deck</span>
      {badge != null && badge > 0 && (
        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-ping-purple px-1.5 text-2xs font-semibold text-white tabular-nums">
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </button>
  );
}
