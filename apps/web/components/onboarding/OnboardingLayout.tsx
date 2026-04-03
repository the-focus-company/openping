"use client";

import Image from "next/image";

interface OnboardingLayoutProps {
  children: React.ReactNode;
}

export function OnboardingLayout({ children }: OnboardingLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="mb-8">
        <Image
          src="/bw_logotype_onwhite_padding.png"
          alt="OpenPing"
          width={140}
          height={40}
          className="dark:hidden"
          priority
        />
        <Image
          src="/bw_logotype_onbalck_padding.png"
          alt="OpenPing"
          width={140}
          height={40}
          className="hidden dark:block"
          priority
        />
      </div>
      <div className="w-full max-w-lg">{children}</div>
    </div>
  );
}
