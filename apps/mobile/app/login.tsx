import { useState } from "react";
import {
  View,
  Text,
  Image,
  Pressable,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import * as WebBrowser from "expo-web-browser";
import {
  buildAuthorizationUrl,
  exchangeCodeForTokens,
  saveToken,
  saveRefreshToken,
} from "@/lib/auth";
import { notifyTokenSaved } from "@/hooks/useConvexAuth";

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const handleSignIn = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const authUrl = buildAuthorizationUrl();
      const redirectUri = "openping://auth/callback";

      const result = await WebBrowser.openAuthSessionAsync(
        authUrl,
        redirectUri,
      );

      if (result.type === "success" && result.url) {
        const url = new URL(result.url);
        const code = url.searchParams.get("code");

        if (!code) {
          setError("No authorization code received");
          return;
        }

        const tokens = await exchangeCodeForTokens(code);
        await saveToken(tokens.accessToken);
        await saveRefreshToken(tokens.refreshToken);
        // Notify the auth hook so Convex re-authenticates
        notifyTokenSaved(tokens.accessToken);
        // AuthGate will handle navigation once isAuthenticated flips to true
      } else if (result.type === "cancel") {
        // User cancelled — do nothing
      } else {
        setError("Authentication failed");
      }
    } catch (e: any) {
      setError(e?.message ?? "Something went wrong");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Image
          source={require("@/assets/logo-icon-light-on-dark.png")}
          style={styles.logoImage}
          resizeMode="contain"
        />
        <Text style={styles.subtitle}>AI-native workspace communication</Text>

        {error && <Text style={styles.error}>{error}</Text>}

        <Pressable
          style={[styles.button, isLoading && styles.buttonDisabled]}
          onPress={handleSignIn}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Sign in</Text>
          )}
        </Pressable>

        <Pressable
          style={[styles.secondaryButton, isLoading && styles.buttonDisabled]}
          onPress={handleSignIn}
          disabled={isLoading}
        >
          <Text style={styles.secondaryButtonText}>Create account</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    alignItems: "center",
    paddingHorizontal: 32,
    width: "100%",
    maxWidth: 400,
  },
  logoImage: {
    width: 100,
    height: 100,
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: "#888",
    marginBottom: 48,
    textAlign: "center",
  },
  error: {
    color: "#ef4444",
    fontSize: 14,
    marginBottom: 16,
    textAlign: "center",
  },
  button: {
    backgroundColor: "#0a7ea4",
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderRadius: 12,
    width: "100%",
    alignItems: "center",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "600",
  },
  secondaryButton: {
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderRadius: 12,
    width: "100%",
    alignItems: "center",
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#333",
  },
  secondaryButtonText: {
    color: "#ccc",
    fontSize: 17,
    fontWeight: "600",
  },
});
