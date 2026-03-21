"use client";

import { use, useEffect, useMemo } from "react";
import { useQuery, usePaginatedQuery, useMutation, useConvexAuth } from "convex/react";
import { api } from "@convex/_generated/api";
import { Id } from "@convex/_generated/dataModel";
import { MessageList, type Message } from "@/components/channel/MessageList";
import { AlertBanner } from "@/components/proactive/AlertBanner";
import { Loader2 } from "lucide-react";

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
  const alerts = useQuery(api.proactiveAlerts.listPending, isAuthenticated ? {} : "skip");
  const dismissAlert = useMutation(api.proactiveAlerts.dismiss);

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
    }));
  }, [results]);

  const handleSend = (content: string) => {
    sendMessage({ channelId: typedChannelId, body: content });
  };

  const firstAlert = alerts?.[0];

  if (status === "LoadingFirstPage") {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-white/20" />
      </div>
    );
  }

  return (
    <div className="relative flex h-full flex-col">
      <MessageList
        channelName={channel?.name ?? channelId}
        messages={messages}
        onSend={handleSend}
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
