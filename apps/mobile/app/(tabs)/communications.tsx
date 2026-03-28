import { useState, useMemo } from "react";
import {
  View,
  Text,
  SectionList,
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
import { User, Users, SlidersHorizontal, Plus } from "lucide-react-native";

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
  kind?: "1to1" | "group" | "agent_1to1" | "agent_group";
};

export default function CommunicationsScreen() {
  const { workspaceId } = useWorkspace();
  const channels = useQuery(api.channels.list, { workspaceId });
  const conversations = useQuery(api.directConversations.list);
  const { user } = useCurrentUser();
  const router = useRouter();

  const [sortBy, setSortBy] = useState<"date" | "alpha">("date");
  const [filterUnread, setFilterUnread] = useState(false);
  const [filter1to1, setFilter1to1] = useState(false);

  const loading = channels === undefined || conversations === undefined;

  const sections = useMemo(() => {
    if (loading) return [];

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
        kind: (conv as any).kind,
      });
    }

    // Apply filters
    let filtered = items;
    if (filterUnread) {
      filtered = filtered.filter((item) => item.unreadCount > 0);
    }
    if (filter1to1) {
      filtered = filtered.filter(
        (item) => item.type === "dm" && (item.kind === "1to1" || item.kind === "agent_1to1"),
      );
    }

    // Apply sorting
    if (sortBy === "alpha") {
      filtered.sort((a, b) => a.name.localeCompare(b.name));
    } else {
      filtered.sort((a, b) => b.timestamp - a.timestamp);
    }

    const favorites = filtered.filter((item) => item.isStarred);
    const recent = filtered.filter((item) => !item.isStarred);

    const result: { title: string; data: CommunicationItem[] }[] = [];
    if (favorites.length > 0) {
      result.push({ title: "Favorites", data: favorites });
    }
    result.push({ title: "Recent", data: recent });

    return result;
  }, [channels, conversations, user?._id, loading, sortBy, filterUnread, filter1to1]);

  function showFilterOptions() {
    if (Platform.OS === "ios") {
      const options = [
        "Cancel",
        "Sort by Date",
        "Sort by Name",
        filterUnread ? "Show All" : "Only Unread",
        filter1to1 ? "Show All Types" : "Only 1:1",
      ];
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options,
          cancelButtonIndex: 0,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) setSortBy("date");
          if (buttonIndex === 2) setSortBy("alpha");
          if (buttonIndex === 3) setFilterUnread((prev) => !prev);
          if (buttonIndex === 4) setFilter1to1((prev) => !prev);
        },
      );
    }
  }

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

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0a7ea4" />
      </View>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () => (
            <View style={styles.headerButtons}>
              <Pressable onPress={showFilterOptions} hitSlop={8}>
                <SlidersHorizontal size={20} color="#0a7ea4" />
              </Pressable>
              <Pressable onPress={handleNewPress} hitSlop={8}>
                <Text style={styles.addButton}>+</Text>
              </Pressable>
            </View>
          ),
        }}
      />
      <View style={styles.container}>
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          renderSectionHeader={({ section: { title } }) => (
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionHeaderText}>{title}</Text>
            </View>
          )}
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
                  <View style={styles.dmIconWrap}>
                    <Users size={20} color="#aaa" />
                  </View>
                ) : (
                  <View style={styles.dmIconWrap}>
                    {item.kind === "group" || item.kind === "agent_group" ? (
                      <Users size={20} color="#aaa" />
                    ) : (
                      <User size={20} color="#aaa" />
                    )}
                    {(item.kind === "agent_1to1" || item.kind === "agent_group") && (
                      <View style={styles.agentBadge}>
                        <Text style={styles.agentBadgeText}>AI</Text>
                      </View>
                    )}
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
                    {item.isStarred ? "\u2605 " : ""}
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
            sections.every((s) => s.data.length === 0) ? styles.emptyContainer : undefined
          }
        />

        {/* Floating Action Button */}
        <Pressable
          style={styles.fab}
          onPress={() => router.push("/new-conversation")}
        >
          <Plus size={24} color="#fff" />
        </Pressable>
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
  addButton: { color: "#0a7ea4", fontSize: 28, fontWeight: "300", paddingHorizontal: 4 },
  sectionHeader: {
    backgroundColor: "#111",
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  sectionHeaderText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#888",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
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
  dmIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#222",
    justifyContent: "center",
    alignItems: "center",
    position: "relative" as const,
  },
  agentBadge: {
    position: "absolute" as const,
    top: -2,
    right: -4,
    backgroundColor: "#7c3aed",
    borderRadius: 4,
    paddingHorizontal: 3,
    paddingVertical: 1,
  },
  agentBadgeText: {
    fontSize: 8,
    fontWeight: "700" as const,
    color: "#fff",
  },
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
  fab: {
    position: "absolute" as const,
    bottom: 20,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#7c3aed",
    justifyContent: "center" as const,
    alignItems: "center" as const,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
});
