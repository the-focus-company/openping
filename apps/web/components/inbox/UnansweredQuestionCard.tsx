"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { HelpCircle, X, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatRelativeTime } from "@/lib/utils";

interface UnansweredQuestionCardProps {
  alertId: string;
  channelId: string;
  channelName: string;
  title: string;
  body: string;
  suggestedAction: string;
  createdAt: Date;
  onDismiss?: (alertId: string) => void;
}

export function UnansweredQuestionCard({
  alertId,
  channelId,
  channelName,
  title,
  body,
  suggestedAction,
  createdAt,
  onDismiss,
}: UnansweredQuestionCardProps) {
  const [hovered, setHovered] = useState(false);
  const router = useRouter();

  return (
    <div
      className={cn(
        "group relative flex gap-3 border-b border-subtle px-4 py-3",
        "cursor-default transition-colors duration-75",
        hovered ? "bg-surface-2" : "bg-transparent"
      )}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Blue left border = Q3 Urgent */}
      <div className="absolute left-0 top-3 bottom-3 w-0.5 rounded-r bg-blue-500" />

      {/* Icon */}
      <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-500/10">
        <HelpCircle className="h-3 w-3 text-blue-400" />
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        {/* Header */}
        <div className="flex items-center gap-2 pb-0.5">
          <span className="text-xs font-medium text-foreground">{title}</span>
          <span className="text-2xs text-white/25">·</span>
          <span className="text-2xs text-muted-foreground">#{channelName}</span>
          <span className="text-2xs text-white/25">·</span>
          <span className="text-2xs text-muted-foreground">
            {formatRelativeTime(createdAt)}
          </span>
          <div className="ml-auto">
            <span className="rounded bg-blue-500/8 px-1.5 py-px text-2xs font-medium text-blue-400">
              NEEDS ANSWER
            </span>
          </div>
        </div>

        {/* Body */}
        <p className="text-sm text-foreground/90">{body}</p>

        {/* Suggested action */}
        <p className="mt-0.5 text-2xs text-muted-foreground">{suggestedAction}</p>

        {/* Actions */}
        <div
          className={cn(
            "mt-2 flex items-center gap-1.5 transition-all duration-150",
            hovered ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1 pointer-events-none"
          )}
        >
          <button
            onClick={() => router.push(`/channel/${channelId}`)}
            className="flex items-center gap-1 rounded bg-ping-purple px-2 py-1 text-xs font-medium text-white transition-colors hover:bg-ping-purple-hover"
          >
            <ArrowRight className="h-3 w-3" />
            Go to question
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
