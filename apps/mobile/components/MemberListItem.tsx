import { View, Text, StyleSheet } from "react-native";
import { getInitials } from "@/lib/initials";

interface MemberListItemProps {
  name: string;
  role?: string;
  isOnline?: boolean;
  isAgent?: boolean;
}

function getAvatarColor(name: string): string {
  const colors = [
    "#e74c3c",
    "#3498db",
    "#2ecc71",
    "#9b59b6",
    "#e67e22",
    "#1abc9c",
    "#f39c12",
    "#e84393",
  ];
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  return colors[Math.abs(hash) % colors.length];
}

export function MemberListItem({
  name,
  role,
  isOnline,
  isAgent,
}: MemberListItemProps) {
  return (
    <View style={styles.row}>
      <View style={[styles.avatar, { backgroundColor: getAvatarColor(name) }]}>
        <Text style={styles.initials}>{getInitials(name)}</Text>
      </View>

      <Text style={styles.name} numberOfLines={1}>
        {name}
      </Text>

      {role === "admin" && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>Admin</Text>
        </View>
      )}

      {isAgent && (
        <View style={[styles.badge, styles.agentBadge]}>
          <Text style={styles.badgeText}>AI</Text>
        </View>
      )}

      {isOnline && <View style={styles.onlineDot} />}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#333",
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  initials: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
  name: {
    color: "#fff",
    fontSize: 16,
    flex: 1,
  },
  badge: {
    backgroundColor: "#333",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 8,
  },
  agentBadge: {
    backgroundColor: "#0a7ea4",
  },
  badgeText: {
    color: "#ccc",
    fontSize: 12,
    fontWeight: "600",
  },
  onlineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#2ecc71",
    marginLeft: 8,
  },
});
