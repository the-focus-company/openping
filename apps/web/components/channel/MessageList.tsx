"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { ChevronDown } from "lucide-react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import { RichTextComposer, type RichTextComposerHandle } from "@/components/channel/RichTextComposer";
import { IntegrationStack } from "@/components/integrations/IntegrationStack";
import { FileUpload, uploadAttachments, type PendingAttachment } from "@/components/channel/FileUpload";
import { cn } from "@/lib/utils";
import type { ReactionGroup } from "@/components/channel/MessageReactions";
import type { VirtualRow, Message, TypingUser } from "./message-types";
import { formatDateDivider, DateDivider } from "./DateDivider";
import { MessageItem } from "./MessageItem";
import { MessageSkeleton } from "./MessageSkeleton";
import { TypingIndicator } from "./TypingIndicator";

// ── Barrel re-exports for downstream consumers ────────────────────────────────
export { MessageItem } from "./MessageItem";
export { TypingIndicator } from "./TypingIndicator";
export { MessageSkeleton } from "./MessageSkeleton";
export { DateDivider, formatDateDivider } from "./DateDivider";
export type { Message, MessageItemProps, TypingUser, VirtualRow } from "./message-types";

// ── MessageList props ─────────────────────────────────────────────────────────

interface MessageListProps {
  channelName: string;
  messages: Message[];
  onSend?: (content: string, attachments?: Array<{ storageId: string; filename: string; mimeType: string; size: number }>) => void;
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
  /** Called when user copies a message link (timestamp click or hover action) */
  onCopyMessageLink?: (messageId: string) => void;
  onJoinMeeting?: (meetingId: string, meetingUrl: string) => void;
  onEndMeeting?: (meetingId: string) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

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
  onCopyMessageLink,
  onJoinMeeting,
  onEndMeeting,
}: MessageListProps) {
  const [showNewMessages, setShowNewMessages] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<RichTextComposerHandle>(null);
  const prevMessageCountRef = useRef(messages.length);
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);
  const filePickerTriggerRef = useRef<(() => void) | null>(null);
  const hasInitiallyScrolledRef = useRef(false);
  const [newMessageId, setNewMessageId] = useState<string | null>(null);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);

  // Build a flat list of virtual rows: date dividers interleaved with messages.
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
      const row = rows[index];
      if (!row) return 40;
      if (row.kind === "date") return 40;
      const msg = messages[row.messageIndex];
      const hasAvatar = showAvatarFlags[row.messageIndex];
      const baseHeight = hasAvatar ? 64 : 32;
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
      // Double rAF to ensure virtualizer has measured elements before scrolling
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          scrollToBottom("instant");
        });
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
  }, [isAtBottom, scrollToBottom]);

  const handleScrollToBottom = () => {
    scrollToBottom("smooth");
    setShowNewMessages(false);
  };

  const handleScroll = () => {
    if (isAtBottom()) setShowNewMessages(false);
  };

  const handleSend = useCallback(async (content: string) => {
    if (!content) return;

    let uploaded: Array<{ storageId: string; filename: string; mimeType: string; size: number }> | undefined;
    if (pendingAttachments.length > 0) {
      const results = await uploadAttachments(
        pendingAttachments,
        generateUploadUrl,
        setPendingAttachments,
      );
      if (results.length > 0) uploaded = results;
      setPendingAttachments([]);
    }

    onSend?.(content, uploaded);
    // Scroll to bottom after send
    setTimeout(() => scrollToBottom("smooth"), 50);
  }, [onSend, scrollToBottom, pendingAttachments, generateUploadUrl]);

  const vRows = virtualizer.getVirtualItems();

  return (
    <FileUpload
      attachments={pendingAttachments}
      onAttachmentsChange={setPendingAttachments}
      onFileInputReady={(trigger) => { filePickerTriggerRef.current = trigger; }}
      className="flex min-h-0 min-w-0 flex-1 flex-col"
    >
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
                      "bg-ping-purple/10 ring-1 ring-ping-purple/30 transition-colors duration-1000",
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
                    onCopyMessageLink={onCopyMessageLink}
                    onJoinMeeting={onJoinMeeting}
                    onEndMeeting={onEndMeeting}
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
            onAttachFile={() => filePickerTriggerRef.current?.()}
            pendingAttachments={pendingAttachments}
            onRemoveAttachment={(id) => setPendingAttachments((prev) => prev.filter((a) => a.id !== id))}
          />
          {/* Typing indicator below composer */}
          <TypingIndicator users={typingUsers} />
        </div>
      )}
    </FileUpload>
  );
}
