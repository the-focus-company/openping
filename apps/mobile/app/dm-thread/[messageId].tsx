import { useState, useCallback, useMemo } from "react";
import {
  View,
  FlatList,
  ActivityIndicator,
  Text,
  Switch,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Alert,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { useLocalSearchParams, Stack } from "expo-router";
import { useQuery, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { MessageBubble } from "@/components/MessageBubble";
import { MessageComposer } from "@/components/MessageComposer";
import { MessageActionSheet } from "@/components/MessageActionSheet";
import { CollapsibleAttachments } from "@/components/CollapsibleAttachments";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useDMReactions } from "@/hooks/useReactions";

export default function DMThreadScreen() {
  const { messageId, conversationId } = useLocalSearchParams<{
    messageId: string;
    conversationId: string;
  }>();
  const typedThreadId = messageId as Id<"directMessages">;
  const typedConversationId = conversationId as Id<"directConversations">;

  const thread = useQuery(api.threads.listRepliesDM, {
    threadId: typedThreadId,
  });
  const sendReply = useMutation(api.threads.sendReplyDM);
  const { user } = useCurrentUser();

  // DM Reactions
  const allMessageIds = useMemo(() => {
    if (!thread) return [];
    return [
      thread.parent._id as Id<"directMessages">,
      ...thread.replies.map((r: any) => r._id as Id<"directMessages">),
    ];
  }, [thread]);
  const { reactionsByMessage, toggleReaction } = useDMReactions(allMessageIds);

  const [alsoSendToConversation, setAlsoSendToConversation] = useState(false);
  const [actionSheet, setActionSheet] = useState<{
    visible: boolean;
    messageId?: string;
    timestamp?: number;
  }>({ visible: false });

  const handleSend = useCallback(
    (body: string) => {
      if (!body) return;
      sendReply({
        conversationId: typedConversationId,
        threadId: typedThreadId,
        body,
        alsoSendToConversation,
      });
    },
    [sendReply, typedConversationId, typedThreadId, alsoSendToConversation],
  );

  if (thread === undefined) {
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
          title: "Thread",
          headerStyle: { backgroundColor: "#111" },
          headerTintColor: "#fff",
        }}
      />

      <FlatList
        data={thread.replies}
        keyExtractor={(item: any) => item._id}
        ListHeaderComponent={
          <View>
            <MessageBubble
              authorName={thread.parent.author?.name ?? "Unknown"}
              authorAvatarUrl={thread.parent.author?.avatarUrl}
              body={thread.parent.body}
              timestamp={thread.parent._creationTime}
              isOwn={thread.parent.authorId === user?._id}
              type={thread.parent.type}
              reactions={reactionsByMessage[thread.parent._id] ?? []}
              onToggleReaction={(emoji) => toggleReaction(thread.parent._id, emoji)}
              currentUserId={user?._id}
              onLongPress={() =>
                setActionSheet({
                  visible: true,
                  messageId: thread.parent._id,
                  timestamp: thread.parent._creationTime,
                })
              }
            />
            {(thread.parent as any).attachments && (thread.parent as any).attachments.length > 0 && (
              <CollapsibleAttachments attachments={(thread.parent as any).attachments} />
            )}
            <View style={styles.divider}>
              <Text style={styles.dividerText}>
                {thread.replies.length}{" "}
                {thread.replies.length === 1 ? "reply" : "replies"}
              </Text>
            </View>
          </View>
        }
        renderItem={({ item }: { item: any }) => (
          <View>
            <MessageBubble
              authorName={item.author?.name ?? "Unknown"}
              authorAvatarUrl={item.author?.avatarUrl}
              body={item.body}
              timestamp={item._creationTime}
              isOwn={item.authorId === user?._id}
              type={item.type}
              reactions={reactionsByMessage[item._id] ?? []}
              onToggleReaction={(emoji) => toggleReaction(item._id, emoji)}
              currentUserId={user?._id}
              onLongPress={() =>
                setActionSheet({
                  visible: true,
                  messageId: item._id,
                  timestamp: item._creationTime,
                })
              }
            />
            {item.attachments && item.attachments.length > 0 && (
              <CollapsibleAttachments attachments={item.attachments} />
            )}
          </View>
        )}
        contentContainerStyle={styles.messageList}
        ListEmptyComponent={
          <View style={styles.emptyMessages}>
            <Text style={styles.emptyText}>No replies yet</Text>
          </View>
        }
      />

      <View style={styles.toggleRow}>
        <Text style={styles.toggleLabel}>Also send to conversation</Text>
        <Switch
          value={alsoSendToConversation}
          onValueChange={setAlsoSendToConversation}
          trackColor={{ false: "#333", true: "#0a7ea4" }}
          thumbColor="#fff"
        />
      </View>

      <MessageComposer onSend={handleSend} enableAttachments placeholder="Reply in thread..." />

      <MessageActionSheet
        visible={actionSheet.visible}
        onClose={() => setActionSheet({ visible: false })}
        onReaction={(emoji) => {
          if (actionSheet.messageId) {
            toggleReaction(actionSheet.messageId, emoji);
          }
        }}
        onReply={() => {
          setActionSheet({ visible: false });
        }}
        onForward={() => {
          Alert.alert("Forward", "Forward feature coming soon");
        }}
        onCopyLink={() => {
          if (actionSheet.messageId) {
            Clipboard.setStringAsync(
              `https://openping.app/dm/${conversationId}?thread=${messageId}&msg=${actionSheet.messageId}`,
            );
          }
        }}
        messageDate={actionSheet.timestamp ?? Date.now()}
      />
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
  divider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#333",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#333",
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginVertical: 4,
  },
  dividerText: {
    fontSize: 13,
    color: "#888",
    fontWeight: "600",
  },
  emptyMessages: {
    alignItems: "center",
    paddingVertical: 24,
  },
  emptyText: {
    color: "#888",
    fontSize: 14,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#333",
    backgroundColor: "#111",
  },
  toggleLabel: {
    fontSize: 14,
    color: "#999",
  },
});
