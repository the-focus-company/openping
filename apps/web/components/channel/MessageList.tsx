"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Bot, ChevronDown, Pin, Users, MessageSquare, SmilePlus, Pencil, Trash2 } from "lucide-react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { RichTextComposer, type RichTextComposerHandle } from "@/components/channel/RichTextComposer";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { CitationRow, type Citation } from "@/components/bot/CitationPill";
import { MessageReactions, EmojiPickerPopover, type ReactionGroup } from "@/components/channel/MessageReactions";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { MarkdownContent } from "@/components/channel/MarkdownContent";
import { cn, avatarGradient, formatRelativeTime } from "@/lib/utils";

export interface Message {
  id: string;
  type: "user" | "bot";
  authorId: string;
  author: string;
  authorInitials: string;
  content: string;
  timestamp: Date;
  citations?: Citation[];
  botName?: string;
  threadReplyCount?: number;
  threadLastReplyAt?: number;
  threadParticipants?: Array<{ _id: string; name: string; avatarUrl?: string | null }>;
  threadId?: string;
  alsoSentToChannel?: boolean;
  reactions?: ReactionGroup[];
  isEdited?: boolean;
}

interface MessageItemProps {
  message: Message;
  showAvatar: boolean;
  onOpenThread?: (messageId: string) => void;
  onToggleReaction?: (messageId: string, emoji: string) => void;
  currentUserId?: string;
  onEditMessage?: (messageId: string, newBody: string) => void;
  onDeleteMessage?: (messageId: string) => void;
}

