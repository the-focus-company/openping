"use client";

import { Search, GitCommitHorizontal, Zap } from "lucide-react";
import { Section, SectionHeader, Reveal, Stagger, staggerItem } from "./primitives";
import { motion } from "motion/react";

const steps = [
  {
    icon: Search,
    number: "01",
    title: "Context assembled",
    description:
      "OpenPing gathers relevant messages, tickets, PRs, and prior decisions automatically. Your experts get ranked, ready-to-act context instead of raw chat noise.",
    color: "#5E6AD2",
  },
  {
    icon: GitCommitHorizontal,
    number: "02",
    title: "Decisions traced",
    description:
      "Every decision is linked to its discussion, supporting evidence, and the person who made the call. No more reconstructing history to understand why.",
    color: "#F59E0B",
  },
  {
    icon: Zap,
    number: "03",
    title: "Action orchestrated",
    description:
      "Once a human decides, OpenPing triggers follow-ups: notify the right people, create tickets, update stakeholders. The gap between deciding and doing closes.",
    color: "#22C55E",
  },
];

export function SolutionSection() {
  return (
    <Section id="how-it-works" className="border-t border-white/[0.04]">
      <SectionHeader
        eyebrow="How it works"
        title="Replace coordination overhead with orchestrated flow"
        description="OpenPing sits between your team's communication and their work. It assembles context, helps decisions happen faster, and makes sure action follows."
      />

      <Stagger className="grid gap-6 sm:grid-cols-3" stagger={0.12}>
        {steps.map((step) => (
          <motion.div key={step.number} variants={staggerItem} className="group relative">
            {/* Step number */}
            <div className="mb-4 font-mono text-[3rem] font-bold leading-none text-white/[0.04] transition-colors group-hover:text-white/[0.08]">
              {step.number}
            </div>

            {/* Icon */}
            <div
              className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl transition-colors"
              style={{ backgroundColor: `${step.color}12` }}
            >
              <step.icon className="h-5 w-5" style={{ color: step.color }} />
            </div>

            <h3 className="text-[16px] font-semibold text-white">{step.title}</h3>
            <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
              {step.description}
            </p>
          </motion.div>
        ))}
      </Stagger>

      {/* Before/After */}
      <Reveal className="mt-20" delay={0.1}>
        <div className="grid gap-4 sm:grid-cols-2">
          {/* Before */}
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.015] p-6">
            <div className="mb-4 flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-red-400/60" />
              <span className="text-[12px] font-semibold uppercase tracking-wider text-red-400/70">
                Without OpenPing
              </span>
            </div>
            <ul className="space-y-2.5 text-[13px] text-muted-foreground">
              {[
                "DM Sarah for context on the Acme issue",
                "Check Slack threads for prior decisions",
                "Search Linear for related tickets",
                "Compile update for the client call",
                "Follow up with 3 people who haven't responded",
                "Schedule a sync to align on next steps",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-red-400/40" />
                  {item}
                </li>
              ))}
            </ul>
            <p className="mt-4 text-[12px] font-medium text-red-400/50">
              ~45 minutes of coordination per decision
            </p>
          </div>

          {/* After */}
          <div className="rounded-2xl border border-ping-purple/20 bg-ping-purple/[0.03] p-6">
            <div className="mb-4 flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-ping-purple" />
              <span className="text-[12px] font-semibold uppercase tracking-wider text-ping-purple/80">
                With OpenPing
              </span>
            </div>
            <ul className="space-y-2.5 text-[13px] text-white/70">
              {[
                "Open inbox: Acme issue ranked as urgent + important",
                "Context assembled: 3 threads, 2 PRs, prior decision linked",
                "Make the call. Action orchestrated automatically.",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-ping-purple" />
                  {item}
                </li>
              ))}
            </ul>
            <p className="mt-4 text-[12px] font-medium text-ping-purple/70">
              ~3 minutes from question to action
            </p>
          </div>
        </div>
      </Reveal>
    </Section>
  );
}
