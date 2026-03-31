import { Pressable, View, Text, StyleSheet } from "react-native";
import { formatRelativeTime } from "@/lib/formatRelativeTime";

interface SearchResultItemProps {
  title: string;
  subtitle?: string;
  context?: string;
  timestamp?: number;
  initials?: string;
  onPress: () => void;
}

export function SearchResultItem({
  title,
  subtitle,
  context,
  timestamp,
  initials,
  onPress,
}: SearchResultItemProps) {
  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      onPress={onPress}
    >
      {initials ? (
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
      ) : null}
      <View style={styles.textContent}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {context ? (
        <View style={[styles.badge, context === "AI" && styles.badgeAI]}>
          <Text style={[styles.badgeText, context === "AI" && styles.badgeTextAI]}>{context}</Text>
        </View>
      ) : null}
      {timestamp ? (
        <Text style={styles.time}>{formatRelativeTime(timestamp)}</Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#222",
    gap: 8,
  },
  rowPressed: {
    backgroundColor: "#1a1a1a",
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#333",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  textContent: {
    flex: 1,
  },
  title: {
    fontSize: 15,
    fontWeight: "600",
    color: "#fff",
  },
  subtitle: {
    fontSize: 14,
    color: "#888",
    marginTop: 2,
  },
  badge: {
    backgroundColor: "#222",
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeText: {
    fontSize: 12,
    color: "#ccc",
  },
  badgeAI: {
    backgroundColor: "rgba(124,58,237,0.2)",
    borderWidth: 1,
    borderColor: "rgba(124,58,237,0.4)",
  },
  badgeTextAI: {
    color: "#a78bfa",
    fontWeight: "700" as const,
    fontSize: 10,
  },
  time: {
    fontSize: 12,
    color: "#666",
  },
});
