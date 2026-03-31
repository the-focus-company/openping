import { Pressable, View, Text, StyleSheet } from "react-native";

interface ChannelListItemProps {
  name: string;
  unreadCount?: number;
  isStarred?: boolean;
  onPress: () => void;
}

export function ChannelListItem({
  name,
  unreadCount = 0,
  isStarred = false,
  onPress,
}: ChannelListItemProps) {
  return (
    <Pressable
      style={({ pressed }) => [styles.container, pressed && styles.pressed]}
      onPress={onPress}
    >
      <View style={styles.row}>
        <Text style={styles.hash}>#</Text>
        <Text
          style={[styles.name, unreadCount > 0 && styles.nameBold]}
          numberOfLines={1}
        >
          {name}
        </Text>
        {isStarred && <Text style={styles.star}>★</Text>}
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
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#222",
  },
  pressed: {
    backgroundColor: "#1a1a1a",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 6,
  },
  hash: {
    fontSize: 18,
    fontWeight: "700",
    color: "#666",
    width: 20,
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
  star: {
    fontSize: 14,
    color: "#f59e0b",
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
