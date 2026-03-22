"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { X, MessageSquare } from "lucide-react";

import { useQuery, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import { Id } from "@convex/_generated/dataModel";
import { MessageItem, TypingIndicator, type Message } from "./MessageList";
import { type ReactionGroup } from "./MessageReactions";
import { RichTextComposer } from "./RichTextComposer";
import { useThreadTyping, useThreadDMTyping } from "@/hooks/useThreadTyping";
import { useReactions } from "@/hooks/useReactions";

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

interface ThreadPanelProps {
  parentMessageId: string;
  messageTable: "messages" | "directMessages";
  channelId?: string;
  conversationId?: string;
  contextName: string;
  onClose: () => void;
}

function ChannelThread({
  parentMessageId,
  channelId,
  contextName,
  onClose,
}: {
  parentMessageId: string;
  channelId: string;
  contextName: string;
  onClose: () => void;
}) {
  const threadId = parentMessageId as Id<"messages">;
  const typedChannelId = channelId as Id<"channels">;
  const data = useQuery(api.threads.listReplies, { threadId });
  const sendReply = useMutation(api.threads.sendReply);
  const editMessage = useMutation(api.messages.edit);
  const deleteMessage = useMutation(api.messages.remove);
  const { typingUsers, onTyping, onSendClear } = useThreadTyping(threadId);
  const currentUser = useQuery(api.users.getMe, {});

  const [alsoSendToChannel, setAlsoSendToChannel] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "instant" });
  }, [data?.replies.length]);

  const handleSend = useCallback((content: string) => {
    if (!content) return;
    sendReply({
      channelId: typedChannelId,
      threadId,
      body: content,
      alsoSendToChannel,
    });
    onSendClear();
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  }, [sendReply, typedChannelId, threadId, alsoSendToChannel, onSendClear]);

  const parentMessage: Message | null = data?.parent
    ? {
        id: data.parent._id,
        type: data.parent.type === "bot" ? "bot" : "user",
        authorId: data.parent.authorId,
        author: data.parent.author?.name ?? "Unknown",
        authorInitials: getInitials(data.parent.author?.name ?? "?"),
        content: data.parent.body,
        timestamp: new Date(data.parent._creationTime),
        isEdited: data.parent.isEdited,
      }
    : null;

  const replies: Message[] = (data?.replies ?? []).map((r) => ({
    id: r._id,
    type: r.type === "bot" ? "bot" : "user",
    authorId: r.authorId,
    author: r.author?.name ?? "Unknown",
    authorInitials: getInitials(r.author?.name ?? "?"),
    content: r.body,
    timestamp: new Date(r._creationTime),
    isEdited: r.isEdited,
  }));

  const allMessageIds = useMemo(() => {
    const ids: Id<"messages">[] = [];
    if (parentMessage) ids.push(parentMessage.id as Id<"messages">);
    for (const r of replies) ids.push(r.id as Id<"messages">);
    return ids;
  }, [parentMessage, replies]);

  const { reactionsByMessage, toggleReaction } = useReactions({
    messageIds: allMessageIds,
    enabled: true,
  });

  const handleEditMessage = useCallback((messageId: string, newBody: string) => {
    editMessage({ messageId: messageId as Id<"messages">, body: newBody });
  }, [editMessage]);

  const handleDeleteMessage = useCallback((messageId: string) => {
    deleteMessage({ messageId: messageId as Id<"messages"> });
  }, [deleteMessage]);

  return (
    <ThreadPanelShell
      contextName={contextName}
      contextPrefix="#"
      onClose={onClose}
      replyCount={replies.length}
      parentMessage={parentMessage}
      replies={replies}
      typingUsers={typingUsers}
      onTyping={onTyping}
      onSend={handleSend}
      bottomRef={bottomRef}
      alsoSendTo={alsoSendToChannel}
      setAlsoSendTo={setAlsoSendToChannel}
      alsoSendLabel={`Also send to #${contextName}`}
      onToggleReaction={toggleReaction}
      currentUserId={currentUser?._id}
      reactionsByMessage={reactionsByMessage}
      onEditMessage={handleEditMessage}
      onDeleteMessage={handleDeleteMessage}
    />
  );
}

