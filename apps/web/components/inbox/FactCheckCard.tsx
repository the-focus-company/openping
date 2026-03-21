"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Search, X, ArrowRight } from "lucide-react";
import { cn, formatRelativeTime } from "@/lib/utils";

interface FactCheckCardProps {
  alertId: string;
  channelId: string;
  channelName: string;
  title: string;
  body: string;
  suggestedAction: string;
  createdAt: Date;
  onDismiss?: (alertId: string) => void;
}

export function FactCheckCard({
  alertId,
  channelId,
  channelName,
  title,
  body,
  suggestedAction,
  createdAt,
  onDismiss,
}: FactCheckCardProps) {
  const [hovered, setHovered] = useState(false);
  const router = useRouter();

  // Parse body: first line is the original claim, rest is the correction.
  // Citations are extracted from bracketed references like [Source Name].
  const lines = body.split("\n").filter(Boolean);
  const claim = lines[0] ?? "";
  const correction = lines.slice(1).join(" ");
  const citations = [...body.matchAll(/\[([^\]]+)\]/g)].map((m) => m[1]);

  return (
    <div
      className={cn(
        "group relative flex gap-3 border-b border-subtle px-4 py-3",
        "cursor-default transition-colors duration-75",
        hovered ? "bg-surface-2" : "bg-transparent",
      )}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Purple left border */}
      <div className="absolute left-0 top-3 bottom-3 w-0.5 rounded-r bg-[#5E6AD2]" />

      {/* Icon */}
      <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#5E6AD2]/10">
        <Search className="h-3 w-3 text-[#5E6AD2]" />
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        {/* Header */}
        <div className="flex items-center gap-2 pb-0.5">
          <span className="text-xs font-medium text-foreground">{title || "Knowledge Check"}</span>
          <span className="text-2xs text-white/25">·</span>
          <span className="text-2xs text-muted-foreground">#{channelName}</span>
          <span className="text-2xs text-white/25">·</span>
          <span className="text-2xs text-muted-foreground">
            {formatRelativeTime(createdAt)}
          </span>
          <div className="ml-auto">
            <span className="rounded bg-[#5E6AD2]/8 px-1.5 py-px text-2xs font-medium text-[#5E6AD2]">
              FACT CHECK
            </span>
          </div>
        </div>

        {/* Original claim */}
        <p className="text-sm italic text-foreground/70">&ldquo;{claim}&rdquo;</p>

        {/* AI correction */}
        {correction && (
          <p className="mt-0.5 text-sm text-foreground/90">{correction}</p>
        )}

        {/* Citation pills */}
        {citations.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {citations.map((cite, i) => (
              <span
                key={i}
                className="rounded-full bg-[#5E6AD2]/8 px-2 py-0.5 text-2xs text-[#5E6AD2]"
              >
                {cite}
              </span>
            ))}
          </div>
        )}

        {/* Suggested action */}
        {suggestedAction && (
          <p className="mt-0.5 text-2xs text-muted-foreground">{suggestedAction}</p>
        )}

        {/* Actions */}
        <div
          className={cn(
            "mt-2 flex items-center gap-1.5 transition-all duration-150",
            hovered ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1 pointer-events-none",
          )}
        >
          <button
            onClick={() => router.push(`/channel/${channelId}`)}
            className="flex items-center gap-1 rounded bg-ping-purple px-2 py-1 text-xs font-medium text-white transition-colors hover:bg-ping-purple-hover"
          >
            View in Channel
            <ArrowRight className="h-3 w-3" />
          </button>
          <div className="ml-auto">
            <button
              onClick={() => onDismiss?.(alertId)}
              className="rounded p-1 text-white/30 transition-colors hover:bg-surface-3 hover:text-foreground"
              title="Dismiss"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
