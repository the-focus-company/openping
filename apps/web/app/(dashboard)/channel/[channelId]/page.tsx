"use client";

import { use, useCallback, useEffect, useMemo, useRef } from "react";
import { useQuery, usePaginatedQuery, useMutation, useConvexAuth } from "convex/react";
import { api } from "@convex/_generated/api";
import { Id } from "@convex/_generated/dataModel";
import { MessageList, type Message } from "@/components/channel/MessageList";
import { ChannelSkeleton } from "@/components/channel/ChannelSkeleton";
import { AlertBanner } from "@/components/proactive/AlertBanner";
import type { TypingUser } from "@/components/channel/MessageList";

const EMPTY_TYPING_USERS: TypingUser[] = [];

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

  const { isAuthenticated } = useConvexAuth();
  const channel = useQuery(api.channels.get, isAuthenticated ? { channelId: typedChannelId } : "skip");
  const { results, status, loadMore } = usePaginatedQuery(
    api.messages.list,
    isAuthenticated ? { channelId: typedChannelId } : "skip",
    { initialNumItems: 50 },
  );
  const sendMessage = useMutation(api.messages.send);
  const markRead = useMutation(api.channels.markRead);
  const memberCount = useQuery(api.channels.memberCount, isAuthenticated ? { channelId: typedChannelId } : "skip");
  const onlineUsers = useQuery(api.presence.getOnlineUsers, isAuthenticated ? {} : "skip");
  const alerts = useQuery(api.proactiveAlerts.listPending, isAuthenticated ? {} : "skip");
  const dismissAlert = useMutation(api.proactiveAlerts.dismiss);
  const setTyping = useMutation(api.typing.setTyping);
  const clearTyping = useMutation(api.typing.clearTyping);
  const typingUsers = useQuery(api.typing.getTypingUsers, isAuthenticated ? { channelId: typedChannelId } : "skip");

  // Debounce typing indicator — fire at most once per 2 seconds
  const lastTypingRef = useRef(0);
  const handleTyping = useCallback(() => {
    const now = Date.now();
    if (now - lastTypingRef.current < 2000) return;
    lastTypingRef.current = now;
    setTyping({ channelId: typedChannelId });
  }, [setTyping, typedChannelId]);

  // Mark channel as read on mount (only when authenticated)
  useEffect(() => {
    if (!isAuthenticated) return;
    markRead({ channelId: typedChannelId });
  }, [isAuthenticated, markRead, typedChannelId]);

  // Reverse results (they come desc, we display asc)
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
      integrationObject: msg.integrationObject ?? null,
    }));
  }, [results]);

  const handleSend = (content: string) => {
    sendMessage({ channelId: typedChannelId, body: content });
    clearTyping({ channelId: typedChannelId });
    lastTypingRef.current = 0;
  };

  const firstAlert = alerts?.[0];

  if (status === "LoadingFirstPage" && !channel) {
    return <ChannelSkeleton />;
  }

  return (
    <div className="relative flex h-full flex-col">
      <MessageList
        channelName={channel?.name ?? channelId}
        messages={messages}
        onSend={handleSend}
        memberCount={memberCount ?? undefined}
        onlineCount={onlineUsers?.length}
        isLoading={status === "LoadingFirstPage"}
        hasMore={status === "CanLoadMore"}
        onLoadMore={loadMore}
        typingUsers={typingUsers ?? EMPTY_TYPING_USERS}
        onTyping={handleTyping}
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
  );
}
