"use client";

import { Zap } from "lucide-react";

interface OnboardingLayoutProps {
  children: React.ReactNode;
}

export function OnboardingLayout({ children }: OnboardingLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="mb-8 flex items-center gap-2">
        <Zap className="h-6 w-6 text-ping-purple" />
        <span className="text-lg font-semibold text-foreground tracking-tight">
          PING
        </span>
      </div>
      <div className="w-full max-w-lg">{children}</div>
    </div>
  );
}
