import { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  SectionList,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { useQuery, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useRouter } from "expo-router";
import { getInitials } from "@/lib/initials";
import { SearchResultItem } from "@/components/search/SearchResultItem";

export default function SearchScreen() {
  const { workspaceId } = useWorkspace();
  const router = useRouter();

  const createConversation = useMutation(api.conversations.create);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const shouldSearch = debouncedQuery.length >= 2;

  const people = useQuery(
    api.search.searchPeople,
    shouldSearch ? { workspaceId, query: debouncedQuery } : "skip",
  );
  const messages = useQuery(
    api.search.searchMessages,
    shouldSearch ? { workspaceId, query: debouncedQuery } : "skip",
  );
  const agents = useQuery(
    api.agents.list,
    { workspaceId },
  );

  const isLoading =
    shouldSearch &&
    (people === undefined || messages === undefined);

  type ResultItem = {
    key: string;
    title: string;
    subtitle?: string;
    context?: string;
    timestamp?: number;
    initials?: string;
    onPress: () => void;
  };
  const sections: { title: string; data: ResultItem[] }[] = [];

  // Build a set of agent userIds to identify agents in people results
  const agentUserIdMap = new Map<string, any>();
  if (agents) {
    for (const a of agents as any[]) {
      if (a.agentUserId) {
        agentUserIdMap.set(a.agentUserId, a);
      }
    }
  }

  // Merge people + agents into one "People" section
  if (people && people.length > 0) {
    const peopleItems: ResultItem[] = people.map((p) => {
      const agentRecord = agentUserIdMap.get(p._id);
      const isAgent = !!agentRecord;
      return {
        key: p._id,
        title: p.name,
        subtitle: isAgent ? (agentRecord.description ?? "AI Agent") : p.email,
        context: isAgent ? "AI" : undefined,
        initials: getInitials(p.name),
        onPress: async () => {
          const conversationId = await createConversation({
            kind: isAgent ? "agent_1to1" : "1to1",
            visibility: "secret",
            memberIds: [p._id as Id<"users">],
            ...(isAgent ? { agentMemberIds: [p._id as Id<"users">] } : {}),
            workspaceId,
          });
          router.push({
            pathname: "/conversation/[conversationId]" as any,
            params: { conversationId },
          });
        },
      };
    });

    // Add agents that matched by name/description but aren't in people results
    // (e.g. agent has no workspace membership or different search match)
    if (agents && shouldSearch) {
      const lowerQ = debouncedQuery.toLowerCase();
      const existingKeys = new Set(peopleItems.map((p) => p.key));
      for (const a of agents as any[]) {
        if (a.agentUserId && existingKeys.has(a.agentUserId)) continue;
        if (
          a.name.toLowerCase().includes(lowerQ) ||
          (a.description && a.description.toLowerCase().includes(lowerQ))
        ) {
          peopleItems.push({
            key: a._id,
            title: a.name,
            subtitle: a.description ?? "AI Agent",
            context: "AI",
            initials: a.name.charAt(0).toUpperCase(),
            onPress: async () => {
              if (a.agentUserId) {
                const conversationId = await createConversation({
                  kind: "agent_1to1",
                  visibility: "secret",
                  memberIds: [a.agentUserId as Id<"users">],
                  agentMemberIds: [a.agentUserId as Id<"users">],
                  workspaceId,
                });
                router.push({
                  pathname: "/conversation/[conversationId]" as any,
                  params: { conversationId },
                });
              }
            },
          });
        }
      }
    }

    sections.push({ title: "People", data: peopleItems });
  }
  if (messages && messages.length > 0) {
    const seenMsg = new Set<string>();
    const uniqueMessages = messages.filter((m) => {
      if (seenMsg.has(m._id)) return false;
      seenMsg.add(m._id);
      return true;
    });
    sections.push({
      title: "Messages",
      data: uniqueMessages.map((m) => ({
        key: m._id,
        title: m.authorName,
        subtitle: m.body,
        context: m.conversationName ? `#${m.conversationName}` : undefined,
        timestamp: m._creationTime,
        onPress: () =>
          router.push({
            pathname: "/conversation/[conversationId]" as any,
            params: { conversationId: m.conversationId, highlightMessage: m._id },
          }),
      })),
    });
  }

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        placeholder="Search messages, people..."
        placeholderTextColor="#666"
        value={query}
        onChangeText={setQuery}
        autoFocus
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
      />

      {!shouldSearch ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>
            Search across conversations, people, and messages
          </Text>
        </View>
      ) : isLoading ? (
        <View style={styles.empty}>
          <ActivityIndicator size="large" color="#0a7ea4" />
        </View>
      ) : sections.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>
            No results for &apos;{debouncedQuery}&apos;
          </Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.key}
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
            </View>
          )}
          renderItem={({ item }) => (
            <SearchResultItem
              title={item.title}
              subtitle={item.subtitle}
              context={item.context}
              timestamp={item.timestamp}
              initials={item.initials}
              onPress={item.onPress}
            />
          )}
          keyboardShouldPersistTaps="handled"
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  input: {
    backgroundColor: "#222",
    color: "#fff",
    fontSize: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    margin: 12,
    borderRadius: 10,
  },
  empty: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  emptyText: {
    color: "#888",
    fontSize: 15,
    textAlign: "center",
  },
  sectionHeader: {
    backgroundColor: "#111",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#333",
  },
  sectionTitle: {
    color: "#ccc",
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
});
