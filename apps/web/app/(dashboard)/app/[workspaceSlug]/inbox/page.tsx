"use client";

import { useMemo, useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useConvexAuth } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { DecisionCard, type InboxItemData, type OrgTracePerson } from "@/components/inbox/DecisionCard";
import dynamic from "next/dynamic";
import type { ModalItem } from "@/components/inbox/InboxModal";
const InboxModal = dynamic(
  () => import("@/components/inbox/InboxModal").then((m) => ({ default: m.InboxModal })),
  { ssr: false },
);
import { DraftReminderCard } from "@/components/inbox/DraftReminderCard";
import { type InboxCategory, type PriorityLevel, CATEGORY_ORDER, CATEGORY_TO_PRIORITY } from "@/components/inbox/InboxCard";
import { CheckCircle2, Loader2, FlaskConical, Sparkles, ChevronDown, Check, Archive } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLoadingTimeout } from "@/hooks/useLoadingTimeout";

// ── Section labels ──
const SECTION_LABELS: Record<InboxCategory, string> = {
  do: "Do",
  decide: "Decide",
  delegate: "Delegate",
  skip: "Skip",
};

// ── Quadrant pill config ──
const CATEGORY_PILL_CONFIG: Record<
  InboxCategory,
  { label: string; bg: string; text: string; activeBg: string; activeText: string; border: string; dot: string }
> = {
  do: {
    label: "Do",
    bg: "bg-priority-urgent/8", text: "text-priority-urgent/60",
    activeBg: "bg-priority-urgent/15", activeText: "text-priority-urgent",
    border: "border-priority-urgent/30", dot: "bg-priority-urgent",
  },
  decide: {
    label: "Decide",
    bg: "bg-priority-important/8", text: "text-priority-important/60",
    activeBg: "bg-priority-important/15", activeText: "text-priority-important",
    border: "border-priority-important/30", dot: "bg-priority-important",
  },
  delegate: {
    label: "Delegate",
    bg: "bg-blue-500/8", text: "text-blue-400/60",
    activeBg: "bg-blue-500/15", activeText: "text-blue-400",
    border: "border-blue-500/30", dot: "bg-blue-400",
  },
  skip: {
    label: "Skip",
    bg: "bg-foreground/4", text: "text-foreground/45",
    activeBg: "bg-foreground/8", activeText: "text-foreground/40",
    border: "border-foreground/15", dot: "bg-foreground/20",
  },
};

// ── Priority dropdown config ──
const PRIORITY_ORDER: PriorityLevel[] = ["urgent", "high", "medium", "low"];

const PRIORITY_CONFIG: Record<
  PriorityLevel,
  { label: string; bg: string; text: string; activeBg: string; activeText: string; border: string; dot: string }
> = {
  urgent: {
    label: "Urgent", bg: "bg-priority-urgent/8", text: "text-priority-urgent/60",
    activeBg: "bg-priority-urgent/15", activeText: "text-priority-urgent",
    border: "border-priority-urgent/30", dot: "bg-priority-urgent",
  },
  high: {
    label: "High", bg: "bg-priority-important/8", text: "text-priority-important/60",
    activeBg: "bg-priority-important/15", activeText: "text-priority-important",
    border: "border-priority-important/30", dot: "bg-priority-important",
  },
  medium: {
    label: "Medium", bg: "bg-blue-500/8", text: "text-blue-400/60",
    activeBg: "bg-blue-500/15", activeText: "text-blue-400",
    border: "border-blue-500/30", dot: "bg-blue-400",
  },
  low: {
    label: "Low", bg: "bg-foreground/4", text: "text-foreground/25",
    activeBg: "bg-foreground/8", activeText: "text-foreground/40",
    border: "border-foreground/15", dot: "bg-foreground/20",
  },
};

function itemToModalItem(d: InboxItemData): ModalItem {
  return {
    id: d.id,
    kind: "decision",
    title: d.title,
    summary: d.summary,
    priority: d.priority,
    channelName: d.channelName,
    createdAt: d.createdAt,
    category: d.category,
    decisionType: d.type,
    orgTrace: d.orgTrace,
    nextSteps: d.nextSteps,
    recommendedActions: d.recommendedActions,
    links: d.links,
    relatedItemIds: d.relatedItemIds,
    agentExecutionStatus: d.agentExecutionStatus,
    pingWillDo: d.pingWillDo,
  };
}

