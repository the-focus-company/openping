"use client";

import { use, useState, useCallback, useEffect, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useConvexAuth } from "convex/react";
import { api } from "@convex/_generated/api";
import { Id } from "@convex/_generated/dataModel";
import { MessageList, type Message } from "@/components/channel/MessageList";
import { ChannelTopBar } from "@/components/channel/ChannelTopBar";
import { ConversationTopBar } from "@/components/channel/ConversationTopBar";
import { ChannelTopBarSkeleton, ConversationTopBarSkeleton } from "@/components/channel/ChannelSkeleton";
import { AlertBanner } from "@/components/proactive/AlertBanner";
import { UserProfileDialog } from "@/components/user/UserProfileDialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Archive } from "lucide-react";
import { useChannelTyping } from "@/hooks/useTyping";
import { useThreadPanel } from "@/hooks/useThreadPanel";
import { useReactions } from "@/hooks/useReactions";
import { useToast } from "@/components/ui/toast-provider";
import { useWorkspace } from "@/hooks/useWorkspace";

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

export default function ConversationPage({ params }: Props) {
  const { conversationId } = use(params);
  const typedId = conversationId as Id<"conversations">;
  const searchParams = useSearchParams();
  const highlightMessageId = searchParams.get("msg");

  const { isAuthenticated } = useConvexAuth();
  const conversation = useQuery(
    api.conversations.get,
    isAuthenticated ? { conversationId: typedId } : "skip",
  );
  const isMember = conversation?.isMember ?? false;
  const isPublicChannel = conversation?.visibility === "public";
  const isDM = conversation ? (conversation.kind !== "group" || !isPublicChannel) : false;

  const results = useQuery(
    api.messages.listByConversation,
    isAuthenticated ? { conversationId: typedId } : "skip",
  );

  const sendMessage = useMutation(api.messages.send);
  const editMessage = useMutation(api.messages.edit);
  const deleteMessage = useMutation(api.messages.remove);
  const markRead = useMutation(api.conversations.markRead);
  const joinConversation = useMutation(api.conversations.join);
  const leaveConversation = useMutation(api.conversations.leave);
  const archiveConversation = useMutation(api.conversations.archive);
  const unarchiveConversation = useMutation(api.conversations.unarchive);
  const toggleStar = useMutation(api.conversations.toggleStar);
  const memberCount = useQuery(
    api.conversations.memberCount,
    isAuthenticated ? { conversationId: typedId } : "skip",
  );
  const conversationMembers = useQuery(
    api.conversations.listMembers,
    isAuthenticated ? { conversationId: typedId } : "skip",
  );
  const alerts = useQuery(api.inboxItems.list, isAuthenticated ? {} : "skip");
  const dismissAlert = useMutation(api.inboxItems.archive);
  const startMeeting = useMutation(api.meetings.startInConversation);
  const joinMeetingMut = useMutation(api.meetings.joinMeeting);
  const endMeetingMut = useMutation(api.meetings.endMeeting);
  const activeMeeting = useQuery(
    api.meetings.getActiveMeeting,
    isAuthenticated ? { conversationId: typedId } : "skip",
  );
  const { typingUsers, onTyping, onSendClear } = useChannelTyping(typedId, isMember);
  const { openThreadPanel, closeThreadPanel } = useThreadPanel();
  const currentUser = useQuery(api.users.getMe, isAuthenticated ? {} : "skip");
  const { toast } = useToast();
  const router = useRouter();
  const { buildPath, workspaceId, role: workspaceRole } = useWorkspace();
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);

  const inviteLink = useQuery(
    api.conversationInvitations.getLink,
    isAuthenticated ? { conversationId: typedId } : "skip",
  );
  const generateInviteLink = useMutation(api.conversationInvitations.generateLink);
  const revokeInviteLink = useMutation(api.conversationInvitations.revokeLink);
  const inviteMembers = useMutation(api.conversations.invite);
  const workspaceMembers = useQuery(
    api.workspaceMembers.listMembers,
    isAuthenticated && workspaceId ? { workspaceId } : "skip",
  );
  const isGuest = workspaceRole === "guest";

  // Mark as read on mount and when conversation changes
  useEffect(() => {
    if (!isAuthenticated || !isMember) return;
    markRead({ conversationId: typedId });
  }, [isAuthenticated, isMember, markRead, typedId]);

  // Close thread panel when navigating to a different conversation
  useEffect(() => {
    closeThreadPanel();
  }, [conversationId, closeThreadPanel]);

  const handleCopyLink = useCallback(() => {
    navigator.clipboard.writeText(window.location.href);
    toast("Link copied", "success");
  }, [toast]);

  const handleGenerateInviteLink = useCallback(async () => {
    await generateInviteLink({ conversationId: typedId });
    toast("Guest link generated", "success");
  }, [generateInviteLink, typedId, toast]);

  const handleCopyInviteLink = useCallback(async () => {
    if (!inviteLink) return;
    const url = `${window.location.origin}/conversation-invite/${inviteLink.token}`;
    await navigator.clipboard.writeText(url);
    toast("Link copied", "success");
  }, [inviteLink, toast]);

  const handleRevokeInviteLink = useCallback(async () => {
    await revokeInviteLink({ conversationId: typedId });
    toast("Guest link revoked", "success");
  }, [revokeInviteLink, typedId, toast]);

  const handleInviteMembers = useCallback(
    (userIds: string[]) => {
      inviteMembers({
        conversationId: typedId,
        userIds: userIds as Id<"users">[],
      });
      toast(
        userIds.length === 1 ? "Member added" : `${userIds.length} members added`,
        "success",
      );
    },
    [inviteMembers, typedId, toast],
  );

  const handleLeave = useCallback(async () => {
    await leaveConversation({ conversationId: typedId });
    toast("Left conversation", "success");
    router.push(buildPath("/conversations"));
  }, [leaveConversation, typedId, toast, router, buildPath]);

  const handleArchive = useCallback(async () => {
    await archiveConversation({ conversationId: typedId });
    toast("Conversation archived", "success");
    router.push(buildPath("/conversations"));
  }, [archiveConversation, typedId, workspaceId, toast, router, buildPath]);

  const handleUnarchive = useCallback(async () => {
    await unarchiveConversation({ conversationId: typedId });
    toast("Conversation unarchived", "success");
  }, [unarchiveConversation, typedId, workspaceId, toast]);

  const handleToggleStar = useCallback(() => {
    toggleStar({ conversationId: typedId });
  }, [toggleStar, typedId]);

  const handleJoinConversation = useCallback(() => {
    joinConversation({ conversationId: typedId });
  }, [joinConversation, typedId]);

  // Build display name
  const otherMembers = useMemo(
    () => conversationMembers?.filter((m) => m._id !== currentUser?._id) ?? [],
    [conversationMembers, currentUser?._id],
  );
  const displayName = useMemo(() => {
    if (isPublicChannel) return conversation?.name ?? conversationId;
    return (
      conversation?.name ||
      otherMembers.map((m) => m.name).join(", ") ||
      "Conversation"
    );
  }, [isPublicChannel, conversation?.name, conversationId, otherMembers]);

  const messages: Message[] = useMemo(() => {
    if (!results) return [];
    const messageArray = Array.isArray(results) ? results : [];
    return [...messageArray].reverse().map((msg) => ({
      id: msg._id,
      type: msg.type === "system" ? ("system" as const) : msg.type === "bot" ? ("bot" as const) : ("user" as const),
      authorId: msg.authorId,
      author: msg.author?.name ?? "Unknown",
      authorInitials: getInitials(msg.author?.name ?? "?"),
      authorAvatarUrl: msg.author?.avatarUrl,
      content: msg.body,
      timestamp: new Date(msg._creationTime),
      citations: msg.citations?.map((c: { sourceTitle?: string; text: string; sourceUrl?: string }) => ({
        type: "message" as const,
        label: c.sourceTitle ?? c.text,
        url: c.sourceUrl,
      })),
      botName: msg.type === "bot" ? (msg.author?.name ?? "mrPING") : undefined,
      threadReplyCount: msg.threadReplyCount,
      threadLastReplyAt: msg.threadLastReplyAt,
      threadParticipants: msg.threadParticipants,
      threadId: msg.threadId,
      alsoSentToChannel: msg.alsoSentToChannel ?? msg.alsoSentToConversation,
      isEdited: msg.isEdited,
      integrationObjectId: msg.integrationObjectId,
      integrationHistory: msg.integrationHistory as Array<{ body: string; timestamp: number }> | undefined,
      integrationObject: msg.integrationObject,
      messageType: msg.type,
      attachments: msg.attachments as Array<{ storageId: string; filename: string; mimeType: string; size: number }> | undefined,
      meetingId: msg.meetingId,
      meeting: msg.meeting,
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

  const handleSend = (
    content: string,
    attachments?: Array<{ storageId: string; filename: string; mimeType: string; size: number }>,
  ) => {
    sendMessage({
      conversationId: typedId,
      body: content,
      ...(attachments ? { attachments } : {}),
    });
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
        conversationId,
        contextName: displayName,
        workspaceId,
      });
    },
    [openThreadPanel, conversationId, displayName, workspaceId],
  );

  const [profileUserId, setProfileUserId] = useState<Id<"users"> | null>(null);

  const handleClickAuthor = useCallback((authorId: string) => {
    setProfileUserId(authorId as Id<"users">);
  }, []);

  const handleClickMention = useCallback((name: string) => {
    const member = conversationMembers?.find(
      (m) => m.name.toLowerCase() === name.toLowerCase(),
    );
    if (member) {
      setProfileUserId(member._id as Id<"users">);
    }
  }, [conversationMembers]);

  const handleStartMeeting = useCallback(async () => {
    if (activeMeeting) {
      await joinMeetingMut({ meetingId: activeMeeting._id as Id<"meetings"> });
      window.open(activeMeeting.meetingUrl, "_blank");
    } else {
      const result = await startMeeting({ conversationId: typedId });
      window.open(result.meetingUrl, "_blank");
    }
  }, [activeMeeting, joinMeetingMut, startMeeting, typedId]);

  const handleJoinMeeting = useCallback(async (meetingId: string, meetingUrl: string) => {
    await joinMeetingMut({ meetingId: meetingId as Id<"meetings"> });
    window.open(meetingUrl, "_blank");
  }, [joinMeetingMut]);

  const handleEndMeeting = useCallback(async (meetingId: string) => {
    await endMeetingMut({ meetingId: meetingId as Id<"meetings"> });
  }, [endMeetingMut]);

  const handleCopyMessageLink = useCallback((messageId: string) => {
    const url = new URL(window.location.href);
    url.search = "";
    url.searchParams.set("msg", messageId);
    navigator.clipboard.writeText(url.toString());
    toast("Link copied", "success");
  }, [toast]);

  const firstAlert = alerts?.[0];

  return (
    <div className="relative flex h-full flex-col">
      {/* Top bar: channel style for public channels, conversation style for DMs */}
      {isPublicChannel ? (
        conversation && conversationMembers ? (
          <ChannelTopBar
            name={conversation.name ?? conversationId}
            description={conversation.description}
            members={conversationMembers}
            memberCount={memberCount ?? conversationMembers.length}
            isStarred={conversation.isStarred ?? false}
            isPrivate={false}
            isArchived={conversation.isArchived ?? false}
            isDefault={conversation.isDefault ?? false}
            isOwnerOrAdmin={conversation.createdBy === currentUser?._id || workspaceRole === "admin"}
            onToggleStar={handleToggleStar}
            onCopyLink={handleCopyLink}
            onLeave={() => setLeaveDialogOpen(true)}
            onArchive={() => setArchiveDialogOpen(true)}
            onUnarchive={handleUnarchive}
            onStartMeeting={isMember ? handleStartMeeting : undefined}
            hasActiveMeeting={!!activeMeeting}
          />
        ) : (
          <ChannelTopBarSkeleton />
        )
      ) : conversation ? (
        <ConversationTopBar
          name={displayName}
          members={otherMembers.map((m) => ({ userId: m._id as string, name: m.name, avatarUrl: m.avatarUrl, isAgent: m.isAgent }))}
          kind={(conversation.kind ?? "1to1") as "1to1" | "group" | "agent_1to1" | "agent_group"}
          onCopyId={handleCopyLink}
          onArchive={handleArchive}
          onStartMeeting={handleStartMeeting}
          hasActiveMeeting={!!activeMeeting}
          isGuest={isGuest}
          workspaceMembers={workspaceMembers?.map((wm) => ({
            _id: wm.userId as string,
            name: wm.name,
            avatarUrl: wm.avatarUrl,
          }))}
          onInviteMembers={handleInviteMembers}
          inviteLink={inviteLink ?? null}
          onGenerateInviteLink={handleGenerateInviteLink}
          onRevokeInviteLink={handleRevokeInviteLink}
          onCopyInviteLink={handleCopyInviteLink}
        />
      ) : (
        <ConversationTopBarSkeleton />
      )}

      <MessageList
        channelName={displayName}
        messages={messages}
        onSend={isMember && !conversation?.isArchived ? handleSend : undefined}
        isLoading={results === undefined}
        isDM={isDM}
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
        onCopyMessageLink={handleCopyMessageLink}
        onJoinMeeting={isMember ? handleJoinMeeting : undefined}
        onEndMeeting={isMember ? handleEndMeeting : undefined}
      />

      {/* Preview banner for non-members of public channels */}
      {!isMember && isPublicChannel && conversation && (
        <div className="border-t border-subtle bg-surface-1 px-6 py-4">
          <div className="flex items-center justify-center gap-3">
            <span className="text-sm text-muted-foreground">
              You&apos;re previewing <span className="font-medium text-foreground">#{conversation.name}</span>
            </span>
            <button
              onClick={handleJoinConversation}
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

      {conversation?.isArchived && (
        <div className="flex items-center justify-center gap-3 border-t border-subtle bg-surface-2 px-6 py-3">
          <Archive className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">This conversation has been archived</span>
          {(conversation.createdBy === currentUser?._id || workspaceRole === "admin") && (
            <button
              onClick={handleUnarchive}
              className="rounded-md bg-ping-purple px-3 py-1 text-sm font-medium text-white transition-colors hover:bg-ping-purple/90"
            >
              Unarchive
            </button>
          )}
        </div>
      )}

      <UserProfileDialog
        userId={profileUserId}
        open={profileUserId !== null}
        onOpenChange={(open) => { if (!open) setProfileUserId(null); }}
      />

      {/* Leave confirmation dialog */}
      <Dialog open={leaveDialogOpen} onOpenChange={setLeaveDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Leave {isPublicChannel ? "channel" : "conversation"}</DialogTitle>
            <DialogDescription>
              Are you sure you want to leave {isPublicChannel ? `#${conversation?.name}` : displayName}? {isPublicChannel ? "You can rejoin anytime." : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button
              onClick={() => setLeaveDialogOpen(false)}
              className="rounded border border-subtle px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-surface-3"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                handleLeave();
                setLeaveDialogOpen(false);
              }}
              className="rounded bg-status-danger px-3 py-1.5 text-sm text-white transition-colors hover:bg-status-danger/90"
            >
              Leave
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Archive confirmation dialog */}
      <Dialog open={archiveDialogOpen} onOpenChange={setArchiveDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Archive {isPublicChannel ? "channel" : "conversation"}</DialogTitle>
            <DialogDescription>
              Are you sure you want to archive {isPublicChannel ? `#${conversation?.name}` : displayName}? Messages will remain readable but no one can send new ones.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button
              onClick={() => setArchiveDialogOpen(false)}
              className="rounded border border-subtle px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-surface-3"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                handleArchive();
                setArchiveDialogOpen(false);
              }}
              className="rounded bg-status-danger px-3 py-1.5 text-sm text-white transition-colors hover:bg-status-danger/90"
            >
              Archive
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
