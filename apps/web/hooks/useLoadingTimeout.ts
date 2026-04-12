"use client";

import { useEffect, useState } from "react";

/**
 * Returns `true` when loading has exceeded the given timeout.
 * Resets automatically when `isLoading` becomes `false`.
 */
export function useLoadingTimeout(isLoading: boolean, timeoutMs = 10_000) {
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (!isLoading) {
      setTimedOut(false);
      return;
    }
    const timer = setTimeout(() => setTimedOut(true), timeoutMs);
    return () => clearTimeout(timer);
  }, [isLoading, timeoutMs]);

  return timedOut;
}