export default function InboxPage() {
  const { isAuthenticated } = useConvexAuth();
  const inboxItems = useQuery(api.inboxItems.list, isAuthenticated ? {} : "skip");
  const drafts = useQuery(api.drafts.listActive, isAuthenticated ? {} : "skip");
  const actMutation = useMutation(api.inboxItems.act);
  const archiveMutation = useMutation(api.inboxItems.archive);
  const snoozeMutation = useMutation(api.inboxItems.snooze);
  const seedMutation = useMutation(api.seed.seedDecisions);
  const generateMutation = useMutation(api.generateDecision.generateDecision);
  const clearMutation = useMutation(api.seed.clearSeedDecisions);

  const [openItem, setOpenItem] = useState<string | null>(null);
  const [focusMode, setFocusMode] = useState(false);
  const [showArchive, setShowArchive] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const prevItemCount = useRef<number | null>(null);

  // Track when new items arrive to stop the generating spinner
  useEffect(() => {
    if (!isGenerating) {
      prevItemCount.current = null;
      return;
    }
    const currentCount = inboxItems?.length ?? 0;
    if (prevItemCount.current === null) {
      prevItemCount.current = currentCount;
    } else if (currentCount > prevItemCount.current) {
      setIsGenerating(false);
      prevItemCount.current = null;
    }
  }, [isGenerating, inboxItems?.length]);

  const handleGenerate = () => {
    setIsGenerating(true);
    generateMutation({});
  };

  // Filters
  const [selectedCategories, setSelectedCategories] = useState<Set<InboxCategory>>(new Set());
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

  const toggleCategory = (c: InboxCategory) => {
    setSelectedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c); else next.add(c);
      return next;
    });
  };

  const togglePriority = (p: PriorityLevel) => {
    setSelectedPriorities((prev) => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p); else next.add(p);
      return next;
    });
  };

  const items: InboxItemData[] = useMemo(() => {
    if (!inboxItems) return [];
    return inboxItems.map((d) => ({
      id: d._id,
      type: d.type,
      title: d.title,
      summary: d.summary,
      category: d.category as InboxCategory,
      priority: CATEGORY_TO_PRIORITY[d.category as InboxCategory],
      status: d.status,
      channelName: d.conversationName ?? "unknown",
      pingWillDo: d.pingWillDo ?? undefined,
      createdAt: new Date(d.createdAt),
      agentExecutionStatus: d.agentExecutionStatus ?? undefined,
      agentExecutionResult: d.agentExecutionResult ?? undefined,
      orgTrace: (d.orgTrace ?? []) as OrgTracePerson[],
      nextSteps: (d.nextSteps ?? []) as InboxItemData["nextSteps"],
      recommendedActions: (d.recommendedActions ?? []) as InboxItemData["recommendedActions"],
      links: (d.links ?? []) as InboxItemData["links"],
      relatedItemIds: d.relatedItemIds as string[] | undefined,
    }));
  }, [inboxItems]);

  // Counts per category (unfiltered) for pills
  const categoryCounts = useMemo(() => {
    const counts: Record<InboxCategory, number> = { do: 0, decide: 0, delegate: 0, skip: 0 };
    for (const d of items) counts[d.category]++;
    return counts;
  }, [items]);

  // Counts per priority (unfiltered) for dropdown
  const priorityCounts = useMemo(() => {
    const counts: Record<PriorityLevel, number> = { urgent: 0, high: 0, medium: 0, low: 0 };
    for (const d of items) counts[d.priority]++;
    return counts;
  }, [items]);

  const handleAction = (id: string, action: string, comment?: string) => {
    if (action === "Snooze" || action === "snooze") {
      snoozeMutation({ itemId: id as Id<"inboxItems">, snoozeUntil: Date.now() + 60 * 60 * 1000 });
    } else {
      actMutation({ itemId: id as Id<"inboxItems">, action, comment });
    }
  };

  const handleArchive = (id: string) => {
    archiveMutation({ itemId: id as Id<"inboxItems"> });
  };

  const isLoading = inboxItems === undefined || drafts === undefined;
  const loadingTimedOut = useLoadingTimeout(isLoading, 15_000);
  if (isLoading) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3">
        {loadingTimedOut ? (
          <>
            <p className="text-sm text-muted-foreground">Could not load inbox.</p>
            <button onClick={() => window.location.reload()} className="text-xs text-foreground/60 underline hover:text-foreground">Retry</button>
          </>
        ) : (
          <Loader2 className="h-5 w-5 animate-spin text-foreground/40" />
        )}
      </div>
    );
  }

  const totalCount = items.length + (drafts?.length ?? 0);
  if (totalCount === 0 && !showArchive) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 animate-fade-in px-8 text-center">
        <CheckCircle2 className="h-10 w-10 text-foreground/50" />
        <h2 className="text-sm font-medium text-foreground">Inbox is empty</h2>
        <p className="max-w-xs text-xs text-muted-foreground leading-relaxed">
          Items appear here as your team communicates in channels.
          Send messages in a channel — AI summaries and decisions generate every 5–15 minutes.
        </p>
        <div className="mt-2 flex items-center gap-2">
          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="flex items-center gap-1.5 rounded-md border border-subtle px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-white/20 hover:text-foreground disabled:opacity-50"
          >
            {isGenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            {isGenerating ? "Generating…" : "Generate decision"}
          </button>
          <button
            onClick={() => seedMutation({})}
            className="flex items-center gap-1.5 rounded-md border border-subtle px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-white/20 hover:text-foreground"
          >
            <FlaskConical className="h-3.5 w-3.5" />
            Load demo data
          </button>
        </div>
      </div>
    );
  }

  // Sort by category order then time desc
  const sorted = [...items].sort((a, b) => {
    const cDiff = CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category);
    return cDiff !== 0 ? cDiff : b.createdAt.getTime() - a.createdAt.getTime();
  });

  // Apply filters
  const activeCategoryFilter = selectedCategories.size > 0;
  const activePriorityFilter = selectedPriorities.size > 0;
  const activeFilter = activeCategoryFilter || activePriorityFilter;

  const filtered = sorted.filter((d) => {
    if (activeCategoryFilter && !selectedCategories.has(d.category)) return false;
    if (activePriorityFilter && !selectedPriorities.has(d.priority)) return false;
    return true;
  });

  // Find modal item
  const openModalItem: ModalItem | null = (() => {
    if (!openItem) return null;
    const d = sorted.find((i) => i.id === openItem);
    return d ? itemToModalItem(d) : null;
  })();

  return (
    <div className="animate-fade-in">

      {/* ── Sticky header ── */}
      <div className="sticky top-0 z-20 flex items-center justify-between border-b border-subtle bg-background px-3 py-2">

        {/* Category filter pills + Priority dropdown */}
        <div className="flex items-center gap-1">
          {CATEGORY_ORDER.map((c) => {
            const cfg = CATEGORY_PILL_CONFIG[c];
            const count = categoryCounts[c];
            const isActive = selectedCategories.has(c);
            const anyActive = activeCategoryFilter;
            return (
              <button
                key={c}
                onClick={() => toggleCategory(c)}
                className={cn(
                  "flex items-center gap-1.5 rounded border px-2 py-0.5 text-2xs font-medium transition-all",
                  isActive
                    ? [cfg.activeBg, cfg.activeText, cfg.border]
                    : anyActive
                      ? "border-transparent text-foreground/40 hover:text-foreground/40"
                      : [cfg.bg, cfg.text, "border-transparent hover:border-white/10"],
                )}
              >
                <span className={cn("h-1.5 w-1.5 rounded-full", isActive ? cfg.dot : "bg-foreground/20")} />
                {cfg.label}
                <span className={cn("tabular-nums", isActive ? "opacity-70" : "opacity-50")}>{count}</span>
              </button>
            );
          })}

          {/* Priority dropdown */}
          <div className="relative ml-1" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen((o) => !o)}
              className={cn(
                "flex items-center gap-1 rounded border px-2 py-0.5 text-2xs font-medium transition-colors",
                dropdownOpen
                  ? "border-white/15 bg-surface-2 text-foreground"
                  : activePriorityFilter
                    ? "border-white/10 bg-surface-2/50 text-muted-foreground hover:bg-surface-2"
                    : "border-transparent text-foreground/40 hover:bg-surface-2 hover:text-muted-foreground",
              )}
            >
              Priority
              {activePriorityFilter && (
                <span className="flex h-1.5 w-1.5 rounded-full bg-ping-purple" />
              )}
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
                      <span className="tabular-nums text-foreground/45">{priorityCounts[p]}</span>
                    </button>
                  );
                })}
                {activePriorityFilter && (
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

          {/* Archive toggle */}
          <button
            onClick={() => setShowArchive((s) => !s)}
            className={cn(
              "ml-2 flex items-center gap-1 rounded border px-2 py-0.5 text-2xs font-medium transition-colors",
              showArchive
                ? "border-white/15 bg-surface-2 text-foreground"
                : "border-transparent text-foreground/20 hover:bg-surface-2 hover:text-muted-foreground",
            )}
          >
            <Archive className="h-3 w-3" />
            Archive
          </button>
        </div>

        {/* Demo controls */}
        <div className="flex items-center gap-1">
          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            title="Generate decision from real data"
            className="flex items-center gap-1 rounded px-2 py-1 text-2xs text-foreground/20 transition-colors hover:bg-surface-2 hover:text-muted-foreground disabled:opacity-50"
          >
            {isGenerating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
            {isGenerating ? "generating…" : "generate"}
          </button>
          <button
            onClick={() => seedMutation({})}
            title="Load demo data"
            className="flex items-center gap-1 rounded px-2 py-1 text-2xs text-foreground/20 transition-colors hover:bg-surface-2 hover:text-muted-foreground"
          >
            <FlaskConical className="h-3 w-3" />
            demo
          </button>
          <button
            onClick={() => clearMutation({})}
            title="Clear all items"
            className="flex items-center gap-1 rounded px-2 py-1 text-2xs text-foreground/20 transition-colors hover:bg-surface-2 hover:text-red-400"
          >
            ✕
          </button>
        </div>
      </div>

      {showArchive ? (
        <ArchiveView />
      ) : (
        <>
          {/* ── Draft reminders (not filtered) ── */}
          {!activeFilter && drafts.length > 0 && (
            <div>
              <SectionHeader label="Drafts" count={drafts.length} />
              {drafts.map((draft) => (
                <DraftReminderCard
                  key={draft._id}
                  draftId={draft._id}
                  channelId={draft.conversationId}
                  channelName={draft.conversationName}
                  body={draft.body}
                  suggestedCompletion={draft.suggestedCompletion}
                  updatedAt={new Date(draft.updatedAt)}
                />
              ))}
            </div>
          )}

          {/* ── Per-category sections ── */}
          {CATEGORY_ORDER.map((category) => {
            const sectionItems = filtered.filter((d) => d.category === category);
            if (sectionItems.length === 0) return null;
            return (
              <div key={category}>
                <SectionHeader label={SECTION_LABELS[category]} count={sectionItems.length} />
                {sectionItems.map((item) => (
                  <DecisionCard
                    key={item.id}
                    item={item}
                    onAction={handleAction}
                    onArchive={handleArchive}
                    onOpen={() => { setOpenItem(item.id); setFocusMode(false); }}
                    onFocus={() => { setOpenItem(item.id); setFocusMode(true); }}
                  />
                ))}
              </div>
            );
          })}

          {/* Empty state when filter returns nothing */}
          {activeFilter && filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
              <p className="text-sm text-muted-foreground">No items match the selected filter</p>
              <button
                onClick={() => { setSelectedCategories(new Set()); setSelectedPriorities(new Set()); }}
                className="text-xs text-foreground/40 underline-offset-2 hover:text-foreground hover:underline"
              >
                Clear filters
              </button>
            </div>
          )}
        </>
      )}

      {/* Unified inbox modal */}
      {openModalItem && (
        <InboxModal
          item={openModalItem}
          onAction={handleAction}
          onClose={() => setOpenItem(null)}
          focusMode={focusMode}
          onToggleFocusMode={() => setFocusMode((f) => !f)}
        />
      )}
    </div>
  );
}

