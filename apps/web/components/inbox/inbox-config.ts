import {
  GitPullRequest,
  Ticket,
  HelpCircle,
  AlertTriangle,
  Search,
  RefreshCw,
  FileText,
  ExternalLink,
  Link2,
} from "lucide-react";

// ── Type config ─────────────────────────────────────────────────────────────

export const typeConfig: Record<string, { icon: typeof GitPullRequest; label: string }> = {
  pr_review:       { icon: GitPullRequest, label: "PR Review" },
  ticket_triage:   { icon: Ticket,         label: "Ticket" },
  question_answer: { icon: HelpCircle,     label: "Question" },
  blocked_unblock: { icon: AlertTriangle,  label: "Blocked" },
  fact_verify:     { icon: Search,         label: "Fact Check" },
  cross_team_ack:  { icon: RefreshCw,      label: "Cross-Team" },
  channel_summary: { icon: FileText,       label: "Summary" },
};

// ── Category config ─────────────────────────────────────────────────────────

export const categoryConfig: Record<string, { label: string; bg: string; text: string; border: string }> = {
  do:       { label: "DO",       bg: "bg-priority-urgent/10",    text: "text-priority-urgent",    border: "border-priority-urgent/30" },
  decide:   { label: "DECIDE",   bg: "bg-priority-important/10", text: "text-priority-important", border: "border-priority-important/30" },
  delegate: { label: "DELEGATE", bg: "bg-blue-500/10",           text: "text-blue-400",           border: "border-blue-500/30" },
  skip:     { label: "SKIP",     bg: "bg-white/5",               text: "text-white/30",           border: "border-white/10" },
};

// ── Role labels ─────────────────────────────────────────────────────────────

export const ROLE_LABEL: Record<string, string> = {
  author: "wrote",
  assignee: "assigned",
  mentioned: "mentioned",
  to_consult: "consult?",
};

// ── Fallback actions ────────────────────────────────────────────────────────

export interface RecommendedAction {
  label: string;
  actionKey: string;
  primary?: boolean;
  needsComment?: boolean;
}

export const fallbackActions: Record<string, RecommendedAction[]> = {
  pr_review:       [{ label: "Approve", actionKey: "approve", primary: true }, { label: "Request Changes", actionKey: "request_changes", needsComment: true }, { label: "Skip", actionKey: "snooze" }],
  question_answer: [{ label: "Reply", actionKey: "reply", primary: true, needsComment: true }, { label: "Delegate", actionKey: "delegate", needsComment: true }, { label: "Dismiss", actionKey: "dismiss" }],
  blocked_unblock: [{ label: "Investigate", actionKey: "investigate", primary: true }, { label: "Reassign", actionKey: "reassign", needsComment: true }, { label: "Snooze", actionKey: "snooze" }],
  ticket_triage:   [{ label: "Accept", actionKey: "accept", primary: true }, { label: "Reject", actionKey: "reject", needsComment: true }, { label: "Delegate", actionKey: "delegate", needsComment: true }],
  fact_verify:     [{ label: "Confirm", actionKey: "confirm", primary: true }, { label: "Dispute", actionKey: "dispute", needsComment: true }, { label: "Investigate", actionKey: "investigate" }],
  cross_team_ack:  [{ label: "Acknowledge", actionKey: "acknowledge", primary: true }, { label: "Follow Up", actionKey: "follow_up", needsComment: true }],
  channel_summary: [{ label: "Mark Read", actionKey: "mark_read", primary: true }, { label: "Investigate", actionKey: "investigate" }],
};

// ── Related decision type ───────────────────────────────────────────────────

export interface RelatedDecisionData {
  id: string;
  title: string;
  type: string;
  category: string;
  summary: string;
  outcome?: { action: string; comment?: string; decidedAt: number } | null;
  orgTrace: Array<{ name: string; role: string; userId?: string }>;
  createdAt: number;
  status: string;
}

// ── Context tab type ────────────────────────────────────────────────────────

export type ContextTab = "messages" | "linked" | "history";

// ── Helpers ─────────────────────────────────────────────────────────────────

export function initials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function linkIcon(type: string) {
  if (type === "pr") return GitPullRequest;
  if (type === "video") return ExternalLink;
  if (type === "sheet") return FileText;
  if (type === "doc") return FileText;
  return Link2;
}

export function linkTypeLabel(type: string) {
  const labels: Record<string, string> = {
    doc: "Document",
    sheet: "Spreadsheet",
    video: "Video",
    pr: "Pull Request",
    other: "Link",
  };
  return labels[type] ?? "Link";
}
