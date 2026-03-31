import { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  Modal,
  FlatList,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { useQuery, useMutation, useConvex } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { getDMDisplayName } from "@/lib/dmDisplayName";
import { getInitials } from "@/lib/initials";
import { X, Send, User, Users, Hash } from "lucide-react-native";

interface ForwardModalProps {
  visible: boolean;
  onClose: () => void;
  messageBody: string;
  authorName: string;
}

type ForwardTarget = {
  id: string;
  type: "channel" | "dm";
  name: string;
  icon: "user" | "users" | "hash";
};

export function ForwardModal({
  visible,
  onClose,
  messageBody,
  authorName,
}: ForwardModalProps) {
  const { workspaceId } = useWorkspace();
  const { user } = useCurrentUser();
  const channels = useQuery(api.channels.list, { workspaceId });
  const conversations = useQuery(api.directConversations.list);
  const sendChannelMessage = useMutation(api.messages.send);
  const sendDM = useMutation(api.directMessages.send);

  const [query, setQuery] = useState("");
  const [sending, setSending] = useState(false);

  const targets: ForwardTarget[] = [];

  if (channels) {
    for (const ch of channels) {
      if (!ch.isMember || ch.isArchived) continue;
      targets.push({
        id: ch._id,
        type: "channel",
        name: `# ${ch.name}`,
        icon: "hash",
      });
    }
  }

  if (conversations) {
    for (const conv of conversations) {
      const displayName = getDMDisplayName(
        conv.name,
        (conv as any).members ?? [],
        user?._id,
      );
      targets.push({
        id: conv._id,
        type: "dm",
        name: displayName,
        icon: (conv as any).kind === "group" || (conv as any).kind === "agent_group" ? "users" : "user",
      });
    }
  }

  const filtered = query
    ? targets.filter((t) => t.name.toLowerCase().includes(query.toLowerCase()))
    : targets;

  async function handleForward(target: ForwardTarget) {
    setSending(true);
    const forwardedBody = `> *Forwarded from ${authorName}:*\n> ${messageBody.split("\n").join("\n> ")}`;

    try {
      if (target.type === "channel") {
        await sendChannelMessage({
          channelId: target.id as Id<"channels">,
          body: forwardedBody,
        });
      } else {
        await sendDM({
          conversationId: target.id as Id<"directConversations">,
          body: forwardedBody,
        });
      }
      onClose();
    } finally {
      setSending(false);
    }
  }

  const renderIcon = (icon: string) => {
    switch (icon) {
      case "hash": return <Hash size={18} color="#888" />;
      case "users": return <Users size={18} color="#888" />;
      default: return <User size={18} color="#888" />;
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Forward message</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <X size={20} color="#888" />
            </Pressable>
          </View>

          <View style={styles.preview}>
            <Text style={styles.previewAuthor}>{authorName}</Text>
            <Text style={styles.previewBody} numberOfLines={2}>{messageBody}</Text>
          </View>

          <TextInput
            style={styles.search}
            placeholder="Search conversations..."
            placeholderTextColor="#666"
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />

          {sending ? (
            <View style={styles.loading}>
              <ActivityIndicator color="#0a7ea4" />
              <Text style={styles.loadingText}>Sending...</Text>
            </View>
          ) : (
            <FlatList
              data={filtered}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <Pressable
                  style={({ pressed }) => [styles.targetRow, pressed && styles.targetRowPressed]}
                  onPress={() => handleForward(item)}
                >
                  <View style={styles.targetIcon}>{renderIcon(item.icon)}</View>
                  <Text style={styles.targetName} numberOfLines={1}>{item.name}</Text>
                  <Send size={16} color="#0a7ea4" />
                </Pressable>
              )}
              ListEmptyComponent={
                <Text style={styles.empty}>No conversations found</Text>
              }
              keyboardShouldPersistTaps="handled"
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: "#1c1c1e",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: "70%",
    paddingBottom: 34,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#333",
  },
  headerTitle: { color: "#fff", fontSize: 17, fontWeight: "600" },
  preview: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#333",
    backgroundColor: "#222",
  },
  previewAuthor: { color: "#ccc", fontSize: 13, fontWeight: "600", marginBottom: 2 },
  previewBody: { color: "#888", fontSize: 13, lineHeight: 18 },
  search: {
    backgroundColor: "#2c2c2e",
    color: "#fff",
    fontSize: 15,
    paddingHorizontal: 16,
    paddingVertical: 10,
    margin: 12,
    borderRadius: 10,
  },
  loading: { alignItems: "center", paddingVertical: 30, gap: 8 },
  loadingText: { color: "#888", fontSize: 14 },
  targetRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#222",
  },
  targetRowPressed: { backgroundColor: "#2c2c2e" },
  targetIcon: { width: 32, alignItems: "center" },
  targetName: { flex: 1, color: "#ccc", fontSize: 15 },
  empty: { color: "#666", fontSize: 14, textAlign: "center", paddingVertical: 30 },
});
