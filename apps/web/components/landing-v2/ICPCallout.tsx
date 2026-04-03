"use client";

import { ArrowRight } from "lucide-react";
import { ICP_VERTICALS } from "./constants";
import {
  Section,
  SectionHeader,
  Stagger,
  staggerItem,
  GlowCard,
  Reveal,
} from "./primitives";
import { motion } from "motion/react";
import Link from "next/link";

export function ICPCallout() {
  return (
    <Section className="border-t border-white/[0.04]">
      <SectionHeader
        eyebrow="Who it's for"
        title="Built for teams where communication is the control plane of work"
        description="If your organization runs many parallel projects with shared experts across them, coordination overhead is your biggest hidden cost."
      />

      <Stagger className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" stagger={0.06}>
        {ICP_VERTICALS.map((vertical) => (
          <motion.div key={vertical.name} variants={staggerItem}>
            <GlowCard className="rounded-xl">
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.015] px-5 py-4">
                <h3 className="text-[14px] font-semibold text-white">
                  {vertical.name}
                </h3>
                <p className="mt-1.5 text-[13px] text-muted-foreground/60">
                  {vertical.pain}
                </p>
              </div>
            </GlowCard>
          </motion.div>
        ))}

        {/* CTA card */}
        <motion.div variants={staggerItem}>
          <Link href="/sign-in" className="block h-full">
            <div className="group flex h-full items-center justify-center rounded-xl border border-ping-purple/20 bg-ping-purple/[0.04] px-5 py-4 transition-all hover:border-ping-purple/30 hover:bg-ping-purple/[0.06]">
              <div className="flex items-center gap-2 text-[14px] font-medium text-ping-purple transition-colors group-hover:text-white">
                See if OpenPing fits your team
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </div>
            </div>
          </Link>
        </motion.div>
      </Stagger>

      {/* Buyer persona callout */}
      <Reveal className="mt-12" delay={0.15}>
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.015] p-6 sm:p-8">
          <p className="text-[12px] font-semibold uppercase tracking-[0.15em] text-ping-purple/70">
            Typical buyer
          </p>
          <p className="mt-3 text-[15px] leading-relaxed text-white/80">
            Founder, COO, Head of Delivery, or VP Professional Services at a
            50-300 person service firm. Looking to improve project margins,
            reduce coordination headcount, and scale shared expertise across
            more parallel engagements.
          </p>
        </div>
      </Reveal>
    </Section>
  );
}
