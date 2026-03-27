"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import * as Sentry from "@sentry/nextjs";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-surface-0 px-6 text-center">
      <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/10">
        <AlertTriangle className="h-7 w-7 text-red-400" />
      </div>

      <h1 className="text-xl font-semibold text-foreground">
        Something went wrong
      </h1>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        An unexpected error occurred. You can try again or head back to the home
        page.
      </p>
      {error.digest && (
        <p className="mt-3 font-mono text-xs text-muted-foreground/60">
          Error ID: {error.digest}
        </p>
      )}

      <div className="mt-8 flex items-center gap-3">
        <button
          onClick={reset}
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-ping-purple px-5 text-sm font-medium text-white transition-colors hover:bg-ping-purple-hover active:scale-[0.98]"
        >
          <RefreshCw className="h-4 w-4" />
          Try again
        </button>
        <Link
          href="/"
          className="inline-flex h-10 items-center gap-2 rounded-lg border border-subtle bg-surface-1 px-5 text-sm font-medium text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
        >
          <Home className="h-4 w-4" />
          Home
        </Link>
      </div>
    </div>
  );
}
