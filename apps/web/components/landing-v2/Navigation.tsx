"use client";

import Link from "next/link";
import { Github } from "lucide-react";
import { motion, useScroll, useTransform } from "motion/react";
import { DOCS_URL, GITHUB_URL } from "./constants";

export function Navigation() {
  const { scrollY } = useScroll();
  const bgOpacity = useTransform(scrollY, [0, 80], [0, 0.85]);
  const borderOpacity = useTransform(scrollY, [0, 80], [0, 0.06]);

  return (
    <motion.nav
      className="fixed top-0 z-50 w-full backdrop-blur-xl"
      style={{
        backgroundColor: useTransform(bgOpacity, (v) => `rgba(5,6,15,${v})`),
        borderBottom: useTransform(
          borderOpacity,
          (v) => `1px solid rgba(255,255,255,${v})`
        ),
      }}
    >
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6 lg:px-8">
        <Link href="/" className="group flex items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/bw_logotype_onbalck_padding.png"
            alt="OpenPing"
            height={32}
            className="h-8 w-auto transition-transform group-hover:scale-[1.03]"
          />
        </Link>

        <div className="flex items-center gap-1">
          <Link
            href="/manifesto"
            className="hidden rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-white/[0.04] hover:text-white sm:inline-flex"
          >
            Manifesto
          </Link>
          <Link
            href={DOCS_URL}
            className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-white/[0.04] hover:text-white"
          >
            Docs
          </Link>
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-white/[0.04] hover:text-white"
          >
            <Github className="h-4 w-4" />
            <span className="hidden sm:inline">GitHub</span>
          </a>

          <span className="mx-2 h-4 w-px bg-white/[0.08]" />

          <Link
            href="/sign-in"
            className="inline-flex h-8 items-center rounded-lg border border-white/[0.1] bg-white/[0.04] px-4 text-sm font-medium text-white/80 transition-all hover:bg-white/[0.08] hover:text-white"
          >
            Sign in
          </Link>
        </div>
      </div>
    </motion.nav>
  );
}
