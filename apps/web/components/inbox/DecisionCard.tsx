"use client";

import { useState } from "react";
import {
  GitPullRequest,
  Ticket,
  HelpCircle,
  AlertTriangle,
  Search,
  RefreshCw,
  FileText,
  Mail,
  Maximize2,
  Archive,
} from "lucide-react";
import { cn, formatRelativeTime } from "@/lib/utils";
import { DecisionActions } from "./DecisionActions";
import type { DecisionType } from "./DecisionActions";
import type { InboxCategory, PriorityLevel } from "./InboxCard";
import { priorityConfig } from "./InboxCard";

export type { DecisionType, InboxCategory, PriorityLevel };

export interface OrgTracePerson {
  name: string;
  role: "author" | "assignee" | "mentioned" | "to_consult";
  avatarUrl?: string;
}

export interface InboxItemData {
  id: string;
  type: DecisionType;
  title: string;
  summary: string;
  category: InboxCategory;
  priority: PriorityLevel;
  status: string;
  channelName: string;
  pingWillDo?: string;
  sourceUrl?: string;
  createdAt: Date;
  agentExecutionStatus?: "pending" | "running" | "completed" | "failed";
  agentExecutionResult?: string;
  orgTrace?: OrgTracePerson[];
  nextSteps?: Array<{
    actionKey: string;
    label: string;
    automated: boolean;
  }>;
  recommendedActions?: Array<{
    label: string;
    actionKey: string;
    primary?: boolean;
    needsComment?: boolean;
  }>;
  links?: Array<{
    title: string;
    url: string;
    type: "doc" | "sheet" | "video" | "pr" | "other";
  }>;
  relatedItemIds?: string[];
}

function initials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

const ROLE_LABEL: Record<string, string> = {
  author: "wrote",
  assignee: "assigned",
  mentioned: "mentioned",
};

function OrgFacepile({ people }: { people: OrgTracePerson[] }) {
  if (people.length === 0) return null;
  const visible = people.slice(0, 4);
  const overflow = people.length - visible.length;
  return (
    <div className="flex items-center gap-0.5">
      {visible.map((p, i) => (
        <span
          key={i}
          title={`${p.name} (${ROLE_LABEL[p.role] ?? p.role})`}
          className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-surface-3 text-[9px] font-medium text-muted-foreground ring-1 ring-background"
          style={{ zIndex: visible.length - i }}
        >
          {initials(p.name)}
        </span>
      ))}
      {overflow > 0 && (
        <span className="text-2xs text-muted-foreground">+{overflow}</span>
      )}
    </div>
  );
}

const typeConfig: Record<string, { icon: typeof GitPullRequest; label: string }> = {
  pr_review: { icon: GitPullRequest, label: "PR Review" },
  ticket_triage: { icon: Ticket, label: "Ticket" },
  question_answer: { icon: HelpCircle, label: "Question" },
  blocked_unblock: { icon: AlertTriangle, label: "Blocked" },
  fact_verify: { icon: Search, label: "Fact Check" },
  cross_team_ack: { icon: RefreshCw, label: "Cross-Team" },
  channel_summary: { icon: FileText, label: "Summary" },
  email_summary: { icon: Mail, label: "Email" },
};

interface DecisionCardProps {
  item: InboxItemData;
  onAction: (id: string, action: string, comment?: string) => void;
  onArchive: (id: string) => void;
  onOpen: () => void;
  onFocus?: () => void;
}

export function DecisionCard({ item, onAction, onArchive, onOpen, onFocus }: DecisionCardProps) {
  const [hovered, setHovered] = useState(false);
  const config = priorityConfig[item.category];
  const typeInfo = typeConfig[item.type] ?? typeConfig.channel_summary;
  const TypeIcon = typeInfo.icon;

  return (
    <div
      className={cn(
        "group relative flex flex-col border-b border-subtle px-4 py-4",
        "cursor-pointer transition-colors duration-75",
        hovered ? "bg-surface-2" : "bg-transparent"
      )}
      onClick={onOpen}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Priority left border */}
      <div
        className={cn(
          "absolute left-0 top-4 bottom-4 rounded-r",
          config.borderColor,
          config.borderWidth
        )}
      />

      {/* Pulse dot for Do items */}
      {config.pulse && (
        <span className="absolute left-3 top-4 flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-priority-urgent opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-priority-urgent" />
        </span>
      )}

      {/* Main row */}
      <div className={cn("flex gap-3", config.dimmed && "opacity-60")}>
        {/* Content */}
        <div className="min-w-0 flex-1 pl-1">
          {/* Header row */}
          <div className="flex items-center gap-2 pb-1">
            <TypeIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="text-2xs font-medium text-muted-foreground">{typeInfo.label}</span>
            <span className="text-2xs text-white/25">·</span>
            <span className="text-2xs text-muted-foreground">#{item.channelName}</span>
            {item.orgTrace && item.orgTrace.length > 0 && (
              <>
                <span className="text-2xs text-white/25">·</span>
                <OrgFacepile people={item.orgTrace} />
              </>
            )}
            <span className="text-2xs text-white/25">·</span>
            <span className="text-2xs text-muted-foreground">
              {formatRelativeTime(item.createdAt)}
            </span>

            <div className="ml-auto flex items-center gap-1.5">
              {item.agentExecutionStatus && (
                <span
                  className={cn(
                    "rounded px-1.5 py-px text-2xs font-medium",
                    item.agentExecutionStatus === "completed" && "bg-green-500/10 text-green-400",
                    item.agentExecutionStatus === "running" && "bg-blue-500/10 text-blue-400",
                    item.agentExecutionStatus === "pending" && "bg-white/5 text-white/40",
                    item.agentExecutionStatus === "failed" && "bg-red-500/10 text-red-400"
                  )}
                >
                  {item.agentExecutionStatus}
                </span>
              )}
              <button
                onClick={(e) => { e.stopPropagation(); onArchive(item.id); }}
                title="Archive"
                className={cn(
                  "rounded p-0.5 transition-colors hover:bg-surface-3 hover:text-foreground",
                  hovered ? "text-foreground/25" : "text-transparent pointer-events-none",
                )}
              >
                <Archive className="h-3 w-3" />
              </button>
              {onFocus && (
                <button
                  onClick={(e) => { e.stopPropagation(); onFocus(); }}
                  title="Focus mode"
                  className={cn(
                    "rounded p-0.5 transition-colors hover:bg-surface-3 hover:text-foreground",
                    hovered ? "text-foreground/45" : "text-transparent pointer-events-none",
                  )}
                >
                  <Maximize2 className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>

          {/* Title */}
          <p className={cn("text-sm text-foreground", config.bold && "font-semibold")}>
            {item.title}
          </p>

          {/* Summary — single line */}
          <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">
            {item.summary}
          </p>

          {/* PING will do */}
          {item.pingWillDo && (
            <p className="mt-1 text-2xs text-blue-400/60 line-clamp-1">
              PING will: {item.pingWillDo}
            </p>
          )}

          {/* Quick actions — always visible */}
          <div
            className="mt-2"
            onClick={(e) => e.stopPropagation()}
          >
            <DecisionActions
              type={item.type as DecisionType}
              recommendedActions={item.recommendedActions}
              onAction={(action, comment) => onAction(item.id, action, comment)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
