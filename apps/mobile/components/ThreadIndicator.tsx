import { View, Pressable, Text, Image, StyleSheet } from "react-native";
import { formatRelativeTime } from "@/lib/formatRelativeTime";

interface ThreadIndicatorProps {
  replyCount: number;
  lastReplyAuthor?: string;
  lastReplyAvatarUrl?: string | null;
  lastReplyAt?: number;
  onPress: () => void;
}

export function ThreadIndicator({
  replyCount,
  lastReplyAuthor,
  lastReplyAvatarUrl,
  lastReplyAt,
  onPress,
}: ThreadIndicatorProps) {
  const countLabel = `${replyCount} ${replyCount === 1 ? "reply" : "replies"}`;
  const authorLabel = lastReplyAuthor ? ` — last from ${lastReplyAuthor}` : "";
  const timeLabel = lastReplyAt ? ` ${formatRelativeTime(lastReplyAt)}` : "";

  const initials = lastReplyAuthor ? lastReplyAuthor.charAt(0).toUpperCase() : "?";

  return (
    <Pressable style={styles.container} onPress={onPress}>
      {lastReplyAvatarUrl ? (
        <Image source={{ uri: lastReplyAvatarUrl }} style={styles.avatar} />
      ) : (
        <View style={styles.avatarFallback}>
          <Text style={styles.avatarInitials}>{initials}</Text>
        </View>
      )}
      <Text style={styles.text}>
        {countLabel}
        {authorLabel}
        {timeLabel}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#222",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: "flex-start",
    marginTop: 4,
    gap: 6,
  },
  avatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  avatarFallback: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#333",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarInitials: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "600",
  },
  text: {
    fontSize: 13,
    color: "#0a7ea4",
  },
});
