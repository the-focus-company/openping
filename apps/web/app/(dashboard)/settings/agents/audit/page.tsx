"use client";

import { useState, useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { Id } from "@convex/_generated/dataModel";
import { ArrowLeft, Activity, Filter } from "lucide-react";
import Link from "next/link";
import { cn, formatRelativeTime } from "@/lib/utils";
import { useWorkspace } from "@/hooks/useWorkspace";

const WRITE_ACTIONS = new Set([
  "send_message",
  "send_dm",
  "create_channel",
  "join_channel",
  "leave_channel",
  "update_presence",
]);

function ActionBadge({ action }: { action: string }) {
  const isWrite = WRITE_ACTIONS.has(action);
  return (
    <span
      className={cn(
        "inline-flex items-center rounded border px-1.5 py-px text-2xs font-medium",
        isWrite
          ? "border-ping-purple/40 bg-ping-purple/10 text-ping-purple"
          : "border-white/15 bg-white/5 text-white/60"
      )}
    >
      {action}
    </span>
  );
}

export default function AuditLogPage() {
  const { workspaceId } = useWorkspace();
  const [filterAgentId, setFilterAgentId] = useState<string>("all");

  const agentIdArg =
    filterAgentId === "all"
      ? undefined
      : (filterAgentId as Id<"agents">);

  const logs = useQuery(api.agentAudit.list, {
    workspaceId,
    limit: 100,
    agentId: agentIdArg,
  });
  const stats = useQuery(api.agentAudit.getStats, { workspaceId });
  const agents = useQuery(api.agents.list, { workspaceId });

  const topAgent = useMemo(() => {
    if (!stats || !agents) return null;
    const entries = Object.entries(stats.agentCounts);
    if (entries.length === 0) return null;
    entries.sort((a, b) => b[1] - a[1]);
    const topId = entries[0][0];
    const agent = agents.find((a) => (a._id as string) === topId);
    return agent?.name ?? "Unknown";
  }, [stats, agents]);

  const topAction = useMemo(() => {
    if (!stats) return null;
    const entries = Object.entries(stats.actionCounts);
    if (entries.length === 0) return null;
    entries.sort((a, b) => b[1] - a[1]);
    return entries[0][0];
  }, [stats]);

  if (logs === undefined || stats === undefined || agents === undefined) {
    return (
      <div className="mx-auto max-w-4xl animate-fade-in px-6 py-6">
        <h1 className="text-md font-semibold text-foreground">Agent Audit Log</h1>
        <p className="mt-2 text-xs text-muted-foreground">Loading audit logs...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl animate-fade-in px-6 py-6">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/settings/agents"
            className="flex h-7 w-7 items-center justify-center rounded border border-subtle text-muted-foreground transition-colors hover:border-white/10 hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
          </Link>
          <div>
            <h1 className="text-md font-semibold text-foreground">Agent Audit Log</h1>
            <p className="mt-0.5 text-xs text-muted-foreground">
              API activity from external agent connections
            </p>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="mb-4 grid grid-cols-3 gap-3">
        <div className="rounded border border-subtle bg-surface-1 px-3 py-2.5">
          <div className="flex items-center gap-1.5">
            <Activity className="h-3 w-3 text-muted-foreground" />
            <span className="text-2xs font-medium uppercase tracking-widest text-white/25">
              Total Calls
            </span>
          </div>
          <p className="mt-1 text-lg font-semibold text-foreground">{stats.totalCalls}</p>
        </div>
        <div className="rounded border border-subtle bg-surface-1 px-3 py-2.5">
          <span className="text-2xs font-medium uppercase tracking-widest text-white/25">
            Top Agent
          </span>
          <p className="mt-1 text-sm font-medium text-foreground">{topAgent ?? "---"}</p>
        </div>
        <div className="rounded border border-subtle bg-surface-1 px-3 py-2.5">
          <span className="text-2xs font-medium uppercase tracking-widest text-white/25">
            Top Action
          </span>
          <p className="mt-1 text-sm font-medium text-foreground">{topAction ?? "---"}</p>
        </div>
      </div>

      {/* Filter */}
      <div className="mb-4 flex items-center gap-2">
        <Filter className="h-3 w-3 text-muted-foreground" />
        <select
          value={filterAgentId}
          onChange={(e) => setFilterAgentId(e.target.value)}
          className="rounded border border-subtle bg-surface-2 px-2 py-1 text-xs text-foreground focus:border-white/20 focus:outline-none"
        >
          <option value="all">All agents</option>
          {agents.map((agent) => (
            <option key={agent._id} value={agent._id}>
              {agent.name}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded border border-subtle">
        <div className="grid grid-cols-[120px_1fr_1fr_1fr_100px] gap-4 border-b border-subtle bg-surface-1 px-4 py-2">
          <span className="text-2xs font-medium uppercase tracking-widest text-white/25">
            Timestamp
          </span>
          <span className="text-2xs font-medium uppercase tracking-widest text-white/25">
            Agent
          </span>
          <span className="text-2xs font-medium uppercase tracking-widest text-white/25">
            Action
          </span>
          <span className="text-2xs font-medium uppercase tracking-widest text-white/25">
            Resource
          </span>
          <span className="text-2xs font-medium uppercase tracking-widest text-white/25">
            Token
          </span>
        </div>

        {logs.length === 0 && (
          <div className="px-4 py-8 text-center text-xs text-muted-foreground">
            No audit logs found.
          </div>
        )}

        {logs.map((log) => (
          <div
            key={log._id}
            className="grid grid-cols-[120px_1fr_1fr_1fr_100px] items-center gap-4 border-b border-subtle px-4 py-2.5 transition-colors last:border-0 hover:bg-surface-2"
          >
            <span className="text-xs text-muted-foreground">
              {formatRelativeTime(log.timestamp)}
            </span>
            <span className="truncate text-xs font-medium text-foreground">
              {log.agentName}
            </span>
            <ActionBadge action={log.action} />
            <span className="truncate text-xs text-muted-foreground">
              {log.resourceType
                ? `${log.resourceType}${log.resourceId ? `:${log.resourceId.slice(0, 8)}...` : ""}`
                : "---"}
            </span>
            <span className="font-mono text-2xs text-white/30">{log.tokenPrefix}...</span>
          </div>
        ))}
      </div>

      <p className="mt-3 text-2xs text-white/20">
        Showing {logs.length} recent log entries
      </p>
    </div>
  );
}
