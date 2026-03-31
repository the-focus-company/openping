import { useState, useMemo } from "react";
import {
  View,
  Text,
  Image,
  Pressable,
  ActivityIndicator,
  Switch,
  ScrollView,
  Alert,
  StyleSheet,
} from "react-native";
import { useQuery, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useWorkspace, useWorkspaceData } from "@/hooks/useWorkspace";
import { signOut } from "@/lib/auth";
import { getInitials } from "@/lib/initials";
import { formatRelativeTime } from "@/lib/formatRelativeTime";
import { useRouter } from "expo-router";
import { Bell, BellOff, AtSign, ChevronRight, Smile, Circle, Folder, Trash2, Plus, Building2, Check } from "lucide-react-native";
import { StatusModal } from "@/components/StatusModal";

export default function ProfileScreen() {
  const { user, isLoading } = useCurrentUser();
  const { workspaceId, switchWorkspace } = useWorkspace();
  const { workspaces } = useWorkspaceData();
  const router = useRouter();

  const channels = useQuery(api.channels.list, { workspaceId });
  const conversations = useQuery(api.directConversations.list);
  const setChannelFolder = useMutation(api.channels.setFolder);
  const setDMFolder = useMutation(api.directConversations.setFolder);

  const [pushEnabled, setPushEnabled] = useState(true);
  const [dmNotifs, setDmNotifs] = useState(true);
  const [mentionNotifs, setMentionNotifs] = useState(true);
  const [showAllMentions, setShowAllMentions] = useState(false);
  const [statusModalVisible, setStatusModalVisible] = useState(false);

  // Collect unique folders from channels and DMs
  const folders = useMemo(() => {
    const set = new Set<string>();
    if (channels) {
      for (const ch of channels) {
        if ((ch as any).folder) set.add((ch as any).folder);
      }
    }
    if (conversations) {
      for (const conv of conversations) {
        if ((conv as any).folder) set.add((conv as any).folder);
      }
    }
    return Array.from(set).sort();
  }, [channels, conversations]);

  // Fetch messages mentioning the user
  const mentions = useQuery(
    api.messages.listByChannel,
    // We can't easily query mentions across channels from mobile without a dedicated endpoint,
    // so we'll use the search endpoint as a workaround
    "skip",
  );

  // Use search to find messages mentioning the user
  const mentionResults = useQuery(
    api.search.searchMessages,
    user?.name
      ? { workspaceId, query: `@${user.name}` }
      : "skip",
  );

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0a7ea4" />
      </View>
    );
  }

  const name = user?.name ?? "Unknown";
  const email = user?.email ?? "";
  const initials = getInitials(name);

  const mentionItems = mentionResults ?? [];
  const visibleMentions = showAllMentions ? mentionItems : mentionItems.slice(0, 5);

  async function handleSignOut() {
    await signOut();
    router.replace("/login");
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Profile */}
      <View style={styles.profileSection}>
        {user?.avatarUrl ? (
          <Image source={{ uri: user.avatarUrl }} style={styles.avatarImage} />
        ) : (
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
        )}
        <Text style={styles.name}>{name}</Text>
        {email ? <Text style={styles.email}>{email}</Text> : null}

        {/* Presence indicator */}
        <View style={styles.presenceRow}>
          <Circle size={8} color={user?.presenceStatus === "online" ? "#22c55e" : "#666"} fill={user?.presenceStatus === "online" ? "#22c55e" : "#666"} />
          <Text style={styles.presenceText}>
            {user?.presenceStatus === "online" ? "Active" : "Away"}
          </Text>
        </View>
      </View>

      {/* Status */}
      <Pressable
        style={styles.statusBtn}
        onPress={() => setStatusModalVisible(true)}
      >
        <View style={styles.statusBtnContent}>
          <Smile size={18} color="#888" />
          {user?.statusMessage ? (
            <View style={styles.statusInfo}>
              {user.statusEmoji && <Text style={styles.statusEmoji}>{user.statusEmoji}</Text>}
              <Text style={styles.statusText}>{user.statusMessage}</Text>
            </View>
          ) : (
            <Text style={styles.statusPlaceholder}>Set a status</Text>
          )}
        </View>
        {user?.statusMessage && (
          <Text style={styles.statusClear}>Change</Text>
        )}
      </Pressable>

      <StatusModal
        visible={statusModalVisible}
        onClose={() => setStatusModalVisible(false)}
        currentEmoji={user?.statusEmoji ?? undefined}
        currentText={user?.statusMessage ?? undefined}
      />

      {/* Workspace Switcher */}
      {workspaces && workspaces.length > 1 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Workspace</Text>
          {workspaces.map((ws) => (
            <Pressable
              key={ws.workspaceId}
              style={({ pressed }) => [
                styles.workspaceRow,
                pressed && { backgroundColor: "#1a1a1a" },
              ]}
              onPress={() => switchWorkspace(ws.workspaceId)}
            >
              <Building2 size={18} color={ws.workspaceId === workspaceId ? "#0a7ea4" : "#666"} />
              <Text
                style={[
                  styles.workspaceName,
                  ws.workspaceId === workspaceId && styles.workspaceNameActive,
                ]}
                numberOfLines={1}
              >
                {ws.name}
              </Text>
              {ws.workspaceId === workspaceId && (
                <Check size={16} color="#0a7ea4" />
              )}
            </Pressable>
          ))}
        </View>
      )}

      {/* Notification Settings */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Notifications</Text>

        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Bell size={18} color="#ccc" />
            <Text style={styles.settingLabel}>Push Notifications</Text>
          </View>
          <Switch
            value={pushEnabled}
            onValueChange={setPushEnabled}
            trackColor={{ false: "#333", true: "#0a7ea4" }}
            thumbColor="#fff"
          />
        </View>

        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            {dmNotifs ? (
              <Bell size={18} color="#ccc" />
            ) : (
              <BellOff size={18} color="#666" />
            )}
            <Text style={styles.settingLabel}>Direct Messages</Text>
          </View>
          <Switch
            value={dmNotifs}
            onValueChange={setDmNotifs}
            trackColor={{ false: "#333", true: "#0a7ea4" }}
            thumbColor="#fff"
          />
        </View>

        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <AtSign size={18} color="#ccc" />
            <Text style={styles.settingLabel}>@Mentions</Text>
          </View>
          <Switch
            value={mentionNotifs}
            onValueChange={setMentionNotifs}
            trackColor={{ false: "#333", true: "#0a7ea4" }}
            thumbColor="#fff"
          />
        </View>
      </View>

      {/* Folders */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Folders</Text>
        {folders.length === 0 ? (
          <View style={styles.emptyMentions}>
            <Folder size={24} color="#444" />
            <Text style={styles.emptyText}>No folders yet</Text>
            <Text style={[styles.emptyText, { fontSize: 12 }]}>Create folders from the + button in Conversations</Text>
          </View>
        ) : (
          folders.map((folderName) => {
            const channelCount = channels?.filter((ch: any) => ch.folder === folderName).length ?? 0;
            const dmCount = conversations?.filter((c: any) => c.folder === folderName).length ?? 0;
            return (
              <View key={folderName} style={styles.folderRow}>
                <Folder size={18} color="#0a7ea4" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.folderName}>{folderName}</Text>
                  <Text style={styles.folderCount}>{channelCount + dmCount} conversations</Text>
                </View>
                <Pressable
                  hitSlop={8}
                  onPress={() => {
                    Alert.alert(
                      `Delete "${folderName}"?`,
                      "Conversations will be moved back to Recent. No messages will be deleted.",
                      [
                        { text: "Cancel", style: "cancel" },
                        {
                          text: "Delete Folder",
                          style: "destructive",
                          onPress: async () => {
                            // Remove folder from all channels and DMs that have it
                            if (channels) {
                              for (const ch of channels) {
                                if ((ch as any).folder === folderName) {
                                  await setChannelFolder({ channelId: ch._id as any, folder: undefined });
                                }
                              }
                            }
                            if (conversations) {
                              for (const conv of conversations) {
                                if ((conv as any).folder === folderName) {
                                  await setDMFolder({ conversationId: conv._id as any, folder: undefined });
                                }
                              }
                            }
                            Alert.alert("Folder deleted");
                          },
                        },
                      ],
                    );
                  }}
                >
                  <Trash2 size={16} color="#ef4444" />
                </Pressable>
              </View>
            );
          })
        )}
      </View>

      {/* Mentions List */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent Mentions</Text>

        {mentionItems.length === 0 ? (
          <View style={styles.emptyMentions}>
            <AtSign size={24} color="#444" />
            <Text style={styles.emptyText}>No mentions yet</Text>
          </View>
        ) : (
          <>
            {visibleMentions.map((m: any) => (
              <Pressable
                key={m._id}
                style={({ pressed }) => [
                  styles.mentionRow,
                  pressed && styles.mentionRowPressed,
                ]}
                onPress={() =>
                  router.push({
                    pathname: "/channel/[channelId]",
                    params: { channelId: m.channelId, highlightMessage: m._id },
                  })
                }
              >
                <View style={styles.mentionContent}>
                  <View style={styles.mentionHeader}>
                    <Text style={styles.mentionAuthor} numberOfLines={1}>
                      {m.authorName}
                    </Text>
                    {m.channelName && (
                      <Text style={styles.mentionChannel}>#{m.channelName}</Text>
                    )}
                  </View>
                  <Text style={styles.mentionBody} numberOfLines={2}>
                    {m.body}
                  </Text>
                </View>
                <Text style={styles.mentionTime}>
                  {formatRelativeTime(m._creationTime)}
                </Text>
              </Pressable>
            ))}
            {!showAllMentions && mentionItems.length > 5 && (
              <Pressable
                style={styles.showMoreBtn}
                onPress={() => setShowAllMentions(true)}
              >
                <Text style={styles.showMoreText}>
                  Show {mentionItems.length - 5} more
                </Text>
                <ChevronRight size={16} color="#0a7ea4" />
              </Pressable>
            )}
          </>
        )}
      </View>

      {/* Sign Out */}
      <Pressable
        style={({ pressed }) => [
          styles.signOutButton,
          pressed && styles.signOutPressed,
        ]}
        onPress={handleSignOut}
      >
        <Text style={styles.signOutText}>Sign Out</Text>
      </Pressable>

      {/* App Branding */}
      <View style={styles.branding}>
        <Image
          source={require("@/assets/logo-dark.png")}
          style={styles.brandLogo}
          resizeMode="contain"
        />
        <Text style={styles.brandVersion}>OpenPing v0.1.0</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  contentContainer: { padding: 24, paddingBottom: 60 },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#000",
  },
  profileSection: { alignItems: "center", paddingTop: 20, marginBottom: 32 },
  avatarImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginBottom: 16,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#333",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  avatarText: { color: "#fff", fontSize: 32, fontWeight: "600" },
  name: { fontSize: 24, fontWeight: "bold", color: "#fff", marginBottom: 4 },
  email: { fontSize: 16, color: "#888" },
  presenceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
  },
  presenceText: { color: "#888", fontSize: 14 },

  statusBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#111",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "#222",
  },
  statusBtnContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  statusInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  statusEmoji: { fontSize: 18 },
  statusText: { color: "#ccc", fontSize: 15 },
  statusPlaceholder: { color: "#666", fontSize: 15 },
  statusClear: { color: "#0a7ea4", fontSize: 13, fontWeight: "500" },

  section: {
    marginBottom: 24,
    backgroundColor: "#111",
    borderRadius: 12,
    overflow: "hidden",
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#888",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#222",
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#222",
  },
  settingInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  settingLabel: {
    fontSize: 15,
    color: "#ccc",
  },

  workspaceRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#222",
  },
  workspaceName: {
    flex: 1,
    fontSize: 15,
    color: "#ccc",
  },
  workspaceNameActive: {
    color: "#fff",
    fontWeight: "600",
  },

  folderRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#222",
  },
  folderName: { color: "#ccc", fontSize: 15, fontWeight: "500" },
  folderCount: { color: "#666", fontSize: 12, marginTop: 1 },

  emptyMentions: {
    alignItems: "center",
    paddingVertical: 24,
    gap: 8,
  },
  emptyText: { color: "#666", fontSize: 14 },

  mentionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#222",
    gap: 8,
  },
  mentionRowPressed: { backgroundColor: "#1a1a1a" },
  mentionContent: { flex: 1 },
  mentionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 2,
  },
  mentionAuthor: {
    fontSize: 14,
    fontWeight: "600",
    color: "#fff",
  },
  mentionChannel: {
    fontSize: 12,
    color: "#0a7ea4",
  },
  mentionBody: {
    fontSize: 13,
    color: "#999",
    lineHeight: 18,
  },
  mentionTime: {
    fontSize: 11,
    color: "#666",
  },

  showMoreBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    gap: 4,
  },
  showMoreText: {
    fontSize: 14,
    color: "#0a7ea4",
    fontWeight: "600",
  },

  signOutButton: {
    backgroundColor: "#222",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#333",
    marginTop: 8,
  },
  signOutPressed: { backgroundColor: "#333" },
  signOutText: { color: "#ff4444", fontSize: 16, fontWeight: "600" },

  branding: {
    alignItems: "center",
    paddingVertical: 24,
    gap: 6,
  },
  brandLogo: {
    height: 24,
    width: 80,
    opacity: 0.5,
  },
  brandVersion: {
    color: "#444",
    fontSize: 12,
  },
});
