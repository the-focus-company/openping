"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { MessageSkeleton } from "@/components/channel/MessageSkeleton";

/* ------------------------------------------------------------------ */
/*  ChannelTopBarSkeleton — mirrors ChannelTopBar                      */
/* ------------------------------------------------------------------ */

export function ChannelTopBarSkeleton() {
  return (
    <div className="flex h-10 items-center gap-3 border-b border-subtle bg-surface-1 px-4 shrink-0">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <Skeleton className="h-3.5 w-3.5 shrink-0 rounded" />
        <Skeleton className="h-3.5 w-28" />
        <Skeleton className="h-3 w-40" />
      </div>
      <div className="flex items-center gap-1.5">
        <Skeleton className="h-5 w-5 rounded" />
        <Skeleton className="h-5 w-5 rounded" />
        <Skeleton className="h-5 w-5 rounded" />
        <Skeleton className="h-5 w-5 rounded" />
        <Skeleton className="h-5 w-5 rounded" />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  ConversationTopBarSkeleton — mirrors ConversationTopBar            */
/* ------------------------------------------------------------------ */

export function ConversationTopBarSkeleton() {
  return (
    <div className="flex h-10 items-center gap-3 border-b border-subtle bg-surface-1 px-4 shrink-0">
      <div className="relative flex items-center">
        <Skeleton className="h-6 w-6 shrink-0 rounded-full" />
        <Skeleton className="-ml-2 h-6 w-6 shrink-0 rounded-full" />
      </div>
      <Skeleton className="h-3.5 w-24" />
      <div className="flex-1" />
      <div className="flex items-center gap-1.5">
        <Skeleton className="h-5 w-5 rounded" />
        <Skeleton className="h-5 w-5 rounded" />
        <Skeleton className="h-5 w-5 rounded" />
        <Skeleton className="h-5 w-5 rounded" />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  ComposerSkeleton — mirrors RichTextComposer                        */
/* ------------------------------------------------------------------ */

export function ComposerSkeleton() {
  return (
    <div className="shrink-0 min-w-0 border-t border-subtle p-3">
      <div className="rounded border border-subtle bg-background">
        <div className="px-3 py-2">
          <Skeleton className="h-5 w-48" />
        </div>
        <div className="flex items-center justify-between border-t border-subtle px-1 py-1">
          <div className="flex items-center gap-0.5">
            <Skeleton className="h-3.5 w-3.5 rounded" />
            <Skeleton className="h-3.5 w-3.5 rounded" />
            <Skeleton className="h-3.5 w-3.5 rounded" />
            <div className="mx-1 h-4 w-px bg-primary/5" />
            <Skeleton className="h-3.5 w-3.5 rounded" />
            <Skeleton className="h-3.5 w-3.5 rounded" />
            <div className="mx-1 h-4 w-px bg-primary/5" />
            <Skeleton className="h-3.5 w-3.5 rounded" />
            <Skeleton className="h-3.5 w-3.5 rounded" />
            <div className="mx-1 h-4 w-px bg-primary/5" />
            <Skeleton className="h-3.5 w-3.5 rounded" />
            <Skeleton className="h-3.5 w-3.5 rounded" />
          </div>
          <Skeleton className="h-5 w-5 rounded" />
        </div>
      </div>
      <div className="h-5" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  ThreadContentSkeleton — mirrors ThreadPanelShell content area      */
/* ------------------------------------------------------------------ */

export function ThreadContentSkeleton() {
  return (
    <>
      <div className="pt-3">
        <MessageSkeleton />
        <div className="mx-4 my-2 flex items-center gap-2">
          <div className="h-px flex-1 bg-subtle" />
          <Skeleton className="h-3 w-12" />
          <div className="h-px flex-1 bg-subtle" />
        </div>
      </div>
      <MessageSkeleton />
      <MessageSkeleton />
      <MessageSkeleton />
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  ChannelSkeleton — full-page placeholder (legacy)                   */
/* ------------------------------------------------------------------ */

const MESSAGE_WIDTHS: [string, string][] = [
  ["w-[60%]", "w-[40%]"],
  ["w-[80%]", "w-[50%]"],
  ["w-[40%]", "w-[30%]"],
  ["w-[70%]", "w-[60%]"],
  ["w-[55%]", "w-[35%]"],
  ["w-[65%]", "w-[45%]"],
];

export function ChannelSkeleton() {
  return (
    <div className="flex h-full animate-fade-in flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-subtle px-4 py-2.5">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-48" />
      </div>

      {/* Messages */}
      <div className="flex flex-1 flex-col gap-4 overflow-hidden px-4 py-4">
        {MESSAGE_WIDTHS.map(([line1, line2], i) => (
          <div key={i} className="flex items-start gap-3">
            <Skeleton className="h-7 w-7 shrink-0 rounded-full" />
            <div className="flex flex-1 flex-col gap-1.5">
              <Skeleton className={`h-3 ${line1}`} />
              <Skeleton className={`h-2.5 ${line2}`} />
            </div>
          </div>
        ))}
      </div>

      {/* Composer */}
      <div className="border-t border-subtle px-4 py-3">
        <Skeleton className="h-9 w-full rounded-md" />
      </div>
    </div>
  );
}
