"use client";

import { use, useCallback, useEffect, useMemo } from "react";
import { useQuery, usePaginatedQuery, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import { Id } from "@convex/_generated/dataModel";
import { MessageList, type Message } from "@/components/channel/MessageList";
import { GroupChatHeader } from "@/components/channel/GroupChatHeader";
import { Loader2 } from "lucide-react";
import { useDMTyping } from "@/hooks/useTyping";
import { useThreadPanel } from "@/hooks/useThreadPanel";

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
  const editMessage = useMutation(api.directMessages.edit);
  const deleteMessage = useMutation(api.directMessages.remove);
  const markRead = useMutation(api.directConversations.markRead);
  const currentUser = useQuery(api.users.getMe);
  const { typingUsers, onTyping, onSendClear } = useDMTyping(typedId);
  const { openThreadPanel, closeThreadPanel } = useThreadPanel();

  // Mark as read on mount
  useEffect(() => {
    markRead({ conversationId: typedId });
  }, [markRead, typedId]);

  // Close thread panel when navigating to a different conversation
  useEffect(() => {
    closeThreadPanel();
  }, [conversationId, closeThreadPanel]);

  const messages: Message[] = useMemo(() => {
    if (!results) return [];
    return [...results].reverse().map((msg) => ({
      id: msg._id,
      type: msg.type === "bot" ? ("bot" as const) : ("user" as const),
      authorId: msg.authorId,
      author: msg.author?.name ?? "Unknown",
      authorInitials: getInitials(msg.author?.name ?? "?"),
      content: msg.body,
      timestamp: new Date(msg._creationTime),
      botName: msg.isAgent ? msg.author?.name ?? "Agent" : undefined,
      threadReplyCount: msg.threadReplyCount,
      threadLastReplyAt: msg.threadLastReplyAt,
      threadParticipants: msg.threadParticipants,
      threadId: msg.threadId,
      alsoSentToChannel: msg.alsoSentToConversation,
      isEdited: msg.isEdited,
    }));
  }, [results]);

  const handleSend = (
    content: string,
    attachments?: { storageId: string; filename: string; mimeType: string; size: number }[],
  ) => {
    sendMessage({
      conversationId: typedId,
      body: content,
      ...(attachments ? { attachments } : {}),
    });
    onSendClear();
  };

  // Build display name
  const otherMembers =
    conversation?.members.filter((m) => m.userId !== currentUser?._id) ?? [];
  const displayName =
    conversation?.name ||
    otherMembers.map((m) => m.name).join(", ") ||
    "Conversation";

  const handleEditMessage = useCallback((messageId: string, newBody: string) => {
    editMessage({ messageId: messageId as Id<"directMessages">, body: newBody });
  }, [editMessage]);

  const handleDeleteMessage = useCallback((messageId: string) => {
    deleteMessage({ messageId: messageId as Id<"directMessages"> });
  }, [deleteMessage]);

  const handleOpenThread = useCallback(
    (messageId: string) => {
      openThreadPanel({
        parentMessageId: messageId,
        messageTable: "directMessages",
        conversationId,
        contextName: displayName,
      });
    },
    [openThreadPanel, conversationId, displayName],
  );

  if (status === "LoadingFirstPage") {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-foreground/20" />
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
        typingUsers={typingUsers}
        onTyping={onTyping}
        onOpenThread={handleOpenThread}
        currentUserId={currentUser?._id}
        onEditMessage={handleEditMessage}
        onDeleteMessage={handleDeleteMessage}
      />
    </div>
  );
}
