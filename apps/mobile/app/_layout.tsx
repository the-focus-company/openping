import React, { useEffect, useRef, useCallback } from "react";
import { View, Image, StyleSheet } from "react-native";
import { ConvexProviderWithAuth, ConvexReactClient, useConvexAuth as useConvexAuthState } from "convex/react";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { useConvexAuth } from "@/hooks/useConvexAuth";
import { useNotifications } from "@/hooks/useNotifications";
import { WorkspaceProvider } from "@/components/WorkspaceProvider";

SplashScreen.preventAutoHideAsync();

const convex = new ConvexReactClient(process.env.EXPO_PUBLIC_CONVEX_URL!);

// eslint-disable-next-line @typescript-eslint/no-var-requires
const splashLogo = require("@/assets/logo-icon-light-on-dark.png");

function AuthGate() {
  const { isLoading, isAuthenticated } = useConvexAuthState();
  const segments = useSegments();
  const router = useRouter();
  const segmentsRef = useRef(segments);
  segmentsRef.current = segments;

  useNotifications();

  const onReady = useCallback(async () => {
    if (!isLoading) {
      await SplashScreen.hideAsync();
    }
  }, [isLoading]);

  useEffect(() => {
    onReady();
  }, [onReady]);

  useEffect(() => {
    if (isLoading) return;

    const inLoginScreen = segmentsRef.current[0] === "login";

    if (!isAuthenticated && !inLoginScreen) {
      router.replace("/login");
    } else if (isAuthenticated && inLoginScreen) {
      router.replace("/(tabs)");
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading) {
    return (
      <View style={styles.splashContainer}>
        <Image source={splashLogo} style={styles.splashLogo} resizeMode="contain" />
      </View>
    );
  }

  return (
    <WorkspaceProvider>
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
        {/* Unified conversation routes */}
        <Stack.Screen
          name="conversation/[conversationId]"
          options={{ headerBackTitle: " " }}
        />
        <Stack.Screen
          name="conversation-info/[conversationId]"
          options={{ title: "Info", headerBackTitle: " " }}
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
        {/* Legacy routes — kept for backward compatibility while old screens still exist */}
        <Stack.Screen
          name="channel/[channelId]"
          options={{ headerBackTitle: " " }}
        />
        <Stack.Screen
          name="dm/[conversationId]"
          options={{ headerBackTitle: " " }}
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
  splashContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#000",
  },
  splashLogo: {
    width: 120,
    height: 120,
  },
});
