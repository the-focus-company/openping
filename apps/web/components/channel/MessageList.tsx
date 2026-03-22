"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Bot, ChevronDown, MessageSquare, SmilePlus, Pencil, Trash2 } from "lucide-react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { RichTextComposer, type RichTextComposerHandle } from "@/components/channel/RichTextComposer";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { CitationRow, type Citation } from "@/components/bot/CitationPill";
import { MessageReactions, EmojiPickerPopover, type ReactionGroup } from "@/components/channel/MessageReactions";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { MarkdownContent } from "@/components/channel/MarkdownContent";
import { IntegrationMessageCard } from "@/components/integrations/IntegrationMessageCard";
import { IntegrationStack } from "@/components/integrations/IntegrationStack";
import { cn, avatarGradient, formatRelativeTime } from "@/lib/utils";

type VirtualRow =
  | { kind: "date"; label: string; messageIndex: number }
  | { kind: "message"; messageIndex: number };

function formatDateDivider(date: Date): string {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const msgDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (msgDay.getTime() === today.getTime()) return "Today";
  if (msgDay.getTime() === yesterday.getTime()) return "Yesterday";

  const opts: Intl.DateTimeFormatOptions = { weekday: "long", month: "long", day: "numeric" };
  if (msgDay.getFullYear() !== now.getFullYear()) opts.year = "numeric";
  return date.toLocaleDateString("en-US", opts);
}

function DateDivider({ label }: { label: string }) {
  return (
    <div className="relative flex items-center px-4 py-3">
      <div className="flex-1 border-t border-subtle" />
      <span className="mx-3 shrink-0 rounded-full border border-subtle bg-surface-2 px-3 py-0.5 text-2xs font-medium text-muted-foreground">
        {label}
      </span>
      <div className="flex-1 border-t border-subtle" />
    </div>
  );
}

export interface Message {
  id: string;
  type: "user" | "bot";
  /** Raw message type from DB (user/bot/system/integration) */
  messageType?: string;
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
  integrationObjectId?: string;
  integrationHistory?: Array<{ body: string; timestamp: number }>;
  integrationObject?: {
    identifier?: string;
    type?: string;
    title?: string;
    status?: string;
    url?: string;
    author?: string;
  };
}

interface MessageItemProps {
  message: Message;
  showAvatar: boolean;
  showThreadLabel?: boolean;
  onOpenThread?: (messageId: string) => void;
  onToggleReaction?: (messageId: string, emoji: string) => void;
  currentUserId?: string;
  onEditMessage?: (messageId: string, newBody: string) => void;
  onDeleteMessage?: (messageId: string) => void;
  onClickAuthor?: (authorId: string) => void;
  onClickMention?: (name: string) => void;
}

