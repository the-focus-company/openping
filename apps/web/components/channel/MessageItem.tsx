"use client";

import { useState, useCallback } from "react";
import { Bot, MessageSquare, SmilePlus, Pencil, Trash2, Link } from "lucide-react";
import { RichTextComposer } from "@/components/channel/RichTextComposer";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CitationRow } from "@/components/bot/CitationPill";
import { MessageReactions, EmojiPickerPopover } from "@/components/channel/MessageReactions";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { MarkdownContent } from "@/components/channel/MarkdownContent";
import { IntegrationMessageCard } from "@/components/integrations/IntegrationMessageCard";
import { MeetingCard } from "@/components/channel/MeetingCard";
import { AttachmentRenderer } from "@/components/channel/AttachmentRenderer";
import { cn, avatarGradient, formatRelativeTime } from "@/lib/utils";
import type { MessageItemProps } from "./message-types";

export function MessageItem({ message, showAvatar, showThreadLabel = true, onOpenThread, onToggleReaction, currentUserId, onEditMessage, onDeleteMessage, onClickAuthor, onClickMention, onCopyMessageLink, onJoinMeeting, onEndMeeting }: MessageItemProps) {
  const isBot = message.type === "bot";
  const hasThread = (message.threadReplyCount ?? 0) > 0;
  const isThreadReplyInFeed = message.threadId && message.alsoSentToChannel;
  const isOwnUserMessage = currentUserId === message.authorId && message.type === "user";
  const showActionBar = onOpenThread || onToggleReaction || isOwnUserMessage || onCopyMessageLink;

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
          {onCopyMessageLink && (
            <button
              onClick={() => onCopyMessageLink(message.id)}
              className="flex items-center gap-1 px-2 py-1 text-2xs text-muted-foreground transition-colors hover:bg-surface-3 hover:text-foreground"
              title="Copy link to message"
            >
              <Link className="h-3 w-3" />
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
              {!isBot && message.authorAvatarUrl && (
                <AvatarImage src={message.authorAvatarUrl} alt={message.author} />
              )}
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
        <button
          type="button"
          onClick={() => onCopyMessageLink?.(message.id)}
          className={cn(
            "absolute left-0 top-[8px] w-[calc(1rem+24px+0.75rem)] text-center text-[10px] text-foreground/45 opacity-0 group-hover:opacity-100",
            onCopyMessageLink ? "cursor-pointer hover:underline hover:text-foreground/60" : "pointer-events-none select-none",
          )}
          title={onCopyMessageLink ? "Copy link to message" : undefined}
        >
          {message.timestamp.toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          })}
        </button>
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
            <button
              type="button"
              onClick={() => onCopyMessageLink?.(message.id)}
              className={cn(
                "text-2xs text-foreground/45",
                onCopyMessageLink && "hover:underline hover:text-foreground/60 cursor-pointer",
              )}
              title={onCopyMessageLink ? "Copy link to message" : undefined}
            >
              {message.timestamp.toLocaleTimeString("en-US", {
                hour: "2-digit",
                minute: "2-digit",
                hour12: false,
              })}
            </button>
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
        ) : message.meeting ? (
          <MeetingCard
            title={message.meeting.title}
            provider={message.meeting.provider}
            meetingUrl={message.meeting.meetingUrl}
            status={message.meeting.status}
            startedBy={message.meeting.startedBy}
            startedAt={message.meeting.startedAt}
            endedAt={message.meeting.endedAt}
            participants={message.meeting.participants}
            onJoin={() => onJoinMeeting?.(message.meeting!._id, message.meeting!.meetingUrl)}
            onEnd={
              currentUserId === message.authorId
                ? () => onEndMeeting?.(message.meeting!._id)
                : undefined
            }
          />
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

        {message.attachments && message.attachments.length > 0 && (
          <AttachmentRenderer attachments={message.attachments} />
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
            className="mt-1 flex items-center gap-2 rounded-md px-3 py-1.5 text-xs text-ping-purple transition-colors hover:bg-surface-3"
          >
            {/* Avatar stack — up to 3 */}
            {message.threadParticipants && message.threadParticipants.length > 0 && (
              <span className="flex -space-x-1.5">
                {message.threadParticipants.slice(0, 3).map((p) => (
                  <Avatar key={p._id} className="h-4 w-4 border border-background">
                    {p.avatarUrl && (
                      <AvatarImage src={p.avatarUrl} alt={p.name} />
                    )}
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
