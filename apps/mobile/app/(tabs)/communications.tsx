import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  Pressable,
  ActionSheetIOS,
  Platform,
  StyleSheet,
} from "react-native";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { getDMDisplayName } from "@/lib/dmDisplayName";
import { useRouter, Stack } from "expo-router";
import { formatRelativeTime } from "@/lib/formatRelativeTime";

type CommunicationItem = {
  id: string;
  type: "channel" | "dm";
  name: string;
  lastMessagePreview?: string;
  lastMessageAuthor?: string;
  unreadCount: number;
  isStarred: boolean;
  timestamp: number;
  route: { pathname: string; params: Record<string, string> };
};

export default function CommunicationsScreen() {
  const { workspaceId } = useWorkspace();
  const channels = useQuery(api.channels.list, { workspaceId });
  const conversations = useQuery(api.directConversations.list);
  const { user } = useCurrentUser();
  const router = useRouter();

  const loading = channels === undefined || conversations === undefined;

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0a7ea4" />
      </View>
    );
  }

  const items: CommunicationItem[] = [];

  for (const ch of channels) {
    if (!ch.isMember || ch.isArchived) continue;
    items.push({
      id: ch._id,
      type: "channel",
      name: ch.name,
      lastMessagePreview: undefined,
      unreadCount: ch.unreadCount ?? 0,
      isStarred: ch.isStarred ?? false,
      timestamp: ch._creationTime,
      route: {
        pathname: "/channel/[channelId]",
        params: { channelId: ch._id },
      },
    });
  }

  for (const conv of conversations) {
    const displayName = getDMDisplayName(
      conv.name,
      (conv as any).members ?? [],
      user?._id,
    );
    items.push({
      id: conv._id,
      type: "dm",
      name: displayName,
      lastMessagePreview: (conv as any).lastMessage?.body,
      lastMessageAuthor: (conv as any).lastMessage?.authorName,
      unreadCount: (conv as any).unreadCount ?? 0,
      isStarred: false,
      timestamp: (conv as any).lastMessage?.timestamp ?? conv._creationTime,
      route: {
        pathname: "/dm/[conversationId]",
        params: { conversationId: conv._id },
      },
    });
  }

  items.sort((a, b) => {
    if (a.isStarred !== b.isStarred) return a.isStarred ? -1 : 1;
    return b.timestamp - a.timestamp;
  });

  function handleNewPress() {
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ["Cancel", "New DM"],
          cancelButtonIndex: 0,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) {
            router.push("/new-conversation");
          }
        },
      );
    } else {
      router.push("/new-conversation");
    }
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () => (
            <View style={styles.headerButtons}>
              <Pressable onPress={() => router.push("/search")} hitSlop={8}>
                <Text style={styles.headerIcon}>🔍</Text>
              </Pressable>
              <Pressable onPress={handleNewPress} hitSlop={8}>
                <Text style={styles.addButton}>+</Text>
              </Pressable>
            </View>
          ),
        }}
      />
      <View style={styles.container}>
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [
                styles.row,
                pressed && styles.rowPressed,
              ]}
              onPress={() => router.push(item.route as any)}
            >
              <View style={styles.iconWrap}>
                {item.type === "channel" ? (
                  <Text style={styles.channelIcon}>#</Text>
                ) : (
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>
                      {item.name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}
              </View>

              <View style={styles.content}>
                <View style={styles.topRow}>
                  <Text
                    style={[
                      styles.name,
                      item.unreadCount > 0 && styles.nameBold,
                    ]}
                    numberOfLines={1}
                  >
                    {item.isStarred ? "★ " : ""}
                    {item.name}
                  </Text>
                  <Text style={styles.time}>
                    {formatRelativeTime(item.timestamp)}
                  </Text>
                </View>
                {item.lastMessagePreview && (
                  <Text style={styles.preview} numberOfLines={1}>
                    {item.lastMessageAuthor
                      ? `${item.lastMessageAuthor}: `
                      : ""}
                    {item.lastMessagePreview}
                  </Text>
                )}
              </View>

              {item.unreadCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    {item.unreadCount > 99 ? "99+" : item.unreadCount}
                  </Text>
                </View>
              )}
            </Pressable>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No conversations yet</Text>
              <Text style={styles.emptySubtext}>
                Tap + to start a new conversation
              </Text>
            </View>
          }
          contentContainerStyle={
            items.length === 0 ? styles.emptyContainer : undefined
          }
        />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#000",
  },
  headerButtons: { flexDirection: "row", alignItems: "center", gap: 12 },
  headerIcon: { fontSize: 20 },
  addButton: { color: "#0a7ea4", fontSize: 28, fontWeight: "300", paddingHorizontal: 4 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#222",
    gap: 12,
  },
  rowPressed: { backgroundColor: "#1a1a1a" },
  iconWrap: { width: 44, alignItems: "center", justifyContent: "center" },
  channelIcon: { fontSize: 22, fontWeight: "700", color: "#666" },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#333",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: { color: "#fff", fontSize: 18, fontWeight: "600" },
  content: { flex: 1 },
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  name: { fontSize: 16, color: "#ccc", flex: 1 },
  nameBold: { color: "#fff", fontWeight: "600" },
  time: { fontSize: 12, color: "#666", marginLeft: 8 },
  preview: { fontSize: 14, color: "#888", marginTop: 2 },
  badge: {
    backgroundColor: "#0a7ea4",
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    justifyContent: "center",
    alignItems: "center",
  },
  badgeText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  empty: { alignItems: "center", paddingTop: 60 },
  emptyText: { color: "#888", fontSize: 16, marginBottom: 4 },
  emptySubtext: { color: "#666", fontSize: 14 },
  emptyContainer: { flex: 1 },
});
