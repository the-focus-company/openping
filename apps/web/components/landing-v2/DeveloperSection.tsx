"use client";

import Link from "next/link";
import { ArrowRight, Github, Terminal } from "lucide-react";
import { motion } from "motion/react";
import { CopyButton } from "@/components/landing/CopyButton";

const DOCS_URL = "https://the-focus-company.github.io/openping/";
const GITHUB_URL = "https://github.com/the-focus-company/openping";
const QUICKSTART_COMMANDS = `git clone https://github.com/the-focus-company/openping.git\ncd openping\npnpm install\npnpm dev`;

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-80px" },
  transition: { type: "spring" as const, damping: 20, stiffness: 250 },
};

const terminalLines = [
  "git clone https://github.com/the-focus-company/openping.git",
  "cd openping",
  "pnpm install",
  "pnpm dev",
];

export function DeveloperSection() {
  return (
    <section className="border-t border-white/[0.06]">
      <div className="mx-auto max-w-5xl px-6 py-24 md:py-32">
        {/* Heading area */}
        <motion.div {...fadeUp}>
          <span className="inline-block font-semibold tracking-[0.14em] text-[11px] uppercase border px-3 py-1 rounded-full text-indigo-400 border-indigo-500/25 bg-indigo-500/8">
            Developer first
          </span>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white mt-4">
            Four commands. You&apos;re running.
          </h2>
          <p className="text-neutral-400 mt-4 max-w-md">
            Clone, install, and go. MIT licensed. No vendor lock-in.
          </p>
        </motion.div>

        {/* Terminal block */}
        <motion.div className="mt-12 max-w-2xl" {...fadeUp}>
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900 shadow-2xl shadow-black/40 overflow-hidden">
            {/* Top bar */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800">
              <div className="flex items-center gap-2">
                <span
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: "#FF5F57" }}
                />
                <span
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: "#FEBC2E" }}
                />
                <span
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: "#28C840" }}
                />
                <span className="ml-3 text-xs text-neutral-500 flex items-center gap-1.5">
                  <Terminal className="h-3 w-3" />
                  terminal
                </span>
              </div>
              <CopyButton text={QUICKSTART_COMMANDS} />
            </div>

            {/* Commands */}
            <div className="px-5 py-4 font-mono text-sm leading-7">
              {terminalLines.map((line, i) => (
                <div key={i} className="text-neutral-300">
                  <span className="text-neutral-500 select-none">$ </span>
                  {line}
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Links row */}
        <motion.div
          className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm"
          {...fadeUp}
        >
          <a
            href={`${DOCS_URL}getting-started/quickstart/`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-neutral-400 transition-colors hover:text-white"
          >
            Full quickstart guide
            <ArrowRight className="h-3.5 w-3.5" />
          </a>
          <span className="text-neutral-600">&middot;</span>
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-neutral-400 transition-colors hover:text-white"
          >
            View source
            <Github className="h-3.5 w-3.5" />
          </a>
        </motion.div>

        {/* Hosted CTA */}
        <motion.div className="mt-8" {...fadeUp}>
          <Link
            href="/sign-in"
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-white/[0.1] bg-white/[0.03] px-6 text-sm font-medium text-neutral-400 transition-colors hover:text-white active:scale-[0.98]"
          >
            Or try the hosted version
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
