"use client";

import {
  Circle,
  CircleDot,
  CheckCircle2,
  XCircle,
  SignalHigh,
  Signal,
  SignalMedium,
  SignalLow,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface LinearTicketCardProps {
  ticketId: string;
  title: string;
  status: "backlog" | "todo" | "in_progress" | "done" | "cancelled";
  priority?: "urgent" | "high" | "medium" | "low" | "none";
  assignee?: string;
  subTaskCount?: number;
  cycleName?: string;
  url?: string;
  compact?: boolean;
}

const STATUS_CONFIG: Record<
  LinearTicketCardProps["status"],
  { icon: typeof Circle; color: string; label: string }
> = {
  backlog: { icon: Circle, color: "text-white/30", label: "Backlog" },
  todo: { icon: Circle, color: "text-white/50", label: "Todo" },
  in_progress: { icon: CircleDot, color: "text-amber-400", label: "In Progress" },
  done: { icon: CheckCircle2, color: "text-green-400", label: "Done" },
  cancelled: { icon: XCircle, color: "text-red-400", label: "Cancelled" },
};

const PRIORITY_CONFIG: Record<
  NonNullable<LinearTicketCardProps["priority"]>,
  { icon: typeof Signal; color: string }
> = {
  urgent: { icon: SignalHigh, color: "text-red-400" },
  high: { icon: Signal, color: "text-orange-400" },
  medium: { icon: SignalMedium, color: "text-amber-400" },
  low: { icon: SignalLow, color: "text-white/40" },
  none: { icon: SignalLow, color: "text-white/20" },
};

export function LinearTicketCard({
  ticketId,
  title,
  status,
  priority,
  assignee,
  subTaskCount,
  cycleName,
  url,
  compact,
}: LinearTicketCardProps) {
  const statusCfg = STATUS_CONFIG[status];
  const StatusIcon = statusCfg.icon;
  const priorityCfg = priority ? PRIORITY_CONFIG[priority] : null;
  const PriorityIcon = priorityCfg?.icon ?? null;

  const Wrapper = url ? "a" : "div";
  const wrapperProps = url
    ? { href: url, target: "_blank" as const, rel: "noopener noreferrer" }
    : {};

  return (
    <Wrapper
      {...wrapperProps}
      className={cn(
        "flex items-start gap-2 rounded border border-subtle transition-colors",
        url && "hover:bg-surface-2",
        compact ? "p-1.5 gap-1.5" : "p-2"
      )}
    >
      <StatusIcon
        className={cn("mt-0.5 h-3.5 w-3.5 shrink-0", statusCfg.color)}
      />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="shrink-0 text-2xs text-muted-foreground">
            {ticketId}
          </span>
          <span
            className={cn(
              "truncate font-medium text-foreground",
              compact ? "text-2xs" : "text-xs"
            )}
          >
            {title}
          </span>
        </div>

        <div className="mt-0.5 flex items-center gap-2 text-2xs text-muted-foreground">
          <span className={statusCfg.color}>{statusCfg.label}</span>

          {PriorityIcon && priorityCfg && (
            <>
              <span className="text-white/20">·</span>
              <PriorityIcon className={cn("h-3 w-3", priorityCfg.color)} />
            </>
          )}

          {assignee && (
            <>
              <span className="text-white/20">·</span>
              <span>{assignee}</span>
            </>
          )}

          {subTaskCount !== undefined && subTaskCount > 0 && (
            <>
              <span className="text-white/20">·</span>
              <span>
                {subTaskCount} subtask{subTaskCount !== 1 ? "s" : ""}
              </span>
            </>
          )}

          {cycleName && (
            <>
              <span className="text-white/20">·</span>
              <span className="rounded bg-surface-3 px-1 py-px text-2xs text-muted-foreground">
                {cycleName}
              </span>
            </>
          )}
        </div>
      </div>
    </Wrapper>
  );
}
