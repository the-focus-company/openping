"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import {
  X,
  ExternalLink,
  Loader2,
  CircleDot,
  MessageSquare,
  Link2,
  History,
  Bot,
  UserCheck,
  UserPlus,
  ChevronDown,
  ChevronUp,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { cn, formatRelativeTime } from "@/lib/utils";
import { useFocusModeSidebar } from "@/hooks/useFocusModeSidebar";
import type { InboxItemData } from "./DecisionCard";
import { UserProfileModal } from "./UserProfileModal";
import { RelatedDecisionView } from "./RelatedDecisionView";
import { PersonPill } from "./PersonPill";
import {
  typeConfig,
  categoryConfig,
  fallbackActions,
  initials,
  linkIcon,
  linkTypeLabel,
  type RecommendedAction,
  type RelatedDecisionData,
  type ContextTab,
} from "./inbox-config";

// ── Types ──────────────────────────────────────────────────────────────────────

interface DecisionModalProps {
  item: InboxItemData;
  onAction: (id: string, action: string, comment?: string) => void;
  onClose: () => void;
  focusMode?: boolean;
  onToggleFocusMode?: () => void;
}

// ── Main component ─────────────────────────────────────────────────────────────

export function DecisionModal({ item, onAction, onClose, focusMode = false, onToggleFocusMode }: DecisionModalProps) {
  const [comment, setComment] = useState("");
  const [deciding, setDeciding] = useState(false);
  const [contextTab, setContextTab] = useState<ContextTab>("messages");
  const [hoveredAction, setHoveredAction] = useState<string | null>(null);
  const [nextStepsExpanded, setNextStepsExpanded] = useState(true);
  const [profileUserId, setProfileUserId] = useState<string | null>(null);
  const [relatedDecisionView, setRelatedDecisionView] = useState<RelatedDecisionData | null>(null);

  useFocusModeSidebar(focusMode);

  // Escape to close
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !profileUserId && !relatedDecisionView) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, profileUserId, relatedDecisionView]);

  const context = useQuery(api.inboxItems.getContext, {
    itemId: item.id as Id<"inboxItems">,
  });

  const typeInfo = typeConfig[item.type] ?? typeConfig.channel_summary;
  const TypeIcon = typeInfo.icon;
  const qConfig = categoryConfig[item.category] ?? categoryConfig.skip;
  const actions: RecommendedAction[] = item.recommendedActions ?? fallbackActions[item.type] ?? [];

  const involved = (item.orgTrace ?? []).filter((p) => p.role !== "to_consult");
  const toConsult = (item.orgTrace ?? []).filter((p) => p.role === "to_consult");

  const allNextSteps = item.nextSteps ?? [];
  const nextStepsByAction = actions.reduce<Record<string, typeof allNextSteps>>(
    (acc, a) => {
      acc[a.actionKey] = allNextSteps.filter((s) => s.actionKey === a.actionKey);
      return acc;
    },
    {},
  );

  function handleAction(action: RecommendedAction) {
    setDeciding(true);
    onAction(item.id, action.actionKey, comment || undefined);
    onClose();
  }

  // Links from the decision itself
  const decisionLinks = (item.links ?? []) as Array<{
    title: string;
    url: string;
    type: string;
  }>;

  const msgCount = context?.relatedMessages.length ?? 0;
  const linkedCount = decisionLinks.length + (context?.sourceIntegrationObject ? 1 : 0);
  const historyCount = context?.relatedItems?.length ?? 0;

  const relatedDecisions = (context?.relatedItems ?? []) as RelatedDecisionData[];

  return createPortal(
    <>
      {/* Backdrop — covers only below topbar */}
      <div
        className="fixed left-0 right-0 top-12 bottom-0 z-40 bg-black/60 backdrop-blur-[2px]"
        onClick={onClose}
      />

      {/* Panel — always starts below topbar */}
      <div
        className={focusMode
          ? "fixed left-0 right-0 top-12 bottom-0 z-50 flex flex-col bg-background"
          : "fixed right-0 top-12 bottom-0 z-50 flex w-[540px] flex-col bg-background border-l border-subtle shadow-2xl"
        }
      >

        {/* ── HEADER ── */}
        <div className="flex shrink-0 items-center justify-between border-b border-subtle px-5 py-3">
          <div className="flex items-center gap-2">
            <TypeIcon className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-2xs font-medium text-muted-foreground">{typeInfo.label}</span>
            <span className="text-2xs text-white/25">·</span>
            <span className="text-2xs text-muted-foreground">#{item.channelName}</span>
            <span className="text-2xs text-white/25">·</span>
            <span className="text-2xs text-muted-foreground">{formatRelativeTime(item.createdAt)}</span>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "rounded border px-1.5 py-px text-2xs font-medium",
                qConfig.bg,
                qConfig.text,
                qConfig.border,
              )}
            >
              {qConfig.label}
            </span>
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
        <div className={cn("flex flex-col", focusMode && "mx-auto w-full max-w-3xl")}>

          {/* 1. QUESTION */}
          <div className="px-5 pt-5 pb-5">
            <h2 className="text-[15px] font-semibold leading-snug text-foreground">{item.title}</h2>
            <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">{item.summary}</p>
          </div>

          {/* 2. CONTEXT TABS */}
          <div className="border-t border-subtle">
            <div className="flex items-center px-5 pt-3 pb-0">
              {(
                [
                  { key: "messages", icon: MessageSquare, label: "Messages", count: msgCount },
                  { key: "linked", icon: Link2, label: "Linked", count: linkedCount },
                  { key: "history", icon: History, label: "Related", count: historyCount },
                ] as const
              ).map(({ key, icon: Icon, label, count }) => (
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
                    <span
                      className={cn(
                        "rounded px-1 text-2xs",
                        contextTab === key
                          ? "bg-white/10 text-foreground"
                          : "bg-white/5 text-muted-foreground",
                      )}
                    >
                      {count}
                    </span>
                  )}
                </button>
              ))}
            </div>

            <div className="min-h-[80px] px-5 pb-4 pt-3">
              {context === undefined ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-4 w-4 animate-spin text-foreground/40" />
                </div>
              ) : (
                <>
                  {/* MESSAGES TAB */}
                  {contextTab === "messages" && (
                    <div className="space-y-2">
                      {context.relatedMessages.length === 0 ? (
                        <p className="py-4 text-center text-xs text-muted-foreground">
                          No messages found in this channel
                        </p>
                      ) : (
                        context.relatedMessages.slice(0, 8).map((msg, i) => (
                          <div key={i} className="rounded-md bg-surface-2 px-3 py-2.5">
                            <div className="mb-1 flex items-center gap-2">
                              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-surface-3 text-[9px] font-medium text-foreground/60">
                                {initials(msg.authorName)}
                              </span>
                              <span className="text-2xs font-medium text-foreground">
                                {msg.authorName}
                              </span>
                              <span className="text-2xs text-muted-foreground">
                                {formatRelativeTime(msg.createdAt)}
                              </span>
                            </div>
                            <p className="text-xs leading-relaxed text-foreground/80">{msg.body}</p>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {/* LINKED TAB */}
                  {contextTab === "linked" && (
                    <div className="space-y-2">
                      {context.sourceIntegrationObject && (
                        <a
                          href={context.sourceIntegrationObject.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2.5 rounded-md bg-surface-2 px-3 py-2.5 transition-colors hover:bg-surface-3"
                        >
                          <CircleDot className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm text-foreground/90">
                              {context.sourceIntegrationObject.title}
                            </p>
                            <p className="text-2xs capitalize text-muted-foreground">
                              {context.sourceIntegrationObject.type.replace("_", " ")}
                            </p>
                          </div>
                          <span className="shrink-0 rounded bg-white/5 px-1.5 py-px text-2xs text-muted-foreground">
                            {context.sourceIntegrationObject.status}
                          </span>
                          <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        </a>
                      )}
                      {decisionLinks.map((link, i) => {
                        const LinkIcon = linkIcon(link.type);
                        return (
                          <a
                            key={i}
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2.5 rounded-md bg-surface-2 px-3 py-2.5 transition-colors hover:bg-surface-3"
                          >
                            <LinkIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm text-foreground/90">{link.title}</p>
                              <p className="text-2xs text-muted-foreground">
                                {linkTypeLabel(link.type)}
                              </p>
                            </div>
                            <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          </a>
                        );
                      })}
                      {linkedCount === 0 && (
                        <p className="py-4 text-center text-xs text-muted-foreground">
                          No linked artifacts
                        </p>
                      )}
                    </div>
                  )}

                  {/* HISTORY / RELATED TAB */}
                  {contextTab === "history" && (
                    <div className="space-y-2">
                      {relatedDecisions.length === 0 ? (
                        <p className="py-4 text-center text-xs text-muted-foreground">
                          No related decisions
                        </p>
                      ) : (
                        relatedDecisions.map((d, i) => (
                          <button
                            key={i}
                            onClick={() => setRelatedDecisionView(d)}
                            className="w-full rounded-md bg-surface-2 px-3 py-2.5 text-left transition-colors hover:bg-surface-3"
                          >
                            <div className="mb-1 flex items-start justify-between gap-2">
                              <p className="text-xs font-medium text-foreground/80 leading-snug">
                                {d.title}
                              </p>
                              {d.outcome && (
                                <span className="shrink-0 rounded bg-ping-purple/15 px-1.5 py-px text-2xs text-ping-purple/80">
                                  {d.outcome.action}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-2xs text-muted-foreground">
                                {d.outcome
                                  ? `Decided ${formatRelativeTime(d.outcome.decidedAt)}`
                                  : formatRelativeTime(d.createdAt)}
                              </span>
                              {d.orgTrace
                                .filter((p) => p.role !== "to_consult")
                                .slice(0, 3)
                                .map((p, j) => (
                                  <span
                                    key={j}
                                    title={p.name}
                                    className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-surface-3 text-[8px] font-medium text-foreground/50"
                                  >
                                    {initials(p.name)}
                                  </span>
                                ))}
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* 3. WHAT PING WILL DO */}
          {allNextSteps.length > 0 && (
            <div className="border-t border-subtle px-5 py-4">
              <button
                onClick={() => setNextStepsExpanded(!nextStepsExpanded)}
                className="mb-3 flex w-full items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <Bot className="h-3.5 w-3.5 text-foreground/50" />
                  <span className="text-2xs font-medium uppercase tracking-widest text-foreground/45">
                    What PING will do
                  </span>
                </div>
                {nextStepsExpanded ? (
                  <ChevronUp className="h-3.5 w-3.5 text-foreground/45" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5 text-foreground/45" />
                )}
              </button>
              {nextStepsExpanded && (
                <div className="space-y-2">
                  {actions.map((action) => {
                    const steps = nextStepsByAction[action.actionKey] ?? [];
                    if (steps.length === 0) return null;
                    const isHovered = hoveredAction === action.actionKey;
                    return (
                      <div
                        key={action.actionKey}
                        className={cn(
                          "rounded-md border px-3 py-2.5 transition-colors",
                          isHovered
                            ? "border-white/15 bg-surface-2"
                            : "border-transparent bg-surface-2/50",
                        )}
                      >
                        <p className="mb-1.5 text-2xs font-medium text-foreground/50">
                          If: {action.label}
                        </p>
                        <div className="space-y-1">
                          {steps.map((step, i) => (
                            <div key={i} className="flex items-start gap-2">
                              <span
                                className={cn(
                                  "mt-0.5 shrink-0 rounded px-1 py-px text-[9px] font-medium",
                                  step.automated
                                    ? "bg-blue-500/15 text-blue-400"
                                    : "bg-white/5 text-foreground/40",
                                )}
                              >
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
              )}
            </div>
          )}

          {/* 4. PEOPLE */}
          <div className="border-t border-subtle px-5 py-4">
            <span className="text-2xs font-medium uppercase tracking-widest text-foreground/45">
              People
            </span>

            {involved.length > 0 && (
              <div className="mt-3">
                <p className="mb-2 flex items-center gap-1.5 text-2xs text-foreground/40">
                  <UserCheck className="h-3 w-3" />
                  In this decision
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {involved.map((p, i) => (
                    <PersonPill
                      key={i}
                      name={p.name}
                      role={p.role}
                      onClick={
                        (p as { userId?: string }).userId
                          ? () => setProfileUserId((p as { userId?: string }).userId!)
                          : undefined
                      }
                    />
                  ))}
                </div>
              </div>
            )}

            {toConsult.length > 0 && (
              <div className="mt-3">
                <p className="mb-2 flex items-center gap-1.5 text-2xs text-foreground/40">
                  <UserPlus className="h-3 w-3" />
                  Suggested to consult
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {toConsult.map((p, i) => (
                    <PersonPill
                      key={i}
                      name={p.name}
                      role={p.role}
                      dashed
                      onClick={
                        (p as { userId?: string }).userId
                          ? () => setProfileUserId((p as { userId?: string }).userId!)
                          : undefined
                      }
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

        </div>{/* end max-width wrapper */}
        </div>

        {/* ── STICKY ACTION FOOTER ── */}
        <div className={cn(
          "shrink-0 border-t border-subtle bg-background px-5 py-3 space-y-2",
          focusMode && "flex items-end gap-4 space-y-0",
        )}>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Add reasoning or instructions for PING (optional)..."
            rows={2}
            className={cn(
              "resize-none rounded-md border border-subtle bg-surface-2 px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-white/20",
              focusMode ? "flex-1" : "w-full",
            )}
          />
          <div className="flex flex-wrap items-center gap-1.5">
            {actions.map((action) => (
              <button
                key={action.actionKey}
                onMouseEnter={() => setHoveredAction(action.actionKey)}
                onMouseLeave={() => setHoveredAction(null)}
                onClick={() => handleAction(action)}
                disabled={deciding}
                className={cn(
                  "rounded px-2.5 py-1.5 text-xs font-medium transition-all disabled:opacity-50",
                  action.primary
                    ? "bg-ping-purple text-white hover:bg-ping-purple/90"
                    : "bg-white/5 text-foreground hover:bg-white/10",
                  hoveredAction === action.actionKey && !action.primary && "bg-white/10",
                )}
              >
                {action.label}
              </button>
            ))}
          </div>
        </div>

      </div>

      {/* Sub-modals rendered above the panel */}
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