function SectionHeader({ label, count }: { label: string; count: number }) {
  return (
    <div className="sticky top-[37px] z-10 flex items-center gap-2 border-b border-subtle bg-background/95 px-4 py-2.5 backdrop-blur-sm">
      <span className="text-xs font-semibold uppercase tracking-wider text-foreground/50">{label}</span>
      <span className="text-2xs tabular-nums text-foreground/50">{count}</span>
    </div>
  );
}

function ArchiveView() {
  const { isAuthenticated } = useConvexAuth();
  const archived = useQuery(
    api.inboxItems.listArchived,
    isAuthenticated ? { paginationOpts: { numItems: 50, cursor: null } } : "skip",
  );

  const archiveTimedOut = useLoadingTimeout(!archived, 15_000);
  if (!archived) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16">
        {archiveTimedOut ? (
          <>
            <p className="text-sm text-muted-foreground">Could not load archive.</p>
            <button onClick={() => window.location.reload()} className="text-xs text-foreground/60 underline hover:text-foreground">Retry</button>
          </>
        ) : (
          <Loader2 className="h-5 w-5 animate-spin text-foreground/20" />
        )}
      </div>
    );
  }

  if (archived.page.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
        <Archive className="h-8 w-8 text-foreground/15" />
        <p className="text-sm text-muted-foreground">No archived items yet</p>
      </div>
    );
  }

  return (
    <div>
      <SectionHeader label="Archive" count={archived.page.length} />
      {archived.page.map((item) => (
        <div
          key={item._id}
          className="flex items-start gap-3 border-b border-subtle px-4 py-3 opacity-60"
        >
          <div className="min-w-0 flex-1">
            <p className="text-sm text-foreground">{item.title}</p>
            <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">{item.summary}</p>
            {item.outcome && (
              <span className="mt-1 inline-block rounded bg-ping-purple/15 px-1.5 py-px text-2xs text-ping-purple/80">
                {item.outcome.action}
              </span>
            )}
          </div>
          <span className="shrink-0 text-2xs text-muted-foreground">
            {new Date(item.createdAt).toLocaleDateString()}
          </span>
        </div>
      ))}
    </div>
  );
}
