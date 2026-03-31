import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useQuery, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import { DecisionCard } from "@/components/inbox/DecisionCard";
import { Stack } from "expo-router";
import { useWorkspace } from "@/hooks/useWorkspace";

type InboxItem = {
  _id: string;
  type: string;
  category: "do" | "decide" | "delegate" | "skip";
  title: string;
  summary: string;
  context?: string | null;
  pingWillDo?: string | null;
  status: "pending" | "snoozed" | "archived";
  channelName?: string | null;
  orgTrace?: any[] | null;
  recommendedActions?: {
    label: string;
    actionKey: string;
    primary?: boolean;
    needsComment?: boolean;
  }[] | null;
  nextSteps?: any[] | null;
  links?: any[] | null;
  agentExecutionStatus?: string | null;
  agentExecutionResult?: string | null;
  createdAt: number;
  _creationTime: number;
};

const CATEGORIES = ["all", "do", "decide", "delegate", "skip"] as const;
type CategoryFilter = (typeof CATEGORIES)[number];

const categoryColors: Record<string, string> = {
  do: "#ef4444",
  decide: "#f59e0b",
  delegate: "#3b82f6",
  skip: "#888",
};

// eslint-disable-next-line @typescript-eslint/no-var-requires
const logoImage = require("@/assets/logo-dark.png");

export default function InboxScreen() {
  const { workspaceName } = useWorkspace();
  const items = useQuery(api.inboxItems.list);
  const actMutation = useMutation(api.inboxItems.act);
  const archiveMutation = useMutation(api.inboxItems.archive);

  const [refreshing, setRefreshing] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 600);
  }, []);

  const handleAct = useCallback(
    (itemId: string, actionKey: string) => {
      actMutation({ itemId: itemId as any, action: actionKey });
    },
    [actMutation],
  );

  const handleArchive = useCallback(
    (itemId: string) => {
      archiveMutation({ itemId: itemId as any });
    },
    [archiveMutation],
  );

  if (items === undefined) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0a7ea4" />
      </View>
    );
  }

  const filtered = categoryFilter === "all"
    ? items
    : items.filter((i: InboxItem) => i.category === categoryFilter);

  const pending = filtered.filter((i: InboxItem) => i.status === "pending");
  const snoozed = filtered.filter((i: InboxItem) => i.status === "snoozed");

  // Category counts for filter chips
  const counts: Record<string, number> = { all: items.length };
  for (const item of items) {
    counts[item.category] = (counts[item.category] ?? 0) + 1;
  }

  const sections = [
    ...(pending.length > 0 ? [{ title: "Pending", data: pending }] : []),
    ...(snoozed.length > 0 ? [{ title: "Snoozed", data: snoozed }] : []),
  ];

  return (
    <>
      <Stack.Screen
        options={{
          headerStyle: { backgroundColor: "#111" },
          headerTintColor: "#fff",
          headerTitle: () => (
            <View style={styles.headerRow}>
              <Image source={logoImage} style={styles.headerLogo} resizeMode="contain" />
              <Text style={styles.headerDot}>·</Text>
              <Text style={styles.headerWorkspace}>{workspaceName}</Text>
            </View>
          ),
        }}
      />
      <View style={styles.filterBar}>
        {CATEGORIES.map((cat) => {
          const isActive = categoryFilter === cat;
          const count = counts[cat] ?? 0;
          return (
            <Pressable
              key={cat}
              style={[
                styles.filterChip,
                isActive && styles.filterChipActive,
                cat !== "all" && isActive && { backgroundColor: categoryColors[cat] + "22", borderColor: categoryColors[cat] },
              ]}
              onPress={() => setCategoryFilter(cat)}
            >
              <Text
                style={[
                  styles.filterChipText,
                  isActive && styles.filterChipTextActive,
                  cat !== "all" && isActive && { color: categoryColors[cat] },
                ]}
              >
                {cat === "all" ? "All" : cat.charAt(0).toUpperCase() + cat.slice(1)}
                {count > 0 ? ` ${count}` : ""}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {sections.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyTitle}>
            {categoryFilter === "all" ? "Your deck is clear" : `No "${categoryFilter}" items`}
          </Text>
          <Text style={styles.emptySubtitle}>
            {categoryFilter === "all"
              ? "New decisions will appear here when they need your attention."
              : "Try a different filter or check back later."}
          </Text>
        </View>
      ) : (
        <SectionList
          style={styles.list}
          contentContainerStyle={styles.listContent}
          sections={sections}
          keyExtractor={(item) => item._id}
          renderItem={({ item }) => (
            <DecisionCard
              item={item as InboxItem}
              onAct={handleAct}
              onArchive={handleArchive}
            />
          )}
          renderSectionHeader={({ section }) => (
            <Text style={styles.sectionHeader}>{section.title}</Text>
          )}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#0a7ea4"
            />
          }
          stickySectionHeadersEnabled={false}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  headerLogo: {
    height: 20,
    width: 60,
  },
  headerDot: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 16,
  },
  headerWorkspace: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#000",
    padding: 24,
  },
  list: {
    flex: 1,
    backgroundColor: "#000",
  },
  listContent: {
    padding: 16,
  },
  filterBar: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    backgroundColor: "#000",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#222",
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#333",
    backgroundColor: "#111",
  },
  filterChipActive: {
    borderColor: "#0a7ea4",
    backgroundColor: "rgba(10,126,164,0.15)",
  },
  filterChipText: {
    fontSize: 13,
    color: "#888",
    fontWeight: "500",
  },
  filterChipTextActive: {
    color: "#0a7ea4",
    fontWeight: "600",
  },
  sectionHeader: {
    color: "#888",
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyTitle: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 8,
  },
  emptySubtitle: {
    color: "#888",
    fontSize: 15,
    textAlign: "center",
  },
});
