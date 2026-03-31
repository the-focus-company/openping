import React, { useEffect, useRef } from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { ConvexProviderWithAuth, ConvexReactClient, useConvexAuth as useConvexAuthState } from "convex/react";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useConvexAuth } from "@/hooks/useConvexAuth";
import { useNotifications } from "@/hooks/useNotifications";
import { WorkspaceProvider } from "@/components/WorkspaceProvider";

const convex = new ConvexReactClient(process.env.EXPO_PUBLIC_CONVEX_URL!);

function AuthGate() {
  const { isLoading, isAuthenticated } = useConvexAuthState();
  const segments = useSegments();
  const router = useRouter();
  const segmentsRef = useRef(segments);
  segmentsRef.current = segments;

  useNotifications();

  useEffect(() => {
    if (isLoading) return;

    const inLoginScreen = segmentsRef.current[0] === "login";

    if (!isAuthenticated && !inLoginScreen) {
      router.replace("/login");
    } else if (isAuthenticated && inLoginScreen) {
      router.replace("/(tabs)");
    }
  }, [isLoading, isAuthenticated, router]);

  return (
    <WorkspaceProvider>
      {isLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#0a7ea4" />
        </View>
      )}
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: "#111" },
          headerTintColor: "#fff",
          contentStyle: { backgroundColor: "#000" },
          headerBackButtonDisplayMode: "minimal",
        }}
      >
        <Stack.Screen
          name="(tabs)"
          options={{ headerShown: false, headerBackTitle: " " }}
        />
        <Stack.Screen
          name="login"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="channel/[channelId]"
          options={{ headerBackTitle: " " }}
        />
        <Stack.Screen
          name="dm/[conversationId]"
          options={{ headerBackTitle: " " }}
        />
        <Stack.Screen
          name="new-conversation"
          options={{ title: "New Conversation", headerBackTitle: " " }}
        />
        <Stack.Screen
          name="search"
          options={{ title: "Search", headerBackTitle: " " }}
        />
        <Stack.Screen
          name="thread/[messageId]"
          options={{ title: "Thread", headerBackTitle: " " }}
        />
        <Stack.Screen
          name="dm-thread/[messageId]"
          options={{ title: "Thread", headerBackTitle: " " }}
        />
        <Stack.Screen
          name="channel-info/[channelId]"
          options={{ title: "Channel Info", headerBackTitle: " " }}
        />
        <Stack.Screen
          name="dm-info/[conversationId]"
          options={{ title: "Conversation Info", headerBackTitle: " " }}
        />
      </Stack>
    </WorkspaceProvider>
  );
}

export default function RootLayout() {
  return (
    <ConvexProviderWithAuth client={convex} useAuth={useConvexAuth}>
      <AuthGate />
      <StatusBar style="light" />
    </ConvexProviderWithAuth>
  );
}

const styles = StyleSheet.create({
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#000",
    zIndex: 10,
  },
});
