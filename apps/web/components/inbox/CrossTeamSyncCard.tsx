"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { RefreshCw, X, ArrowRight, CheckCircle2 } from "lucide-react";
import { cn, formatRelativeTime } from "@/lib/utils";

interface CrossTeamSyncCardProps {
  alertId: string;
  channelId: string;
  channelName: string;
  title: string;
  body: string;
  suggestedAction: string;
  createdAt: Date;
  onDismiss?: (alertId: string) => void;
}

export function CrossTeamSyncCard({
  alertId,
  channelId,
  channelName,
  title,
  body,
  suggestedAction,
  createdAt,
  onDismiss,
}: CrossTeamSyncCardProps) {
  const [hovered, setHovered] = useState(false);
  const router = useRouter();

  // Extract author/timestamp citation from body if present (format: "— Author, timestamp")
  const citationMatch = body.match(/—\s*(.+)$/);
  const summary = citationMatch ? body.slice(0, citationMatch.index).trim() : body;
  const citation = citationMatch ? citationMatch[1].trim() : null;

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
      {/* Blue left border */}
      <div className="absolute left-0 top-3 bottom-3 w-0.5 rounded-r bg-blue-500" />

      {/* Icon */}
      <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-500/10">
        <RefreshCw className="h-3 w-3 text-blue-400" />
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        {/* Header */}
        <div className="flex items-center gap-2 pb-0.5">
          <span className="text-xs font-medium text-foreground">
            {title || `Context from #${channelName}`}
          </span>
          <span className="text-2xs text-white/25">·</span>
          <span className="text-2xs text-muted-foreground">#{channelName}</span>
          <span className="text-2xs text-white/25">·</span>
          <span className="text-2xs text-muted-foreground">
            {formatRelativeTime(createdAt)}
          </span>
          <div className="ml-auto">
            <span className="rounded bg-blue-500/8 px-1.5 py-px text-2xs font-medium text-blue-400">
              CROSS-TEAM
            </span>
          </div>
        </div>

        {/* Summary */}
        <p className="text-sm text-foreground/90">{summary}</p>

        {/* Source citation pill */}
        {citation && (
          <div className="mt-1">
            <span className="rounded-full bg-blue-500/8 px-2 py-0.5 text-2xs text-blue-400">
              {citation}
            </span>
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
            View Original
            <ArrowRight className="h-3 w-3" />
          </button>
          <button
            onClick={() => onDismiss?.(alertId)}
            className="flex items-center gap-1 rounded bg-surface-3 px-2 py-1 text-xs font-medium text-foreground/70 transition-colors hover:bg-surface-3/80 hover:text-foreground"
          >
            <CheckCircle2 className="h-3 w-3" />
            Acknowledge
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
