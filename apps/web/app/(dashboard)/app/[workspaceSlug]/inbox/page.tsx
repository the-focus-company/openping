"use client";

import { useMemo, useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useConvexAuth } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { InboxCard, type InboxItem, type EisenhowerQuadrant, type PriorityLevel, QUADRANT_ORDER } from "@/components/inbox/InboxCard";
import { DecisionCard, type DecisionItem, type OrgTracePerson } from "@/components/inbox/DecisionCard";
import { DecisionModal } from "@/components/inbox/DecisionModal";
import { DraftReminderCard } from "@/components/inbox/DraftReminderCard";
import { UnansweredQuestionCard } from "@/components/inbox/UnansweredQuestionCard";
import { CheckCircle2, Loader2, FlaskConical, ChevronDown, Check } from "lucide-react";
import { useWorkspace } from "@/hooks/useWorkspace";
import { cn } from "@/lib/utils";

// Quadrant → human action label (section headers)
const SECTION_LABELS: Record<EisenhowerQuadrant, string> = {
  "urgent-important": "Do",
  "important":        "Decide",
  "urgent":           "Delegate",
  "fyi":              "Skip",
};

// Quadrant → priority level
const QUADRANT_TO_PRIORITY: Record<EisenhowerQuadrant, PriorityLevel> = {
  "urgent-important": "urgent",
  "important":        "high",
  "urgent":           "medium",
  "fyi":              "low",
};

const PRIORITY_ORDER: PriorityLevel[] = ["urgent", "high", "medium", "low"];

const PRIORITY_CONFIG: Record<
  PriorityLevel,
  { label: string; bg: string; text: string; activeBg: string; activeText: string; border: string; dot: string }
> = {
  urgent: {
    label: "Urgent",
    bg: "bg-priority-urgent/8", text: "text-priority-urgent/60",
    activeBg: "bg-priority-urgent/15", activeText: "text-priority-urgent",
    border: "border-priority-urgent/30", dot: "bg-priority-urgent",
  },
  high: {
    label: "High",
    bg: "bg-priority-important/8", text: "text-priority-important/60",
    activeBg: "bg-priority-important/15", activeText: "text-priority-important",
    border: "border-priority-important/30", dot: "bg-priority-important",
  },
  medium: {
    label: "Medium",
    bg: "bg-blue-500/8", text: "text-blue-400/60",
    activeBg: "bg-blue-500/15", activeText: "text-blue-400",
    border: "border-blue-500/30", dot: "bg-blue-400",
  },
  low: {
    label: "Low",
    bg: "bg-foreground/4", text: "text-foreground/25",
    activeBg: "bg-foreground/8", activeText: "text-foreground/40",
    border: "border-foreground/15", dot: "bg-foreground/20",
  },
};

