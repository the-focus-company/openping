"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, Star, Mail, MailOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatRelativeTime } from "@/lib/utils";
import { useWorkspace } from "@/hooks/useWorkspace";

export type EisenhowerQuadrant =
  | "urgent-important"
  | "important"
  | "urgent"
  | "fyi";

export interface EmailItem {
  _id: string;
  threadId: string;
  subject: string;
  from: { name?: string; email: string };
  snippet: string;
  receivedAt: number;
  isRead: boolean;
  isStarred: boolean;
  eisenhowerQuadrant?: EisenhowerQuadrant;
}

const quadrantConfig: Record<
  EisenhowerQuadrant,
  { bg: string; label: string; textColor: string }
> = {
  "urgent-important": {
    bg: "bg-priority-urgent/8",
    label: "URGENT",
    textColor: "text-priority-urgent",
  },
  important: {
    bg: "bg-priority-important/8",
    label: "IMPORTANT",
    textColor: "text-priority-important",
  },
  urgent: {
    bg: "bg-blue-500/8",
    label: "URGENT",
    textColor: "text-blue-400",
  },
  fyi: {
    bg: "bg-white/5",
    label: "FYI",
    textColor: "text-white/30",
  },
};

interface EmailCardProps {
  email: EmailItem;
  onMarkRead?: (id: string) => void;
  onArchive?: (id: string) => void;
  onToggleStar?: (id: string) => void;
}

export function EmailCard({
  email,
  onMarkRead,
  onArchive,
  onToggleStar,
}: EmailCardProps) {
  const [hovered, setHovered] = useState(false);
  const router = useRouter();
  const { buildPath } = useWorkspace();
  const quadrant = email.eisenhowerQuadrant
    ? quadrantConfig[email.eisenhowerQuadrant]
    : null;
  const senderName = email.from.name || email.from.email;
  const senderInitial = senderName[0]?.toUpperCase() ?? "?";

  return (
    <div
      className={cn(
        "group relative flex gap-3 border-b border-subtle px-4 py-3",
        "cursor-pointer transition-colors duration-75",
        hovered ? "bg-surface-2" : "bg-transparent",
        email.isRead && "opacity-60",
      )}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => router.push(buildPath(`/email/${email.threadId}`))}
    >
      {/* Unread indicator */}
      {!email.isRead && (
        <div className="absolute left-1.5 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-ping-purple" />
      )}

      {/* Avatar */}
      <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-3 text-2xs font-medium text-foreground">
        {senderInitial}
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        {/* Header row */}
        <div className="flex items-center gap-2 pb-0.5">
          <span
            className={cn(
              "text-xs text-foreground",
              !email.isRead && "font-semibold",
            )}
          >
            {senderName}
          </span>
          <span className="text-2xs text-white/25">·</span>
          <span className="text-2xs text-muted-foreground">
            {formatRelativeTime(email.receivedAt)}
          </span>

          <div className="ml-auto flex items-center gap-1">
            {quadrant && (
              <span
                className={cn(
                  "rounded px-1.5 py-px text-2xs font-medium",
                  quadrant.bg,
                  quadrant.textColor,
                )}
              >
                {quadrant.label}
              </span>
            )}
          </div>
        </div>

        {/* Subject */}
        <p
          className={cn(
            "truncate text-sm text-foreground",
            !email.isRead && "font-medium",
          )}
        >
          {email.subject}
        </p>

        {/* Snippet */}
        <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
          {email.snippet}
        </p>

        {/* Actions on hover */}
        <div
          className={cn(
            "mt-2 flex items-center gap-1.5 transition-all duration-150",
            hovered
              ? "translate-y-0 opacity-100"
              : "pointer-events-none translate-y-1 opacity-0",
          )}
        >
          <div className="ml-auto flex items-center gap-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleStar?.(email._id);
              }}
              className={cn(
                "rounded p-1 transition-colors hover:bg-surface-3",
                email.isStarred
                  ? "text-amber-400"
                  : "text-white/30 hover:text-foreground",
              )}
              title={email.isStarred ? "Unstar" : "Star"}
            >
              <Star
                className="h-3 w-3"
                fill={email.isStarred ? "currentColor" : "none"}
              />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onMarkRead?.(email._id);
              }}
              className="rounded p-1 text-white/30 transition-colors hover:bg-surface-3 hover:text-foreground"
              title={email.isRead ? "Mark unread" : "Mark read"}
            >
              {email.isRead ? (
                <Mail className="h-3 w-3" />
              ) : (
                <MailOpen className="h-3 w-3" />
              )}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onArchive?.(email._id);
              }}
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
