"use client";

import Link from "next/link";
import { ArrowRight, Github } from "lucide-react";
import { GITHUB_URL } from "./constants";
import { Section, Reveal } from "./primitives";

export function FinalCTA() {
  return (
    <Section className="border-t border-white/[0.04]">
      <div className="relative mx-auto max-w-2xl text-center">
        {/* Subtle background glow */}
        <div className="pointer-events-none absolute -top-32 left-1/2 h-[300px] w-[500px] -translate-x-1/2 rounded-full bg-ping-purple/[0.04] blur-[100px]" />

        <Reveal>
          <h2 className="relative text-[2rem] font-bold leading-tight tracking-tight text-white sm:text-[2.5rem]">
            Start with one team.
            <br />
            See the margin difference.
          </h2>
          <p className="relative mt-5 text-[15px] leading-relaxed text-muted-foreground">
            Pick your highest-coordination team. Run OpenPing for two weeks.
            Measure the time saved on context assembly, follow-ups, and
            status syncs. The numbers speak.
          </p>
        </Reveal>

        <Reveal delay={0.15}>
          <div className="relative mt-10 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/sign-in"
              className="group inline-flex h-12 items-center gap-2 rounded-lg bg-ping-purple px-8 text-sm font-medium text-white transition-all hover:bg-ping-purple-hover active:scale-[0.98]"
            >
              Start a pilot
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-12 items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.02] px-8 text-sm font-medium text-muted-foreground transition-all hover:border-white/[0.14] hover:bg-white/[0.05] hover:text-white"
            >
              <Github className="h-4 w-4" />
              Star on GitHub
            </a>
          </div>
        </Reveal>
      </div>
    </Section>
  );
}
