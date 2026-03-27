import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getToken,
  getRefreshToken,
  refreshAccessToken,
  saveToken,
  saveRefreshToken,
  deleteToken,
  deleteRefreshToken,
} from "@/lib/auth";

export function useConvexAuth() {
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      try {
        const stored = await getToken();
        if (!cancelled) {
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

  const fetchAccessToken = useCallback(
    async ({ forceRefreshToken }: { forceRefreshToken: boolean }) => {
      if (!forceRefreshToken && token) {
        return token;
      }

      try {
        const refreshTokenValue = await getRefreshToken();
        if (refreshTokenValue) {
          const result = await refreshAccessToken(refreshTokenValue);
          await saveToken(result.accessToken);
          await saveRefreshToken(result.refreshToken);
          setToken(result.accessToken);
          return result.accessToken;
        }
      } catch {
        await deleteToken();
        await deleteRefreshToken();
        setToken(null);
      }

      return null;
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
