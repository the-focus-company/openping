"use client";

import Link from "next/link";
import { ArrowRight, Terminal } from "lucide-react";
import { motion } from "motion/react";
import { DOCS_URL } from "./constants";

const spring = { type: "spring" as const, damping: 20, stiffness: 250 };

const headingWords = [
  ["Stop", "routing", "messages."],
  ["Start", "making", "decisions."],
];

export function HeroSection() {
  return (
    <section className="pt-24 sm:pt-32 pb-20 text-center">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={spring}
      >
        <span className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-neutral-800/80 px-3.5 py-1.5 text-xs text-neutral-400">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
          </span>
          Open source · Self-hostable · MIT
        </span>
      </motion.div>

      <h1 className="mt-8 text-[2.75rem] sm:text-[3.75rem] font-bold tracking-tight leading-[1.1]">
        {headingWords.map((line, lineIdx) => (
          <span key={lineIdx} className="block">
            {line.map((word, wordIdx) => {
              const globalIdx = lineIdx * 3 + wordIdx;
              return (
                <motion.span
                  key={globalIdx}
                  className="inline-block bg-gradient-to-b from-white to-neutral-400 bg-clip-text text-transparent"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ ...spring, delay: 0.1 + globalIdx * 0.06 }}
                >
                  {word}
                  {wordIdx < line.length - 1 ? "\u00A0" : ""}
                </motion.span>
              );
            })}
          </span>
        ))}
      </h1>

      <motion.p
        className="mx-auto mt-6 max-w-xl text-base sm:text-lg text-neutral-400"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...spring, delay: 0.5 }}
      >
        Open-source AI workspace that triages conversations, tracks decisions,
        and keeps your team in context.
      </motion.p>

      <motion.div
        className="mt-8 flex items-center justify-center gap-4"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...spring, delay: 0.65 }}
      >
        <Link
          href="/sign-in"
          className="inline-flex h-11 items-center gap-2 rounded-lg bg-white px-7 font-medium text-black transition-colors hover:bg-neutral-200 active:scale-[0.98]"
        >
          Get started
          <ArrowRight className="h-4 w-4" />
        </Link>
        <a
          href={`${DOCS_URL}getting-started/quickstart/`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-11 items-center gap-2 rounded-lg border border-white/[0.1] bg-white/[0.03] px-7 font-medium text-neutral-400 transition-colors hover:text-white active:scale-[0.98]"
        >
          <Terminal className="h-4 w-4" />
          Self-host
        </a>
      </motion.div>
    </section>
  );
}
