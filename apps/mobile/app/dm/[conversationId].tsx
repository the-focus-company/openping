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
import { useQuery, useMutation, usePaginatedQuery, useConvex } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { MessageBubble } from "@/components/MessageBubble";
import { MessageComposer } from "@/components/MessageComposer";
import { MessageActionSheet } from "@/components/MessageActionSheet";
import { CollapsibleAttachments } from "@/components/CollapsibleAttachments";
import { DateSeparator } from "@/components/DateSeparator";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useDMReactions } from "@/hooks/useReactions";
import { TypingIndicator } from "@/components/TypingIndicator";
import { uploadFile } from "@/lib/fileUpload";
import { getDMDisplayName } from "@/lib/dmDisplayName";
import { ForwardModal } from "@/components/ForwardModal";

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

export default function DMDetailScreen() {
  const { conversationId } = useLocalSearchParams<{
    conversationId: string;
  }>();
  const typedConversationId = conversationId as Id<"directConversations">;

  const conversation = useQuery(api.directConversations.get, {
    conversationId: typedConversationId,
  });
  const { results: messages, status, loadMore } = usePaginatedQuery(
    api.directMessages.list,
    { conversationId: typedConversationId },
    { initialNumItems: 25 },
  );
  const router = useRouter();
  const markRead = useMutation(api.directConversations.markRead);
  const sendMessage = useMutation(api.directMessages.send);
  const { user } = useCurrentUser();
  const convex = useConvex();
  const typingUsers = useQuery(api.typing.getTypingUsersDM, { conversationId: typedConversationId });

  // DM Reactions
  const allDMMessageIds = useMemo(() => {
    if (!messages) return [];
    return messages.map((m) => m._id as Id<"directMessages">);
  }, [messages]);
  const { reactionsByMessage, toggleReaction } = useDMReactions(allDMMessageIds);

  const [actionSheet, setActionSheet] = useState<{
    visible: boolean;
    messageId?: string;
    timestamp?: number;
  }>({ visible: false });
  const [forwardMsg, setForwardMsg] = useState<{ body: string; author: string } | null>(null);

  useEffect(() => {
    markRead({ conversationId: typedConversationId });
  }, [typedConversationId, markRead]);

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
      let attachments;
      if (pendingFiles && pendingFiles.length > 0) {
        attachments = await Promise.all(
          pendingFiles.map((file) => uploadFile(convex, file)),
        );
      }

      await sendMessage({
        conversationId: typedConversationId,
        body: body || " ",
        ...(attachments ? { attachments } : {}),
      });
    },
    [sendMessage, typedConversationId, convex],
  );

  const handleLoadMore = useCallback(() => {
    if (status === "CanLoadMore") {
      loadMore(25);
    }
  }, [status, loadMore]);

  const displayName = getDMDisplayName(
    conversation?.name,
    conversation?.members ?? [],
    user?._id,
  );

  // Build list items with date separators + message grouping
  const listItems = useMemo(() => {
    if (!messages) return [];
    const items: ListItem[] = [];
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
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

  if (messages === undefined) {
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
          title: displayName,
          headerStyle: { backgroundColor: "#111" },
          headerTintColor: "#fff",
          headerTitle: () => (
            <Pressable
              onPress={() =>
                router.push({
                  pathname: "/dm-info/[conversationId]",
                  params: { conversationId },
                })
              }
            >
              <Text style={styles.headerTitleText}>
                {displayName}
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
          return (
            <View>
              <MessageBubble
                authorName={msg.author?.name ?? "Unknown"}
                authorAvatarUrl={msg.author?.avatarUrl}
                body={msg.body}
                timestamp={msg._creationTime}
                showHeader={item.showHeader}
                isOwn={msg.authorId === user?._id}
                type={msg.type}
                reactions={reactionsByMessage[msg._id] ?? []}
                onToggleReaction={(emoji) => toggleReaction(msg._id, emoji)}
                currentUserId={user?._id}
                onPress={() =>
                  router.push({
                    pathname: "/dm-thread/[messageId]",
                    params: { messageId: msg._id, conversationId },
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
                threadLastReplyAuthor={
                  msg.threadParticipants?.[msg.threadParticipants.length - 1]?.name
                }
                threadLastReplyAvatarUrl={
                  msg.threadParticipants?.[msg.threadParticipants.length - 1]?.avatarUrl
                }
                threadLastReplyAt={msg.threadLastReplyAt}
                onThreadPress={() =>
                  router.push({
                    pathname: "/dm-thread/[messageId]",
                    params: { messageId: msg._id, conversationId },
                  })
                }
              />
              {msg.attachments && msg.attachments.length > 0 && (
                <CollapsibleAttachments attachments={msg.attachments} />
              )}
            </View>
          );
        }}
        inverted
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        contentContainerStyle={styles.messageList}
        ListFooterComponent={
          status === "LoadingMore" ? (
            <ActivityIndicator style={styles.loadingMore} color="#0a7ea4" />
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.emptyMessages}>
            <Text style={styles.emptyText}>No messages yet</Text>
            <Text style={styles.emptySubtext}>
              Send the first message!
            </Text>
          </View>
        }
      />

      <TypingIndicator userNames={(typingUsers ?? []).map((u: any) => u.name)} />

      <MessageComposer
        onSend={handleSend}
        enableAttachments
        placeholder="Message..."
      />

      <MessageActionSheet
        visible={actionSheet.visible}
        onClose={() => setActionSheet({ visible: false })}
        onReaction={(emoji) => {
          if (actionSheet.messageId) {
            toggleReaction(actionSheet.messageId, emoji);
          }
        }}
        onReply={() => {
          if (actionSheet.messageId) {
            router.push({
              pathname: "/dm-thread/[messageId]",
              params: { messageId: actionSheet.messageId, conversationId },
            });
          }
        }}
        onForward={() => {
          if (actionSheet.messageId && messages) {
            const msg = messages.find((m) => m._id === actionSheet.messageId);
            if (msg) {
              setForwardMsg({ body: msg.body, author: (msg as any).author?.name ?? "Unknown" });
            }
          }
          setActionSheet({ visible: false });
        }}
        onCopyLink={() => {
          if (actionSheet.messageId) {
            Clipboard.setStringAsync(
              `https://openping.app/dm/${conversationId}?msg=${actionSheet.messageId}`,
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
  loadingMore: {
    paddingVertical: 16,
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
  headerTitleText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "600",
  },
});
