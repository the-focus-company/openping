"use client";

import { useEffect, useRef } from "react";
import { useQuery, useMutation } from "convex/react";
import { Authenticated, AuthLoading, Unauthenticated } from "convex/react";
import { api } from "@convex/_generated/api";
import { navigateToWorkspace } from "@/lib/workspace-url";
import { Loader2 } from "lucide-react";
import {
  Navigation,
  HeroSection,
  PainSection,
  SolutionSection,
  FeaturesShowcase,
  ValueProps,
  ComparisonSection,
  ICPCallout,
  PricingSignal,
  DeveloperSection,
  FinalCTA,
  Footer,
} from "@/components/landing-v2";
import { Divider } from "@/components/landing-v2/primitives";

/* ── Authenticated redirect ── */

function WorkspaceRedirect() {
  const workspaces = useQuery(api.workspaceMembers.listMyWorkspaces);
  const ensureUser = useMutation(api.users.ensureUser);
  const redirected = useRef(false);
  const ensured = useRef(false);

  // If authenticated but no user record found, provision one from JWT claims
  useEffect(() => {
    if (ensured.current) return;
    if (workspaces === null) {
      ensured.current = true;
      ensureUser().catch(() => {
        // Reset so it can retry on next render cycle
        ensured.current = false;
      });
    }
  }, [workspaces, ensureUser]);

  useEffect(() => {
    if (redirected.current) return;
    if (workspaces === undefined || workspaces === null) return;
    if (workspaces.length === 1) {
      redirected.current = true;
      navigateToWorkspace(workspaces[0].slug);
    }
  }, [workspaces]);

  if (workspaces === undefined || workspaces === null) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3">
        <Loader2 className="h-5 w-5 animate-spin text-white/20" />
        <p className="text-sm text-muted-foreground">
          {workspaces === null ? "Setting up your workspace\u2026" : "Loading\u2026"}
        </p>
      </div>
    );
  }

  if (workspaces.length === 1) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-white/20" />
      </div>
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
  return (
    <div className="min-h-screen bg-surface-0 text-foreground dark">
      <Navigation />
      <HeroSection />
      <Divider />
      <PainSection />
      <Divider />
      <SolutionSection />
      <Divider />
      <FeaturesShowcase />
      <Divider />
      <ValueProps />
      <Divider />
      <ComparisonSection />
      <Divider />
      <ICPCallout />
      <Divider />
      <PricingSignal />
      <Divider />
      <DeveloperSection />
      <Divider />
      <FinalCTA />
      <Footer />
    </div>
  );
}

export default function Home() {
  return (
    <>
      <AuthLoading>
        <div className="flex h-screen items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-transparent" />
        </div>
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
