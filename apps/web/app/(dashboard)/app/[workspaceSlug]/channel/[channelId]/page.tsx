"use client";

import { use, useState, useCallback, useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery, useMutation, useConvexAuth } from "convex/react";
import { api } from "@convex/_generated/api";
import { Id } from "@convex/_generated/dataModel";
import { MessageList, type Message } from "@/components/channel/MessageList";
import { ChannelTopBar } from "@/components/channel/ChannelTopBar";
import { AlertBanner } from "@/components/proactive/AlertBanner";
import { UserProfileDialog } from "@/components/user/UserProfileDialog";
import { useChannelTyping } from "@/hooks/useTyping";
import { useThreadPanel } from "@/hooks/useThreadPanel";
import { useReactions } from "@/hooks/useReactions";
import { useToast } from "@/components/ui/toast-provider";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useRouter } from "next/navigation";

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
  const searchParams = useSearchParams();
  const highlightMessageId = searchParams.get("msg");

  const { isAuthenticated } = useConvexAuth();
  const channel = useQuery(api.channels.get, isAuthenticated ? { channelId: typedChannelId } : "skip");
  const isMember = channel?.isMember ?? false;
  const results = useQuery(
    api.messages.listByChannel,
    isAuthenticated ? { channelId: typedChannelId } : "skip",
  );
  const joinChannel = useMutation(api.channels.join);
  const sendMessage = useMutation(api.messages.send);
  const editMessage = useMutation(api.messages.edit);
  const deleteMessage = useMutation(api.messages.remove);
  const markRead = useMutation(api.channels.markRead);
  const memberCount = useQuery(api.channels.memberCount, isAuthenticated ? { channelId: typedChannelId } : "skip");
  const channelMembers = useQuery(api.channels.listMembers, isAuthenticated ? { channelId: typedChannelId } : "skip");
  const alerts = useQuery(api.inboxItems.list, isAuthenticated ? {} : "skip");
  const dismissAlert = useMutation(api.inboxItems.archive);
  const leaveChannel = useMutation(api.channels.leave);
  const toggleStar = useMutation(api.channels.toggleStar);
  const { typingUsers, onTyping, onSendClear } = useChannelTyping(typedChannelId, isMember);
  const { openThreadPanel, closeThreadPanel } = useThreadPanel();
  const currentUser = useQuery(api.users.getMe, isAuthenticated ? {} : "skip");
  const { toast } = useToast();
  const router = useRouter();
  const { buildPath, workspaceId } = useWorkspace();

  useEffect(() => {
    if (!isAuthenticated || !isMember) return;
    markRead({ channelId: typedChannelId });
  }, [isAuthenticated, isMember, markRead, typedChannelId]);

  // Close thread panel when navigating to a different channel
  useEffect(() => {
    closeThreadPanel();
  }, [channelId, closeThreadPanel]);

  const handleCopyLink = useCallback(() => {
    navigator.clipboard.writeText(window.location.href);
    toast("Link copied", "success");
  }, [toast]);

  const handleLeave = useCallback(async () => {
    await leaveChannel({ channelId: typedChannelId });
    toast("Left channel", "success");
    router.push(buildPath("/channels"));
  }, [leaveChannel, typedChannelId, toast, router, buildPath]);

  const handleToggleStar = useCallback(() => {
    toggleStar({ channelId: typedChannelId });
  }, [toggleStar, typedChannelId]);

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
      citations: msg.citations?.map((c) => ({
        type: "message" as const,
        label: c.sourceTitle ?? c.text,
        url: c.sourceUrl,
      })),
      botName: msg.type === "bot" ? "mrPING" : undefined,
      threadReplyCount: msg.threadReplyCount,
      threadLastReplyAt: msg.threadLastReplyAt,
      threadParticipants: msg.threadParticipants,
      threadId: msg.threadId,
      alsoSentToChannel: msg.alsoSentToChannel,
      isEdited: msg.isEdited,
      integrationObjectId: msg.integrationObjectId,
      integrationHistory: msg.integrationHistory as Array<{ body: string; timestamp: number }> | undefined,
      integrationObject: msg.integrationObject,
      messageType: msg.type,
    }));
  }, [results]);

  const messageIds = useMemo(
    () => messages.map((m) => m.id as Id<"messages">),
    [messages],
  );
  const { reactionsByMessage, toggleReaction } = useReactions({
    messageIds,
    enabled: isAuthenticated,
  });

  const handleSend = (content: string) => {
    sendMessage({ channelId: typedChannelId, body: content });
    onSendClear();
  };

  const handleEditMessage = useCallback((messageId: string, newBody: string) => {
    editMessage({ messageId: messageId as Id<"messages">, body: newBody });
  }, [editMessage]);

  const handleDeleteMessage = useCallback((messageId: string) => {
    deleteMessage({ messageId: messageId as Id<"messages"> });
  }, [deleteMessage]);

  const handleOpenThread = useCallback(
    (messageId: string) => {
      openThreadPanel({
        parentMessageId: messageId,
        messageTable: "messages",
        channelId,
        contextName: channel?.name ?? channelId,
        workspaceId,
      });
    },
    [openThreadPanel, channelId, channel?.name, workspaceId],
  );

  const handleJoinChannel = useCallback(() => {
    joinChannel({ channelId: typedChannelId });
  }, [joinChannel, typedChannelId]);

  const firstAlert = alerts?.[0];

  const [profileUserId, setProfileUserId] = useState<Id<"users"> | null>(null);

  const handleClickAuthor = useCallback((authorId: string) => {
    setProfileUserId(authorId as Id<"users">);
  }, []);

  const handleClickMention = useCallback((name: string) => {
    // Find user by name from channel members
    const member = channelMembers?.find(
      (m) => m.name.toLowerCase() === name.toLowerCase(),
    );
    if (member) {
      setProfileUserId(member._id as Id<"users">);
    }
  }, [channelMembers]);

  return (
    <div className="relative flex h-full flex-col">
      {channel && channelMembers && (
        <ChannelTopBar
          name={channel.name}
          description={channel.description}
          members={channelMembers}
          memberCount={memberCount ?? channelMembers.length}
          isStarred={channel.isStarred ?? false}
          isPrivate={channel.isPrivate ?? false}
          onToggleStar={handleToggleStar}
          onCopyLink={handleCopyLink}
          onLeave={handleLeave}
        />
      )}
      <MessageList
        channelName={channel?.name ?? channelId}
        messages={messages}
        onSend={isMember ? handleSend : undefined}
        isLoading={results === undefined}
        typingUsers={typingUsers}
        onTyping={isMember ? onTyping : undefined}
        onOpenThread={handleOpenThread}
        onToggleReaction={isMember ? toggleReaction : undefined}
        currentUserId={currentUser?._id}
        reactionsByMessage={reactionsByMessage}
        onEditMessage={isMember ? handleEditMessage : undefined}
        onDeleteMessage={isMember ? handleDeleteMessage : undefined}
        onClickAuthor={handleClickAuthor}
        onClickMention={handleClickMention}
        highlightMessageId={highlightMessageId}
      />

      {!isMember && channel && (
        <div className="border-t border-subtle bg-surface-1 px-6 py-4">
          <div className="flex items-center justify-center gap-3">
            <span className="text-sm text-muted-foreground">
              You&apos;re previewing <span className="font-medium text-foreground">#{channel.name}</span>
            </span>
            <button
              onClick={handleJoinChannel}
              className="rounded-md bg-ping-purple px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-ping-purple/90"
            >
              Join Channel
            </button>
          </div>
        </div>
      )}

      {firstAlert && (
        <AlertBanner
          title={firstAlert.title}
          description={firstAlert.summary}
          actions={[
            { label: firstAlert.pingWillDo ?? "View", primary: true },
          ]}
          onDismiss={() => dismissAlert({ itemId: firstAlert._id })}
        />
      )}

      <UserProfileDialog
        userId={profileUserId}
        open={profileUserId !== null}
        onOpenChange={(open) => { if (!open) setProfileUserId(null); }}
      />
    </div>
  );
}
