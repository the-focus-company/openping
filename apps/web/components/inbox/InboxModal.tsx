"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "convex/react";
import { useSidebar } from "@/hooks/useSidebar";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import {
  X, GitPullRequest, Ticket, HelpCircle, AlertTriangle, Search,
  RefreshCw, FileText, ExternalLink, Loader2, CircleDot, MessageSquare,
  Link2, History, UserCheck, UserPlus, ChevronRight, Maximize2,
  Minimize2, PenLine,
} from "lucide-react";
import { cn, formatRelativeTime } from "@/lib/utils";
import type { InboxCategory, PriorityLevel } from "./InboxCard";
import type { OrgTracePerson } from "./DecisionCard";
import { UserProfileModal } from "./UserProfileModal";
import { RelatedDecisionView } from "./RelatedDecisionView";

// ── Types ──────────────────────────────────────────────────────────────────────

export type ModalItemKind = "decision" | "summary";

export interface ModalItem {
  id: string;
  kind: ModalItemKind;
  title: string;
  summary: string;
  bodyText?: string;
  priority: PriorityLevel;
  channelName: string;
  createdAt: Date;
  category?: InboxCategory;
  decisionType?: string;
  orgTrace?: OrgTracePerson[];
  nextSteps?: Array<{ actionKey: string; label: string; automated: boolean }>;
  recommendedActions?: Array<{ label: string; actionKey: string; primary?: boolean }>;
  links?: Array<{ title: string; url: string; type: string }>;
  relatedItemIds?: string[];
  agentExecutionStatus?: string;
  pingWillDo?: string;
  quickActions?: Array<{ label: string; primary?: boolean; onClick?: () => void }>;
}

