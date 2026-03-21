"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Send, Bot, Paperclip, AtSign, ChevronDown, Pin, Users } from "lucide-react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { CitationRow, type Citation } from "@/components/bot/CitationPill";
import { cn } from "@/lib/utils";

export interface Message {
  id: string;
  type: "user" | "bot";
  author: string;
  authorInitials: string;
  content: string;
  timestamp: Date;
  citations?: Citation[];
  botName?: string;
}

interface MessageItemProps {
  message: Message;
  showAvatar: boolean;
}

export function MessageItem({ message, showAvatar }: MessageItemProps) {
  const isBot = message.type === "bot";

  return (
    <div
      className={cn(
        "group flex gap-3 px-4 py-1.5 transition-colors hover:bg-surface-2/60",
        showAvatar ? "mt-3" : "mt-0"
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
                  : "bg-surface-3 text-foreground"
              )}
            >
              {isBot ? <Bot className="h-3 w-3" /> : message.authorInitials}
            </AvatarFallback>
          </Avatar>
        ) : null}
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        {showAvatar && (
          <div className="flex items-baseline gap-2 pb-0.5">
            <span className={cn("text-xs font-semibold", isBot ? "text-ping-purple" : "text-foreground")}>
              {isBot ? message.botName || "KnowledgeBot" : message.author}
            </span>
            {isBot && (
              <span className="rounded border border-ping-purple/30 bg-ping-purple/10 px-1 py-px text-2xs text-ping-purple">
                AI
              </span>
            )}
            <span className="text-2xs text-white/25">
              {message.timestamp.toLocaleTimeString("en-US", {
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
            isBot ? "text-foreground" : "text-foreground/90"
          )}
        >
          {message.content}
        </div>

        {message.citations && (
          <CitationRow citations={message.citations} />
        )}
      </div>
    </div>
  );
}

function MessageSkeleton() {
  return (
    <div className="flex gap-3 px-4 py-1.5 mt-3">
      <Skeleton className="h-6 w-6 shrink-0 rounded-full" />
      <div className="flex-1 space-y-1.5">
        <div className="flex items-center gap-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-10" />
        </div>
        <Skeleton className="h-3.5 w-3/4" />
        <Skeleton className="h-3.5 w-1/2" />
      </div>
    </div>
  );
}

export interface TypingUser {
  _id: string;
  name: string;
  avatarUrl?: string | null;
}

function TypingIndicator({ users }: { users: TypingUser[] }) {
  if (users.length === 0) return null;

  const label =
    users.length === 1
      ? `${users[0].name} is typing`
      : users.length === 2
        ? `${users[0].name} and ${users[1].name} are typing`
        : `${users[0].name} and ${users.length - 1} others are typing`;

  return (
    <div className="flex items-center gap-2 px-4 py-1 text-2xs text-muted-foreground">
      <span className="inline-flex gap-0.5">
        <span className="animate-bounce [animation-delay:0ms]">·</span>
        <span className="animate-bounce [animation-delay:150ms]">·</span>
        <span className="animate-bounce [animation-delay:300ms]">·</span>
      </span>
      <span>{label}</span>
    </div>
  );
}

interface MessageListProps {
  channelName: string;
  messages: Message[];
  onSend?: (content: string) => void;
  isLoading?: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
  /** When true, renders a DM-style composer (no # prefix, no toolbar) */
  isDM?: boolean;
  /** Users currently typing */
  typingUsers?: TypingUser[];
  /** Called on input keystrokes for typing indicator */
  onTyping?: () => void;
}

export function MessageList({
  channelName,
  messages,
  onSend,
  isLoading,
  hasMore,
  onLoadMore,
  isDM = false,
  typingUsers = [],
  onTyping,
}: MessageListProps) {
  const [input, setInput] = useState("");
  const [showNewMessages, setShowNewMessages] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const prevMessageCountRef = useRef(messages.length);
  const hasInitiallyScrolledRef = useRef(false);

  // Pre-compute which messages should show avatars so the virtualizer can use it
  const showAvatarFlags = useMemo(() => {
    return messages.map((msg, i) => {
      const prev = messages[i - 1];
      return (
        !prev ||
        prev.author !== msg.author ||
        msg.timestamp.getTime() - prev.timestamp.getTime() > 5 * 60 * 1000
      );
    });
  }, [messages]);

  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (index) => {
      // Messages with avatars are taller due to the author header and top margin
      return showAvatarFlags[index] ? 64 : 32;
    },
    overscan: 20,
  });

  const isAtBottom = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  }, []);

  const scrollToBottom = useCallback(
    (behavior: ScrollBehavior = "smooth") => {
      if (messages.length === 0) return;
      virtualizer.scrollToIndex(messages.length - 1, {
        align: "end",
        behavior,
      });
    },
    [virtualizer, messages.length]
  );

  // Auto-scroll when new messages arrive (only if already at bottom)
  useEffect(() => {
    const newCount = messages.length;
    const prevCount = prevMessageCountRef.current;
    prevMessageCountRef.current = newCount;

    if (newCount > prevCount) {
      if (isAtBottom()) {
        scrollToBottom("smooth");
        setShowNewMessages(false);
      } else {
        setShowNewMessages(true);
      }
    }
  }, [messages, isAtBottom, scrollToBottom]);

  // Initial scroll to bottom once loading completes
  useEffect(() => {
    if (!isLoading && messages.length > 0 && !hasInitiallyScrolledRef.current) {
      hasInitiallyScrolledRef.current = true;
      // Use requestAnimationFrame to ensure the virtualizer has rendered
      requestAnimationFrame(() => {
        scrollToBottom("instant");
      });
    }
  }, [isLoading, messages.length, scrollToBottom]);

  const handleScrollToBottom = () => {
    scrollToBottom("smooth");
    setShowNewMessages(false);
  };

  const handleScroll = () => {
    if (isAtBottom()) setShowNewMessages(false);
  };

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    onSend?.(trimmed);
    setInput("");
    // Scroll to bottom after send
    setTimeout(() => scrollToBottom("smooth"), 50);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const virtualItems = virtualizer.getVirtualItems();

  return (
    <div className="flex h-full flex-col">
      {/* Utility toolbar — channels only */}
      {!isDM && (
        <div className="flex items-center gap-1 border-b border-subtle px-3 py-1">
          <button className="flex items-center gap-1.5 rounded px-2 py-1 text-2xs text-muted-foreground transition-colors hover:bg-surface-3 hover:text-foreground">
            <Pin className="h-3 w-3" />
            Pinned
          </button>
          <button className="flex items-center gap-1.5 rounded px-2 py-1 text-2xs text-muted-foreground transition-colors hover:bg-surface-3 hover:text-foreground">
            <Bot className="h-3 w-3" />
            Agents
          </button>
          <button className="flex items-center gap-1.5 rounded px-2 py-1 text-2xs text-muted-foreground transition-colors hover:bg-surface-3 hover:text-foreground">
            <Users className="h-3 w-3" />
            Members
          </button>
        </div>
      )}

      {/* Messages */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="relative flex-1 overflow-y-auto py-2 scrollbar-thin"
      >
        {/* Load more */}
        {hasMore && (
          <div className="flex justify-center py-2">
            <button
              onClick={onLoadMore}
              className="rounded px-3 py-1 text-2xs text-muted-foreground transition-colors hover:bg-surface-3 hover:text-foreground"
            >
              Load earlier messages
            </button>
          </div>
        )}

        {/* Skeletons */}
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => <MessageSkeleton key={i} />)
        ) : (
          <div
            style={{
              height: `${virtualizer.getTotalSize()}px`,
              width: "100%",
              position: "relative",
            }}
          >
            {virtualItems.map((virtualRow) => {
              const msg = messages[virtualRow.index];
              const showAvatar = showAvatarFlags[virtualRow.index];

              return (
                <div
                  key={msg.id}
                  data-index={virtualRow.index}
                  ref={virtualizer.measureElement}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  <MessageItem message={msg} showAvatar={showAvatar} />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* New messages pill */}
      {showNewMessages && (
        <div className="absolute bottom-20 left-1/2 z-10 -translate-x-1/2">
          <button
            onClick={handleScrollToBottom}
            className="flex items-center gap-1.5 rounded-full border border-subtle bg-surface-2 px-3 py-1.5 text-xs font-medium text-foreground shadow-lg transition-colors hover:bg-surface-3"
          >
            <ChevronDown className="h-3 w-3" />
            New messages
          </button>
        </div>
      )}

      {/* Typing indicator */}
      <TypingIndicator users={typingUsers} />

      {/* Composer */}
      <div className="border-t border-subtle p-3">
        <div className="flex items-end gap-2 rounded border border-subtle bg-surface-2 px-3 py-2 focus-within:border-white/15">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              onTyping?.();
            }}
            onKeyDown={handleKeyDown}
            placeholder={isDM ? `Message ${channelName}...` : `Message #${channelName}... or @KnowledgeBot`}
            rows={1}
            className="max-h-32 flex-1 resize-none bg-transparent text-sm text-foreground placeholder:text-white/25 focus:outline-none"
            style={{ height: "20px" }}
            onInput={(e) => {
              const el = e.currentTarget;
              el.style.height = "20px";
              el.style.height = `${el.scrollHeight}px`;
            }}
          />
          <div className="flex shrink-0 items-center gap-1 pb-0.5">
            {!isDM && (
              <button
                onClick={() => {
                  setInput((prev) => prev + "@");
                  textareaRef.current?.focus();
                }}
                className="rounded p-1 text-white/25 hover:bg-surface-3 hover:text-white/60"
              >
                <AtSign className="h-3.5 w-3.5" />
              </button>
            )}
            <button
              disabled
              title="File attachments coming soon"
              className="rounded p-1 text-white/25 opacity-50 cursor-not-allowed"
            >
              <Paperclip className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={handleSend}
              disabled={!input.trim()}
              className={cn(
                "rounded p-1 transition-colors",
                input.trim()
                  ? "bg-ping-purple text-white hover:bg-ping-purple-hover"
                  : "text-white/20"
              )}
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
        <p className="mt-1 text-2xs text-white/20">
          Enter to send · Shift+Enter for new line{!isDM && " · @mention to summon agents"}
        </p>
      </div>
    </div>
  );
}
