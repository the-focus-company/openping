"use client";

import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Activity, Clock, AlertCircle } from "lucide-react";

interface InboxStatsProps {
  workspaceId: Id<"workspaces">;
}

export function InboxStats({ workspaceId }: InboxStatsProps) {
  const stats = useQuery(api.decisions.getStats, { workspaceId });

  if (!stats) {
    return null;
  }

  const avgMinutes =
    stats.avgDecisionTimeMs > 0
      ? Math.round(stats.avgDecisionTimeMs / 60000)
      : 0;

  return (
    <div className="flex items-center gap-4 rounded-lg border border-border bg-card/50 px-4 py-2 text-xs text-muted-foreground">
      <div className="flex items-center gap-1.5">
        <Activity className="h-3.5 w-3.5 text-white/40" />
        <span>
          <span className="font-medium text-foreground">
            {stats.totalToday}
          </span>{" "}
          decisions today
        </span>
      </div>

      <div className="h-3 w-px bg-border" />

      <div className="flex items-center gap-1.5">
        <Clock className="h-3.5 w-3.5 text-white/40" />
        <span>
          Avg response:{" "}
          <span className="font-medium text-foreground">
            {avgMinutes > 0 ? `${avgMinutes}m` : "--"}
          </span>
        </span>
      </div>

      <div className="h-3 w-px bg-border" />

      <div className="flex items-center gap-1.5">
        <AlertCircle className="h-3.5 w-3.5 text-white/40" />
        <span>
          <span className="font-medium text-foreground">
            {stats.pendingCount}
          </span>{" "}
          pending
        </span>
      </div>
    </div>
  );
}
