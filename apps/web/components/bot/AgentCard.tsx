"use client";

import {
  Settings, Bot, Globe, Lock,
  Wrench, Zap, CalendarClock,
} from "lucide-react";
import { StatusDot } from "@/components/ui/status-dot";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Id } from "@convex/_generated/dataModel";
import type { Agent } from "./agent-config";

// ── Barrel re-exports ────────────────────────────────────────────────
export { AgentConfigDialog } from "./AgentConfigDialog";
export { ChipGrid } from "./ChipGrid";
export type { Agent, AgentSaveData } from "./agent-config";
export {
  AGENT_TOOLS,
  AGENT_RESTRICTIONS,
  AGENT_TRIGGERS,
  AGENT_JOBS,
  AGENT_MODELS,
} from "./agent-config";

// ── AgentCard ────────────────────────────────────────────────────────

interface AgentCardProps {
  agent: Agent;
  isManaged?: boolean;
  onConfigure?: (id: Id<"agents">) => void;
}

export function AgentCard({ agent, isManaged, onConfigure }: AgentCardProps) {
  const isActive = agent.status === "active";
  const color = agent.color || "#5E6AD2";
  const toolCount = (agent.tools?.length ?? 0);
  const triggerCount = (agent.triggers?.length ?? 0);
  const jobCount = (agent.jobs?.length ?? 0);
  const capsuleCount = toolCount + triggerCount + jobCount;

  return (
    <div
      className={cn(
        "group flex flex-col rounded border border-subtle bg-surface-1 p-4",
        "transition-all duration-150 hover:border-foreground/10 hover:bg-surface-2",
        agent.status === "revoked" && "opacity-50"
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
            style={{ backgroundColor: `${color}20`, border: `1px solid ${color}30` }}
          >
            <Bot className="h-4 w-4" style={{ color }} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-medium text-foreground truncate">{agent.name}</p>
              {isManaged && (
                <span className="shrink-0 rounded border border-violet-500/20 bg-violet-500/10 px-1.5 py-px text-[10px] font-medium text-violet-400">
                  Platform
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <StatusDot variant={isActive ? "online" : "offline"} size="xs" />
              <span className="text-2xs text-muted-foreground">
                {agent.status === "revoked" ? "Revoked" : isActive ? "Active" : "Inactive"}
              </span>
              {agent.scope && (
                <>
                  <span className="text-foreground/45">·</span>
                  {agent.scope === "workspace" ? (
                    <Globe className="h-2.5 w-2.5 text-foreground/45" />
                  ) : (
                    <Lock className="h-2.5 w-2.5 text-foreground/45" />
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Description */}
      {agent.description && (
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground line-clamp-2">
          {agent.description}
        </p>
      )}

      {/* Capability pills */}
      {capsuleCount > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {agent.model && (
            <span className="inline-flex items-center rounded bg-surface-3 px-1.5 py-0.5 text-2xs text-foreground/40 font-mono">
              {agent.model}
            </span>
          )}
          {toolCount > 0 && (
            <span className="inline-flex items-center gap-0.5 rounded bg-blue-500/10 px-1.5 py-0.5 text-2xs text-blue-400">
              <Wrench className="h-2.5 w-2.5" />{toolCount} tool{toolCount !== 1 ? "s" : ""}
            </span>
          )}
          {triggerCount > 0 && (
            <span className="inline-flex items-center gap-0.5 rounded bg-amber-500/10 px-1.5 py-0.5 text-2xs text-amber-400">
              <Zap className="h-2.5 w-2.5" />{triggerCount} trigger{triggerCount !== 1 ? "s" : ""}
            </span>
          )}
          {jobCount > 0 && (
            <span className="inline-flex items-center gap-0.5 rounded bg-green-500/10 px-1.5 py-0.5 text-2xs text-green-400">
              <CalendarClock className="h-2.5 w-2.5" />{jobCount} job{jobCount !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      )}

      {/* Footer */}
      {agent.status !== "revoked" && (
        <div className="mt-auto pt-3">
          <div className="flex items-center justify-between border-t border-subtle pt-3">
            <span className="text-2xs text-muted-foreground shrink-0">
              {agent.lastActiveAt
                ? `Active ${new Date(agent.lastActiveAt).toLocaleDateString()}`
                : "Never connected"}
            </span>
            <Button
              variant="outline"
              size="sm"
              className="h-6 gap-1 border-subtle px-1.5 text-2xs hover:border-foreground/15"
              onClick={() => onConfigure?.(agent._id)}
            >
              <Settings className="h-2.5 w-2.5" />
              Configure
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
