"use client";

import { useState, type ReactNode } from "react";
import {
  GitPullRequest,
  Ticket,
  HelpCircle,
  AlertTriangle,
  Search,
  RefreshCw,
  FileText,
  ChevronDown,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import { cn, formatRelativeTime } from "@/lib/utils";
import { DecisionActions } from "./DecisionActions";
import type { DecisionType } from "./DecisionActions";
import type { EisenhowerQuadrant } from "./InboxCard";

export type { DecisionType, EisenhowerQuadrant };

export interface DecisionItem {
  id: string;
  type: DecisionType;
  title: string;
  summary: string;
  eisenhowerQuadrant: EisenhowerQuadrant;
  status: string;
  channelName: string;
  sourceUrl?: string;
  createdAt: Date;
  agentExecutionStatus?: "pending" | "running" | "completed" | "failed";
  agentExecutionResult?: string;
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

const typeConfig: Record<DecisionType, { icon: typeof GitPullRequest; label: string }> = {
  pr_review: { icon: GitPullRequest, label: "PR Review" },
  ticket_triage: { icon: Ticket, label: "Ticket" },
  question_answer: { icon: HelpCircle, label: "Question" },
  blocked_unblock: { icon: AlertTriangle, label: "Blocked" },
  fact_verify: { icon: Search, label: "Fact Check" },
  cross_team_ack: { icon: RefreshCw, label: "Cross-Team" },
  channel_summary: { icon: FileText, label: "Summary" },
};

interface DecisionCardProps {
  item: DecisionItem;
  onAction: (id: string, action: string, comment?: string) => void;
  children?: ReactNode;
}

export function DecisionCard({ item, onAction, children }: DecisionCardProps) {
  const [hovered, setHovered] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const config = priorityConfig[item.eisenhowerQuadrant];
  const typeInfo = typeConfig[item.type];
  const TypeIcon = typeInfo.icon;

  return (
    <div
      className={cn(
        "group relative flex flex-col border-b border-subtle px-4 py-3",
        "cursor-default transition-colors duration-75",
        hovered ? "bg-surface-2" : "bg-transparent"
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

      {/* Main row */}
      <div className={cn("flex gap-3", config.dimmed && "opacity-60")}>
        {/* Expand toggle + type icon */}
        <button
          onClick={() => setExpanded(!expanded)}
          aria-expanded={expanded}
          aria-label={expanded ? "Collapse decision details" : "Expand decision details"}
          className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-surface-3 hover:text-foreground"
        >
          {expanded ? (
            <ChevronDown className="h-3.5 w-3.5" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" />
          )}
        </button>

        {/* Content */}
        <div className="min-w-0 flex-1">
          {/* Header row */}
          <div className="flex items-center gap-2 pb-0.5">
            <TypeIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="text-2xs font-medium text-muted-foreground">{typeInfo.label}</span>
            <span className="text-2xs text-white/25">·</span>
            <span className="text-2xs text-muted-foreground">#{item.channelName}</span>
            <span className="text-2xs text-white/25">·</span>
            <span className="text-2xs text-muted-foreground">
              {formatRelativeTime(item.createdAt)}
            </span>

            <div className="ml-auto flex items-center gap-1.5">
              {item.agentExecutionStatus && (
                <span
                  className={cn(
                    "rounded px-1.5 py-px text-2xs font-medium",
                    item.agentExecutionStatus === "completed" &&
                      "bg-green-500/10 text-green-400",
                    item.agentExecutionStatus === "running" &&
                      "bg-blue-500/10 text-blue-400",
                    item.agentExecutionStatus === "pending" &&
                      "bg-white/5 text-white/40",
                    item.agentExecutionStatus === "failed" &&
                      "bg-red-500/10 text-red-400"
                  )}
                >
                  {item.agentExecutionStatus}
                </span>
              )}
              <span
                className={cn(
                  "rounded px-1.5 py-px text-2xs font-medium",
                  config.bg,
                  config.textColor
                )}
              >
                {config.label}
              </span>
              {item.sourceUrl && (
                <a
                  href={item.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded p-0.5 text-white/30 transition-colors hover:bg-surface-3 hover:text-foreground"
                >
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          </div>

          {/* Title */}
          <p className={cn("text-sm text-foreground", config.bold && "font-semibold")}>
            {item.title}
          </p>

          {/* Summary (collapsed: single line) */}
          <p
            className={cn(
              "mt-0.5 text-xs text-muted-foreground",
              !expanded && "line-clamp-1"
            )}
          >
            {item.summary}
          </p>

          {/* Actions — show on hover */}
          <div
            className={cn(
              "mt-2 transition-all duration-150",
              hovered
                ? "opacity-100 translate-y-0"
                : "opacity-0 translate-y-1 pointer-events-none"
            )}
          >
            <DecisionActions
              type={item.type}
              onAction={(action, comment) => onAction(item.id, action, comment)}
            />
          </div>
        </div>
      </div>

      {/* Expanded content (children slot for context panel) */}
      {expanded && children && (
        <div className="ml-9 mt-3 rounded border border-subtle bg-surface-2 p-3">
          {children}
        </div>
      )}

      {/* Agent execution result in expanded view */}
      {expanded && item.agentExecutionResult && (
        <div className="ml-9 mt-2 rounded border border-subtle bg-surface-2 p-3">
          <p className="text-2xs font-medium text-muted-foreground">Agent Result</p>
          <p className="mt-1 text-xs text-foreground">{item.agentExecutionResult}</p>
        </div>
      )}
    </div>
  );
}
