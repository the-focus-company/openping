import { useCallback, useEffect, useRef, useState } from "react";
import {
  getToken,
  getRefreshToken,
  refreshAccessToken,
  saveToken,
  saveRefreshToken,
  deleteToken,
  deleteRefreshToken,
} from "@/lib/auth";

// Module-level callback so login.tsx can notify the hook about new tokens
let onTokenSaved: ((token: string) => void) | null = null;

export function notifyTokenSaved(token: string) {
  onTokenSaved?.(token);
}

export function useConvexAuth() {
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const tokenRef = useRef<string | null>(null);

  // Keep ref in sync with state
  useEffect(() => {
    tokenRef.current = token;
  }, [token]);

  // Register the module-level callback
  useEffect(() => {
    onTokenSaved = (newToken: string) => {
      tokenRef.current = newToken;
      setToken(newToken);
    };
    return () => {
      onTokenSaved = null;
    };
  }, []);

  // Read token from SecureStore on mount
  useEffect(() => {
    let cancelled = false;
    async function init() {
      try {
        const stored = await getToken();
        if (!cancelled && stored) {
          tokenRef.current = stored;
          setToken(stored);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    init();
    return () => {
      cancelled = true;
    };
  }, []);

  // Stable fetchAccessToken — uses ref to avoid re-creating on token change
  const fetchAccessToken = useCallback(
    async ({ forceRefreshToken }: { forceRefreshToken: boolean }) => {
      if (!forceRefreshToken) {
        // Return in-memory token if available
        if (tokenRef.current) return tokenRef.current;
        // Token might have been saved externally — re-read from SecureStore
        const stored = await getToken();
        if (stored) {
          tokenRef.current = stored;
          setToken(stored);
          return stored;
        }
        return null;
      }

      // Force refresh
      try {
        const refreshTokenValue = await getRefreshToken();
        if (refreshTokenValue) {
          const result = await refreshAccessToken(refreshTokenValue);
          await saveToken(result.accessToken);
          await saveRefreshToken(result.refreshToken);
          tokenRef.current = result.accessToken;
          setToken(result.accessToken);
          return result.accessToken;
        }
      } catch {
        await deleteToken();
        await deleteRefreshToken();
        tokenRef.current = null;
        setToken(null);
      }

      return null;
    },
    [], // Stable — uses refs, not state
  );

  return {
    isLoading,
    isAuthenticated: token !== null,
    fetchAccessToken,
  };
}
