import { useState, useMemo } from "react";
import {
  View,
  Text,
  SectionList,
  ActivityIndicator,
  Pressable,
  ActionSheetIOS,
  Platform,
  Alert,
  StyleSheet,
} from "react-native";
import { useQuery, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import type { Id } from "@convex/_generated/dataModel";
import { getDMDisplayName } from "@/lib/dmDisplayName";
import { useRouter, Stack } from "expo-router";
import { formatRelativeTime } from "@/lib/formatRelativeTime";
import { User, Users, Filter, Plus, Hash, BellOff } from "lucide-react-native";

type CommunicationItem = {
  id: string;
  name: string;
  lastMessagePreview?: string;
  lastMessageAuthor?: string;
  unreadCount: number;
  isStarred: boolean;
  isMuted: boolean;
  folder: string | null;
  timestamp: number;
  route: { pathname: string; params: Record<string, string> };
  kind: "1to1" | "group" | "agent_1to1" | "agent_group";
  visibility: "public" | "secret" | "secret_can_be_public";
};

export default function CommunicationsScreen() {
  const { workspaceId } = useWorkspace();
  const conversations = useQuery(api.conversations.list, { workspaceId });
  const { user } = useCurrentUser();
  const router = useRouter();
  const createSection = useMutation(api.sidebarLayout.createSection);

  const [sortBy, setSortBy] = useState<"date" | "alpha">("date");
  const [filterUnread, setFilterUnread] = useState(false);
  const [filter1to1, setFilter1to1] = useState(false);

  const loading = conversations === undefined;

  const sections = useMemo(() => {
    if (loading) return [];

    const items: CommunicationItem[] = [];

    for (const conv of conversations) {
      const isPublicChannel = conv.visibility === "public";
      const displayName = isPublicChannel
        ? (conv.name ?? "Unnamed")
        : getDMDisplayName(
            conv.name,
            (conv as any).members ?? [],
            user?._id,
          ) ?? "Conversation";
      items.push({
        id: conv._id,
        name: displayName,
        lastMessagePreview: (conv as any).lastMessage?.body,
        lastMessageAuthor: (conv as any).lastMessage?.authorName,
        unreadCount: (conv as any).unreadCount ?? 0,
        isStarred: (conv as any).isStarred ?? false,
        isMuted: (conv as any).isMuted ?? false,
        folder: (conv as any).folder ?? null,
        timestamp: (conv as any).lastMessage?.timestamp ?? conv._creationTime,
        route: {
          pathname: "/conversation/[conversationId]",
          params: { conversationId: conv._id },
        },
        kind: conv.kind,
        visibility: conv.visibility,
      });
    }

    // Apply filters
    let filtered = items;
    if (filterUnread) {
      filtered = filtered.filter((item) => item.unreadCount > 0);
    }
    if (filter1to1) {
      filtered = filtered.filter(
        (item) => item.kind === "1to1" || item.kind === "agent_1to1",
      );
    }

    // Apply sorting
    if (sortBy === "alpha") {
      filtered.sort((a, b) => a.name.localeCompare(b.name));
    } else {
      filtered.sort((a, b) => b.timestamp - a.timestamp);
    }

    const favorites = filtered.filter((item) => item.isStarred);
    const foldered = filtered.filter((item) => !item.isStarred && item.folder);
    const recent = filtered.filter((item) => !item.isStarred && !item.folder);

    const result: { title: string; data: CommunicationItem[] }[] = [];
    if (favorites.length > 0) {
      result.push({ title: "Favorites", data: favorites });
    }

    // Group by folder
    const folderMap = new Map<string, CommunicationItem[]>();
    for (const item of foldered) {
      const f = item.folder!;
      if (!folderMap.has(f)) folderMap.set(f, []);
      folderMap.get(f)!.push(item);
    }
    for (const [folderName, items] of folderMap) {
      result.push({ title: folderName, data: items });
    }

    result.push({ title: "Recent", data: recent });

    return result;
  }, [conversations, user?._id, loading, sortBy, filterUnread, filter1to1]);

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
          options: ["Cancel", "New conversation", "New section"],
          cancelButtonIndex: 0,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) {
            router.push("/new-conversation");
          } else if (buttonIndex === 2) {
            Alert.prompt(
              "New Section",
              "Enter section name",
              (sectionName) => {
                if (sectionName?.trim()) {
                  createSection({ workspaceId, name: sectionName.trim() });
                }
              },
            );
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
            <Pressable onPress={showFilterOptions} hitSlop={12} style={styles.filterBtn}>
              <Filter size={18} color={filterUnread || filter1to1 ? "#0a7ea4" : "#888"} />
            </Pressable>
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
                {item.unreadCount > 0 && <View style={styles.unreadDot} />}
                <View style={styles.dmIconWrap}>
                  {item.visibility === "public" ? (
                    <Hash size={18} color="#aaa" />
                  ) : item.kind === "group" || item.kind === "agent_group" ? (
                    <Users size={18} color="#aaa" />
                  ) : (
                    <User size={18} color="#aaa" />
                  )}
                  {(item.kind === "agent_1to1" || item.kind === "agent_group") && (
                    <View style={styles.agentBadge}>
                      <Text style={styles.agentBadgeText}>AI</Text>
                    </View>
                  )}
                </View>
              </View>

              <View style={styles.content}>
                <View style={styles.topRow}>
                  <Text
                    style={[
                      styles.name,
                      item.unreadCount > 0 && !item.isMuted && styles.nameBold,
                      item.isMuted && styles.nameMuted,
                    ]}
                    numberOfLines={1}
                  >
                    {item.isStarred ? "\u2605 " : ""}
                    {item.visibility === "public" ? `# ${item.name}` : item.name}
                  </Text>
                  <Text style={styles.time}>
                    {formatRelativeTime(item.timestamp)}
                  </Text>
                </View>
                {item.lastMessagePreview && (
                  <Text style={[styles.preview, item.unreadCount > 0 && styles.previewUnread]} numberOfLines={1}>
                    {item.lastMessageAuthor
                      ? `${item.lastMessageAuthor}: `
                      : ""}
                    {item.lastMessagePreview}
                  </Text>
                )}
              </View>

              {item.isMuted && <BellOff size={14} color="#555" />}
              {item.unreadCount > 0 && !item.isMuted && (
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
          onPress={handleNewPress}
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
  filterBtn: { padding: 6, marginRight: 4 },
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
  iconWrap: { width: 44, alignItems: "center", justifyContent: "center", position: "relative" as const },
  unreadDot: {
    position: "absolute" as const,
    top: -2,
    left: -2,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#0a7ea4",
    zIndex: 1,
  },
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
  nameMuted: { color: "#555" },
  time: { fontSize: 12, color: "#666", marginLeft: 8 },
  preview: { fontSize: 14, color: "#888", marginTop: 2 },
  previewUnread: { color: "#bbb" },
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
    bottom: 64,
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