function DMThread({
  parentMessageId,
  conversationId,
  contextName,
  onClose,
}: {
  parentMessageId: string;
  conversationId: string;
  contextName: string;
  onClose: () => void;
}) {
  const threadId = parentMessageId as Id<"directMessages">;
  const typedConversationId = conversationId as Id<"directConversations">;
  const data = useQuery(api.threads.listRepliesDM, { threadId });
  const sendReply = useMutation(api.threads.sendReplyDM);
  const editMessage = useMutation(api.directMessages.edit);
  const deleteMessage = useMutation(api.directMessages.remove);
  const { typingUsers, onTyping, onSendClear } = useThreadDMTyping(threadId);
  const currentUser = useQuery(api.users.getMe, {});

  const [alsoSendToConversation, setAlsoSendToConversation] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "instant" });
  }, [data?.replies.length]);

  const handleSend = useCallback((content: string) => {
    if (!content) return;
    sendReply({
      conversationId: typedConversationId,
      threadId,
      body: content,
      alsoSendToConversation,
    });
    onSendClear();
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  }, [sendReply, typedConversationId, threadId, alsoSendToConversation, onSendClear]);

  const parentMessage: Message | null = data?.parent
    ? {
        id: data.parent._id,
        type: data.parent.type === "bot" ? "bot" : "user",
        authorId: data.parent.authorId,
        author: data.parent.author?.name ?? "Unknown",
        authorInitials: getInitials(data.parent.author?.name ?? "?"),
        content: data.parent.body,
        timestamp: new Date(data.parent._creationTime),
        isEdited: data.parent.isEdited,
      }
    : null;

  const replies: Message[] = (data?.replies ?? []).map((r) => ({
    id: r._id,
    type: r.type === "bot" ? "bot" : "user",
    authorId: r.authorId,
    author: r.author?.name ?? "Unknown",
    authorInitials: getInitials(r.author?.name ?? "?"),
    content: r.body,
    timestamp: new Date(r._creationTime),
    isEdited: r.isEdited,
  }));

  const handleEditMessage = useCallback((messageId: string, newBody: string) => {
    editMessage({ messageId: messageId as Id<"directMessages">, body: newBody });
  }, [editMessage]);

  const handleDeleteMessage = useCallback((messageId: string) => {
    deleteMessage({ messageId: messageId as Id<"directMessages"> });
  }, [deleteMessage]);

  return (
    <ThreadPanelShell
      contextName={contextName}
      contextPrefix=""
      onClose={onClose}
      replyCount={replies.length}
      parentMessage={parentMessage}
      replies={replies}
      typingUsers={typingUsers}
      onTyping={onTyping}
      onSend={handleSend}
      bottomRef={bottomRef}
      alsoSendTo={alsoSendToConversation}
      setAlsoSendTo={setAlsoSendToConversation}
      alsoSendLabel={`Also send to ${contextName}`}
      currentUserId={currentUser?._id}
      onEditMessage={handleEditMessage}
      onDeleteMessage={handleDeleteMessage}
    />
  );
}

