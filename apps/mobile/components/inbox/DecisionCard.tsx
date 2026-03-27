import { Pressable, StyleSheet, Text, View } from "react-native";
import { CategoryBadge } from "./CategoryBadge";

type Action = { label: string; actionKey: string; primary?: boolean };

type Item = {
  _id: string;
  type: string;
  category: "do" | "decide" | "delegate" | "skip";
  title: string;
  summary: string;
  status: "pending" | "snoozed";
  channelName?: string | null;
  recommendedActions?: Action[] | null;
  createdAt: number;
  _creationTime: number;
};

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

export function DecisionCard({
  item,
  onAct,
  onArchive,
}: {
  item: Item;
  onAct: (itemId: string, actionKey: string) => void;
  onArchive: (itemId: string) => void;
}) {
  const actions = item.recommendedActions ?? [];

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <CategoryBadge category={item.category} />
        {item.channelName ? (
          <Text style={styles.channel}>#{item.channelName}</Text>
        ) : null}
        <Text style={styles.time}>{relativeTime(item.createdAt)}</Text>
      </View>

      <Text style={styles.title}>{item.title}</Text>
      <Text style={styles.summary} numberOfLines={3}>
        {item.summary}
      </Text>

      {actions.length > 0 && (
        <View style={styles.actionsRow}>
          {actions.map((action) => (
            <Pressable
              key={action.actionKey}
              style={[
                styles.actionBtn,
                action.primary ? styles.primaryBtn : styles.secondaryBtn,
              ]}
              onPress={() => onAct(item._id, action.actionKey)}
            >
              <Text
                style={
                  action.primary ? styles.primaryText : styles.secondaryText
                }
              >
                {action.label}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      <Pressable
        style={styles.archiveBtn}
        onPress={() => onArchive(item._id)}
        hitSlop={8}
      >
        <Text style={styles.archiveText}>Archive</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#111",
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  channel: {
    color: "#888",
    fontSize: 13,
    flex: 1,
  },
  time: {
    color: "#888",
    fontSize: 12,
  },
  title: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 17,
    marginTop: 8,
  },
  summary: {
    color: "#ccc",
    fontSize: 14,
    marginTop: 4,
  },
  actionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
  },
  actionBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  primaryBtn: {
    backgroundColor: "#0a7ea4",
  },
  secondaryBtn: {
    backgroundColor: "#222",
  },
  primaryText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  secondaryText: {
    color: "#ccc",
    fontSize: 14,
  },
  archiveBtn: {
    alignSelf: "flex-end",
    marginTop: 8,
  },
  archiveText: {
    color: "#888",
    fontSize: 12,
  },
});
