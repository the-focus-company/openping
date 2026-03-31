import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  Pressable,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { useQuery, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { getInitials } from "@/lib/initials";
import { useRouter, Stack, useLocalSearchParams } from "expo-router";
import { Check, Users } from "lucide-react-native";

export default function NewConversationScreen() {
  const params = useLocalSearchParams<{ mode?: string }>();
  const isGroupMode = params.mode === "group";

  const [filter, setFilter] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<Id<"users">>>(new Set());
  const [groupName, setGroupName] = useState("");
  const { workspaceId } = useWorkspace();
  const { user } = useCurrentUser();
  const router = useRouter();
  const users = useQuery(api.users.listAll, { workspaceId });
  const agents = useQuery(api.agents.list, { workspaceId });
  const createConversation = useMutation(api.directConversations.create);

  // Build agent userId set
  const agentUserIds = new Set<string>();
  if (agents) {
    for (const a of agents as any[]) {
      if (a.agentUserId) agentUserIds.add(a.agentUserId);
    }
  }

  const filteredUsers = (users ?? []).filter((u) => {
    if (u._id === user?._id) return false;
    if (!filter) return true;
    const q = filter.toLowerCase();
    return (
      u.name?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q)
    );
  });

  function toggleSelect(userId: Id<"users">) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }

  async function handleSelect1to1(userId: Id<"users">) {
    const isAgent = agentUserIds.has(userId);
    const conversationId = await createConversation({
      kind: isAgent ? "agent_1to1" : "1to1",
      memberIds: [userId],
      ...(isAgent ? { agentMemberIds: [userId] } : {}),
      workspaceId,
    });
    router.replace({
      pathname: "/dm/[conversationId]",
      params: { conversationId },
    });
  }

  async function handleCreateGroup() {
    if (selectedIds.size < 2) return;
    const memberIds = Array.from(selectedIds);
    const agentMembers = memberIds.filter((id) => agentUserIds.has(id));
    const hasAgents = agentMembers.length > 0;

    const conversationId = await createConversation({
      kind: hasAgents ? "agent_group" : "group",
      memberIds,
      name: groupName.trim() || undefined,
      ...(hasAgents ? { agentMemberIds: agentMembers } : {}),
      workspaceId,
    });
    router.replace({
      pathname: "/dm/[conversationId]",
      params: { conversationId },
    });
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: isGroupMode ? "New Group" : "New Conversation",
          headerRight: isGroupMode && selectedIds.size >= 2
            ? () => (
                <Pressable onPress={handleCreateGroup} hitSlop={8}>
                  <Text style={styles.createBtn}>Create</Text>
                </Pressable>
              )
            : undefined,
        }}
      />
      <View style={styles.container}>
        {isGroupMode && (
          <>
            <TextInput
              style={styles.groupNameInput}
              placeholder="Group name (optional)"
              placeholderTextColor="#666"
              value={groupName}
              onChangeText={setGroupName}
            />
            {selectedIds.size > 0 && (
              <View style={styles.selectedBar}>
                <Users size={14} color="#0a7ea4" />
                <Text style={styles.selectedCount}>{selectedIds.size} selected</Text>
              </View>
            )}
          </>
        )}

        <TextInput
          style={styles.input}
          placeholder="Search people..."
          placeholderTextColor="#666"
          value={filter}
          onChangeText={setFilter}
          autoFocus={!isGroupMode}
        />

        {users === undefined ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#0a7ea4" />
          </View>
        ) : (
          <FlatList
            data={filteredUsers}
            keyExtractor={(item) => item._id}
            renderItem={({ item }) => {
              const initials = getInitials(item.name ?? "?");
              const isAgent = agentUserIds.has(item._id);
              const isSelected = selectedIds.has(item._id);

              return (
                <Pressable
                  style={({ pressed }) => [
                    styles.row,
                    pressed && styles.rowPressed,
                  ]}
                  onPress={() =>
                    isGroupMode ? toggleSelect(item._id) : handleSelect1to1(item._id)
                  }
                >
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{initials}</Text>
                    {isAgent && (
                      <View style={styles.aiBadge}>
                        <Text style={styles.aiBadgeText}>AI</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.info}>
                    <Text style={styles.name}>{item.name}</Text>
                    {item.email ? (
                      <Text style={styles.email}>{item.email}</Text>
                    ) : null}
                  </View>
                  {isGroupMode && (
                    <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                      {isSelected && <Check size={14} color="#fff" />}
                    </View>
                  )}
                </Pressable>
              );
            }}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Text style={styles.emptyText}>
                  {filter ? "No matching users" : "No users found"}
                </Text>
              </View>
            }
            keyboardShouldPersistTaps="handled"
          />
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  createBtn: { color: "#0a7ea4", fontSize: 16, fontWeight: "600" },
  groupNameInput: {
    backgroundColor: "#222",
    color: "#fff",
    fontSize: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#333",
  },
  selectedBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  selectedCount: { color: "#0a7ea4", fontSize: 13, fontWeight: "500" },
  input: {
    backgroundColor: "#222",
    color: "#fff",
    fontSize: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    margin: 16,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#333",
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
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#333",
    justifyContent: "center",
    alignItems: "center",
    position: "relative" as const,
  },
  avatarText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  aiBadge: {
    position: "absolute" as const,
    top: -2,
    right: -4,
    backgroundColor: "#7c3aed",
    borderRadius: 4,
    paddingHorizontal: 3,
    paddingVertical: 1,
  },
  aiBadgeText: { fontSize: 8, fontWeight: "700" as const, color: "#fff" },
  info: { flex: 1 },
  name: { fontSize: 16, color: "#fff", fontWeight: "500" },
  email: { fontSize: 14, color: "#888", marginTop: 2 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: "#444",
    justifyContent: "center",
    alignItems: "center",
  },
  checkboxSelected: {
    backgroundColor: "#0a7ea4",
    borderColor: "#0a7ea4",
  },
  empty: { alignItems: "center", paddingTop: 40 },
  emptyText: { color: "#888", fontSize: 16 },
});
