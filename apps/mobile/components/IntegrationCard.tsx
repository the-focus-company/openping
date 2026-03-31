import { View, Text, Pressable, Linking, StyleSheet } from "react-native";
import { GitPullRequest, Ticket, ExternalLink, Circle } from "lucide-react-native";

interface IntegrationObject {
  type: "github_pr" | "linear_ticket";
  title: string;
  status: string;
  url: string;
  author: string;
  metadata?: {
    repo?: string;
    project?: string;
    priority?: number;
    identifier?: string;
    description?: string;
  };
}

const statusColors: Record<string, string> = {
  open: "#22c55e",
  merged: "#a78bfa",
  closed: "#ef4444",
  draft: "#888",
  "in progress": "#f59e0b",
  "in review": "#0a7ea4",
  todo: "#888",
  done: "#22c55e",
  cancelled: "#ef4444",
  backlog: "#666",
};

const priorityLabels: Record<number, { label: string; color: string }> = {
  0: { label: "No priority", color: "#666" },
  1: { label: "Urgent", color: "#ef4444" },
  2: { label: "High", color: "#f59e0b" },
  3: { label: "Medium", color: "#0a7ea4" },
  4: { label: "Low", color: "#888" },
};

export function IntegrationCard({ integration }: { integration: IntegrationObject }) {
  const isGitHub = integration.type === "github_pr";
  const isLinear = integration.type === "linear_ticket";
  const statusColor = statusColors[integration.status.toLowerCase()] ?? "#888";
  const priority = isLinear && integration.metadata?.priority != null
    ? priorityLabels[integration.metadata.priority]
    : null;

  return (
    <Pressable
      style={styles.card}
      onPress={() => Linking.openURL(integration.url)}
    >
      <View style={styles.header}>
        <View style={[styles.iconWrap, { backgroundColor: isGitHub ? "rgba(139,92,246,0.15)" : "rgba(99,102,241,0.15)" }]}>
          {isGitHub ? (
            <GitPullRequest size={16} color="#a78bfa" />
          ) : (
            <Ticket size={16} color="#818cf8" />
          )}
        </View>
        <View style={styles.headerText}>
          <Text style={styles.source}>
            {isGitHub ? integration.metadata?.repo ?? "GitHub" : integration.metadata?.project ?? "Linear"}
          </Text>
          {integration.metadata?.identifier && (
            <Text style={styles.identifier}>{integration.metadata.identifier}</Text>
          )}
        </View>
        <ExternalLink size={14} color="#666" />
      </View>

      <Text style={styles.title} numberOfLines={2}>{integration.title}</Text>

      {integration.metadata?.description && (
        <Text style={styles.description} numberOfLines={2}>
          {integration.metadata.description}
        </Text>
      )}

      <View style={styles.meta}>
        <View style={styles.statusBadge}>
          <Circle size={8} color={statusColor} fill={statusColor} />
          <Text style={[styles.statusText, { color: statusColor }]}>
            {integration.status}
          </Text>
        </View>

        {priority && (
          <View style={styles.priorityBadge}>
            <Text style={[styles.priorityText, { color: priority.color }]}>
              {priority.label}
            </Text>
          </View>
        )}

        <Text style={styles.author}>{integration.author}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#1c1c1e",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#333",
    padding: 12,
    marginTop: 6,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: 6,
    justifyContent: "center",
    alignItems: "center",
  },
  headerText: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  source: {
    color: "#888",
    fontSize: 12,
    fontWeight: "500",
  },
  identifier: {
    color: "#666",
    fontSize: 12,
    fontFamily: "monospace",
  },
  title: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 20,
    marginBottom: 4,
  },
  description: {
    color: "#999",
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 8,
  },
  meta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 4,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "500",
    textTransform: "capitalize",
  },
  priorityBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    backgroundColor: "#222",
  },
  priorityText: {
    fontSize: 11,
    fontWeight: "600",
  },
  author: {
    color: "#666",
    fontSize: 12,
    flex: 1,
    textAlign: "right",
  },
});
