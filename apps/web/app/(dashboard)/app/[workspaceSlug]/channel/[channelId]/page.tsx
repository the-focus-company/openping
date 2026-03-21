"use client";

import { use, useEffect, useMemo, useCallback } from "react";
import { useQuery, useMutation, useConvexAuth } from "convex/react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@convex/_generated/api";
import { Id } from "@convex/_generated/dataModel";
import { MessageList, type Message } from "@/components/channel/MessageList";
import { ThreadPanel } from "@/components/channel/ThreadPanel";
import { AlertBanner } from "@/components/proactive/AlertBanner";
import { useTopBar } from "@/hooks/useTopBar";

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

interface Props {
  params: Promise<{ channelId: string }>;
}

export default function ChannelPage({ params }: Props) {
  const { channelId } = use(params);
  const typedChannelId = channelId as Id<"channels">;

  const router = useRouter();
  const searchParams = useSearchParams();
  const threadId = searchParams.get("thread") as Id<"messages"> | null;

  const { isAuthenticated } = useConvexAuth();
  const channel = useQuery(api.channels.get, isAuthenticated ? { channelId: typedChannelId } : "skip");
  const results = useQuery(
    api.messages.listByChannel,
    isAuthenticated ? { channelId: typedChannelId } : "skip",
  );
  const sendMessage = useMutation(api.messages.send);
  const markRead = useMutation(api.channels.markRead);
  const memberCount = useQuery(api.channels.memberCount, isAuthenticated ? { channelId: typedChannelId } : "skip");
  const alerts = useQuery(api.proactiveAlerts.listPending, isAuthenticated ? {} : "skip");
  const dismissAlert = useMutation(api.proactiveAlerts.dismiss);

  const { setSubtitle } = useTopBar();

  useEffect(() => {
    if (!isAuthenticated) return;
    markRead({ channelId: typedChannelId });
  }, [isAuthenticated, markRead, typedChannelId]);

  // Inject member count into TopBar
  useEffect(() => {
    if (memberCount !== undefined) {
      setSubtitle(
        <span className="rounded bg-surface-3 px-1.5 py-px text-2xs text-muted-foreground">
          {memberCount} member{memberCount !== 1 ? "s" : ""}
        </span>,
      );
    }
    return () => setSubtitle(null);
  }, [memberCount, setSubtitle]);

  const messages: Message[] = useMemo(() => {
    if (!results) return [];
    return [...results].reverse().map((msg) => ({
      id: msg._id,
      type: msg.type === "bot" ? ("bot" as const) : ("user" as const),
      author: msg.author?.name ?? "Unknown",
      authorInitials: getInitials(msg.author?.name ?? "?"),
      content: msg.body,
      timestamp: new Date(msg._creationTime),
      citations: msg.citations?.map((c) => ({
        type: "message" as const,
        label: c.sourceTitle ?? c.text,
        url: c.sourceUrl,
      })),
      botName: msg.type === "bot" ? "KnowledgeBot" : undefined,
      replyCount: msg.replyCount ?? 0,
      lastRepliers: msg.lastRepliers ?? [],
    }));
  }, [results]);

  const handleSend = (content: string) => {
    sendMessage({ channelId: typedChannelId, body: content });
  };

  const handleOpenThread = useCallback(
    (messageId: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("thread", messageId);
      router.push(`?${params.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  const handleCloseThread = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("thread");
    const qs = params.toString();
    router.push(qs ? `?${qs}` : window.location.pathname, { scroll: false });
  }, [router, searchParams]);

  const firstAlert = alerts?.[0];

  return (
    <div className="relative flex h-full">
      {/* Main channel view */}
      <div className="flex min-w-0 flex-1 flex-col">
        <MessageList
          channelName={channel?.name ?? channelId}
          messages={messages}
          onSend={handleSend}
          isLoading={results === undefined}
          onReply={handleOpenThread}
        />

        {firstAlert && (
          <AlertBanner
            title={firstAlert.title}
            description={firstAlert.body}
            actions={[
              { label: firstAlert.suggestedAction, primary: true },
            ]}
            onDismiss={() => dismissAlert({ alertId: firstAlert._id })}
          />
        )}
      </div>

      {/* Thread sidebar */}
      {threadId && (
        <div className="w-[400px] shrink-0 max-md:absolute max-md:inset-y-0 max-md:right-0 max-md:z-20 max-md:w-full max-md:shadow-xl sm:max-md:w-[360px]">
          <ThreadPanel
            channelId={typedChannelId}
            parentMessageId={threadId}
            onClose={handleCloseThread}
          />
        </div>
      )}
    </div>
  );
}
