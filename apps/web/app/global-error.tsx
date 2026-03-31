"use client";

import { useEffect } from "react";
import localFont from "next/font/local";
import { AlertTriangle, RefreshCw } from "lucide-react";
import * as Sentry from "@sentry/nextjs";

const geist = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist",
  display: "swap",
});

const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  display: "swap",
});

export default function GlobalError({
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
    <html lang="en">
      <body
        className={`${geist.variable} ${geistMono.variable} font-sans antialiased`}
      >
        <div className="flex min-h-screen flex-col items-center justify-center bg-[#0a0a0b] px-6 text-center">
          <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/10">
            <AlertTriangle className="h-7 w-7 text-red-400" />
          </div>

          <h1 className="text-xl font-semibold text-white">
            Something went wrong
          </h1>
          <p className="mt-2 max-w-md text-sm text-[#a1a1aa]">
            A critical error occurred. Please try refreshing the page.
          </p>
          {error.digest && (
            <p className="mt-3 font-mono text-xs text-[#a1a1aa]/60">
              Error ID: {error.digest}
            </p>
          )}

          <button
            onClick={reset}
            className="mt-8 inline-flex h-10 items-center gap-2 rounded-lg bg-[#5E6AD2] px-5 text-sm font-medium text-white transition-colors hover:bg-[#6872d6] active:scale-[0.98]"
          >
            <RefreshCw className="h-4 w-4" />
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
