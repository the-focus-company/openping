import { Pressable, View, Text, StyleSheet } from "react-native";
import { formatRelativeTime } from "@/lib/formatRelativeTime";

interface ConversationListItemProps {
  name: string;
  lastMessage?: string;
  lastMessageAuthor?: string;
  unreadCount?: number;
  timestamp?: number;
  onPress: () => void;
}

export function ConversationListItem({
  name,
  lastMessage,
  lastMessageAuthor,
  unreadCount = 0,
  timestamp,
  onPress,
}: ConversationListItemProps) {
  return (
    <Pressable
      style={({ pressed }) => [styles.container, pressed && styles.pressed]}
      onPress={onPress}
    >
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{name.charAt(0).toUpperCase()}</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.topRow}>
          <Text
            style={[styles.name, unreadCount > 0 && styles.nameBold]}
            numberOfLines={1}
          >
            {name}
          </Text>
          {timestamp && (
            <Text style={styles.time}>{formatRelativeTime(timestamp)}</Text>
          )}
        </View>
        {lastMessage && (
          <Text style={styles.preview} numberOfLines={1}>
            {lastMessageAuthor ? `${lastMessageAuthor}: ` : ""}
            {lastMessage}
          </Text>
        )}
      </View>

      {unreadCount > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>
            {unreadCount > 99 ? "99+" : unreadCount}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#222",
    gap: 12,
  },
  pressed: {
    backgroundColor: "#1a1a1a",
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#333",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
  },
  content: {
    flex: 1,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
  },
  name: {
    fontSize: 16,
    color: "#ccc",
    flex: 1,
  },
  nameBold: {
    color: "#fff",
    fontWeight: "600",
  },
  time: {
    fontSize: 12,
    color: "#666",
    marginLeft: 8,
  },
  preview: {
    fontSize: 14,
    color: "#888",
    marginTop: 2,
  },
  badge: {
    backgroundColor: "#0a7ea4",
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    justifyContent: "center",
    alignItems: "center",
  },
  badgeText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
});
