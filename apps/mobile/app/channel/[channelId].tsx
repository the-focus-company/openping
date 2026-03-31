import { useEffect, useCallback, useState, useMemo } from "react";
import {
  View,
  FlatList,
  ActivityIndicator,
  Text,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Alert,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { useLocalSearchParams, Stack, useRouter } from "expo-router";
import { useQuery, useMutation, useConvex } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { MessageBubble } from "@/components/MessageBubble";
import { MessageComposer } from "@/components/MessageComposer";
import { MessageActionSheet } from "@/components/MessageActionSheet";
import { CollapsibleAttachments } from "@/components/CollapsibleAttachments";
import { DateSeparator } from "@/components/DateSeparator";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useReactions } from "@/hooks/useReactions";
import { TypingIndicator } from "@/components/TypingIndicator";
import { ForwardModal } from "@/components/ForwardModal";
import { IntegrationCard } from "@/components/IntegrationCard";
import { uploadFile } from "@/lib/fileUpload";

function isSameDay(a: number, b: number): boolean {
  const da = new Date(a);
  const db = new Date(b);
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
}

type ListItem =
  | { type: "message"; data: any; showHeader: boolean }
  | { type: "date"; timestamp: number };

export default function ChannelDetailScreen() {
  const { channelId } = useLocalSearchParams<{ channelId: string }>();
  const typedChannelId = channelId as Id<"channels">;

  const channel = useQuery(api.channels.get, { channelId: typedChannelId });
  const messages = useQuery(api.messages.listByChannel, {
    channelId: typedChannelId,
  });
  const markRead = useMutation(api.channels.markRead);
  const sendMessage = useMutation(api.messages.send);
  const joinChannel = useMutation(api.channels.join);
  const router = useRouter();
  const { user } = useCurrentUser();
  const convex = useConvex();

  const [joining, setJoining] = useState(false);
  const [actionSheet, setActionSheet] = useState<{
    visible: boolean;
    messageId?: string;
    timestamp?: number;
  }>({ visible: false });
  const [forwardMsg, setForwardMsg] = useState<{ body: string; author: string } | null>(null);

  const messageIds = useMemo(
    () => (messages ?? []).map((m: any) => m._id as Id<"messages">),
    [messages],
  );
  const { reactionsByMessage, toggleReaction } = useReactions(messageIds);
  const typingUsers = useQuery(api.typing.getTypingUsers, { channelId: typedChannelId });

  useEffect(() => {
    if (channel?.isMember) {
      markRead({ channelId: typedChannelId });
    }
  }, [channel?.isMember, typedChannelId, markRead]);

  const handleSend = useCallback(
    async (
      body: string,
      pendingFiles?: {
        uri: string;
        name: string;
        mimeType: string;
        size: number;
      }[],
    ) => {
      if (!body && (!pendingFiles || pendingFiles.length === 0)) return;

      let attachments;
      if (pendingFiles && pendingFiles.length > 0) {
        attachments = await Promise.all(
          pendingFiles.map((file) => uploadFile(convex, file)),
        );
      }

      await sendMessage({
        channelId: typedChannelId,
        body: body || " ",
        ...(attachments ? { attachments } : {}),
      });
    },
    [sendMessage, typedChannelId, convex],
  );

  const handleJoin = async () => {
    setJoining(true);
    try {
      await joinChannel({ channelId: typedChannelId });
    } finally {
      setJoining(false);
    }
  };

  // Build list items with date separators (inverted, so newest first)
  // In inverted list: messages[0]=newest (bottom), messages[i+1]=older (above)
  const listItems = useMemo(() => {
    if (!messages) return [];
    const items: ListItem[] = [];
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      // Show header unless the message above (older = i+1) is same author within 5min
      const olderMsg = messages[i + 1];
      const sameAuthorAbove =
        olderMsg &&
        olderMsg.authorId === msg.authorId &&
        isSameDay(msg._creationTime, olderMsg._creationTime) &&
        msg._creationTime - olderMsg._creationTime < 5 * 60 * 1000;
      items.push({ type: "message", data: msg, showHeader: !sameAuthorAbove });
      const nextMsg = messages[i + 1];
      if (nextMsg && !isSameDay(msg._creationTime, nextMsg._creationTime)) {
        items.push({ type: "date", timestamp: msg._creationTime });
      }
    }
    if (messages.length > 0) {
      items.push({ type: "date", timestamp: messages[messages.length - 1]._creationTime });
    }
    return items;
  }, [messages]);

  if (messages === undefined || channel === undefined) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0a7ea4" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={90}
    >
      <Stack.Screen
        options={{
          title: channel ? `# ${channel.name}` : "Channel",
          headerStyle: { backgroundColor: "#111" },
          headerTintColor: "#fff",
          headerTitle: () => (
            <Pressable
              onPress={() =>
                router.push({
                  pathname: "/channel-info/[channelId]",
                  params: { channelId },
                })
              }
            >
              <Text style={styles.headerTitleText}>
                {channel ? `# ${channel.name}` : "Channel"}
              </Text>
            </Pressable>
          ),
        }}
      />

      <FlatList
        data={listItems}
        keyExtractor={(item, idx) =>
          item.type === "message" ? item.data._id : `date-${idx}`
        }
        renderItem={({ item }) => {
          if (item.type === "date") {
            return <DateSeparator timestamp={item.timestamp} />;
          }
          const msg = item.data;
          const lastParticipant = msg.threadParticipants?.[msg.threadParticipants.length - 1];
          return (
            <View>
              <MessageBubble
                authorName={msg.author?.name ?? "Unknown"}
                authorAvatarUrl={msg.author?.avatarUrl}
                body={msg.body}
                timestamp={msg._creationTime}
                isOwn={msg.authorId === user?._id}
                type={msg.type}
                messageId={msg._id}
                reactions={reactionsByMessage[msg._id] ?? []}
                onToggleReaction={(emoji) => toggleReaction(msg._id, emoji)}
                currentUserId={user?._id}
                showHeader={item.showHeader}
                onPress={() =>
                  router.push({
                    pathname: "/thread/[messageId]",
                    params: { messageId: msg._id, channelId },
                  })
                }
                onLongPress={() =>
                  setActionSheet({
                    visible: true,
                    messageId: msg._id,
                    timestamp: msg._creationTime,
                  })
                }
                threadReplyCount={msg.threadReplyCount}
                threadLastReplyAuthor={lastParticipant?.name}
                threadLastReplyAvatarUrl={lastParticipant?.avatarUrl}
                threadLastReplyAt={msg.threadLastReplyAt}
                onThreadPress={() =>
                  router.push({
                    pathname: "/thread/[messageId]",
                    params: { messageId: msg._id, channelId },
                  })
                }
              />
              {msg.attachments && msg.attachments.length > 0 && (
                <CollapsibleAttachments attachments={msg.attachments} />
              )}
              {msg.integrationObject && (
                <View style={{ marginLeft: 66, marginRight: 16 }}>
                  <IntegrationCard integration={msg.integrationObject} />
                </View>
              )}
            </View>
          );
        }}
        inverted
        contentContainerStyle={styles.messageList}
        ListEmptyComponent={
          <View style={styles.emptyMessages}>
            <Text style={styles.emptyText}>No messages yet</Text>
            <Text style={styles.emptySubtext}>Be the first to say something!</Text>
          </View>
        }
      />

      <TypingIndicator userNames={(typingUsers ?? []).map((u: any) => u.name)} />

      {channel?.isMember ? (
        <MessageComposer
          onSend={handleSend}
          enableAttachments
          placeholder={`Message #${channel?.name ?? ""}...`}
        />
      ) : (
        <View style={styles.joinBar}>
          <Pressable
            style={[styles.joinBtn, joining && styles.joinBtnDisabled]}
            onPress={handleJoin}
            disabled={joining}
          >
            <Text style={styles.joinBtnText}>
              {joining ? "Joining..." : "Join Channel"}
            </Text>
          </Pressable>
        </View>
      )}

      <MessageActionSheet
        visible={actionSheet.visible}
        onClose={() => setActionSheet({ visible: false })}
        onReaction={(emoji) => {
          if (actionSheet.messageId) {
            toggleReaction(actionSheet.messageId as Id<"messages">, emoji);
          }
        }}
        onReply={() => {
          if (actionSheet.messageId) {
            router.push({
              pathname: "/thread/[messageId]",
              params: { messageId: actionSheet.messageId, channelId },
            });
          }
        }}
        onForward={() => {
          if (actionSheet.messageId && messages) {
            const msg = messages.find((m: any) => m._id === actionSheet.messageId);
            if (msg) {
              setForwardMsg({ body: msg.body, author: (msg as any).author?.name ?? "Unknown" });
            }
          }
          setActionSheet({ visible: false });
        }}
        onCopyLink={() => {
          if (actionSheet.messageId) {
            Clipboard.setStringAsync(
              `https://openping.app/channel/${channelId}?msg=${actionSheet.messageId}`,
            );
          }
        }}
        messageDate={actionSheet.timestamp ?? Date.now()}
      />

      {forwardMsg && (
        <ForwardModal
          visible={!!forwardMsg}
          onClose={() => setForwardMsg(null)}
          messageBody={forwardMsg.body}
          authorName={forwardMsg.author}
        />
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#000",
  },
  messageList: {
    paddingVertical: 8,
  },
  emptyMessages: {
    alignItems: "center",
    paddingVertical: 40,
    transform: [{ scaleY: -1 }],
  },
  emptyText: {
    color: "#888",
    fontSize: 16,
    marginBottom: 4,
  },
  emptySubtext: {
    color: "#666",
    fontSize: 14,
  },
  joinBar: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#333",
    backgroundColor: "#111",
    padding: 12,
    alignItems: "center",
  },
  joinBtn: {
    backgroundColor: "#0a7ea4",
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 10,
  },
  joinBtnDisabled: {
    opacity: 0.5,
  },
  joinBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  headerTitleText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "600",
  },
});
