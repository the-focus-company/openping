import { View, Text, StyleSheet } from "react-native";

interface DateSeparatorProps {
  timestamp: number;
}

function formatDateDivider(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();

  const isToday =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  if (isToday) return "Today";

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday =
    date.getFullYear() === yesterday.getFullYear() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getDate() === yesterday.getDate();

  if (isYesterday) return "Yesterday";

  const dayName = date.toLocaleDateString([], { weekday: "long" });
  const month = date.toLocaleDateString([], { month: "long" });
  const day = date.getDate();

  if (date.getFullYear() !== now.getFullYear()) {
    return `${dayName}, ${month} ${day}, ${date.getFullYear()}`;
  }

  return `${dayName}, ${month} ${day}`;
}

export function DateSeparator({ timestamp }: DateSeparatorProps) {
  return (
    <View style={styles.container}>
      <View style={styles.line} />
      <View style={styles.badge}>
        <Text style={styles.text}>{formatDateDivider(timestamp)}</Text>
      </View>
      <View style={styles.line} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  line: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#333",
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#333",
    backgroundColor: "#1a1a1a",
    marginHorizontal: 8,
  },
  text: {
    fontSize: 12,
    fontWeight: "500",
    color: "#888",
  },
});
