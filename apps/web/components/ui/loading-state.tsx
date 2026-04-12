"use client";

import { Loader2, RefreshCw, LogOut, AlertTriangle } from "lucide-react";
import { useLoadingTimeout } from "@/hooks/useLoadingTimeout";

interface LoadingStateProps {
  isLoading: boolean;
  message?: string;
  timeoutMs?: number;
  timeoutMessage?: string;
  onRetry?: () => void;
  onSignOut?: () => void;
  /** Use "full" for page-level loading (h-screen), "inline" for within-page sections (h-full) */
  variant?: "full" | "inline";
}

export function LoadingState({
  isLoading,
  message = "Loading\u2026",
  timeoutMs = 10_000,
  timeoutMessage = "This is taking longer than expected.",
  onRetry,
  onSignOut,
  variant = "full",
}: LoadingStateProps) {
  const timedOut = useLoadingTimeout(isLoading, timeoutMs);
  const height = variant === "full" ? "h-screen" : "h-full min-h-[200px]";

  if (!timedOut) {
    return (
      <div className={`flex ${height} flex-col items-center justify-center gap-3`}>
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
    );
  }

  return (
    <div className={`flex ${height} flex-col items-center justify-center gap-4 px-4`}>
      <AlertTriangle className="h-8 w-8 text-yellow-500/80" />
      <div className="text-center">
        <p className="text-sm font-medium text-foreground">{timeoutMessage}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Check your connection or try again.
        </p>
      </div>
      <div className="flex gap-2">
        {onRetry && (
          <button
            onClick={onRetry}
            className="inline-flex items-center gap-1.5 rounded-md border border-subtle bg-surface-1 px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-surface-2"
          >
            <RefreshCw className="h-3 w-3" />
            Retry
          </button>
        )}
        {onSignOut && (
          <button
            onClick={onSignOut}
            className="inline-flex items-center gap-1.5 rounded-md border border-subtle bg-surface-1 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-surface-2"
          >
            <LogOut className="h-3 w-3" />
            Sign out
          </button>
        )}
      </div>
    </div>
  );
}
