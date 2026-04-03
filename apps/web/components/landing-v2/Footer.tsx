"use client";

import Link from "next/link";
import { DOCS_URL, GITHUB_URL } from "./constants";

export function Footer() {
  return (
    <footer className="border-t border-white/[0.04] bg-surface-0">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 sm:flex-row lg:px-8">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/bw_logotype_onbalck_padding.png"
            alt="OpenPing"
            className="h-4 w-auto opacity-40"
          />
          <span className="text-[11px] text-muted-foreground/50">
            &copy; 2026 &middot; MIT License
          </span>
        </div>
        <div className="flex gap-5">
          <Link
            href="/manifesto"
            className="text-[11px] text-muted-foreground/50 transition-colors hover:text-white"
          >
            Manifesto
          </Link>
          <Link
            href={DOCS_URL}
            className="text-[11px] text-muted-foreground/50 transition-colors hover:text-white"
          >
            Docs
          </Link>
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] text-muted-foreground/50 transition-colors hover:text-white"
          >
            GitHub
          </a>
          <Link
            href="/privacy"
            className="text-[11px] text-muted-foreground/50 transition-colors hover:text-white"
          >
            Privacy
          </Link>
          <Link
            href="/terms"
            className="text-[11px] text-muted-foreground/50 transition-colors hover:text-white"
          >
            Terms
          </Link>
          <Link
            href="/sign-in"
            className="text-[11px] text-muted-foreground/50 transition-colors hover:text-white"
          >
            Sign in
          </Link>
        </div>
      </div>
    </footer>
  );
}