function ThreadPanelShell({
  contextName,
  contextPrefix,
  onClose,
  replyCount,
  parentMessage,
  replies,
  typingUsers,
  onTyping,
  onSend,
  bottomRef,
  alsoSendTo,
  setAlsoSendTo,
  alsoSendLabel,
  onToggleReaction,
  currentUserId,
  reactionsByMessage,
  onEditMessage,
  onDeleteMessage,
}: {
  contextName: string;
  contextPrefix: string;
  onClose: () => void;
  replyCount: number;
  parentMessage: Message | null;
  replies: Message[];
  typingUsers: Array<{ _id: string; name: string; avatarUrl?: string | null }>;
  onTyping: () => void;
  onSend: (content: string) => void;
  bottomRef: React.RefObject<HTMLDivElement | null>;
  alsoSendTo: boolean;
  setAlsoSendTo: (v: boolean) => void;
  alsoSendLabel: string;
  onToggleReaction?: (messageId: string, emoji: string) => void;
  currentUserId?: string;
  reactionsByMessage?: Record<string, Array<ReactionGroup>>;
  onEditMessage?: (messageId: string, newBody: string) => void;
  onDeleteMessage?: (messageId: string) => void;
}) {
  // Track new replies for animation
  const prevReplyCountRef = useRef(replies.length);
  const [newReplyId, setNewReplyId] = useState<string | null>(null);

  useEffect(() => {
    const prev = prevReplyCountRef.current;
    prevReplyCountRef.current = replies.length;
    if (replies.length > prev && prev > 0) {
      const last = replies[replies.length - 1];
      if (last) {
        setNewReplyId(last.id);
        setTimeout(() => setNewReplyId(null), 600);
      }
    }
  }, [replies.length, replies]);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div
        className="flex h-10 items-center justify-between border-b border-subtle bg-surface-1 px-4 shrink-0"
      >
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-foreground" />
          <span className="text-sm font-semibold text-foreground">Thread</span>
          <span className="text-2xs text-muted-foreground">
            in {contextPrefix}{contextName}
          </span>
        </div>
        <button
          onClick={onClose}
          className="rounded p-1 text-muted-foreground transition-colors hover:bg-surface-3 hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Thread content */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {/* Parent message */}
        {parentMessage && (
          <>
            <MessageItem
              message={reactionsByMessage?.[parentMessage.id] ? { ...parentMessage, reactions: reactionsByMessage[parentMessage.id] } : parentMessage}
              showAvatar
              onToggleReaction={onToggleReaction}
              currentUserId={currentUserId}
              onEditMessage={onEditMessage}
              onDeleteMessage={onDeleteMessage}
            />
            <div className="mx-4 my-2 flex items-center gap-2">
              <div className="h-px flex-1 bg-subtle" />
              <span className="text-2xs text-muted-foreground">
                {replyCount} {replyCount === 1 ? "reply" : "replies"}
              </span>
              <div className="h-px flex-1 bg-subtle" />
            </div>
          </>
        )}

        {/* Replies */}
        {replies.map((reply, i) => {
          const prev = replies[i - 1];
          const showAvatar =
            !prev ||
            prev.authorId !== reply.authorId ||
            reply.timestamp.getTime() - prev.timestamp.getTime() > 5 * 60 * 1000;
          const replyWithReactions = reactionsByMessage?.[reply.id]
            ? { ...reply, reactions: reactionsByMessage[reply.id] }
            : reply;
          return (
            <div key={reply.id} className={reply.id === newReplyId ? "animate-message-in" : undefined}>
              <MessageItem
                message={replyWithReactions}
                showAvatar={showAvatar}
                onToggleReaction={onToggleReaction}
                currentUserId={currentUserId}
                onEditMessage={onEditMessage}
                onDeleteMessage={onDeleteMessage}
              />
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Typing indicator */}
      <TypingIndicator users={typingUsers} />

      {/* Composer */}
      <div className="border-t border-subtle p-3">
        <RichTextComposer
          placeholder="Reply..."
          onSend={onSend}
          onTyping={onTyping}
        />
        <p className="mt-1 h-4 text-2xs leading-4 text-foreground/40">
          <label className="inline-flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={alsoSendTo}
              onChange={(e) => setAlsoSendTo(e.target.checked)}
              className="h-3 w-3 rounded border-subtle accent-ping-purple"
            />
            {alsoSendLabel}
          </label>
        </p>
      </div>
    </div>
  );
}

export function ThreadPanel({
  parentMessageId,
  messageTable,
  channelId,
  conversationId,
  contextName,
  onClose,
}: ThreadPanelProps) {
  if (messageTable === "messages" && channelId) {
    return (
      <ChannelThread
        parentMessageId={parentMessageId}
        channelId={channelId}
        contextName={contextName}
        onClose={onClose}
      />
    );
  }

  if (messageTable === "directMessages" && conversationId) {
    return (
      <DMThread
        parentMessageId={parentMessageId}
        conversationId={conversationId}
        contextName={contextName}
        onClose={onClose}
      />
    );
  }

  return null;
}
