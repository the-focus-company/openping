import { View, TextInput, Pressable, StyleSheet } from "react-native";
import { Tabs, useRouter } from "expo-router";
import { Home, MessageSquare, User, Search } from "lucide-react-native";

function FloatingSearchBar() {
  const router = useRouter();

  return (
    <Pressable
      style={styles.searchContainer}
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
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: "#0a7ea4",
        tabBarInactiveTintColor: "#666",
        tabBarStyle: {
          backgroundColor: "#111",
          borderTopColor: "#333",
        },
        tabBarHideOnKeyboard: true,
        headerStyle: {
          backgroundColor: "#111",
        },
        headerTintColor: "#fff",
      }}
      tabBar={(props: any) => (
        <View style={styles.tabBarWrap}>
          <FloatingSearchBar />
          <View style={styles.tabBarInner}>
            {props.state.routes
              .filter((route: any) => route.name !== "search-tab")
              .map((route: any) => {
                const routeIndex = props.state.routes.indexOf(route);
                const isFocused = props.state.index === routeIndex;
                const color = isFocused ? "#0a7ea4" : "#666";

                let icon: React.ReactNode = null;
                if (route.name === "index")
                  icon = <Home size={22} color={color} />;
                else if (route.name === "communications")
                  icon = <MessageSquare size={22} color={color} />;
                else if (route.name === "profile")
                  icon = <User size={22} color={color} />;

                if (!icon) return null;

                return (
                  <Pressable
                    key={route.key}
                    style={styles.tabItem}
                    onPress={() => {
                      const event = props.navigation.emit({
                        type: "tabPress",
                        target: route.key,
                        canPreventDefault: true,
                      });
                      if (!isFocused && !event.defaultPrevented) {
                        props.navigation.navigate(route.name);
                      }
                    }}
                  >
                    {icon}
                  </Pressable>
                );
              })}
          </View>
        </View>
      )}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
        }}
      />
      <Tabs.Screen
        name="communications"
        options={{
          title: "DMs",
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
        }}
      />
      <Tabs.Screen
        name="search-tab"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBarWrap: {
    backgroundColor: "transparent",
    paddingBottom: 20,
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingBottom: 6,
  },
  searchInputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#222",
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
  tabBarInner: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 8,
    backgroundColor: "#111",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#333",
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 4,
  },
});
