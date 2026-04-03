"use client";

import { BUYER_VALUES } from "./constants";
import {
  Section,
  SectionHeader,
  Stagger,
  staggerItem,
  AnimatedCounter,
  GlowCard,
} from "./primitives";
import { motion } from "motion/react";

export function ValueProps() {
  return (
    <Section className="border-t border-white/[0.04]">
      <SectionHeader
        eyebrow="Why it matters"
        title="What the buyer actually pays for"
        description="OpenPing is not a chat tool purchase. It's a margin improvement investment. Here's what changes."
      />

      <Stagger className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4" stagger={0.08}>
        {BUYER_VALUES.map((value) => (
          <motion.div key={value.label} variants={staggerItem}>
            <GlowCard className="h-full rounded-2xl">
              <div className="flex h-full flex-col rounded-2xl border border-white/[0.06] bg-white/[0.015] p-6">
                <AnimatedCounter
                  value={value.metric}
                  className="text-[2.5rem] font-bold tracking-tight bg-gradient-to-r from-ping-purple to-blue-400 bg-clip-text text-transparent"
                />
                <p className="mt-1 text-[14px] font-medium text-white/80">
                  {value.label}
                </p>
                <p className="mt-3 flex-1 text-[13px] leading-relaxed text-muted-foreground/60">
                  {value.description}
                </p>
              </div>
            </GlowCard>
          </motion.div>
        ))}
      </Stagger>
    </Section>
  );
}
