"use client";

import { useEffect } from "react";
import { useMutation, useConvexAuth } from "convex/react";
import { api } from "@convex/_generated/api";

export function usePresenceHeartbeat(intervalMs = 60_000) {
  const { isAuthenticated } = useConvexAuth();
  const heartbeat = useMutation(api.presence.heartbeat);

  useEffect(() => {
    if (!isAuthenticated) return;

    // Initial heartbeat
    heartbeat();

    const id = setInterval(() => {
      if (!document.hidden) heartbeat();
    }, intervalMs);

    // Heartbeat on visibility change (tab focus)
    const onVisibilityChange = () => {
      if (!document.hidden) heartbeat();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [isAuthenticated, heartbeat, intervalMs]);
}