interface RelatedDecisionData {
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

export interface InboxModalProps {
  item: ModalItem;
  onAction?: (id: string, action: string, comment?: string) => void;
  onClose: () => void;
  focusMode?: boolean;
  onToggleFocusMode?: () => void;
}

type ContextTab = "messages" | "linked" | "history";

// ── Config ─────────────────────────────────────────────────────────────────────

const typeConfig: Record<string, { icon: typeof GitPullRequest; label: string }> = {
  pr_review:      { icon: GitPullRequest, label: "PR Review" },
  ticket_triage:  { icon: Ticket,         label: "Ticket" },
  question_answer:{ icon: HelpCircle,     label: "Question" },
  blocked_unblock:{ icon: AlertTriangle,  label: "Blocked" },
  fact_verify:    { icon: Search,         label: "Fact Check" },
  cross_team_ack: { icon: RefreshCw,      label: "Cross-Team" },
  channel_summary:{ icon: FileText,       label: "Summary" },
};

const categoryConfig: Record<string, { label: string; bg: string; text: string; border: string }> = {
  do:       { label: "DO",       bg: "bg-priority-urgent/10",    text: "text-priority-urgent",    border: "border-priority-urgent/30" },
  decide:   { label: "DECIDE",   bg: "bg-priority-important/10", text: "text-priority-important", border: "border-priority-important/30" },
  delegate: { label: "DELEGATE", bg: "bg-blue-500/10",           text: "text-blue-400",           border: "border-blue-500/30" },
  skip:     { label: "SKIP",     bg: "bg-white/5",               text: "text-white/30",           border: "border-white/10" },
};

const ROLE_LABEL: Record<string, string> = {
  author: "wrote", assignee: "assigned", mentioned: "mentioned", to_consult: "consult?",
};

const fallbackActions: Record<string, Array<{ label: string; actionKey: string; primary?: boolean }>> = {
  pr_review:      [{ label: "Approve", actionKey: "approve", primary: true }, { label: "Request changes", actionKey: "request_changes" }, { label: "Skip", actionKey: "snooze" }],
  question_answer:[{ label: "Reply", actionKey: "reply", primary: true }, { label: "Delegate", actionKey: "delegate" }, { label: "Dismiss", actionKey: "dismiss" }],
  blocked_unblock:[{ label: "Investigate", actionKey: "investigate", primary: true }, { label: "Reassign", actionKey: "reassign" }, { label: "Snooze", actionKey: "snooze" }],
  ticket_triage:  [{ label: "Accept", actionKey: "accept", primary: true }, { label: "Reject", actionKey: "reject" }, { label: "Delegate", actionKey: "delegate" }],
  fact_verify:    [{ label: "Confirm", actionKey: "confirm", primary: true }, { label: "Dispute", actionKey: "dispute" }, { label: "Investigate", actionKey: "investigate" }],
  cross_team_ack: [{ label: "Acknowledge", actionKey: "acknowledge", primary: true }, { label: "Follow up", actionKey: "follow_up" }],
  channel_summary:[{ label: "Mark read", actionKey: "mark_read", primary: true }, { label: "Investigate", actionKey: "investigate" }],
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function initials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

function linkTypeLabel(type: string) {
  return ({ doc: "Document", sheet: "Spreadsheet", video: "Video", pr: "Pull Request", other: "Link" } as Record<string, string>)[type] ?? "Link";
}

// ── Internal sub-components ────────────────────────────────────────────────────

function Accordion({
  label, badge, open, onToggle, children,
}: {
  label: string; badge?: number; open: boolean; onToggle: () => void; children: React.ReactNode;
}) {
  return (
    <div className="border-t border-subtle">
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-2 px-5 py-2.5 text-left transition-colors hover:bg-surface-2/40"
      >
        <ChevronRight className={cn(
          "h-3 w-3 shrink-0 text-foreground/45 transition-transform duration-150",
          open && "rotate-90",
        )} />
        <span className="text-xs text-foreground/50">{label}</span>
        {badge !== undefined && badge > 0 && (
          <span className="rounded bg-white/5 px-1 text-2xs text-foreground/45">{badge}</span>
        )}
      </button>
      {open && <div>{children}</div>}
    </div>
  );
}

function PersonPill({
  name, role, dashed = false, onClick,
}: {
  name: string; role: string; userId?: string; dashed?: boolean; onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 rounded-full px-2.5 py-1 transition-colors",
        dashed
          ? "border border-dashed border-white/15 bg-transparent hover:border-white/25 hover:bg-surface-2"
          : "bg-surface-2 hover:bg-surface-3",
        onClick ? "cursor-pointer" : "cursor-default",
      )}
    >
      <span className={cn(
        "flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-medium",
        dashed ? "bg-white/10 text-foreground/50" : "bg-surface-3 text-foreground/60",
      )}>
        {initials(name)}
      </span>
      <span className="text-xs text-foreground/80">{name}</span>
      <span className="text-2xs text-foreground/50">{ROLE_LABEL[role] ?? role}</span>
    </button>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function InboxModal({
  item, onAction, onClose, focusMode = false, onToggleFocusMode,
}: InboxModalProps) {
  const [comment, setComment] = useState("");
  const [showNote, setShowNote] = useState(false);
  const [deciding, setDeciding] = useState(false);
  const [hoveredAction, setHoveredAction] = useState<string | null>(null);
  const [contextOpen, setContextOpen] = useState(false);
  const [nextStepsOpen, setNextStepsOpen] = useState(false);
  const [peopleOpen, setPeopleOpen] = useState(false);
  const [contextTab, setContextTab] = useState<ContextTab>("messages");
  const [profileUserId, setProfileUserId] = useState<string | null>(null);
  const [relatedDecisionView, setRelatedDecisionView] = useState<RelatedDecisionData | null>(null);
  const noteInputRef = useRef<HTMLInputElement>(null);
  const { setSidebarOpen } = useSidebar();
  const prevSidebarRef = useRef<boolean | null>(null);

  const isDecision = item.kind === "decision";

  const context = useQuery(
    api.inboxItems.getContext,
    isDecision ? { itemId: item.id as Id<"inboxItems"> } : "skip",
  );

  // Escape to close
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !profileUserId && !relatedDecisionView) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, profileUserId, relatedDecisionView]);

  // Collapse sidebar in focus mode
  useEffect(() => {
    if (focusMode) {
      if (prevSidebarRef.current === null) prevSidebarRef.current = true;
      setSidebarOpen(false);
    } else {
      if (prevSidebarRef.current !== null) {
        setSidebarOpen(prevSidebarRef.current);
        prevSidebarRef.current = null;
      }
    }
  }, [focusMode, setSidebarOpen]);

  // Focus note input when revealed
  useEffect(() => {
    if (showNote) noteInputRef.current?.focus();
  }, [showNote]);

  const typeInfo = item.decisionType
    ? (typeConfig[item.decisionType] ?? typeConfig.channel_summary)
    : typeConfig.channel_summary;
  const TypeIcon = typeInfo.icon;
  const qConfig = item.category
    ? (categoryConfig[item.category] ?? categoryConfig.skip)
    : null;

  const actions = item.recommendedActions
    ?? (item.decisionType ? (fallbackActions[item.decisionType] ?? []) : []);
  const allNextSteps = item.nextSteps ?? [];
  const nextStepsByAction = actions.reduce<Record<string, typeof allNextSteps>>((acc, a) => {
    acc[a.actionKey] = allNextSteps.filter((s) => s.actionKey === a.actionKey);
    return acc;
  }, {});

  const involved = (item.orgTrace ?? []).filter((p) => p.role !== "to_consult");
  const toConsult = (item.orgTrace ?? []).filter((p) => p.role === "to_consult");

  const decisionLinks = item.links ?? [];
  const msgCount = context?.relatedMessages.length ?? 0;
  const linkedCount = decisionLinks.length + (context?.sourceIntegrationObject ? 1 : 0);
  const historyCount = context?.relatedItems?.length ?? 0;
  const relatedDecisions = (context?.relatedItems ?? []) as RelatedDecisionData[];
  const contextBadge = msgCount + linkedCount + historyCount;

  function handleDecisionAction(action: { actionKey: string; label: string }) {
    setDeciding(true);
    onAction?.(item.id, action.actionKey, comment || undefined);
    onClose();
  }

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        className="fixed left-0 right-0 top-12 bottom-0 z-40 bg-black/60 backdrop-blur-[2px]"
        onClick={onClose}
      />

      {/* Panel — stop propagation so clicks don't reach the backdrop */}
      <div
        className={focusMode
          ? "fixed left-0 right-0 top-12 bottom-0 z-50 flex flex-col bg-background"
          : "fixed right-0 top-12 bottom-0 z-50 flex w-[540px] flex-col bg-background border-l border-subtle shadow-2xl"
        }
        onClick={(e) => e.stopPropagation()}
      >

        {/* ── HEADER ── */}
        <div className="flex shrink-0 items-center justify-between border-b border-subtle px-5 py-2.5">
          <div className="flex items-center gap-2">
            <TypeIcon className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-2xs font-medium text-muted-foreground">{typeInfo.label}</span>
            <span className="text-2xs text-white/25">·</span>
            <span className="text-2xs text-muted-foreground">#{item.channelName}</span>
            <span className="text-2xs text-white/25">·</span>
            <span className="text-2xs text-muted-foreground">{formatRelativeTime(item.createdAt)}</span>
          </div>
          <div className="flex items-center gap-1.5">
            {qConfig && (
              <span className={cn(
                "rounded border px-1.5 py-px text-2xs font-medium",
                qConfig.bg, qConfig.text, qConfig.border,
              )}>
                {qConfig.label}
              </span>
            )}
            {onToggleFocusMode && (
              <button
                onClick={onToggleFocusMode}
                title={focusMode ? "Exit focus mode" : "Focus mode"}
                className="rounded p-1 text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
              >
                {focusMode ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
              </button>
            )}
            <button
              onClick={onClose}
              className="rounded p-1 text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* ── SCROLLABLE BODY ── */}
        <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin">
          <div className={cn("flex flex-col pb-2", focusMode && "mx-auto w-full max-w-3xl")}>

            {/* 1. SUMMARY — always visible */}
            <div className="px-5 pt-5 pb-4">
              <h2 className="text-[15px] font-semibold leading-snug text-foreground">{item.title}</h2>
              {item.summary && (
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.summary}</p>
              )}
              {item.bodyText && (
                <p className="mt-1.5 text-xs leading-relaxed text-foreground/40">{item.bodyText}</p>
              )}
            </div>

            {/* 2. CONTEXT — accordion, closed by default */}
            <Accordion
              label="Context"
              badge={contextBadge > 0 ? contextBadge : undefined}
              open={contextOpen}
              onToggle={() => setContextOpen((o) => !o)}
            >
              {isDecision ? (
                <div className="px-5 pb-4">
                  {/* Tab bar */}
                  <div className="mb-3 flex items-center border-b border-subtle">
                    {([
                      { key: "messages" as const, icon: MessageSquare, label: "Messages", count: msgCount },
                      { key: "linked"   as const, icon: Link2,         label: "Linked",   count: linkedCount },
                      { key: "history"  as const, icon: History,       label: "Related",  count: historyCount },
                    ]).map(({ key, icon: Icon, label, count }) => (
                      <button
                        key={key}
                        onClick={() => setContextTab(key)}
                        className={cn(
                          "flex items-center gap-1.5 border-b-2 px-3 pb-2 text-xs transition-colors",
                          contextTab === key
                            ? "border-white/40 text-foreground"
                            : "border-transparent text-muted-foreground hover:text-foreground",
                        )}
                      >
                        <Icon className="h-3 w-3" />
                        {label}
                        {count > 0 && (
                          <span className={cn(
                            "rounded px-1 text-2xs",
                            contextTab === key ? "bg-white/10 text-foreground" : "bg-white/5 text-muted-foreground",
                          )}>
                            {count}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>

                  {context === undefined ? (
                    <div className="flex items-center justify-center py-6">
                      <Loader2 className="h-4 w-4 animate-spin text-foreground/40" />
                    </div>
                  ) : (
                    <>
                      {contextTab === "messages" && (
                        <div className="space-y-2">
                          {context.relatedMessages.length === 0 ? (
                            <p className="py-3 text-center text-xs text-muted-foreground">No messages found</p>
                          ) : context.relatedMessages.slice(0, 8).map((msg, i) => (
                            <div key={i} className="rounded-md bg-surface-2 px-3 py-2.5">
                              <div className="mb-1 flex items-center gap-2">
                                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-surface-3 text-[9px] font-medium text-foreground/60">
                                  {initials(msg.authorName)}
                                </span>
                                <span className="text-2xs font-medium text-foreground">{msg.authorName}</span>
                                <span className="text-2xs text-muted-foreground">{formatRelativeTime(msg.createdAt)}</span>
                              </div>
                              <p className="text-xs leading-relaxed text-foreground/80">{msg.body}</p>
                            </div>
                          ))}
                        </div>
                      )}

                      {contextTab === "linked" && (
                        <div className="space-y-2">
                          {context.sourceIntegrationObject && (
                            <a
                              href={context.sourceIntegrationObject.url}
                              target="_blank" rel="noopener noreferrer"
                              className="flex items-center gap-2.5 rounded-md bg-surface-2 px-3 py-2.5 transition-colors hover:bg-surface-3"
                            >
                              <CircleDot className="h-4 w-4 shrink-0 text-muted-foreground" />
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm text-foreground/90">{context.sourceIntegrationObject.title}</p>
                                <p className="text-2xs capitalize text-muted-foreground">{context.sourceIntegrationObject.type.replace("_", " ")}</p>
                              </div>
                              <span className="shrink-0 rounded bg-white/5 px-1.5 py-px text-2xs text-muted-foreground">{context.sourceIntegrationObject.status}</span>
                              <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                            </a>
                          )}
                          {decisionLinks.map((link, i) => (
                            <a
                              key={i} href={link.url} target="_blank" rel="noopener noreferrer"
                              className="flex items-center gap-2.5 rounded-md bg-surface-2 px-3 py-2.5 transition-colors hover:bg-surface-3"
                            >
                              <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm text-foreground/90">{link.title}</p>
                                <p className="text-2xs text-muted-foreground">{linkTypeLabel(link.type)}</p>
                              </div>
                              <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                            </a>
                          ))}
                          {linkedCount === 0 && (
                            <p className="py-3 text-center text-xs text-muted-foreground">No linked artifacts</p>
                          )}
                        </div>
                      )}

                      {contextTab === "history" && (
                        <div className="space-y-2">
                          {relatedDecisions.length === 0 ? (
                            <p className="py-3 text-center text-xs text-muted-foreground">No related decisions</p>
                          ) : relatedDecisions.map((d, i) => (
                            <button
                              key={i}
                              onClick={() => setRelatedDecisionView(d)}
                              className="w-full rounded-md bg-surface-2 px-3 py-2.5 text-left transition-colors hover:bg-surface-3"
                            >
                              <div className="mb-1 flex items-start justify-between gap-2">
                                <p className="text-xs font-medium leading-snug text-foreground/80">{d.title}</p>
                                {d.outcome && (
                                  <span className="shrink-0 rounded bg-ping-purple/15 px-1.5 py-px text-2xs text-ping-purple/80">
                                    {d.outcome.action}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-2xs text-muted-foreground">
                                  {d.outcome ? `Decided ${formatRelativeTime(d.outcome.decidedAt)}` : formatRelativeTime(d.createdAt)}
                                </span>
                                {d.orgTrace.filter((p) => p.role !== "to_consult").slice(0, 3).map((p, j) => (
                                  <span
                                    key={j} title={p.name}
                                    className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-surface-3 text-[8px] font-medium text-foreground/50"
                                  >
                                    {initials(p.name)}
                                  </span>
                                ))}
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              ) : item.bodyText ? (
                <div className="px-5 pb-4">
                  <p className="text-xs leading-relaxed text-muted-foreground">{item.bodyText}</p>
                </div>
              ) : (
                <div className="px-5 pb-4">
                  <p className="text-xs text-muted-foreground/50">No additional context</p>
                </div>
              )}
            </Accordion>

            {/* 3. WHAT PING WILL DO — accordion, closed by default, only for decisions */}
            {isDecision && allNextSteps.length > 0 && (
              <Accordion
                label="What PING will do"
                open={nextStepsOpen}
                onToggle={() => setNextStepsOpen((o) => !o)}
              >
                <div className="space-y-2 px-5 pb-4">
                  {actions.map((action) => {
                    const steps = nextStepsByAction[action.actionKey] ?? [];
                    if (steps.length === 0) return null;
                    return (
                      <div
                        key={action.actionKey}
                        className={cn(
                          "rounded-md border px-3 py-2.5 transition-colors",
                          hoveredAction === action.actionKey
                            ? "border-white/15 bg-surface-2"
                            : "border-transparent bg-surface-2/50",
                        )}
                      >
                        <p className="mb-1.5 text-2xs font-medium text-foreground/50">If: {action.label}</p>
                        <div className="space-y-1">
                          {steps.map((step, i) => (
                            <div key={i} className="flex items-start gap-2">
                              <span className={cn(
                                "mt-0.5 shrink-0 rounded px-1 py-px text-[9px] font-medium",
                                step.automated ? "bg-blue-500/15 text-blue-400" : "bg-white/5 text-foreground/40",
                              )}>
                                {step.automated ? "auto" : "manual"}
                              </span>
                              <p className="text-2xs text-foreground/60">{step.label}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Accordion>
            )}

            {/* 4. PEOPLE — accordion, closed by default, only for decisions */}
            {isDecision && (involved.length > 0 || toConsult.length > 0) && (
              <Accordion
                label="People"
                badge={involved.length + toConsult.length}
                open={peopleOpen}
                onToggle={() => setPeopleOpen((o) => !o)}
              >
                <div className="space-y-3 px-5 pb-4">
                  {involved.length > 0 && (
                    <div>
                      <p className="mb-2 flex items-center gap-1.5 text-2xs text-foreground/40">
                        <UserCheck className="h-3 w-3" /> In this decision
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {involved.map((p, i) => (
                          <PersonPill
                            key={i}
                            name={p.name}
                            role={p.role}
                            userId={(p as { userId?: string }).userId}
                            onClick={(p as { userId?: string }).userId
                              ? () => setProfileUserId((p as { userId?: string }).userId!)
                              : undefined}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                  {toConsult.length > 0 && (
                    <div>
                      <p className="mb-2 flex items-center gap-1.5 text-2xs text-foreground/40">
                        <UserPlus className="h-3 w-3" /> Suggested to consult
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {toConsult.map((p, i) => (
                          <PersonPill
                            key={i}
                            name={p.name}
                            role={p.role}
                            userId={(p as { userId?: string }).userId}
                            dashed
                            onClick={(p as { userId?: string }).userId
                              ? () => setProfileUserId((p as { userId?: string }).userId!)
                              : undefined}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </Accordion>
            )}

          </div>
        </div>

        {/* ── STICKY FOOTER ── */}
        <div className="shrink-0 border-t border-subtle bg-background">
          {/* Reasoning input — one line, revealed on demand */}
          {showNote && (
            <div className="px-4 pt-3">
              <input
                ref={noteInputRef}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                onKeyDown={(e) => e.key === "Escape" && setShowNote(false)}
                placeholder="Add reasoning or instructions for PING..."
                className="w-full rounded border border-subtle bg-surface-2 px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-white/20"
              />
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-1 px-4 py-2.5">
            {isDecision ? (
              <>
                {actions.map((action) => (
                  <button
                    key={action.actionKey}
                    onMouseEnter={() => setHoveredAction(action.actionKey)}
                    onMouseLeave={() => setHoveredAction(null)}
                    onClick={() => handleDecisionAction(action)}
                    disabled={deciding}
                    className={cn(
                      "rounded px-2 py-1 text-xs font-medium transition-all disabled:opacity-50",
                      action.primary
                        ? "bg-ping-purple text-white hover:bg-ping-purple/90"
                        : "bg-white/5 text-foreground hover:bg-white/10",
                      hoveredAction === action.actionKey && !action.primary && "bg-white/10",
                    )}
                  >
                    {action.label}
                  </button>
                ))}
                <button
                  onClick={() => setShowNote((s) => !s)}
                  title={showNote ? "Remove note" : "Add reasoning"}
                  className={cn(
                    "ml-auto rounded p-1 transition-colors",
                    showNote ? "text-foreground/50 hover:text-foreground" : "text-foreground/40 hover:text-foreground/70",
                  )}
                >
                  <PenLine className="h-3.5 w-3.5" />
                </button>
              </>
            ) : (
              (item.quickActions ?? []).map((action, i) => (
                <button
                  key={i}
                  onClick={() => { action.onClick?.(); onClose(); }}
                  className={cn(
                    "rounded px-2 py-1 text-xs font-medium transition-colors",
                    action.primary
                      ? "bg-ping-purple text-white hover:bg-ping-purple/90"
                      : "bg-white/5 text-foreground hover:bg-white/10",
                  )}
                >
                  {action.label}
                </button>
              ))
            )}
          </div>
        </div>

      </div>

      {/* Sub-modals */}
      {profileUserId && (
        <UserProfileModal userId={profileUserId} onClose={() => setProfileUserId(null)} />
      )}
      {relatedDecisionView && (
        <RelatedDecisionView
          decision={relatedDecisionView}
          onClose={() => setRelatedDecisionView(null)}
        />
      )}
    </>,
    document.body,
  );
}
