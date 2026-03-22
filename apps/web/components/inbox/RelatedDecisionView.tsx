"use client";

import {
  X,
  GitPullRequest,
  Ticket,
  HelpCircle,
  AlertTriangle,
  Search,
  RefreshCw,
  FileText,
} from "lucide-react";
import { formatRelativeTime } from "@/lib/utils";

interface RelatedDecision {
  id: string;
  title: string;
  type: string;
  category: string;
  summary: string;
  outcome?: {
    action: string;
    comment?: string;
    decidedAt: number;
  } | null;
  orgTrace: Array<{ name: string; role: string; userId?: string }>;
  createdAt: number;
  status: string;
}

interface RelatedDecisionViewProps {
  decision: RelatedDecision;
  onClose: () => void;
}

const typeConfig: Record<string, { icon: typeof GitPullRequest; label: string }> = {
  pr_review: { icon: GitPullRequest, label: "PR Review" },
  ticket_triage: { icon: Ticket, label: "Ticket" },
  question_answer: { icon: HelpCircle, label: "Question" },
  blocked_unblock: { icon: AlertTriangle, label: "Blocked" },
  fact_verify: { icon: Search, label: "Fact Check" },
  cross_team_ack: { icon: RefreshCw, label: "Cross-Team" },
  channel_summary: { icon: FileText, label: "Summary" },
};

const categoryLabel: Record<string, string> = {
  do: "DO",
  decide: "DECIDE",
  delegate: "DELEGATE",
  skip: "SKIP",
};

const ROLE_LABEL: Record<string, string> = {
  author: "wrote",
  assignee: "assigned",
  mentioned: "mentioned",
  to_consult: "consulted",
};

function initials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function RelatedDecisionView({ decision, onClose }: RelatedDecisionViewProps) {
  const typeInfo = typeConfig[decision.type] ?? typeConfig.channel_summary;
  const TypeIcon = typeInfo.icon;
  const involved = decision.orgTrace.filter((p) => p.role !== "to_consult");

  return (
    <>
      <div className="fixed inset-0 z-[60] bg-black/20" onClick={onClose} />
      <div className="fixed left-1/2 top-1/2 z-[70] w-[440px] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-subtle bg-background shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-subtle px-4 py-3">
          <div className="flex items-center gap-2">
            <TypeIcon className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-2xs font-medium text-muted-foreground">{typeInfo.label}</span>
            <span className="text-2xs text-white/25">·</span>
            <span className="text-2xs text-muted-foreground">
              {categoryLabel[decision.category] ?? decision.category}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded bg-surface-2 px-1.5 py-px text-2xs text-muted-foreground">
              Read-only
            </span>
            <button
              onClick={onClose}
              className="rounded p-1 text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-5 space-y-4">
          {/* Title + summary */}
          <div>
            <h3 className="text-sm font-semibold leading-snug text-foreground">{decision.title}</h3>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{decision.summary}</p>
          </div>

          {/* Outcome */}
          {decision.outcome ? (
            <div className="rounded-md bg-surface-2 px-3 py-3">
              <p className="mb-1 text-2xs font-medium uppercase tracking-widest text-foreground/45">
                Decision made
              </p>
              <div className="flex items-center gap-2">
                <span className="rounded bg-ping-purple/20 px-2 py-0.5 text-xs font-medium text-ping-purple">
                  {decision.outcome.action}
                </span>
                <span className="text-2xs text-muted-foreground">
                  {formatRelativeTime(decision.outcome.decidedAt)}
                </span>
              </div>
              {decision.outcome.comment && (
                <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                  &ldquo;{decision.outcome.comment}&rdquo;
                </p>
              )}
            </div>
          ) : (
            <div className="rounded-md bg-surface-2 px-3 py-2.5">
              <p className="text-2xs text-muted-foreground">
                Status: <span className="text-foreground/60">{decision.status}</span>
                {" · "}created {formatRelativeTime(decision.createdAt)}
              </p>
            </div>
          )}

          {/* People */}
          {involved.length > 0 && (
            <div>
              <p className="mb-2 text-2xs font-medium uppercase tracking-widest text-foreground/45">
                People involved
              </p>
              <div className="flex flex-wrap gap-1.5">
                {involved.map((p, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-1"
                  >
                    <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-surface-3 text-[8px] font-medium text-foreground/60">
                      {initials(p.name)}
                    </span>
                    <span className="text-2xs text-foreground/70">{p.name}</span>
                    <span className="text-2xs text-foreground/50">{ROLE_LABEL[p.role] ?? p.role}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
