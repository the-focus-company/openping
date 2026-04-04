import { useState, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  Pressable,
  ActivityIndicator,
  ScrollView,
  StyleSheet,
} from "react-native";
import { useQuery, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { getInitials } from "@/lib/initials";
import { useRouter, Stack } from "expo-router";
import { X, Lock, ChevronDown } from "lucide-react-native";

type VisibilityOption = "auto" | "public" | "secret" | "secret_can_be_public";

export default function NewConversationScreen() {
  const [filter, setFilter] = useState("");
  const [selectedIds, setSelectedIds] = useState<Id<"users">[]>([]);
  const [groupName, setGroupName] = useState("");
  const [visibility, setVisibility] = useState<VisibilityOption>("auto");
  const [showVisibilityPicker, setShowVisibilityPicker] = useState(false);
  const { workspaceId } = useWorkspace();
  const { user } = useCurrentUser();
  const router = useRouter();
  const users = useQuery(api.users.listAll, { workspaceId });
  const agents = useQuery(api.agents.list, { workspaceId });
  const createConversation = useMutation(api.conversations.create);

  // Build agent userId set
  const agentUserIds = useMemo(() => {
    const set = new Set<string>();
    if (agents) {
      for (const a of agents as any[]) {
        if (a.agentUserId) set.add(a.agentUserId);
      }
    }
    return set;
  }, [agents]);

  // Derive conversation kind
  const isSmallGroup = selectedIds.length === 1; // 2 total (creator + 1)
  const hasAgents = selectedIds.some((id) => agentUserIds.has(id));

  const derivedKind = useMemo(() => {
    if (isSmallGroup) return hasAgents ? "agent_1to1" : "1to1";
    return hasAgents ? "agent_group" : "group";
  }, [isSmallGroup, hasAgents]);

  const derivedVisibility = useMemo(() => {
    if (visibility !== "auto") return visibility;
    return isSmallGroup ? "secret" : "public";
  }, [visibility, isSmallGroup]);

  const visibilityLabel = useMemo(() => {
    switch (visibility) {
      case "auto":
        return `Auto (${isSmallGroup ? "private" : "public"})`;
      case "public":
        return "Public";
      case "secret":
        return "Private";
      case "secret_can_be_public":
        return "Private (can be made public)";
    }
  }, [visibility, isSmallGroup]);

  // Selected user objects
  const selectedUsers = useMemo(() => {
    if (!users) return [];
    return selectedIds
      .map((id) => users.find((u) => u._id === id))
      .filter(Boolean) as typeof users;
  }, [users, selectedIds]);

  // Filtered user list (exclude self and already selected)
  const filteredUsers = useMemo(() => {
    return (users ?? [])
      .filter((u) => {
        if (u._id === user?._id) return false;
        if (selectedIds.includes(u._id)) return false;
        if (!filter) return true;
        const q = filter.toLowerCase();
        return (
          u.name?.toLowerCase().includes(q) ||
          u.email?.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        const aAgent = agentUserIds.has(a._id);
        const bAgent = agentUserIds.has(b._id);
        if (aAgent && !bAgent) return -1;
        if (!aAgent && bAgent) return 1;
        return (a.name ?? "").localeCompare(b.name ?? "");
      });
  }, [users, user?._id, selectedIds, filter, agentUserIds]);

  function addUser(userId: Id<"users">) {
    setSelectedIds((prev) => [...prev, userId]);
    setFilter("");
  }

  function removeUser(userId: Id<"users">) {
    setSelectedIds((prev) => prev.filter((id) => id !== userId));
  }

  async function handleCreate() {
    if (selectedIds.length === 0) return;

    const agentMembers = selectedIds.filter((id) => agentUserIds.has(id));

    const conversationId = await createConversation({
      kind: derivedKind as any,
      visibility: derivedVisibility as any,
      memberIds: selectedIds,
      name: !isSmallGroup && groupName.trim() ? groupName.trim() : undefined,
      ...(agentMembers.length > 0 ? { agentMemberIds: agentMembers } : {}),
      workspaceId,
    });
    router.replace({
      pathname: "/conversation/[conversationId]" as any,
      params: { conversationId },
    });
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: "New conversation",
          headerRight:
            selectedIds.length > 0
              ? () => (
                  <Pressable onPress={handleCreate} hitSlop={8}>
                    <Text style={styles.createBtn}>Start</Text>
                  </Pressable>
                )
              : undefined,
        }}
      />
      <View style={styles.container}>
        {/* Search input */}
        <TextInput
          style={styles.searchInput}
          placeholder="Add people or agents..."
          placeholderTextColor="#666"
          value={filter}
          onChangeText={setFilter}
          autoFocus
        />

        {/* Selected chips */}
        {selectedUsers.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.chipsScroll}
            contentContainerStyle={styles.chipsContent}
          >
            {selectedUsers.map((u) => (
              <View key={u._id} style={styles.chip}>
                <Text style={styles.chipText}>{u.name}</Text>
                <Pressable onPress={() => removeUser(u._id)} hitSlop={6}>
                  <X size={12} color="#7c3aed" />
                </Pressable>
              </View>
            ))}
          </ScrollView>
        )}

        {/* Group name (3+ participants) */}
        {!isSmallGroup && selectedIds.length > 0 && (
          <View style={styles.optionRow}>
            <Text style={styles.optionLabel}>NAME (OPTIONAL)</Text>
            <TextInput
              style={styles.optionInput}
              placeholder="e.g. frontend-team"
              placeholderTextColor="#666"
              value={groupName}
              onChangeText={setGroupName}
            />
          </View>
        )}

        {/* Visibility picker */}
        {selectedIds.length > 0 && (
          <Pressable
            style={styles.visibilityRow}
            onPress={() => setShowVisibilityPicker((v) => !v)}
          >
            <Lock size={14} color="#888" />
            <Text style={styles.visibilityText}>{visibilityLabel}</Text>
            <ChevronDown size={14} color="#888" />
          </Pressable>
        )}

        {showVisibilityPicker && selectedIds.length > 0 && (
          <View style={styles.visibilityPicker}>
            {(
              [
                { value: "auto", label: `Auto (${isSmallGroup ? "private" : "public"})` },
                { value: "public", label: "Public" },
                { value: "secret", label: "Private" },
                { value: "secret_can_be_public", label: "Private (can be made public)" },
              ] as { value: VisibilityOption; label: string }[]
            ).map((opt) => (
              <Pressable
                key={opt.value}
                style={[
                  styles.visibilityOption,
                  visibility === opt.value && styles.visibilityOptionActive,
                ]}
                onPress={() => {
                  setVisibility(opt.value);
                  setShowVisibilityPicker(false);
                }}
              >
                <Text
                  style={[
                    styles.visibilityOptionText,
                    visibility === opt.value && styles.visibilityOptionTextActive,
                  ]}
                >
                  {opt.label}
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        {/* Divider */}
        <View style={styles.divider} />

        {/* User list */}
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

              return (
                <Pressable
                  style={({ pressed }) => [
                    styles.row,
                    pressed && styles.rowPressed,
                  ]}
                  onPress={() => addUser(item._id)}
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
                    {isAgent ? (
                      <Text style={styles.agentLabel}>Agent</Text>
                    ) : item.email ? (
                      <Text style={styles.email}>{item.email}</Text>
                    ) : null}
                  </View>
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
  createBtn: { color: "#7c3aed", fontSize: 16, fontWeight: "600" },

  searchInput: {
    backgroundColor: "#222",
    color: "#fff",
    fontSize: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    margin: 16,
    marginBottom: 0,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#333",
  },

  chipsScroll: {
    maxHeight: 40,
    marginTop: 10,
  },
  chipsContent: {
    paddingHorizontal: 16,
    gap: 6,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(124,58,237,0.12)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
  },
  chipText: {
    fontSize: 13,
    color: "#7c3aed",
    fontWeight: "500",
  },

  optionRow: {
    paddingHorizontal: 16,
    marginTop: 12,
  },
  optionLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: "#666",
    letterSpacing: 1,
    marginBottom: 6,
  },
  optionInput: {
    backgroundColor: "#222",
    color: "#fff",
    fontSize: 15,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#333",
  },

  visibilityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: "#222",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#333",
  },
  visibilityText: {
    flex: 1,
    fontSize: 14,
    color: "#ccc",
  },

  visibilityPicker: {
    marginHorizontal: 16,
    marginTop: 4,
    backgroundColor: "#222",
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#333",
    overflow: "hidden",
  },
  visibilityOption: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#333",
  },
  visibilityOptionActive: {
    backgroundColor: "rgba(124,58,237,0.12)",
  },
  visibilityOptionText: {
    fontSize: 14,
    color: "#ccc",
  },
  visibilityOptionTextActive: {
    color: "#7c3aed",
    fontWeight: "500",
  },

  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#333",
    marginTop: 12,
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
  agentLabel: { fontSize: 13, color: "#7c3aed", marginTop: 1 },

  empty: { alignItems: "center", paddingTop: 40 },
  emptyText: { color: "#888", fontSize: 16 },
});
