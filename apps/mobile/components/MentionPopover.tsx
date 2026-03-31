import { View, Text, FlatList, Pressable, StyleSheet } from "react-native";
import { getInitials } from "@/lib/initials";

interface MentionUser {
  _id: string;
  name: string;
  email?: string;
  isAgent?: boolean;
}

interface MentionPopoverProps {
  query: string;
  users: MentionUser[];
  onSelect: (user: { _id: string; name: string }) => void;
  onDismiss: () => void;
  visible: boolean;
}

export function MentionPopover({
  query,
  users,
  onSelect,
  onDismiss,
  visible,
}: MentionPopoverProps) {
  if (!visible) return null;

  const lowerQuery = query.toLowerCase();
  const filtered = users
    .filter((u) => u.name.toLowerCase().includes(lowerQuery))
    .slice(0, 6);

  if (filtered.length === 0) return null;

  return (
    <View style={styles.overlay}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onDismiss} />
      <View style={styles.card}>
        <FlatList
          data={filtered}
          keyExtractor={(item) => item._id}
          keyboardShouldPersistTaps="always"
          renderItem={({ item }) => (
            <Pressable
              style={styles.row}
              onPress={() => onSelect({ _id: item._id, name: item.name })}
            >
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{getInitials(item.name)}</Text>
              </View>
              <Text style={styles.name} numberOfLines={1}>
                {item.name}
              </Text>
              {item.isAgent && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>AI</Text>
                </View>
              )}
            </Pressable>
          )}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    bottom: "100%",
    left: 0,
    right: 0,
    zIndex: 50,
    paddingHorizontal: 8,
    paddingBottom: 4,
  },
  card: {
    backgroundColor: "#222",
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#333",
    maxHeight: 200,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#333",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  name: {
    flex: 1,
    color: "#fff",
    fontSize: 15,
  },
  badge: {
    backgroundColor: "#0a7ea4",
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
  },
});
