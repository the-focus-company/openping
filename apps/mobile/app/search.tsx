import { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  SectionList,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useRouter } from "expo-router";
import { getInitials } from "@/lib/initials";
import { SearchResultItem } from "@/components/search/SearchResultItem";

export default function SearchScreen() {
  const { workspaceId } = useWorkspace();
  const router = useRouter();

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
  const directMessages = useQuery(
    api.search.searchDirectMessages,
    shouldSearch ? { query: debouncedQuery } : "skip",
  );

  const isLoading =
    shouldSearch &&
    (people === undefined || messages === undefined || directMessages === undefined);

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
  if (people && people.length > 0) {
    sections.push({
      title: "People",
      data: people.map((p) => ({
        key: p._id,
        title: p.name,
        subtitle: p.email,
        initials: getInitials(p.name),
        onPress: () => {},
      })),
    });
  }
  if (messages && messages.length > 0) {
    sections.push({
      title: "Messages",
      data: messages.map((m) => ({
        key: m._id,
        title: m.authorName,
        subtitle: m.body,
        context: m.channelName ? `#${m.channelName}` : undefined,
        timestamp: m._creationTime,
        onPress: () =>
          router.push({
            pathname: "/channel/[channelId]",
            params: { channelId: m.channelId },
          }),
      })),
    });
  }
  if (directMessages && directMessages.length > 0) {
    sections.push({
      title: "Direct Messages",
      data: directMessages.map((m) => ({
        key: m._id,
        title: m.authorName,
        subtitle: m.body,
        context: "DM",
        timestamp: m._creationTime,
        onPress: () =>
          router.push({
            pathname: "/dm/[conversationId]",
            params: { conversationId: m.conversationId },
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
