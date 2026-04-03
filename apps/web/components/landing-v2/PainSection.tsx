"use client";

import { PAIN_POINTS } from "./constants";
import {
  Section,
  SectionHeader,
  Reveal,
  Stagger,
  staggerItem,
  AnimatedCounter,
  GlowCard,
} from "./primitives";
import { motion } from "motion/react";

export function PainSection() {
  return (
    <Section className="border-t border-white/[0.04]">
      <SectionHeader
        eyebrow="The problem"
        title="Coordination tax is eating your margin"
        description="Your best people spend more time chasing context, relaying status, and sitting in alignment meetings than doing the expert work you hired them for."
      />

      <Stagger className="grid gap-5 sm:grid-cols-3" stagger={0.1}>
        {PAIN_POINTS.map((point) => (
          <motion.div key={point.label} variants={staggerItem}>
            <GlowCard className="rounded-2xl">
              <div className="h-full rounded-2xl border border-white/[0.06] bg-white/[0.015] p-6">
                <AnimatedCounter
                  value={point.stat}
                  className="text-[2.5rem] font-bold tracking-tight text-white"
                />
                <p className="mt-2 text-[14px] font-medium text-white/80">
                  {point.label}
                </p>
                <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground/60">
                  {point.detail}
                </p>
              </div>
            </GlowCard>
          </motion.div>
        ))}
      </Stagger>

      {/* Pain narrative */}
      <Reveal className="mt-16 text-center" delay={0.2}>
        <div className="mx-auto max-w-2xl rounded-2xl border border-white/[0.06] bg-white/[0.015] p-8">
          <p className="text-[15px] leading-relaxed text-muted-foreground">
            Every day, your delivery leads chase people for answers. Your experts
            get pulled from deep work for status updates. Your PMs assemble
            context that should already exist. The result:{" "}
            <span className="text-white font-medium">
              you hire coordinators to manage coordination
            </span>{" "}
            instead of delivering more value to clients.
          </p>
        </div>
      </Reveal>
    </Section>
  );
}
