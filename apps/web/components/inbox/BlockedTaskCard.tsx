"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AlertTriangle, ExternalLink, AtSign, X } from "lucide-react";
import { cn, formatRelativeTime } from "@/lib/utils";
import { LinearTicketCard, type LinearTicketCardProps } from "@/components/integrations/LinearTicketCard";

interface BlockedTaskCardProps {
  alertId: string;
  channelId: string;
  title: string;
  body: string;
  suggestedAction: string;
  createdAt: Date;
  ticket?: Pick<
    LinearTicketCardProps,
    "ticketId" | "title" | "status" | "url"
  >;
  onDismiss?: (alertId: string) => void;
}

export function BlockedTaskCard({
  alertId,
  channelId,
  title,
  body,
  suggestedAction,
  createdAt,
  ticket,
  onDismiss,
}: BlockedTaskCardProps) {
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
      {/* Amber left border */}
      <div className="absolute left-0 top-3 bottom-3 w-[3px] rounded-r bg-[#F59E0B]" />

      {/* Icon */}
      <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-500/10">
        <AlertTriangle className="h-3 w-3 text-amber-400" />
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        {/* Header */}
        <div className="flex items-center gap-2 pb-0.5">
          <span className="text-xs font-medium text-foreground">
            Blocked Task
          </span>
          <span className="text-2xs text-white/25">·</span>
          <span className="text-2xs text-muted-foreground">
            {formatRelativeTime(createdAt)}
          </span>
          <div className="ml-auto">
            <span className="rounded bg-amber-500/8 px-1.5 py-px text-2xs font-medium text-amber-400">
              BLOCKED
            </span>
          </div>
        </div>

        {/* Title */}
        <p className="text-sm text-foreground/90">{title}</p>

        {/* Embedded ticket (compact) */}
        {ticket && (
          <div className="mt-1.5">
            <LinearTicketCard
              ticketId={ticket.ticketId}
              title={ticket.title}
              status={ticket.status}
              url={ticket.url}
              compact
            />
          </div>
        )}

        {/* AI blocker explanation */}
        <p className="mt-1 text-2xs text-muted-foreground">{body}</p>

        {/* Suggested action */}
        <p className="mt-0.5 text-2xs text-muted-foreground italic">
          {suggestedAction}
        </p>

        {/* Actions */}
        <div
          className={cn(
            "mt-2 flex items-center gap-1.5 transition-all duration-150",
            hovered
              ? "opacity-100 translate-y-0"
              : "opacity-0 translate-y-1 pointer-events-none"
          )}
        >
          {ticket?.url && (
            <a
              href={ticket.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 rounded bg-ping-purple px-2 py-1 text-xs font-medium text-white transition-colors hover:bg-ping-purple-hover"
            >
              <ExternalLink className="h-3 w-3" />
              Open in Linear
            </a>
          )}

          <button
            onClick={() => router.push(`/channel/${channelId}`)}
            className="flex items-center gap-1 rounded bg-surface-3 px-2 py-1 text-xs font-medium text-foreground transition-colors hover:bg-white/10"
          >
            <AtSign className="h-3 w-3" />
            Ask @person
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
