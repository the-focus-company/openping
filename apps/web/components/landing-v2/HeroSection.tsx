"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { motion } from "motion/react";
import { SPRING, DOCS_URL } from "./constants";
import { InboxMockup } from "./InboxMockup";
import { Parallax } from "./primitives";

const heroWords = [
  { text: "Scale", highlight: false },
  { text: "shared", highlight: false },
  { text: "expertise", highlight: true },
  { text: "\n", highlight: false },
  { text: "without", highlight: false },
  { text: "scaling", highlight: false },
  { text: "\n", highlight: false },
  { text: "coordination", highlight: true },
  { text: "headcount.", highlight: false },
];

export function HeroSection() {
  return (
    <section className="relative overflow-hidden pt-14">
      {/* Background atmosphere */}
      <div className="pointer-events-none absolute inset-0">
        {/* Dot grid */}
        <div
          className="absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage:
              "radial-gradient(circle, currentColor 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />
        {/* Primary glow */}
        <div className="absolute -top-40 left-1/2 h-[700px] w-[1000px] -translate-x-1/2 rounded-full bg-ping-purple/[0.06] blur-[140px]" />
        {/* Warm accent */}
        <div className="absolute -top-20 right-[10%] h-[400px] w-[500px] rounded-full bg-amber-500/[0.02] blur-[120px]" />
      </div>

      <div className="relative mx-auto max-w-6xl px-6 pb-16 pt-20 sm:pt-28 lg:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-[1fr,minmax(0,420px)] lg:gap-16">
          {/* Left: Copy */}
          <div>
            {/* ICP signal badge */}
            <motion.div
              className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/[0.06] bg-white/[0.02] px-4 py-1.5 text-[12px] text-muted-foreground backdrop-blur-sm"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...SPRING, delay: 0.05 }}
            >
              <span className="flex h-1.5 w-1.5 rounded-full bg-ping-purple animate-pulse" />
              For agencies, consultancies &amp; professional services
            </motion.div>

            {/* Headline */}
            <motion.h1
              className="max-w-[560px] text-[2.5rem] font-bold leading-[1.08] tracking-tight text-white sm:text-[3.25rem]"
              initial="hidden"
              animate="visible"
              variants={{
                hidden: {},
                visible: {
                  transition: { staggerChildren: 0.04, delayChildren: 0.12 },
                },
              }}
            >
              {heroWords.map((word, i) =>
                word.text === "\n" ? (
                  <br key={i} />
                ) : (
                  <motion.span
                    key={i}
                    className={`inline-block mr-[0.22em] ${
                      word.highlight
                        ? "bg-gradient-to-r from-ping-purple to-blue-400 bg-clip-text text-transparent"
                        : ""
                    }`}
                    variants={{
                      hidden: { opacity: 0, y: 14, filter: "blur(5px)" },
                      visible: {
                        opacity: 1,
                        y: 0,
                        filter: "blur(0px)",
                        transition: SPRING,
                      },
                    }}
                  >
                    {word.text}
                  </motion.span>
                )
              )}
            </motion.h1>

            {/* Subheading */}
            <motion.p
              className="mt-6 max-w-[480px] text-[15px] leading-relaxed text-muted-foreground"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...SPRING, delay: 0.35 }}
            >
              OpenPing is a decision-first communication layer that removes the
              coordination tax around expert work. Context assembled. Decisions
              traced. Action orchestrated.
            </motion.p>

            {/* CTAs */}
            <motion.div
              className="mt-8 flex flex-wrap items-center gap-3"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...SPRING, delay: 0.42 }}
            >
              <Link
                href="/sign-in"
                className="group inline-flex h-11 items-center gap-2 rounded-lg bg-ping-purple px-6 text-sm font-medium text-white transition-all hover:bg-ping-purple-hover active:scale-[0.98]"
              >
                Start a pilot
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link
                href="#how-it-works"
                className="inline-flex h-11 items-center rounded-lg border border-white/[0.08] bg-white/[0.02] px-6 text-sm font-medium text-muted-foreground transition-all hover:border-white/[0.14] hover:bg-white/[0.05] hover:text-white"
              >
                See how it works
              </Link>
            </motion.div>

            {/* Trust signal */}
            <motion.p
              className="mt-6 text-[12px] text-muted-foreground/50"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.55 }}
            >
              Open source &middot; MIT license &middot; Self-hostable &middot;
              No vendor lock-in
            </motion.p>
          </div>

          {/* Right: Animated inbox mockup */}
          <motion.div
            className="hidden lg:block"
            initial={{ opacity: 0, y: 20, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ ...SPRING, delay: 0.3 }}
          >
            <Parallax offset={20}>
              <InboxMockup />
            </Parallax>
          </motion.div>
        </div>

        {/* Mobile mockup */}
        <motion.div
          className="mt-12 lg:hidden"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...SPRING, delay: 0.4 }}
        >
          <InboxMockup />
        </motion.div>
      </div>
    </section>
  );
}
