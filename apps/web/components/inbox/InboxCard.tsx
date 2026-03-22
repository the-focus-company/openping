"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, Check, ArrowRight, ExternalLink } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn, formatRelativeTime, avatarGradient } from "@/lib/utils";

export type EisenhowerQuadrant = "urgent-important" | "important" | "urgent" | "fyi";
export type PriorityLevel = "urgent" | "high" | "medium" | "low";

export interface InboxAction {
  label: string;
  primary?: boolean;
  onClick?: () => void;
}

export interface InboxItem {
  id: string;
  quadrant: EisenhowerQuadrant;
  priority: PriorityLevel;
  channel: string;
  author: string;
  authorInitials: string;
  summary: string;
  context: string;
  timestamp: Date;
  actions: InboxAction[];
  isRead?: boolean;
}

export const priorityConfig: Record<
  EisenhowerQuadrant,
  { borderColor: string; borderWidth: string; bg: string; label: string; textColor: string; dimmed: boolean; bold: boolean; pulse: boolean }
> = {
  "urgent-important": { borderColor: "bg-priority-urgent",    borderWidth: "w-[3px]", bg: "bg-priority-urgent/8",    label: "URGENT",     textColor: "text-priority-urgent",    dimmed: false, bold: true,  pulse: true  },
  "important":        { borderColor: "bg-priority-important", borderWidth: "w-0.5",   bg: "bg-priority-important/8", label: "IMPORTANT",  textColor: "text-priority-important", dimmed: false, bold: false, pulse: false },
  "urgent":           { borderColor: "bg-blue-500",           borderWidth: "w-0.5",   bg: "bg-blue-500/8",           label: "URGENT",     textColor: "text-blue-400",           dimmed: false, bold: false, pulse: false },
  "fyi":              { borderColor: "bg-foreground/20",      borderWidth: "w-0.5",   bg: "bg-foreground/5",         label: "FYI",        textColor: "text-foreground/30",      dimmed: true,  bold: false, pulse: false },
};

// Sort order for Eisenhower quadrants
export const QUADRANT_ORDER: EisenhowerQuadrant[] = ["urgent-important", "important", "urgent", "fyi"];

interface InboxCardProps {
  item: InboxItem;
  onMarkRead?: (id: string) => void;
  onArchive?: (id: string) => void;
}

export function InboxCard({ item, onMarkRead, onArchive }: InboxCardProps) {
  const [hovered, setHovered] = useState(false);
  const router = useRouter();
  const config = priorityConfig[item.quadrant] ?? priorityConfig["fyi"];

  return (
    <div
      className={cn(
        "group relative flex gap-3 border-b border-subtle px-4 py-3",
        "cursor-default transition-colors duration-75",
        hovered ? "bg-surface-2" : "bg-transparent",
        item.isRead && "opacity-60"
      )}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Priority left border */}
      <div
        className={cn(
          "absolute left-0 top-3 bottom-3 rounded-r",
          config.borderColor,
          config.borderWidth
        )}
      />

      {/* Pulse dot for Q1 urgent-important */}
      {config.pulse && (
        <span className="absolute left-3 top-3 flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-priority-urgent opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-priority-urgent" />
        </span>
      )}

      {/* Avatar */}
      <Avatar className="mt-0.5 h-6 w-6 shrink-0">
        <AvatarFallback className={cn("text-2xs font-medium text-white bg-gradient-to-br", avatarGradient(item.id + item.authorInitials))}>
          {item.authorInitials}
        </AvatarFallback>
      </Avatar>

      {/* Content */}
      <div className={cn("min-w-0 flex-1", config.dimmed && "opacity-60")}>
        {/* Header row */}
        <div className="flex items-center gap-2 pb-0.5">
          <span className="text-xs font-medium text-foreground">{item.author}</span>
          <span className="text-2xs text-foreground/25">·</span>
          <span className="text-2xs text-muted-foreground">#{item.channel}</span>
          <span className="text-2xs text-foreground/25">·</span>
          <span className="text-2xs text-muted-foreground">
            {formatRelativeTime(item.timestamp)}
          </span>

          <div className="ml-auto flex items-center gap-1">
            <span
              className={cn(
                "rounded px-1.5 py-px text-2xs font-medium",
                config.bg,
                config.textColor
              )}
            >
              {config.label}
            </span>
          </div>
        </div>

        {/* Summary */}
        <p className={cn("text-sm text-foreground", config.bold && "font-semibold")}>
          {item.summary}
        </p>

        {/* Context */}
        <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
          {item.context}
        </p>

        {/* Actions */}
        <div
          className={cn(
            "mt-2 flex items-center gap-1.5 transition-all duration-150",
            hovered ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1 pointer-events-none"
          )}
        >
          {item.actions.map((action) => (
            <button
              key={action.label}
              onClick={action.onClick}
              className={cn(
                "flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition-colors",
                action.primary
                  ? "bg-ping-purple text-white hover:bg-ping-purple-hover"
                  : "bg-surface-3 text-foreground hover:bg-foreground/10"
              )}
            >
              {action.primary && <ArrowRight className="h-3 w-3" />}
              {action.label}
            </button>
          ))}

          <div className="ml-auto flex items-center gap-1">
            <button
              onClick={() => onMarkRead?.(item.id)}
              className="rounded p-1 text-foreground/30 transition-colors hover:bg-surface-3 hover:text-foreground"
              title="Mark as read"
            >
              <Check className="h-3 w-3" />
            </button>
            <button
              onClick={() => onArchive?.(item.id)}
              className="rounded p-1 text-foreground/30 transition-colors hover:bg-surface-3 hover:text-foreground"
              title="Archive"
            >
              <Archive className="h-3 w-3" />
            </button>
            <button
              onClick={() => router.push(`/channel/${item.channel}`)}
              className="rounded p-1 text-foreground/30 transition-colors hover:bg-surface-3 hover:text-foreground"
              title="Go to channel"
            >
              <ExternalLink className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
