import { useMemo } from "react";
import { View, Text, FlatList, Pressable, ActivityIndicator, ActionSheetIOS, Platform, Alert, StyleSheet } from "react-native";
import { useLocalSearchParams, Stack } from "expo-router";
import { useQuery, usePaginatedQuery, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { MemberListItem } from "@/components/MemberListItem";
import { AttachmentPreview } from "@/components/AttachmentPreview";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { getDMDisplayName } from "@/lib/dmDisplayName";
import { FileIcon, ImageIcon, Star, Bell, BellOff, FolderPlus } from "lucide-react-native";

export default function DMInfoScreen() {
  const { conversationId } = useLocalSearchParams<{
    conversationId: string;
  }>();
  const typedConversationId = conversationId as Id<"directConversations">;

  const conversation = useQuery(api.directConversations.get, {
    conversationId: typedConversationId,
  });
  const allConvos = useQuery(api.directConversations.list);
  const toggleStar = useMutation(api.directConversations.toggleStar);
  const toggleMute = useMutation(api.directConversations.toggleMute);
  const setFolderMut = useMutation(api.directConversations.setFolder);
  const { user } = useCurrentUser();

  const existingFolders = useMemo(() => {
    const set = new Set<string>();
    if (allConvos) for (const c of allConvos) { if ((c as any).folder) set.add((c as any).folder); }
    return Array.from(set).sort();
  }, [allConvos]);
  const { results: messages } = usePaginatedQuery(
    api.directMessages.list,
    { conversationId: typedConversationId },
    { initialNumItems: 50 },
  );

  // Extract attachments from messages
  const sharedFiles: { storageId: string; filename: string; mimeType: string; size: number }[] = [];
  if (messages) {
    for (const msg of messages) {
      if ((msg as any).attachments) {
        for (const att of (msg as any).attachments) {
          sharedFiles.push(att);
        }
      }
    }
  }

  const images = sharedFiles.filter((f) => f.mimeType?.startsWith("image/"));
  const files = sharedFiles.filter((f) => !f.mimeType?.startsWith("image/"));

  if (conversation === undefined) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0a7ea4" />
      </View>
    );
  }

  const members = conversation?.members ?? [];
  const displayName = getDMDisplayName(
    conversation?.name,
    members,
    user?._id,
  );

  return (
    <FlatList
      style={styles.container}
      data={members}
      keyExtractor={(item: any) => item.userId}
      ListHeaderComponent={
        <>
          <Stack.Screen
            options={{
              title: displayName,
              headerStyle: { backgroundColor: "#111" },
              headerTintColor: "#fff",
            }}
          />

          {/* Actions */}
          <View style={styles.actionsRow}>
            <Pressable
              style={styles.actionBtn}
              onPress={async () => {
                const result = await toggleStar({ conversationId: typedConversationId });
                Alert.alert(result ? "Added to Favorites" : "Removed from Favorites");
              }}
            >
              <Star
                size={20}
                color={(conversation as any)?.isStarred ? "#f59e0b" : "#888"}
                fill={(conversation as any)?.isStarred ? "#f59e0b" : "transparent"}
              />
              <Text style={[styles.actionLabel, (conversation as any)?.isStarred && { color: "#f59e0b" }]}>
                {(conversation as any)?.isStarred ? "Starred" : "Star"}
              </Text>
            </Pressable>

            <Pressable
              style={styles.actionBtn}
              onPress={async () => {
                const result = await toggleMute({ conversationId: typedConversationId });
                Alert.alert(result ? "Notifications muted" : "Notifications unmuted");
              }}
            >
              {(conversation as any)?.isMuted ? (
                <BellOff size={20} color="#ef4444" />
              ) : (
                <Bell size={20} color="#888" />
              )}
              <Text style={[styles.actionLabel, (conversation as any)?.isMuted && { color: "#ef4444" }]}>
                {(conversation as any)?.isMuted ? "Muted" : "Mute"}
              </Text>
            </Pressable>

            <Pressable
              style={styles.actionBtn}
              onPress={() => {
                if (Platform.OS === "ios") {
                  const hasFolder = !!(conversation as any)?.folder;
                  const options = ["Cancel"];
                  if (hasFolder) options.push("Remove from folder");
                  for (const f of existingFolders) options.push(f);
                  options.push("+ New folder...");
                  const destructiveIndex = hasFolder ? 1 : -1;

                  ActionSheetIOS.showActionSheetWithOptions(
                    { options, cancelButtonIndex: 0, destructiveButtonIndex: destructiveIndex },
                    async (index) => {
                      if (index === 0) return;
                      if (hasFolder && index === 1) {
                        await setFolderMut({ conversationId: typedConversationId, folder: undefined });
                        Alert.alert("Removed from folder");
                        return;
                      }
                      const offset = hasFolder ? 2 : 1;
                      const folderIdx = index - offset;
                      if (folderIdx < existingFolders.length) {
                        const f = existingFolders[folderIdx];
                        await setFolderMut({ conversationId: typedConversationId, folder: f });
                        Alert.alert(`Moved to ${f}`);
                      } else {
                        Alert.prompt("New Folder", "Enter folder name", async (name) => {
                          if (name?.trim()) {
                            await setFolderMut({ conversationId: typedConversationId, folder: name.trim() });
                            Alert.alert(`Moved to ${name.trim()}`);
                          }
                        });
                      }
                    },
                  );
                }
              }}
            >
              <FolderPlus size={20} color={(conversation as any)?.folder ? "#0a7ea4" : "#888"} />
              <Text style={[styles.actionLabel, (conversation as any)?.folder && { color: "#0a7ea4" }]}>
                {(conversation as any)?.folder ?? "Folder"}
              </Text>
            </Pressable>
          </View>

          {/* Shared Images */}
          {images.length > 0 && (
            <>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionRow}>
                  <ImageIcon size={16} color="#888" />
                  <Text style={styles.sectionTitle}>
                    Photos ({images.length})
                  </Text>
                </View>
              </View>
              <FlatList
                horizontal
                data={images}
                keyExtractor={(_, i) => `img-${i}`}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.imageRow}
                renderItem={({ item }) => (
                  <AttachmentPreview
                    storageId={item.storageId as any}
                    filename={item.filename}
                    mimeType={item.mimeType}
                    size={item.size}
                  />
                )}
              />
            </>
          )}

          {/* Shared Files */}
          {files.length > 0 && (
            <>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionRow}>
                  <FileIcon size={16} color="#888" />
                  <Text style={styles.sectionTitle}>
                    Files ({files.length})
                  </Text>
                </View>
              </View>
              {files.map((f, i) => (
                <View key={`file-${i}`} style={styles.fileRow}>
                  <AttachmentPreview
                    storageId={f.storageId as any}
                    filename={f.filename}
                    mimeType={f.mimeType}
                    size={f.size}
                  />
                </View>
              ))}
            </>
          )}

          {sharedFiles.length === 0 && (
            <>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionRow}>
                  <FileIcon size={16} color="#888" />
                  <Text style={styles.sectionTitle}>Shared Files</Text>
                </View>
              </View>
              <View style={styles.emptyFiles}>
                <Text style={styles.emptyText}>No shared files yet</Text>
              </View>
            </>
          )}

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Members ({members.length})</Text>
          </View>
        </>
      }
      renderItem={({ item }: { item: any }) => (
        <MemberListItem
          name={item.name ?? "Unknown"}
          isAgent={item.isAgent}
        />
      )}
    />
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
  actionsRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 32,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#333",
    backgroundColor: "#111",
  },
  actionBtn: {
    alignItems: "center",
    gap: 6,
  },
  actionLabel: {
    fontSize: 12,
    color: "#888",
  },
  sectionHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#111",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#333",
    marginTop: 16,
  },
  sectionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sectionTitle: {
    color: "#888",
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  imageRow: {
    padding: 12,
    gap: 8,
  },
  fileRow: {
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  emptyFiles: {
    alignItems: "center",
    paddingVertical: 20,
  },
  emptyText: {
    color: "#666",
    fontSize: 14,
  },
});
