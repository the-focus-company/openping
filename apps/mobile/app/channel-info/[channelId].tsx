import { useState, useMemo } from "react";
import { View, Text, FlatList, Image, TextInput, Pressable, ActivityIndicator, ActionSheetIOS, Platform, Alert, StyleSheet } from "react-native";
import { useLocalSearchParams, Stack } from "expo-router";
import { useQuery, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { MemberListItem } from "@/components/MemberListItem";
import { AttachmentPreview } from "@/components/AttachmentPreview";
import { FileIcon, ImageIcon, Star, BellOff, Bell, FolderPlus } from "lucide-react-native";

export default function ChannelInfoScreen() {
  const { channelId } = useLocalSearchParams<{ channelId: string }>();
  const typedChannelId = channelId as Id<"channels">;

  const channel = useQuery(api.channels.get, { channelId: typedChannelId });
  const allChannels = useQuery(api.channels.list, { workspaceId: channel?.workspaceId ?? ("skip" as any) });
  const allConvos = useQuery(api.directConversations.list);
  const toggleStar = useMutation(api.channels.toggleStar);
  const toggleMute = useMutation(api.channels.toggleMute);
  const setFolderMut = useMutation(api.channels.setFolder);
  const members = useQuery(api.channels.listMembers, {
    channelId: typedChannelId,
  });
  const messagesData = useQuery(api.messages.listByChannel, {
    channelId: typedChannelId,
  });

  // Extract attachments from messages
  const sharedFiles: { storageId: string; filename: string; mimeType: string; size: number; timestamp: number; authorName: string }[] = [];
  if (messagesData) {
    for (const msg of messagesData) {
      if ((msg as any).attachments) {
        for (const att of (msg as any).attachments) {
          sharedFiles.push({
            ...att,
            timestamp: msg._creationTime,
            authorName: (msg as any).author?.name ?? "Unknown",
          });
        }
      }
    }
  }

  const images = sharedFiles.filter((f) => f.mimeType?.startsWith("image/"));
  const files = sharedFiles.filter((f) => !f.mimeType?.startsWith("image/"));

  // Collect existing user folders
  const existingFolders = useMemo(() => {
    const set = new Set<string>();
    if (allChannels) for (const ch of allChannels) { if ((ch as any).folder) set.add((ch as any).folder); }
    if (allConvos) for (const c of allConvos) { if ((c as any).folder) set.add((c as any).folder); }
    return Array.from(set).sort();
  }, [allChannels, allConvos]);

  if (channel === undefined || members === undefined) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0a7ea4" />
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      data={members}
      keyExtractor={(item: any) => item._id}
      ListHeaderComponent={
        <>
          <Stack.Screen
            options={{
              title: channel ? `# ${channel.name}` : "Channel Info",
              headerStyle: { backgroundColor: "#111" },
              headerTintColor: "#fff",
            }}
          />

          <View style={styles.header}>
            <Text style={styles.hashIcon}>#</Text>
            <Text style={styles.channelName}>{channel?.name}</Text>
            {channel?.description ? (
              <Text style={styles.description}>{channel.description}</Text>
            ) : null}
          </View>

          {/* Actions */}
          <View style={styles.actionsRow}>
            <Pressable
              style={styles.actionBtn}
              onPress={async () => {
                const result = await toggleStar({ channelId: typedChannelId });
                Alert.alert(result ? "Added to Favorites" : "Removed from Favorites");
              }}
            >
              <Star
                size={20}
                color={channel?.isStarred ? "#f59e0b" : "#888"}
                fill={channel?.isStarred ? "#f59e0b" : "transparent"}
              />
              <Text style={[styles.actionLabel, channel?.isStarred && { color: "#f59e0b" }]}>
                {channel?.isStarred ? "Starred" : "Star"}
              </Text>
            </Pressable>

            <Pressable
              style={styles.actionBtn}
              onPress={async () => {
                const result = await toggleMute({ channelId: typedChannelId });
                Alert.alert(result ? "Notifications muted" : "Notifications unmuted");
              }}
            >
              {(channel as any)?.isMuted ? (
                <BellOff size={20} color="#ef4444" />
              ) : (
                <Bell size={20} color="#888" />
              )}
              <Text style={[styles.actionLabel, (channel as any)?.isMuted && { color: "#ef4444" }]}>
                {(channel as any)?.isMuted ? "Muted" : "Mute"}
              </Text>
            </Pressable>

            <Pressable
              style={styles.actionBtn}
              onPress={() => {
                if (Platform.OS === "ios") {
                  const hasFolder = !!(channel as any)?.folder;
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
                        await setFolderMut({ channelId: typedChannelId, folder: undefined });
                        Alert.alert("Removed from folder");
                        return;
                      }
                      const offset = hasFolder ? 2 : 1;
                      const folderIdx = index - offset;
                      if (folderIdx < existingFolders.length) {
                        const f = existingFolders[folderIdx];
                        await setFolderMut({ channelId: typedChannelId, folder: f });
                        Alert.alert(`Moved to ${f}`);
                      } else {
                        // New folder
                        Alert.prompt("New Folder", "Enter folder name", async (name) => {
                          if (name?.trim()) {
                            await setFolderMut({ channelId: typedChannelId, folder: name.trim() });
                            Alert.alert(`Moved to ${name.trim()}`);
                          }
                        });
                      }
                    },
                  );
                }
              }}
            >
              <FolderPlus size={20} color={(channel as any)?.folder ? "#0a7ea4" : "#888"} />
              <Text style={[styles.actionLabel, (channel as any)?.folder && { color: "#0a7ea4" }]}>
                {(channel as any)?.folder ?? "Folder"}
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
            <Text style={styles.sectionTitle}>
              Members ({members?.length ?? 0})
            </Text>
          </View>
        </>
      }
      renderItem={({ item }: { item: any }) => (
        <MemberListItem
          name={item.name ?? "Unknown"}
          role={item.role}
          isOnline={item.presenceStatus === "online"}
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
  header: {
    alignItems: "center",
    paddingVertical: 24,
    paddingHorizontal: 16,
    backgroundColor: "#111",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#333",
  },
  hashIcon: {
    color: "#888",
    fontSize: 40,
    fontWeight: "700",
    marginBottom: 8,
  },
  channelName: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "700",
  },
  description: {
    color: "#888",
    fontSize: 14,
    marginTop: 8,
    textAlign: "center",
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
