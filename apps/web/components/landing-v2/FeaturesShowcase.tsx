"use client";

import { type ReactNode } from "react";
import { motion } from "motion/react";
import { InboxMockup } from "./InboxMockup";
import { DecisionTrailMockup } from "./DecisionTrailMockup";
import { WorkspaceMockup } from "./WorkspaceMockup";
import { GuestRolesMockup } from "./GuestRolesMockup";

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-80px" },
  transition: { type: "spring" as const, damping: 20, stiffness: 250 },
};

function Tag({ children, color }: { children: ReactNode; color: string }) {
  const colors: Record<string, string> = {
    indigo: "text-indigo-400 border-indigo-500/25 bg-indigo-500/8",
    emerald: "text-emerald-400 border-emerald-500/25 bg-emerald-500/8",
    amber: "text-amber-400 border-amber-500/25 bg-amber-500/8",
    rose: "text-rose-400 border-rose-500/25 bg-rose-500/8",
    violet: "text-violet-400 border-violet-500/25 bg-violet-500/8",
  };
  return (
    <span
      className={`inline-block font-semibold tracking-[0.14em] text-[11px] uppercase border px-3 py-1 rounded-full ${colors[color]}`}
    >
      {children}
    </span>
  );
}

interface Feature {
  tag: string;
  tagColor: string;
  heading: string;
  description: string;
  mockup: ReactNode;
  reversed?: boolean;
}

const features: Feature[] = [
  {
    tag: "Inbox",
    tagColor: "rose",
    heading: "Every message, triaged.",
    description:
      "AI sorts your team\u2019s conversations into an Eisenhower matrix \u2014 DO, DECIDE, DELEGATE, or SKIP. You always know what needs your attention first.",
    mockup: <InboxMockup />,
  },
  {
    tag: "Decisions",
    tagColor: "violet",
    heading: "Trace every decision.",
    description:
      "See exactly how decisions were made \u2014 from the first message to the final action. Full context, linked threads, and a clear timeline.",
    mockup: <DecisionTrailMockup />,
    reversed: true,
  },
  {
    tag: "Workspace",
    tagColor: "indigo",
    heading: "Everything in one place.",
    description:
      "Channels, DMs, agents, and a command palette. No tab-switching, no context loss. Your workspace understands your codebase.",
    mockup: <WorkspaceMockup />,
  },
  {
    tag: "Access",
    tagColor: "emerald",
    heading: "Invite anyone safely.",
    description:
      "Workspace guests get scoped access \u2014 join conversations without seeing everything. Perfect for contractors, clients, and cross-team collaboration.",
    mockup: <GuestRolesMockup />,
    reversed: true,
  },
];

export function FeaturesShowcase() {
  return (
    <section>
      {features.map((feature, i) => (
        <div key={i} className="py-24 md:py-32">
          <div className="mx-auto max-w-5xl px-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
              <motion.div
                className={feature.reversed ? "lg:order-last" : undefined}
                {...fadeUp}
              >
                <Tag color={feature.tagColor}>{feature.tag}</Tag>
                <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white mt-4">
                  {feature.heading}
                </h2>
                <p className="text-base text-neutral-400 mt-4 leading-relaxed max-w-md">
                  {feature.description}
                </p>
              </motion.div>

              <motion.div {...fadeUp}>{feature.mockup}</motion.div>
            </div>
          </div>
        </div>
      ))}
    </section>
  );
}
