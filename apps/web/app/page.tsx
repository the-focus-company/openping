"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { Authenticated, AuthLoading, Unauthenticated } from "convex/react";
import { api } from "@convex/_generated/api";
import { navigateToWorkspace } from "@/lib/workspace-url";
import { LoadingState } from "@/components/ui/loading-state";
import { AlertTriangle } from "lucide-react";
import LandingDeck from "@/components/LandingDeck";

const MAX_ENSURE_RETRIES = 3;
const RETRY_DELAY_MS = 2_000;

function WorkspaceRedirect() {
  const workspaces = useQuery(api.workspaceMembers.listMyWorkspaces);
  const ensureUser = useMutation(api.users.ensureUser);
  const redirected = useRef(false);
  const retryCount = useRef(0);
  const [error, setError] = useState<string | null>(null);

  const isLoading = workspaces === undefined;
  const needsProvisioning = workspaces === null;

  // If authenticated but no user record found, provision one from JWT claims
  useEffect(() => {
    if (!needsProvisioning || error) return;

    let cancelled = false;
    const attempt = () => {
      ensureUser()
        .then(() => {
          retryCount.current = 0;
        })
        .catch(() => {
          if (cancelled) return;
          retryCount.current += 1;
          if (retryCount.current < MAX_ENSURE_RETRIES) {
            setTimeout(() => {
              if (!cancelled) attempt();
            }, RETRY_DELAY_MS);
          } else {
            setError("Could not set up your account. Please sign out and try again.");
          }
        });
    };
    attempt();
    return () => { cancelled = true; };
  }, [needsProvisioning, ensureUser, error]);

  useEffect(() => {
    if (redirected.current) return;
    if (workspaces === undefined || workspaces === null) return;
    if (workspaces.length === 1) {
      redirected.current = true;
      navigateToWorkspace(workspaces[0].slug);
    }
  }, [workspaces]);

  const handleSignOut = useCallback(() => {
    window.location.href = "/sign-out";
  }, []);

  const handleRetry = useCallback(() => {
    setError(null);
    retryCount.current = 0;
  }, []);

  if (error) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 px-4">
        <AlertTriangle className="h-8 w-8 text-yellow-500/80" />
        <div className="text-center">
          <p className="text-sm font-medium text-foreground">{error}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Check your connection or try again.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleRetry}
            className="inline-flex items-center gap-1.5 rounded-md border border-subtle bg-surface-1 px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-surface-2"
          >
            Retry
          </button>
          <button
            onClick={handleSignOut}
            className="inline-flex items-center gap-1.5 rounded-md border border-subtle bg-surface-1 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-surface-2"
          >
            Sign out
          </button>
        </div>
      </div>
    );
  }

  if (isLoading || needsProvisioning) {
    return (
      <LoadingState
        isLoading
        message={needsProvisioning ? "Setting up your workspace\u2026" : "Loading\u2026"}
        timeoutMs={15_000}
        timeoutMessage="We couldn\u2019t load your workspaces."
        onRetry={() => window.location.reload()}
        onSignOut={handleSignOut}
      />
    );
  }

  if (workspaces.length === 1) {
    return (
      <LoadingState
        isLoading
        message="Redirecting\u2026"
        timeoutMs={8_000}
        timeoutMessage="Redirect is taking too long."
        onRetry={() => navigateToWorkspace(workspaces[0].slug)}
      />
    );
  }

  const lastSlug = typeof window !== "undefined" ? localStorage.getItem("lastWorkspace") : null;
  const sorted = lastSlug
    ? [...workspaces].sort((a, b) => (a.slug === lastSlug ? -1 : b.slug === lastSlug ? 1 : 0))
    : workspaces;

  return (
    <div className="flex h-screen flex-col items-center justify-center gap-6 px-4">
      <div className="text-center">
        <h1 className="text-lg font-semibold text-foreground">Your Workspaces</h1>
        <p className="mt-1 text-xs text-muted-foreground">Choose a workspace to continue</p>
      </div>
      <div className="grid w-full max-w-sm gap-2">
        {sorted.map((ws) => (
          <button
            key={ws.workspaceId}
            onClick={() => {
              localStorage.setItem("lastWorkspace", ws.slug);
              navigateToWorkspace(ws.slug);
            }}
            className="flex items-center gap-3 rounded border border-subtle bg-surface-1 px-4 py-3 text-left transition-colors hover:bg-surface-2"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded bg-foreground/10 text-xs font-bold text-foreground">
              {ws.name[0]?.toUpperCase() ?? "W"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="truncate text-sm font-medium text-foreground">{ws.name}</p>
              <p className="text-2xs text-muted-foreground">{ws.slug}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ── Landing Page ── */

function LandingPage() {
  return <LandingDeck />;
}

export default function Home() {
  return (
    <>
      <AuthLoading>
        <LandingPage />
      </AuthLoading>
      <Unauthenticated>
        <LandingPage />
      </Unauthenticated>
      <Authenticated>
        <WorkspaceRedirect />
      </Authenticated>
    </>
  );
}