export function MessageItem({ message, showAvatar, showThreadLabel = true, onOpenThread, onToggleReaction, currentUserId, onEditMessage, onDeleteMessage, onClickAuthor, onClickMention }: MessageItemProps) {
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
        showAvatar ? "mt-1" : "mt-0"
      )}
      onDoubleClick={() => onOpenThread?.(message.threadId ?? message.id)}
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
          <button
            type="button"
            onClick={() => !isBot && onClickAuthor?.(message.authorId)}
            className={cn(!isBot && onClickAuthor && "cursor-pointer hover:opacity-80")}
          >
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
          </button>
        )}
      </div>
      {/* Hover timestamp — absolute so it never affects row height */}
      {!showAvatar && (
        <span className="pointer-events-none absolute left-0 top-[8px] w-[calc(1rem+24px+0.75rem)] select-none text-center text-[10px] text-foreground/45 opacity-0 group-hover:opacity-100">
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
            <button
              type="button"
              onClick={() => !isBot && onClickAuthor?.(message.authorId)}
              className={cn(
                "text-xs font-semibold",
                isBot ? "text-ping-purple" : "text-foreground",
                !isBot && onClickAuthor && "hover:underline cursor-pointer",
              )}
            >
              {isBot ? message.botName || "mrPING" : message.author}
            </button>
            {isBot && (
              <span className="rounded border border-ping-purple/30 bg-ping-purple/10 px-1 py-px text-2xs text-ping-purple">
                AI
              </span>
            )}
            <span className="text-2xs text-foreground/45">
              {message.timestamp.toLocaleTimeString("en-US", {
                hour: "2-digit",
                minute: "2-digit",
                hour12: false,
              })}
            </span>
            {message.isEdited && (
              <span className="text-2xs text-foreground/45">(edited)</span>
            )}
          </div>
        )}

        {/* "Replied to thread" label for thread replies shown in main feed */}
        {isThreadReplyInFeed && showThreadLabel && onOpenThread && (
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
        ) : message.messageType === "integration" ? (
          <IntegrationMessageCard
            body={message.content}
            history={message.integrationHistory}
            integrationObject={message.integrationObject}
          />
        ) : (
          <MarkdownContent
            content={message.content}
            className={cn(
              "text-sm leading-relaxed",
              isBot ? "text-foreground" : "text-foreground/90"
            )}
            onClickMention={onClickMention}
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
  const label =
    users.length === 1
      ? `${users[0].name} is typing`
      : users.length === 2
        ? `${users[0].name} and ${users[1].name} are typing`
        : users.length > 2
          ? `${users[0].name} and ${users.length - 1} others are typing`
          : null;

  return (
    <AnimatePresence>
      {label && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.15 }}
          className="overflow-hidden"
        >
          <div className="flex items-center gap-2 px-4 py-1 text-2xs text-muted-foreground">
            <span className="inline-flex gap-0.5">
              <span className="animate-bounce [animation-delay:0ms]">·</span>
              <span className="animate-bounce [animation-delay:150ms]">·</span>
              <span className="animate-bounce [animation-delay:300ms]">·</span>
            </span>
            <span>{label}</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
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
  /** Called when user clicks an author's name/avatar to view their profile */
  onClickAuthor?: (authorId: string) => void;
  /** Called when user clicks a @mention pill to view that user's profile */
  onClickMention?: (name: string) => void;
  /** When set, scrolls to and highlights this message */
  highlightMessageId?: string | null;
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
  onClickAuthor,
  onClickMention,
  highlightMessageId,
}: MessageListProps) {
  const [showNewMessages, setShowNewMessages] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<RichTextComposerHandle>(null);
  const prevMessageCountRef = useRef(messages.length);
  const hasInitiallyScrolledRef = useRef(false);
  const [newMessageId, setNewMessageId] = useState<string | null>(null);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);

  // Build a flat list of virtual rows: date dividers interleaved with messages.
  // Also pre-compute per-message flags (avatar, thread label, integration stacks).
  const { rows, showAvatarFlags, showThreadLabelFlags, integrationStackInfo } = useMemo(() => {
    const rowList: VirtualRow[] = [];
    const avatarFlags: boolean[] = [];
    const threadFlags: boolean[] = [];

    // --- integration stack detection ---
    const stackInfo: Array<{ isPartOfStack: boolean; isStackLeader: boolean; stackMessages: Message[] | null }> =
      messages.map(() => ({ isPartOfStack: false, isStackLeader: false, stackMessages: null }));
    {
      let si = 0;
      while (si < messages.length) {
        if (messages[si].messageType === "integration") {
          let sj = si;
          while (sj < messages.length && messages[sj].messageType === "integration") sj++;
          if (sj - si >= 3) {
            const stack = messages.slice(si, sj);
            stackInfo[si] = { isPartOfStack: true, isStackLeader: true, stackMessages: stack };
            for (let k = si + 1; k < sj; k++) {
              stackInfo[k] = { isPartOfStack: true, isStackLeader: false, stackMessages: null };
            }
          }
          si = sj;
        } else {
          si++;
        }
      }
    }

    // --- build rows with date dividers ---
    let lastDateKey = "";
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      const dateKey = `${msg.timestamp.getFullYear()}-${msg.timestamp.getMonth()}-${msg.timestamp.getDate()}`;

      if (dateKey !== lastDateKey) {
        rowList.push({ kind: "date", label: formatDateDivider(msg.timestamp), messageIndex: i });
        lastDateKey = dateKey;
      }

      // Avatar: show for first message of the day, different author, or >5 min gap
      const prev = messages[i - 1];
      const isFirstInDay = !prev || `${prev.timestamp.getFullYear()}-${prev.timestamp.getMonth()}-${prev.timestamp.getDate()}` !== dateKey;
      avatarFlags[i] = isFirstInDay || prev!.author !== msg.author || msg.timestamp.getTime() - prev!.timestamp.getTime() > 5 * 60 * 1000;

      // Thread label: first of consecutive thread replies to same thread
      if (!msg.threadId || !msg.alsoSentToChannel) {
        threadFlags[i] = false;
      } else if (!prev) {
        threadFlags[i] = true;
      } else {
        threadFlags[i] = prev.threadId !== msg.threadId || !prev.alsoSentToChannel;
      }

      rowList.push({ kind: "message", messageIndex: i });
    }

    return { rows: rowList, showAvatarFlags: avatarFlags, showThreadLabelFlags: threadFlags, integrationStackInfo: stackInfo };
  }, [messages]);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (index) => {
      const msg = messages[index];
      const hasAvatar = showAvatarFlags[index];
      const baseHeight = hasAvatar ? 64 : 32;
      // Estimate extra height for longer messages (~20px per 80 chars)
      const contentLines = Math.ceil((msg?.content?.length ?? 0) / 80);
      const extraHeight = contentLines > 1 ? (contentLines - 1) * 20 : 0;
      return baseHeight + extraHeight;
    },
    overscan: 20,
  });

  const handleStackToggle = useCallback(() => {
    virtualizer.measure();
  }, [virtualizer]);

  const isAtBottom = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  }, []);

  const scrollToBottom = useCallback(
    (behavior: ScrollBehavior = "smooth") => {
      if (rows.length === 0) return;
      virtualizer.scrollToIndex(rows.length - 1, {
        align: "end",
        behavior,
      });
    },
    [virtualizer, rows.length]
  );

  // Auto-scroll when new messages arrive (only if already at bottom)
  useEffect(() => {
    const newCount = messages.length;
    const prevCount = prevMessageCountRef.current;
    prevMessageCountRef.current = newCount;

    if (newCount > prevCount && hasInitiallyScrolledRef.current) {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg) {
        setNewMessageId(lastMsg.id);
        setTimeout(() => setNewMessageId(null), 600);
      }
      if (isAtBottom()) {
        scrollToBottom("smooth");
        setShowNewMessages(false);
      } else {
        setShowNewMessages(true);
      }
    }
  }, [messages, isAtBottom, scrollToBottom]);

  // Initial scroll to bottom once loading completes (skip if we need to scroll to a specific message)
  useEffect(() => {
    if (!isLoading && messages.length > 0 && !hasInitiallyScrolledRef.current) {
      hasInitiallyScrolledRef.current = true;
      if (highlightMessageId) {
        // Scroll to highlighted message instead of bottom
        const idx = rows.findIndex(
          (r) => r.kind === "message" && messages[r.messageIndex].id === highlightMessageId
        );
        if (idx >= 0) {
          setHighlightedId(highlightMessageId);
          requestAnimationFrame(() => {
            virtualizer.scrollToIndex(idx, { align: "center", behavior: "instant" });
          });
          // Clear highlight after 2s
          setTimeout(() => setHighlightedId(null), 2000);
          return;
        }
      }
      requestAnimationFrame(() => {
        scrollToBottom("instant");
      });
    }
  }, [isLoading, messages.length, scrollToBottom, highlightMessageId, messages, virtualizer, rows]);

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

  const vRows = virtualizer.getVirtualItems();

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
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
            <p className="text-2xs text-foreground/40">Be the first to break the silence</p>
          </div>
        ) : (
          <div
            style={{
              height: `${virtualizer.getTotalSize()}px`,
              width: "100%",
              position: "relative",
            }}
          >
            {vRows.map((virtualRow) => {
              const row = rows[virtualRow.index];

              if (row.kind === "date") {
                return (
                  <div
                    key={`date-${row.label}-${row.messageIndex}`}
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
                    <DateDivider label={row.label} />
                  </div>
                );
              }

              const msg = messages[row.messageIndex];
              const stackInfo = integrationStackInfo[row.messageIndex];
              const showAvatar = showAvatarFlags[row.messageIndex];
              const showThreadLabel = showThreadLabelFlags[row.messageIndex];

              const msgWithReactions = reactionsByMessage?.[msg.id]
                ? { ...msg, reactions: reactionsByMessage[msg.id] }
                : msg;

              const isNew = msg.id === newMessageId;

              // Hidden: part of a stack but not the leader
              if (stackInfo.isPartOfStack && !stackInfo.isStackLeader) {
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
                      height: 0,
                      overflow: "hidden",
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                  />
                );
              }

              // Stack leader: render the collapsed stack
              if (stackInfo.isStackLeader && stackInfo.stackMessages) {
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
                    <IntegrationStack
                      messages={stackInfo.stackMessages}
                      onToggle={handleStackToggle}
                    />
                  </div>
                );
              }

              return (
                <div
                  key={msg.id}
                  data-index={virtualRow.index}
                  ref={virtualizer.measureElement}
                  className={cn(
                    isNew && "animate-message-in",
                    highlightedId === msg.id &&
                      "bg-ping-purple/10 ring-1 ring-ping-purple/30 rounded transition-colors duration-1000",
                  )}
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
                    showThreadLabel={showThreadLabel}
                    onOpenThread={onOpenThread}
                    onToggleReaction={onToggleReaction}
                    currentUserId={currentUserId}
                    onEditMessage={onEditMessage}
                    onDeleteMessage={onDeleteMessage}
                    onClickAuthor={onClickAuthor}
                    onClickMention={onClickMention}
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
      {onSend && <TypingIndicator users={typingUsers} />}

      {/* Composer */}
      {onSend && (
        <div className="shrink-0 min-w-0 border-t border-subtle p-3">
          <RichTextComposer
            ref={composerRef}
            placeholder={isDM ? `Message ${channelName}...` : `Message #${channelName}... or @mrPING`}
            onSend={handleSend}
            onTyping={onTyping}
            showActions
            isDM={isDM}
          />
        </div>
      )}
    </div>
  );
}
