"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { X, Send, Bot } from "lucide-react";
import { useQuery, useMutation, useConvexAuth } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

interface ThreadMessageProps {
  author: { name: string; avatarUrl?: string } | null;
  body: string;
  type: string;
  creationTime: number;
  showAvatar: boolean;
  isParent?: boolean;
}

function ThreadMessage({
  author,
  body,
  type,
  creationTime,
  showAvatar,
  isParent,
}: ThreadMessageProps) {
  const isBot = type === "bot";
  const authorName = author?.name ?? "Unknown";

  return (
    <div
      className={cn(
        "flex gap-3 px-4 py-1.5 transition-colors hover:bg-surface-2/60",
        showAvatar ? "mt-3" : "mt-0",
        isParent && "border-b border-subtle pb-3",
      )}
    >
      {/* Avatar column */}
      <div className="w-6 shrink-0 pt-0.5">
        {showAvatar ? (
          <Avatar className="h-6 w-6">
            <AvatarFallback
              className={cn(
                "text-2xs font-medium",
                isBot
                  ? "bg-ping-purple/20 text-ping-purple"
                  : "bg-surface-3 text-foreground",
              )}
            >
              {isBot ? <Bot className="h-3 w-3" /> : getInitials(authorName)}
            </AvatarFallback>
          </Avatar>
        ) : null}
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        {showAvatar && (
          <div className="flex items-baseline gap-2 pb-0.5">
            <span
              className={cn(
                "text-xs font-semibold",
                isBot ? "text-ping-purple" : "text-foreground",
              )}
            >
              {isBot ? "KnowledgeBot" : authorName}
            </span>
            {isBot && (
              <span className="rounded border border-ping-purple/30 bg-ping-purple/10 px-1 py-px text-2xs text-ping-purple">
                AI
              </span>
            )}
            <span className="text-2xs text-white/25">
              {new Date(creationTime).toLocaleTimeString("en-US", {
                hour: "2-digit",
                minute: "2-digit",
                hour12: false,
              })}
            </span>
          </div>
        )}

        <div
          className={cn(
            "text-sm leading-relaxed",
            isBot ? "text-foreground" : "text-foreground/90",
          )}
        >
          {body}
        </div>
      </div>
    </div>
  );
}

function ThreadSkeleton() {
  return (
    <div className="space-y-4 p-4">
      <div className="flex gap-3">
        <Skeleton className="h-6 w-6 shrink-0 rounded-full" />
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-3.5 w-full" />
          <Skeleton className="h-3.5 w-2/3" />
        </div>
      </div>
      <div className="border-t border-subtle pt-4">
        <Skeleton className="mb-2 h-3 w-16" />
        <div className="flex gap-3">
          <Skeleton className="h-6 w-6 shrink-0 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3.5 w-3/4" />
          </div>
        </div>
      </div>
    </div>
  );
}

interface ThreadPanelProps {
  channelId: Id<"channels">;
  parentMessageId: Id<"messages">;
  onClose: () => void;
}

export function ThreadPanel({
  channelId,
  parentMessageId,
  onClose,
}: ThreadPanelProps) {
  const { isAuthenticated } = useConvexAuth();
  const threadData = useQuery(
    api.messages.listThread,
    isAuthenticated ? { parentMessageId } : "skip",
  );
  const sendMessage = useMutation(api.messages.send);

  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const prevReplyCountRef = useRef(0);

  const isLoading = threadData === undefined;

  // Auto-scroll when new replies arrive
  useEffect(() => {
    if (!threadData) return;
    const newCount = threadData.replies.length;
    if (newCount > prevReplyCountRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
    prevReplyCountRef.current = newCount;
  }, [threadData]);

  // Initial scroll to bottom
  useEffect(() => {
    if (!isLoading) {
      bottomRef.current?.scrollIntoView({ behavior: "instant" });
    }
  }, [isLoading]);

  const handleSend = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed) return;
    sendMessage({
      channelId,
      body: trimmed,
      threadParentId: parentMessageId,
    });
    setInput("");
    setTimeout(
      () => bottomRef.current?.scrollIntoView({ behavior: "smooth" }),
      50,
    );
  }, [input, sendMessage, channelId, parentMessageId]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    if (e.key === "Escape") {
      onClose();
    }
  };

  return (
    <div className="flex h-full flex-col border-l border-subtle bg-surface-1">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-subtle px-4 py-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-foreground">Thread</span>
          {threadData && (
            <span className="rounded bg-surface-3 px-1.5 py-px text-2xs text-muted-foreground">
              {threadData.replyCount}{" "}
              {threadData.replyCount === 1 ? "reply" : "replies"}
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          className="rounded p-1 text-muted-foreground transition-colors hover:bg-surface-3 hover:text-foreground"
          title="Close thread"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Thread content */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {isLoading ? (
          <ThreadSkeleton />
        ) : (
          <>
            {/* Parent message */}
            <ThreadMessage
              author={threadData.parent.author}
              body={threadData.parent.body}
              type={threadData.parent.type}
              creationTime={threadData.parent._creationTime}
              showAvatar
              isParent
            />

            {/* Reply count label */}
            {threadData.replies.length > 0 && (
              <div className="px-4 pt-2">
                <span className="text-2xs font-medium text-muted-foreground">
                  {threadData.replyCount}{" "}
                  {threadData.replyCount === 1 ? "reply" : "replies"}
                </span>
              </div>
            )}

            {/* Replies */}
            {threadData.replies.map((reply, i) => {
              const prev = threadData.replies[i - 1];
              const showAvatar =
                !prev ||
                prev.authorId !== reply.authorId ||
                reply._creationTime - prev._creationTime > 5 * 60 * 1000;

              return (
                <ThreadMessage
                  key={reply._id}
                  author={reply.author}
                  body={reply.body}
                  type={reply.type}
                  creationTime={reply._creationTime}
                  showAvatar={showAvatar}
                />
              );
            })}

            <div ref={bottomRef} />
          </>
        )}
      </div>

      {/* Thread composer */}
      <div className="border-t border-subtle p-3">
        <div className="flex items-end gap-2 rounded border border-subtle bg-surface-2 px-3 py-2 focus-within:border-white/15">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Reply..."
            rows={1}
            className="max-h-32 flex-1 resize-none bg-transparent text-sm text-foreground placeholder:text-white/25 focus:outline-none"
            style={{ height: "20px" }}
            onInput={(e) => {
              const el = e.currentTarget;
              el.style.height = "20px";
              el.style.height = `${el.scrollHeight}px`;
            }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim()}
            className={cn(
              "shrink-0 rounded p-1 transition-colors",
              input.trim()
                ? "bg-ping-purple text-white hover:bg-ping-purple-hover"
                : "text-white/20",
            )}
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        </div>
        <p className="mt-1 text-2xs text-white/20">
          Enter to send · Shift+Enter for new line · Esc to close
        </p>
      </div>
    </div>
  );
}