export function MessageItem({ message, showAvatar, onOpenThread, onToggleReaction, currentUserId, onEditMessage, onDeleteMessage }: MessageItemProps) {
  const isBot = message.type === "bot";
  const hasThread = (message.threadReplyCount ?? 0) > 0;
  const isThreadReplyInFeed = message.threadId && message.alsoSentToChannel;
  const isOwnUserMessage = currentUserId === message.authorId && message.type === "user";
  const showActionBar = onOpenThread || onToggleReaction || isOwnUserMessage;

  const [isEditing, setIsEditing] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);

  const handleSaveEdit = useCallback((newContent: string) => {
    if (!newContent || newContent === message.content) {
      setIsEditing(false);
      return;
    }
    onEditMessage?.(message.id, newContent);
    setIsEditing(false);
  }, [message.id, message.content, onEditMessage]);

  return (
    <div
      className={cn(
        "group relative flex gap-3 px-4 py-1.5 transition-colors hover:bg-surface-2/60",
        showAvatar ? "mt-3" : "mt-0"
      )}
    >
      {/* Hover action bar */}
      {showActionBar && !isEditing && (
        <div className={cn(
          "absolute -top-2 right-4 z-10 rounded border border-subtle bg-surface-2 shadow-sm",
          emojiPickerOpen ? "flex" : "hidden group-hover:flex"
        )}>
          {onToggleReaction && (
            <EmojiPickerPopover onSelect={(emoji) => onToggleReaction(message.id, emoji)} onOpenChange={setEmojiPickerOpen}>
              <button
                className="flex items-center gap-1 px-2 py-1 text-2xs text-muted-foreground transition-colors hover:bg-surface-3 hover:text-foreground"
                title="Add reaction"
              >
                <SmilePlus className="h-3 w-3" />
              </button>
            </EmojiPickerPopover>
          )}
          {onOpenThread && (
            <button
              onClick={() => onOpenThread(message.threadId ?? message.id)}
              className="flex items-center gap-1 px-2 py-1 text-2xs text-muted-foreground transition-colors hover:bg-surface-3 hover:text-foreground"
              title="Reply in thread"
            >
              <MessageSquare className="h-3 w-3" />
            </button>
          )}
          {isOwnUserMessage && onEditMessage && (
            <button
              onClick={() => setIsEditing(true)}
              className="flex items-center gap-1 px-2 py-1 text-2xs text-muted-foreground transition-colors hover:bg-surface-3 hover:text-foreground"
              title="Edit message"
            >
              <Pencil className="h-3 w-3" />
            </button>
          )}
          {isOwnUserMessage && onDeleteMessage && (
            <button
              onClick={() => setDeleteDialogOpen(true)}
              className="flex items-center gap-1 px-2 py-1 text-2xs text-muted-foreground transition-colors hover:bg-surface-3 hover:text-destructive"
              title="Delete message"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          )}
        </div>
      )}

      {/* Avatar column */}
      <div className="w-6 shrink-0 pt-0.5">
        {showAvatar && (
          <Avatar className="h-6 w-6">
            <AvatarFallback
              className={cn(
                "text-2xs font-medium",
                isBot
                  ? "bg-ping-purple/20 text-ping-purple"
                  : `bg-gradient-to-br ${avatarGradient(message.authorId + message.authorInitials)} text-white`
              )}
            >
              {isBot ? <Bot className="h-3 w-3" /> : message.authorInitials}
            </AvatarFallback>
          </Avatar>
        )}
      </div>
      {/* Hover timestamp — absolute so it never affects row height */}
      {!showAvatar && (
        <span className="pointer-events-none absolute left-0 top-[8px] w-[calc(1rem+24px+0.75rem)] select-none text-center text-[10px] text-foreground/25 opacity-0 group-hover:opacity-100">
          {message.timestamp.toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          })}
        </span>
      )}

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
            <span className="text-2xs text-foreground/25">
              {message.timestamp.toLocaleTimeString("en-US", {
                hour: "2-digit",
                minute: "2-digit",
                hour12: false,
              })}
            </span>
            {message.isEdited && (
              <span className="text-2xs text-foreground/25">(edited)</span>
            )}
          </div>
        )}

        {/* "Replied to thread" label for thread replies shown in main feed */}
        {isThreadReplyInFeed && onOpenThread && (
          <button
            onClick={() => onOpenThread(message.threadId!)}
            className="mb-0.5 flex items-center gap-1 text-2xs text-ping-purple hover:underline"
          >
            <MessageSquare className="h-2.5 w-2.5" />
            Replied to a thread
          </button>
        )}

        {isEditing ? (
          <div className="flex flex-col gap-1">
            <RichTextComposer
              initialContent={message.content}
              enterToSave
              onSave={handleSaveEdit}
              onEscape={() => setIsEditing(false)}
              showToolbar
              autoFocus
            />
            <div className="flex items-center gap-2 text-2xs">
              <span className="text-muted-foreground">
                Enter to save · Escape to cancel
              </span>
              <button
                onClick={() => setIsEditing(false)}
                className="rounded px-2 py-0.5 text-muted-foreground hover:bg-surface-3"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <MarkdownContent
            content={message.content}
            className={cn(
              "text-sm leading-relaxed",
              isBot ? "text-foreground" : "text-foreground/90"
            )}
          />
        )}

        {message.citations && (
          <CitationRow citations={message.citations} />
        )}

        {message.reactions && message.reactions.length > 0 && onToggleReaction && currentUserId && (
          <MessageReactions
            reactions={message.reactions}
            currentUserId={currentUserId}
            onToggle={(emoji) => onToggleReaction(message.id, emoji)}
          />
        )}

        {/* Thread reply badge */}
        {hasThread && onOpenThread && (
          <button
            onClick={() => onOpenThread(message.id)}
            className="mt-1 flex items-center gap-2 rounded px-1 py-0.5 text-2xs text-ping-purple transition-colors hover:bg-surface-3"
          >
            {/* Avatar stack — up to 3 */}
            {message.threadParticipants && message.threadParticipants.length > 0 && (
              <span className="flex -space-x-1.5">
                {message.threadParticipants.slice(0, 3).map((p) => (
                  <Avatar key={p._id} className="h-4 w-4 border border-background">
                    <AvatarFallback
                      className={cn(
                        "text-[8px] font-medium bg-gradient-to-br text-white",
                        avatarGradient(p._id + p.name),
                      )}
                    >
                      {p.name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                ))}
              </span>
            )}
            <span className="font-medium">
              {message.threadReplyCount} {message.threadReplyCount === 1 ? "reply" : "replies"}
            </span>
            {message.threadLastReplyAt && (
              <span className="text-muted-foreground">
                {formatRelativeTime(message.threadLastReplyAt)}
              </span>
            )}
          </button>
        )}
      </div>

      {/* Delete confirmation dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete message</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this message? This can&apos;t be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button
              onClick={() => setDeleteDialogOpen(false)}
              className="rounded border border-subtle px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-surface-3"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                onDeleteMessage?.(message.id);
                setDeleteDialogOpen(false);
              }}
              className="rounded bg-status-danger px-3 py-1.5 text-sm text-white transition-colors hover:bg-status-danger/90"
            >
              Delete
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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

export function TypingIndicator({ users }: { users: TypingUser[] }) {
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
  /** Called when user opens a thread on a message */
  onOpenThread?: (messageId: string) => void;
  /** Called when user toggles a reaction on a message */
  onToggleReaction?: (messageId: string, emoji: string) => void;
  /** Current user's ID for highlighting own reactions */
  currentUserId?: string;
  /** Reactions grouped by message ID */
  reactionsByMessage?: Record<string, Array<ReactionGroup>>;
  onEditMessage?: (messageId: string, newBody: string) => void;
  onDeleteMessage?: (messageId: string) => void;
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
  onOpenThread,
  onToggleReaction,
  currentUserId,
  reactionsByMessage,
  onEditMessage,
  onDeleteMessage,
}: MessageListProps) {
  const [showNewMessages, setShowNewMessages] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<RichTextComposerHandle>(null);
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

  // Re-scroll when the scroll container resizes (e.g. Tiptap composer mounts
  // asynchronously and shrinks the message area)
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      if (isAtBottom()) {
        scrollToBottom("instant");
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [isAtBottom]);

  const handleScrollToBottom = () => {
    scrollToBottom("smooth");
    setShowNewMessages(false);
  };

  const handleScroll = () => {
    if (isAtBottom()) setShowNewMessages(false);
  };

  const handleSend = useCallback((content: string) => {
    if (!content) return;
    onSend?.(content);
    // Scroll to bottom after send
    setTimeout(() => scrollToBottom("smooth"), 50);
  }, [onSend, scrollToBottom]);

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
        className="relative flex flex-1 flex-col overflow-y-auto scrollbar-thin"
      >
        <div className="mt-auto py-2">
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
        ) : messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-4 text-center">
            <span className="text-4xl">🦗</span>
            <p className="text-sm text-muted-foreground">
              {isDM
                ? "No messages yet. Don\u2019t be shy, say hi!"
                : `This is the very beginning of #${channelName}. It\u2019s so quiet you can hear the electrons flowing.`}
            </p>
            <p className="text-2xs text-foreground/20">Be the first to break the silence</p>
          </div>
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

              const msgWithReactions = reactionsByMessage?.[msg.id]
                ? { ...msg, reactions: reactionsByMessage[msg.id] }
                : msg;

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
                  <MessageItem
                    message={msgWithReactions}
                    showAvatar={showAvatar}
                    onOpenThread={onOpenThread}
                    onToggleReaction={onToggleReaction}
                    currentUserId={currentUserId}
                    onEditMessage={onEditMessage}
                    onDeleteMessage={onDeleteMessage}
                  />
                </div>
              );
            })}
          </div>
        )}
        </div>
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
        <RichTextComposer
          ref={composerRef}
          placeholder={isDM ? `Message ${channelName}...` : `Message #${channelName}... or @KnowledgeBot`}
          onSend={handleSend}
          onTyping={onTyping}
          showActions
          isDM={isDM}
        />
        <p className="mt-1 text-2xs text-foreground/20">
          Enter to send · Shift+Enter for new line{!isDM && " · @mention to summon agents"}
        </p>
      </div>
    </div>
  );
}