export default function InboxPage() {
  const router = useRouter();
  const { buildPath } = useWorkspace();

  const { isAuthenticated } = useConvexAuth();
  const summaries = useQuery(api.inboxSummaries.list, isAuthenticated ? {} : "skip");
  const drafts = useQuery(api.drafts.listActive, isAuthenticated ? {} : "skip");
  const alerts = useQuery(api.proactiveAlerts.listPending, isAuthenticated ? {} : "skip");
  const decisions = useQuery(api.decisions.list, isAuthenticated ? {} : "skip");
  const markReadMutation = useMutation(api.inboxSummaries.markRead);
  const archiveMutation = useMutation(api.inboxSummaries.archive);
  const dismissAlertMutation = useMutation(api.proactiveAlerts.dismiss);
  const decideMutation = useMutation(api.decisions.decide);
  const snoozeMutation = useMutation(api.decisions.snooze);
  const seedDecisionsMutation = useMutation(api.seed.seedDecisions);
  const clearSeedMutation = useMutation(api.seed.clearSeedDecisions);

  const [openDecisionId, setOpenDecisionId] = useState<string | null>(null);
  const [focusMode, setFocusMode] = useState(false);

  // Priority filter — empty = show all
  const [selectedPriorities, setSelectedPriorities] = useState<Set<PriorityLevel>>(new Set());
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!dropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [dropdownOpen]);

  const togglePriority = (p: PriorityLevel) => {
    setSelectedPriorities((prev) => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p); else next.add(p);
      return next;
    });
  };

  const unansweredQuestions = useMemo(
    () => (alerts ?? []).filter((a) => a.type === "unanswered_question"),
    [alerts],
  );

  const items: InboxItem[] = useMemo(() => {
    if (!summaries) return [];
    return summaries.map((s) => {
      const quadrant = (s.eisenhowerQuadrant ?? "fyi") as EisenhowerQuadrant;
      return {
        id: s._id,
        quadrant,
        priority: QUADRANT_TO_PRIORITY[quadrant],
        channel: s.channelName,
        author: "PING",
        authorInitials: "P",
        summary: s.bullets[0]?.text ?? "New activity",
        context: s.bullets.slice(1).map((b) => b.text).join(". "),
        timestamp: new Date(s.periodEnd),
        actions: [
          {
            label: "View Channel",
            primary: true,
            onClick: () => router.push(buildPath(`/channel/${s.channelId}`)),
          },
          ...(s.actionItems ?? []).map((ai) => ({
            label: ai.text,
            onClick: () => {
              if (ai.integrationUrl) window.open(ai.integrationUrl, "_blank");
              else router.push(buildPath(`/channel/${s.channelId}`));
              markReadMutation({ summaryId: s._id });
            },
          })),
        ],
        isRead: s.isRead,
      };
    });
  }, [summaries, router, markReadMutation, buildPath]);

  const decisionItems: DecisionItem[] = useMemo(() => {
    if (!decisions) return [];
    return decisions.map((d) => {
      const quadrant = d.eisenhowerQuadrant as EisenhowerQuadrant;
      return {
        id: d._id,
        type: d.type,
        title: d.title,
        summary: d.summary,
        eisenhowerQuadrant: quadrant,
        priority: QUADRANT_TO_PRIORITY[quadrant],
        status: d.status,
        channelName: d.channelName ?? "unknown",
        createdAt: new Date(d.createdAt),
        agentExecutionStatus: d.agentExecutionStatus ?? undefined,
        agentExecutionResult: d.agentExecutionResult ?? undefined,
        orgTrace: (d.orgTrace ?? []) as OrgTracePerson[],
        nextSteps: (d.nextSteps ?? []) as DecisionItem["nextSteps"],
        recommendedActions: (d.recommendedActions ?? []) as DecisionItem["recommendedActions"],
        links: (d.links ?? []) as DecisionItem["links"],
        relatedDecisionIds: d.relatedDecisionIds as string[] | undefined,
      };
    });
  }, [decisions]);

  // Unfiltered counts per priority for pills
  const priorityCounts = useMemo(() => {
    const counts: Record<PriorityLevel, number> = { urgent: 0, high: 0, medium: 0, low: 0 };
    for (const item of items) counts[item.priority]++;
    for (const d of decisionItems) counts[d.priority]++;
    return counts;
  }, [items, decisionItems]);

  const handleMarkRead = (id: string) => markReadMutation({ summaryId: id as Id<"inboxSummaries"> });
  const handleArchive = (id: string) => archiveMutation({ summaryId: id as Id<"inboxSummaries"> });
  const handleDismissAlert = (alertId: string) => dismissAlertMutation({ alertId: alertId as Id<"proactiveAlerts"> });
  const handleDecisionAction = (id: string, action: string, comment?: string) => {
    if (action === "Snooze" || action === "snooze") {
      snoozeMutation({ decisionId: id as Id<"decisions">, snoozeUntil: Date.now() + 60 * 60 * 1000 });
    } else {
      decideMutation({ decisionId: id as Id<"decisions">, action, comment });
    }
  };

  const isLoading = summaries === undefined || drafts === undefined || decisions === undefined;
  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-foreground/20" />
      </div>
    );
  }

  const totalCount = items.length + (drafts?.length ?? 0) + unansweredQuestions.length + decisionItems.length;
  if (totalCount === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 animate-fade-in px-8 text-center">
        <CheckCircle2 className="h-10 w-10 text-foreground/15" />
        <h2 className="text-sm font-medium text-foreground">Inbox is empty</h2>
        <p className="max-w-xs text-xs text-muted-foreground leading-relaxed">
          Decisions, summaries, and action items appear here as your team communicates in channels.
          Send messages in a channel — AI summaries and decisions generate every 5–15 minutes.
        </p>
        <button
          onClick={() => seedDecisionsMutation({})}
          className="mt-2 flex items-center gap-1.5 rounded-md border border-subtle px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-white/20 hover:text-foreground"
        >
          <FlaskConical className="h-3.5 w-3.5" />
          Load demo decisions
        </button>
      </div>
    );
  }

  // Sort by quadrant order then time desc
  const sortedItems = [...items].sort((a, b) => {
    const qDiff = QUADRANT_ORDER.indexOf(a.quadrant) - QUADRANT_ORDER.indexOf(b.quadrant);
    return qDiff !== 0 ? qDiff : b.timestamp.getTime() - a.timestamp.getTime();
  });
  const sortedDecisions = [...decisionItems].sort((a, b) => {
    const qDiff = QUADRANT_ORDER.indexOf(a.eisenhowerQuadrant) - QUADRANT_ORDER.indexOf(b.eisenhowerQuadrant);
    return qDiff !== 0 ? qDiff : b.createdAt.getTime() - a.createdAt.getTime();
  });

  // Apply priority filter
  const activeFilter = selectedPriorities.size > 0;
  const filteredItems = activeFilter ? sortedItems.filter((i) => selectedPriorities.has(i.priority)) : sortedItems;
  const filteredDecisions = activeFilter ? sortedDecisions.filter((d) => selectedPriorities.has(d.priority)) : sortedDecisions;

  const openDecision = filteredDecisions.find((d) => d.id === openDecisionId) ?? null;

  return (
    <div className="animate-fade-in">

      {/* ── Sticky header ── */}
      <div className="sticky top-0 z-20 flex items-center justify-between border-b border-subtle bg-background px-3 py-2">

        {/* Priority filter pills */}
        <div className="flex items-center gap-1">
          {PRIORITY_ORDER.map((p) => {
            const cfg = PRIORITY_CONFIG[p];
            const count = priorityCounts[p];
            const isActive = selectedPriorities.has(p);
            const anyActive = activeFilter;
            return (
              <button
                key={p}
                onClick={() => togglePriority(p)}
                className={cn(
                  "flex items-center gap-1.5 rounded border px-2 py-0.5 text-2xs font-medium transition-all",
                  isActive
                    ? [cfg.activeBg, cfg.activeText, cfg.border]
                    : anyActive
                      ? "border-transparent text-foreground/20 hover:text-foreground/40"
                      : [cfg.bg, cfg.text, "border-transparent hover:border-white/10"],
                )}
              >
                <span className={cn("h-1.5 w-1.5 rounded-full", isActive ? cfg.dot : "bg-foreground/20")} />
                {cfg.label}
                <span className={cn("tabular-nums", isActive ? "opacity-70" : "opacity-50")}>{count}</span>
              </button>
            );
          })}

          {/* Labeled dropdown */}
          <div className="relative ml-1" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen((o) => !o)}
              className={cn(
                "flex items-center gap-1 rounded border px-2 py-0.5 text-2xs font-medium transition-colors",
                dropdownOpen
                  ? "border-white/15 bg-surface-2 text-foreground"
                  : activeFilter
                    ? "border-white/10 bg-surface-2/50 text-muted-foreground hover:bg-surface-2"
                    : "border-transparent text-foreground/20 hover:bg-surface-2 hover:text-muted-foreground",
              )}
            >
              Priority
              <ChevronDown className={cn("h-3 w-3 transition-transform", dropdownOpen && "rotate-180")} />
            </button>

            {dropdownOpen && (
              <div className="absolute left-0 top-full z-30 mt-1 min-w-[148px] rounded-md border border-subtle bg-background shadow-lg">
                {PRIORITY_ORDER.map((p) => {
                  const cfg = PRIORITY_CONFIG[p];
                  const isChecked = selectedPriorities.has(p);
                  return (
                    <button
                      key={p}
                      onClick={() => togglePriority(p)}
                      className="flex w-full items-center gap-2.5 px-3 py-1.5 text-xs transition-colors hover:bg-surface-2"
                    >
                      <span
                        className={cn(
                          "flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[3px] border transition-colors",
                          isChecked ? [cfg.activeBg, "border-transparent"] : "border-white/15",
                        )}
                      >
                        {isChecked && <Check className={cn("h-2.5 w-2.5", cfg.activeText)} />}
                      </span>
                      <span className={cn("flex h-1.5 w-1.5 rounded-full shrink-0", cfg.dot)} />
                      <span className={cn("flex-1 text-left", isChecked ? "text-foreground" : "text-muted-foreground")}>
                        {cfg.label}
                      </span>
                      <span className="tabular-nums text-foreground/25">{priorityCounts[p]}</span>
                    </button>
                  );
                })}
                {activeFilter && (
                  <div className="border-t border-subtle px-3 py-1.5">
                    <button
                      onClick={() => { setSelectedPriorities(new Set()); setDropdownOpen(false); }}
                      className="text-2xs text-muted-foreground transition-colors hover:text-foreground"
                    >
                      Clear filter
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Demo controls */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => seedDecisionsMutation({})}
            title="Load demo decisions"
            className="flex items-center gap-1 rounded px-2 py-1 text-2xs text-foreground/20 transition-colors hover:bg-surface-2 hover:text-muted-foreground"
          >
            <FlaskConical className="h-3 w-3" />
            demo
          </button>
          <button
            onClick={() => clearSeedMutation({})}
            title="Clear all pending decisions"
            className="flex items-center gap-1 rounded px-2 py-1 text-2xs text-foreground/20 transition-colors hover:bg-surface-2 hover:text-red-400"
          >
            ✕
          </button>
        </div>
      </div>

      {/* ── Draft reminders (not priority-filtered) ── */}
      {!activeFilter && drafts.length > 0 && (
        <div>
          <SectionHeader label="Drafts" count={drafts.length} />
          {drafts.map((draft) => (
            <DraftReminderCard
              key={draft._id}
              draftId={draft._id}
              channelId={draft.channelId}
              channelName={draft.channelName}
              body={draft.body}
              suggestedCompletion={draft.suggestedCompletion}
              updatedAt={new Date(draft.updatedAt)}
            />
          ))}
        </div>
      )}

      {/* ── Unanswered questions (not priority-filtered) ── */}
      {!activeFilter && unansweredQuestions.length > 0 && (
        <div>
          <SectionHeader label="Needs Your Answer" count={unansweredQuestions.length} />
          {unansweredQuestions.map((alert) => (
            <UnansweredQuestionCard
              key={alert._id}
              alertId={alert._id}
              channelId={alert.channelId}
              channelName={"channel"}
              title={alert.title}
              body={alert.body}
              suggestedAction={alert.suggestedAction}
              createdAt={new Date(alert.createdAt)}
              onDismiss={handleDismissAlert}
            />
          ))}
        </div>
      )}

      {/* ── Per-quadrant sections: decisions + inbox items merged ── */}
      {QUADRANT_ORDER.map((quadrant) => {
        const sectionDecisions = filteredDecisions.filter((d) => d.eisenhowerQuadrant === quadrant);
        const sectionItems = filteredItems.filter((i) => i.quadrant === quadrant);
        if (sectionDecisions.length === 0 && sectionItems.length === 0) return null;
        return (
          <div key={quadrant}>
            <SectionHeader label={SECTION_LABELS[quadrant]} count={sectionDecisions.length + sectionItems.length} />
            {sectionDecisions.map((decision) => (
              <DecisionCard
                key={decision.id}
                item={decision}
                onAction={handleDecisionAction}
                onOpen={() => { setOpenDecisionId(decision.id); setFocusMode(false); }}
                onFocus={() => { setOpenDecisionId(decision.id); setFocusMode(true); }}
              />
            ))}
            {sectionItems.map((item) => (
              <InboxCard key={item.id} item={item} onMarkRead={handleMarkRead} onArchive={handleArchive} />
            ))}
          </div>
        );
      })}

      {/* Empty state when filter returns nothing */}
      {activeFilter && filteredDecisions.length === 0 && filteredItems.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
          <p className="text-sm text-muted-foreground">No items match the selected priority</p>
          <button
            onClick={() => setSelectedPriorities(new Set())}
            className="text-xs text-foreground/40 underline-offset-2 hover:text-foreground hover:underline"
          >
            Clear filter
          </button>
        </div>
      )}

      {/* Decision modal */}
      {openDecision && (
        <DecisionModal
          item={openDecision}
          onAction={handleDecisionAction}
          onClose={() => setOpenDecisionId(null)}
          focusMode={focusMode}
          onToggleFocusMode={() => setFocusMode((f) => !f)}
        />
      )}
    </div>
  );
}

function SectionHeader({ label, count }: { label: string; count: number }) {
  return (
    <div className="sticky top-[41px] z-10 flex items-center gap-2 border-b border-subtle bg-background/90 px-4 py-1.5 backdrop-blur-sm">
      <span className="text-2xs font-medium uppercase tracking-widest text-foreground/30">{label}</span>
      <span className="text-2xs tabular-nums text-foreground/20">{count}</span>
    </div>
  );
}
