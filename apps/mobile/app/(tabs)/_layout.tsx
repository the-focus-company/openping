import { View, TextInput, Pressable, StyleSheet } from "react-native";
import { Tabs, useRouter } from "expo-router";
import { Home, MessageSquare, User, Search } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function TabLayout() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Tab bar height: icons (22) + padding (6+6) + safe area
  const tabBarHeight = 32 + insets.bottom;
  // Search sits 12px above tab bar
  const searchBottom = tabBarHeight + 12;

  return (
    <View style={styles.root}>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: "#0a7ea4",
          tabBarInactiveTintColor: "#666",
          tabBarStyle: {
            backgroundColor: "#111",
            borderTopColor: "#333",
            height: tabBarHeight,
            paddingTop: 6,
          },
          tabBarShowLabel: false,
          tabBarHideOnKeyboard: true,
          headerStyle: {
            backgroundColor: "#111",
          },
          headerTintColor: "#fff",
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "My Deck",
            tabBarIcon: ({ color }) => <Home size={22} color={color} />,
          }}
        />
        <Tabs.Screen
          name="communications"
          options={{
            title: "Conversations",
            tabBarIcon: ({ color }) => <MessageSquare size={22} color={color} />,
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: "Profile",
            tabBarIcon: ({ color }) => <User size={22} color={color} />,
          }}
        />
        <Tabs.Screen
          name="search-tab"
          options={{ href: null }}
        />
      </Tabs>

      {/* Floating search bar — positioned absolutely above tab bar */}
      <Pressable
        style={[styles.searchOverlay, { bottom: searchBottom }]}
        onPress={() => router.push("/search")}
      >
        <View style={styles.searchInputWrap}>
          <Search size={16} color="#666" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search..."
            placeholderTextColor="#666"
            editable={false}
            pointerEvents="none"
          />
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  searchOverlay: {
    position: "absolute",
    left: 16,
    right: 16,
  },
  searchInputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(34,34,34,0.95)",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    color: "#fff",
    fontSize: 15,
  },
});
