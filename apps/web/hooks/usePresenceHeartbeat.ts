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

    // Self-scheduling with jitter to prevent thundering herd
    const JITTER_RANGE_MS = 15_000;
    let timerId: ReturnType<typeof setTimeout>;
    const scheduleNext = () => {
      const jitter = Math.random() * JITTER_RANGE_MS * 2 - JITTER_RANGE_MS;
      timerId = setTimeout(() => {
        if (!document.hidden) heartbeat();
        scheduleNext();
      }, intervalMs + jitter);
    };
    scheduleNext();

    // Heartbeat on visibility change (tab focus)
    const onVisibilityChange = () => {
      if (!document.hidden) heartbeat();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      clearTimeout(timerId);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [isAuthenticated, heartbeat, intervalMs]);
}
