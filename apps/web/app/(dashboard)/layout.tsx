"use client";

import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";
import { useQuery } from "convex/react";
import { useRouter, usePathname } from "next/navigation";
import { api } from "@convex/_generated/api";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { ToastProvider } from "@/components/ui/toast-provider";

function WaitForUser({ children }: { children: React.ReactNode }) {
  const user = useQuery(api.users.getMe);
  const router = useRouter();
  const pathname = usePathname();

  if (user === undefined || user === null) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-ping-purple border-t-transparent" />
        <p className="text-sm text-muted-foreground">Setting up your account…</p>
      </div>
    );
  }

  // Redirect to onboarding if status is "pending" (undefined = legacy user, treat as completed)
  if (user.onboardingStatus === "pending" && !pathname.startsWith("/onboarding")) {
    router.replace("/onboarding");
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-ping-purple border-t-transparent" />
        <p className="text-sm text-muted-foreground">Setting up your account…</p>
      </div>
    );
  }

  return <>{children}</>;
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ToastProvider>
      <AuthLoading>
        <div className="flex h-screen items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-ping-purple border-t-transparent" />
        </div>
      </AuthLoading>
      <Unauthenticated>
        <div className="flex h-screen items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-ping-purple border-t-transparent" />
        </div>
      </Unauthenticated>
      <Authenticated>
        <WaitForUser>
          <DashboardShell>{children}</DashboardShell>
        </WaitForUser>
      </Authenticated>
    </ToastProvider>
  );
}
