"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useConvexAuth } from "convex/react";
import { api } from "@convex/_generated/api";
import { InboxCard, type InboxItem, type Priority } from "@/components/inbox/InboxCard";
import { useToast } from "@/components/ui/toast-provider";
import { CheckCircle2, Loader2 } from "lucide-react";

function mapPriority(bullets: Array<{ priority: string }>): Priority {
  const priorities = bullets.map((b) => b.priority);
  if (priorities.includes("high")) return "urgent";
  if (priorities.includes("medium")) return "important";
  return "delegate";
}

const SECTIONS: Array<{ priority: Priority; label: string }> = [
  { priority: "urgent",    label: "Do Now" },
  { priority: "important", label: "Schedule" },
  { priority: "delegate",  label: "Delegate" },
  { priority: "low",       label: "Eliminate" },
];

export default function InboxPage() {
  const router = useRouter();
  const { toast } = useToast();

  const { isAuthenticated } = useConvexAuth();
  const summaries = useQuery(api.inboxSummaries.list, isAuthenticated ? {} : "skip");
  const markReadMutation = useMutation(api.inboxSummaries.markRead);
  const archiveMutation = useMutation(api.inboxSummaries.archive);

  const items: InboxItem[] = useMemo(() => {
    if (!summaries) return [];
    return summaries.map((s) => ({
      id: s._id,
      priority: mapPriority(s.bullets),
      channel: s.channelName,
      author: "PING",
      authorInitials: "P",
      summary: s.bullets[0]?.text ?? "New activity",
      context: s.bullets
        .slice(1)
        .map((b) => b.text)
        .join(". "),
      timestamp: new Date(s.periodEnd),
      actions: [
        {
          label: "View Channel",
          primary: true,
          onClick: () => router.push(`/channel/${s.channelId}`),
        },
        ...(s.actionItems ?? []).map((ai) => ({
          label: ai.text,
          onClick: () => toast(ai.text, "success"),
        })),
      ],
      isRead: s.isRead,
    }));
  }, [summaries, router, toast]);

  const handleMarkRead = (id: string) => {
    markReadMutation({ summaryId: id as any });
  };

  const handleArchive = (id: string) => {
    archiveMutation({ summaryId: id as any });
  };

  if (summaries === undefined) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-white/20" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 animate-fade-in">
        <CheckCircle2 className="h-10 w-10 text-white/15" />
        <h2 className="text-sm font-medium text-foreground">You&apos;re all caught up</h2>
        <p className="text-xs text-muted-foreground">
          New summaries and action items will appear here
        </p>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-subtle px-4 py-2">
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">
            {items.length} item{items.length !== 1 ? "s" : ""}
          </span>
          <span className="text-2xs text-white/20">·</span>
          <span className="text-2xs text-muted-foreground">Eisenhower Matrix</span>
        </div>
      </div>

      {/* Sections */}
      {SECTIONS.map(({ priority, label }) => {
        const sectionItems = items.filter((item) => item.priority === priority);
        if (sectionItems.length === 0) return null;

        return (
          <div key={priority}>
            <div className="sticky top-0 z-10 border-b border-subtle bg-background/90 backdrop-blur-sm px-4 py-1.5">
              <span className="text-2xs font-medium uppercase tracking-widest text-white/25">
                {label}
              </span>
            </div>
            {sectionItems.map((item) => (
              <InboxCard
                key={item.id}
                item={item}
                onMarkRead={handleMarkRead}
                onArchive={handleArchive}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
}
