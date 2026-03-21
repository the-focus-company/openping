"use client";

import { ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { ConvexProviderWithAuth, ConvexReactClient } from "convex/react";

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

function useConvexAuth() {
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      try {
        const res = await fetch("/api/auth/token");
        if (!cancelled && res.ok) {
          const data = await res.json();
          setToken(data.token);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    init();
    return () => { cancelled = true; };
  }, []);

  const fetchAccessToken = useCallback(
    async ({ forceRefreshToken }: { forceRefreshToken: boolean }) => {
      if (!forceRefreshToken && token) {
        return token;
      }

      try {
        const res = await fetch("/api/auth/token");
        if (!res.ok) {
          setToken(null);
          return null;
        }
        const data = await res.json();
        setToken(data.token);
        return data.token;
      } catch {
        setToken(null);
        return null;
      }
    },
    [token],
  );

  return useMemo(
    () => ({
      isLoading,
      isAuthenticated: token !== null,
      fetchAccessToken,
    }),
    [isLoading, token, fetchAccessToken],
  );
}

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  return (
    <ConvexProviderWithAuth client={convex} useAuth={useConvexAuth}>
      {children}
    </ConvexProviderWithAuth>
  );
}
