import { StyleSheet, Text, View } from "react-native";

const COLORS: Record<string, string> = {
  do: "#ef4444",
  decide: "#f97316",
  delegate: "#3b82f6",
  skip: "#6b7280",
};

export function CategoryBadge({
  category,
}: {
  category: "do" | "decide" | "delegate" | "skip";
}) {
  return (
    <View style={[styles.pill, { backgroundColor: COLORS[category] }]}>
      <Text style={styles.label}>{category.toUpperCase()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  label: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "600",
  },
});
