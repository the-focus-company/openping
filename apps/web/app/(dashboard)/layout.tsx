"use client";

import { useEffect } from "react";
import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";
import { useQuery } from "convex/react";
import { useRouter, usePathname } from "next/navigation";
import { api } from "@convex/_generated/api";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { ToastProvider } from "@/components/ui/toast-provider";
import { LoadingState } from "@/components/ui/loading-state";

function RedirectToSignIn() {
  useEffect(() => {
    window.location.href = "/sign-in";
  }, []);
  return (
    <LoadingState
      isLoading
      message="Redirecting to sign in\u2026"
      timeoutMs={5_000}
      timeoutMessage="Redirect is taking too long."
      onRetry={() => { window.location.href = "/sign-in"; }}
    />
  );
}

function WaitForUser({ children }: { children: React.ReactNode }) {
  const user = useQuery(api.users.getMe);
  const router = useRouter();
  const pathname = usePathname();

  const isOnboarding = pathname.startsWith("/onboarding");
  const needsOnboarding = user?.onboardingStatus === "pending" && !isOnboarding;

  useEffect(() => {
    if (needsOnboarding) {
      router.replace("/onboarding");
    }
  }, [needsOnboarding, router]);

  if (user === undefined || user === null) {
    return (
      <LoadingState
        isLoading
        message={user === null ? "Setting up your account\u2026" : "Loading your profile\u2026"}
        timeoutMs={12_000}
        timeoutMessage="Could not load your account."
        onRetry={() => window.location.reload()}
        onSignOut={() => { window.location.href = "/sign-out"; }}
      />
    );
  }

  if (needsOnboarding) {
    return (
      <LoadingState
        isLoading
        message="Preparing onboarding\u2026"
        timeoutMs={8_000}
        timeoutMessage="Redirect is taking too long."
        onRetry={() => router.replace("/onboarding")}
      />
    );
  }

  // Onboarding pages render without sidebar
  if (isOnboarding) {
    return <>{children}</>;
  }

  return <DashboardShell>{children}</DashboardShell>;
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ToastProvider>
      <AuthLoading>
        <LoadingState
          isLoading
          message="Authenticating\u2026"
          timeoutMs={10_000}
          timeoutMessage="Authentication is taking too long."
          onRetry={() => window.location.reload()}
          onSignOut={() => { window.location.href = "/sign-out"; }}
        />
      </AuthLoading>
      <Unauthenticated>
        <RedirectToSignIn />
      </Unauthenticated>
      <Authenticated>
        <WaitForUser>
          {children}
        </WaitForUser>
      </Authenticated>
    </ToastProvider>
  );
}
