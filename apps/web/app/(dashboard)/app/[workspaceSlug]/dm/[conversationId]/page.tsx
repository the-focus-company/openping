"use client";

import { use, useState, useCallback, useEffect, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useQuery, usePaginatedQuery, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import { Id } from "@convex/_generated/dataModel";
import { MessageList, type Message } from "@/components/channel/MessageList";
import { ConversationTopBar } from "@/components/channel/ConversationTopBar";
import { ConversationTopBarSkeleton, ComposerSkeleton } from "@/components/channel/ChannelSkeleton";
import { MessageSkeleton } from "@/components/channel/MessageSkeleton";
import { UserProfileDialog } from "@/components/user/UserProfileDialog";
import { useDMTyping } from "@/hooks/useTyping";
import { useThreadPanel } from "@/hooks/useThreadPanel";
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

export default function DMPage({ params }: Props) {
  const { conversationId } = use(params);
  const typedId = conversationId as Id<"directConversations">;
  const searchParams = useSearchParams();
  const highlightMessageId = searchParams.get("msg");

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
  const archiveConversation = useMutation(api.directConversations.archive);
  const removeConversation = useMutation(api.directConversations.remove);
  const currentUser = useQuery(api.users.getMe);
  const startMeeting = useMutation(api.meetings.startInDM);
  const joinMeetingMut = useMutation(api.meetings.joinMeeting);
  const endMeetingMut = useMutation(api.meetings.endMeeting);
  const activeMeeting = useQuery(api.meetings.getActiveMeeting, { conversationId: typedId });
  const { typingUsers, onTyping, onSendClear } = useDMTyping(typedId);
  const { openThreadPanel, closeThreadPanel } = useThreadPanel();
  const { toast } = useToast();
  const router = useRouter();
  const { buildPath, workspaceId } = useWorkspace();

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
      authorAvatarUrl: msg.author?.avatarUrl,
      content: msg.body,
      timestamp: new Date(msg._creationTime),
      botName: msg.isAgent ? msg.author?.name ?? "Agent" : undefined,
      threadReplyCount: msg.threadReplyCount,
      threadLastReplyAt: msg.threadLastReplyAt,
      threadParticipants: msg.threadParticipants,
      threadId: msg.threadId,
      alsoSentToChannel: msg.alsoSentToConversation,
      isEdited: msg.isEdited,
      attachments: msg.attachments as Array<{ storageId: string; filename: string; mimeType: string; size: number }> | undefined,
      meetingId: msg.meetingId,
      meeting: msg.meeting,
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
    const member = conversation?.members.find(
      (m) => m.name.toLowerCase() === name.toLowerCase(),
    );
    if (member) {
      setProfileUserId(member.userId as Id<"users">);
    }
  }, [conversation?.members]);

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

  const handleCopyLink = useCallback(() => {
    navigator.clipboard.writeText(window.location.href);
    toast("Link copied", "success");
  }, [toast]);

  const handleCopyMessageLink = useCallback((messageId: string) => {
    const url = new URL(window.location.href);
    url.search = "";
    url.searchParams.set("msg", messageId);
    navigator.clipboard.writeText(url.toString());
    toast("Link copied", "success");
  }, [toast]);

  const handleArchive = useCallback(async () => {
    await archiveConversation({ conversationId: typedId });
    toast("Conversation archived", "success");
    router.push(buildPath("/dms"));
  }, [archiveConversation, typedId, toast, router, buildPath]);

  const handleDeleteConversation = useCallback(async () => {
    await removeConversation({ conversationId: typedId });
    toast("Conversation deleted", "success");
    router.push(buildPath("/dms"));
  }, [removeConversation, typedId, toast, router, buildPath]);

  const isLoadingFirstPage = status === "LoadingFirstPage";
  const convKind = (conversation?.kind ?? "1to1") as "1to1" | "group" | "agent_1to1" | "agent_group";

  return (
    <div className="relative flex h-full flex-col">
      {conversation ? (
        <ConversationTopBar
          name={displayName}
          members={otherMembers}
          kind={convKind}
          onCopyId={handleCopyLink}
          onArchive={handleArchive}
          onDelete={handleDeleteConversation}
          onStartMeeting={handleStartMeeting}
          hasActiveMeeting={!!activeMeeting}
        />
      ) : (
        <ConversationTopBarSkeleton />
      )}

      {isLoadingFirstPage ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="mt-auto py-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <MessageSkeleton key={i} />
            ))}
          </div>
          <ComposerSkeleton />
        </div>
      ) : (
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
          onClickAuthor={handleClickAuthor}
          onClickMention={handleClickMention}
          highlightMessageId={highlightMessageId}
          onCopyMessageLink={handleCopyMessageLink}
          onJoinMeeting={handleJoinMeeting}
          onEndMeeting={handleEndMeeting}
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
