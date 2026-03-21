"use client";

import { useState } from "react";
import { Archive, Check, Mail, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatRelativeTime } from "@/lib/utils";

type EisenhowerQuadrant = "urgent-important" | "important" | "urgent" | "fyi";

interface EmailCardProps {
  email: {
    _id: string;
    from: string;
    subject: string;
    agentSummary?: string;
    eisenhowerQuadrant?: EisenhowerQuadrant;
    suggestedAction?: string;
    receivedAt: number;
    isRead: boolean;
  };
  onMarkRead?: (id: string) => void;
  onArchive?: (id: string) => void;
}

const priorityConfig: Record<
  EisenhowerQuadrant,
  {
    borderColor: string;
    borderWidth: string;
    bg: string;
    label: string;
    textColor: string;
    dimmed: boolean;
    bold: boolean;
    pulse: boolean;
  }
> = {
  "urgent-important": {
    borderColor: "bg-priority-urgent",
    borderWidth: "w-[3px]",
    bg: "bg-priority-urgent/8",
    label: "URGENT",
    textColor: "text-priority-urgent",
    dimmed: false,
    bold: true,
    pulse: true,
  },
  important: {
    borderColor: "bg-priority-important",
    borderWidth: "w-0.5",
    bg: "bg-priority-important/8",
    label: "IMPORTANT",
    textColor: "text-priority-important",
    dimmed: false,
    bold: false,
    pulse: false,
  },
  urgent: {
    borderColor: "bg-blue-500",
    borderWidth: "w-0.5",
    bg: "bg-blue-500/8",
    label: "URGENT",
    textColor: "text-blue-400",
    dimmed: false,
    bold: false,
    pulse: false,
  },
  fyi: {
    borderColor: "bg-white/20",
    borderWidth: "w-0.5",
    bg: "bg-white/5",
    label: "FYI",
    textColor: "text-white/30",
    dimmed: true,
    bold: false,
    pulse: false,
  },
};

export function EmailCard({ email, onMarkRead, onArchive }: EmailCardProps) {
  const [hovered, setHovered] = useState(false);
  const quadrant = email.eisenhowerQuadrant ?? "fyi";
  const config = priorityConfig[quadrant];

  return (
    <div
      className={cn(
        "group relative flex gap-3 border-b border-subtle px-4 py-3",
        "cursor-default transition-colors duration-75",
        hovered ? "bg-surface-2" : "bg-transparent",
        email.isRead && "opacity-60",
      )}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Priority left border */}
      <div
        className={cn(
          "absolute left-0 top-3 bottom-3 rounded-r",
          config.borderColor,
          config.borderWidth,
        )}
      />

      {/* Pulse dot for Q1 */}
      {config.pulse && (
        <span className="absolute left-3 top-3 flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-priority-urgent opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-priority-urgent" />
        </span>
      )}

      {/* Mail icon */}
      <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded bg-surface-3">
        <Mail className="h-3.5 w-3.5 text-muted-foreground" />
      </div>

      {/* Content */}
      <div className={cn("min-w-0 flex-1", config.dimmed && "opacity-60")}>
        {/* Header row */}
        <div className="flex items-center gap-2 pb-0.5">
          <span className="text-xs font-medium text-foreground">
            {email.from}
          </span>
          <span className="text-2xs text-white/25">·</span>
          <span className="text-2xs text-muted-foreground">email</span>
          <span className="text-2xs text-white/25">·</span>
          <span className="text-2xs text-muted-foreground">
            {formatRelativeTime(new Date(email.receivedAt))}
          </span>

          <div className="ml-auto flex items-center gap-1">
            <span
              className={cn(
                "rounded px-1.5 py-px text-2xs font-medium",
                config.bg,
                config.textColor,
              )}
            >
              {config.label}
            </span>
          </div>
        </div>

        {/* Subject */}
        <p
          className={cn(
            "text-sm text-foreground",
            config.bold && "font-semibold",
          )}
        >
          {email.subject}
        </p>

        {/* AI Summary */}
        {email.agentSummary && (
          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
            {email.agentSummary}
          </p>
        )}

        {/* Actions */}
        <div
          className={cn(
            "mt-2 flex items-center gap-1.5 transition-all duration-150",
            hovered
              ? "opacity-100 translate-y-0"
              : "opacity-0 translate-y-1 pointer-events-none",
          )}
        >
          {email.suggestedAction && (
            <button
              className="flex items-center gap-1 rounded bg-ping-purple px-2 py-1 text-xs font-medium text-white transition-colors hover:bg-ping-purple-hover"
            >
              <ArrowRight className="h-3 w-3" />
              {email.suggestedAction}
            </button>
          )}

          <div className="ml-auto flex items-center gap-1">
            <button
              onClick={() => onMarkRead?.(email._id)}
              className="rounded p-1 text-white/30 transition-colors hover:bg-surface-3 hover:text-foreground"
              title="Mark as read"
            >
              <Check className="h-3 w-3" />
            </button>
            <button
              onClick={() => onArchive?.(email._id)}
              className="rounded p-1 text-white/30 transition-colors hover:bg-surface-3 hover:text-foreground"
              title="Archive"
            >
              <Archive className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
