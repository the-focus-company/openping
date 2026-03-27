import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useQuery, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import { DecisionCard } from "@/components/inbox/DecisionCard";

type InboxItem = {
  _id: string;
  type: string;
  category: "do" | "decide" | "delegate" | "skip";
  title: string;
  summary: string;
  status: "pending" | "snoozed";
  channelName?: string | null;
  recommendedActions?: Array<{
    label: string;
    actionKey: string;
    primary?: boolean;
  }> | null;
  createdAt: number;
  _creationTime: number;
};

export default function InboxScreen() {
  const items = useQuery(api.inboxItems.list);
  const actMutation = useMutation(api.inboxItems.act);
  const archiveMutation = useMutation(api.inboxItems.archive);

  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    // Convex auto-refreshes; this is purely a UX affordance
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

  const pending = items.filter((i: InboxItem) => i.status === "pending");
  const snoozed = items.filter((i: InboxItem) => i.status === "snoozed");

  const sections = [
    ...(pending.length > 0 ? [{ title: "Pending", data: pending }] : []),
    ...(snoozed.length > 0 ? [{ title: "Snoozed", data: snoozed }] : []),
  ];

  if (sections.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyTitle}>Your deck is clear</Text>
        <Text style={styles.emptySubtitle}>
          New decisions will appear here when they need your attention.
        </Text>
      </View>
    );
  }

  return (
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
  );
}

const styles = StyleSheet.create({
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
