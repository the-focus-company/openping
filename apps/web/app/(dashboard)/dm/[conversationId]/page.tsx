"use client";

import { use, useEffect, useMemo } from "react";
import { useQuery, usePaginatedQuery, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import { Id } from "@convex/_generated/dataModel";
import { MessageList, type Message } from "@/components/channel/MessageList";
import { GroupChatHeader } from "@/components/channel/GroupChatHeader";
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
  params: Promise<{ conversationId: string }>;
}

export default function DMPage({ params }: Props) {
  const { conversationId } = use(params);
  const typedId = conversationId as Id<"directConversations">;

  const conversation = useQuery(api.directConversations.get, {
    conversationId: typedId,
  });
  const { results, status } = usePaginatedQuery(
    api.directMessages.list,
    { conversationId: typedId },
    { initialNumItems: 50 },
  );
  const sendMessage = useMutation(api.directMessages.send);
  const markRead = useMutation(api.directConversations.markRead);
  const currentUser = useQuery(api.users.getMe);

  // Mark as read on mount
  useEffect(() => {
    markRead({ conversationId: typedId });
  }, [markRead, typedId]);

  const messages: Message[] = useMemo(() => {
    if (!results) return [];
    return [...results].reverse().map((msg) => ({
      id: msg._id,
      type: msg.type === "bot" ? ("bot" as const) : ("user" as const),
      author: msg.author?.name ?? "Unknown",
      authorInitials: getInitials(msg.author?.name ?? "?"),
      content: msg.body,
      timestamp: new Date(msg._creationTime),
      botName: msg.isAgent ? msg.author?.name ?? "Agent" : undefined,
    }));
  }, [results]);

  const handleSend = (content: string) => {
    sendMessage({ conversationId: typedId, body: content });
  };

  // Build display name
  const otherMembers =
    conversation?.members.filter((m) => m.userId !== currentUser?._id) ?? [];
  const displayName =
    conversation?.name ||
    otherMembers.map((m) => m.name).join(", ") ||
    "Conversation";

  if (status === "LoadingFirstPage") {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-white/20" />
      </div>
    );
  }

  const isGroup = conversation?.kind === "group" || conversation?.kind === "agent_group";

  return (
    <div className="relative flex h-full flex-col">
      {isGroup && otherMembers.length > 0 && (
        <GroupChatHeader members={otherMembers} name={displayName} />
      )}
      <MessageList
        channelName={displayName}
        messages={messages}
        onSend={handleSend}
        isDM
      />
    </div>
  );
}
