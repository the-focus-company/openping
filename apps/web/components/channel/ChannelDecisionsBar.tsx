"use client";

import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { AnimatePresence, motion } from "motion/react";
import { Zap, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DecisionCard,
  type InboxItemData,
  type OrgTracePerson,
} from "@/components/inbox/DecisionCard";
import {
  type InboxCategory,
  CATEGORY_TO_PRIORITY,
} from "@/components/inbox/InboxCard";
import { InboxModal, type ModalItem } from "@/components/inbox/InboxModal";

const CATEGORY_ACCENT: Record<InboxCategory, string> = {
  do: "bg-priority-urgent",
  decide: "bg-priority-important",
  delegate: "bg-blue-500",
  skip: "bg-white/20",
};

interface ChannelDecisionsBarProps {
  channelId: string;
}

export function ChannelDecisionsBar({ channelId }: ChannelDecisionsBarProps) {
  const [expanded, setExpanded] = useState(false);
  const [openItemId, setOpenItemId] = useState<string | null>(null);
  const [focusMode, setFocusMode] = useState(false);

  const raw = useQuery(api.inboxItems.list, {});
  const actMutation = useMutation(api.inboxItems.act);
  const snoozeMutation = useMutation(api.inboxItems.snooze);
  const archiveMutation = useMutation(api.inboxItems.archive);

  const items: InboxItemData[] = useMemo(() => {
    if (!raw) return [];
    return raw
      .filter((d) => d.channelId === channelId)
      .map((d) => ({
        id: d._id,
        type: d.type,
        title: d.title,
        summary: d.summary,
        category: d.category as InboxCategory,
        priority: CATEGORY_TO_PRIORITY[d.category as InboxCategory],
        status: d.status,
        channelName: d.channelName ?? "unknown",
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
  }, [raw, channelId]);

  const handleAction = useCallback(
    (id: string, action: string, comment?: string) => {
      if (action === "Snooze" || action === "snooze") {
        snoozeMutation({
          itemId: id as Id<"inboxItems">,
          snoozeUntil: Date.now() + 60 * 60 * 1000,
        });
      } else {
        actMutation({
          itemId: id as Id<"inboxItems">,
          action,
          comment,
        });
      }
    },
    [actMutation, snoozeMutation],
  );

  const handleArchive = useCallback(
    (id: string) => {
      archiveMutation({ itemId: id as Id<"inboxItems"> });
    },
    [archiveMutation],
  );

  if (!raw || items.length === 0) return null;

  const topItem = items[0];
  const accent = CATEGORY_ACCENT[topItem.category];
  const openItem = items.find((d) => d.id === openItemId) ?? null;

  const openModalItem: ModalItem | null = openItem
    ? {
        id: openItem.id,
        kind: "decision",
        title: openItem.title,
        summary: openItem.summary,
        priority: openItem.priority,
        channelName: openItem.channelName,
        createdAt: openItem.createdAt,
        category: openItem.category,
        decisionType: openItem.type,
        orgTrace: openItem.orgTrace,
        nextSteps: openItem.nextSteps,
        recommendedActions: openItem.recommendedActions,
        links: openItem.links,
        relatedItemIds: openItem.relatedItemIds,
        agentExecutionStatus: openItem.agentExecutionStatus,
        pingWillDo: openItem.pingWillDo,
      }
    : null;

  return (
    <>
      <div className="relative shrink-0 border-b border-subtle bg-surface-1">
        <div className={cn("absolute left-0 top-2 bottom-2 w-[3px] rounded-r", accent)} />

        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex w-full items-center gap-2 px-4 py-1.5 text-left transition-colors hover:bg-surface-2/60"
        >
          <Zap className="h-3.5 w-3.5 shrink-0 text-amber-400" />
          <span className="text-2xs font-medium text-foreground">
            {items.length} {items.length === 1 ? "item" : "items"}
          </span>
          <span className="text-2xs text-foreground/45">·</span>
          <span className="min-w-0 flex-1 truncate text-2xs text-muted-foreground">
            {topItem.title}
          </span>
          <ChevronDown
            className={cn(
              "h-3 w-3 shrink-0 text-muted-foreground transition-transform",
              expanded && "rotate-180",
            )}
          />
        </button>

        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className="overflow-hidden"
            >
              <div className="max-h-[40vh] overflow-y-auto scrollbar-thin border-t border-subtle">
                {items.map((item) => (
                  <DecisionCard
                    key={item.id}
                    item={item}
                    onAction={handleAction}
                    onArchive={handleArchive}
                    onOpen={() => setOpenItemId(item.id)}
                  />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {openModalItem && (
        <InboxModal
          item={openModalItem}
          onAction={handleAction}
          onClose={() => setOpenItemId(null)}
          focusMode={focusMode}
          onToggleFocusMode={() => setFocusMode((f) => !f)}
        />
      )}
    </>
  );
}
