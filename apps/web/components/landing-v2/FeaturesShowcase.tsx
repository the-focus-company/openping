"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Inbox, GitCommitHorizontal, Zap, Shield } from "lucide-react";
import { FEATURES, SPRING, type FeatureId } from "./constants";
import { Section, SectionHeader, GlowCard, Reveal } from "./primitives";
import { InboxMockup } from "./InboxMockup";
import { DecisionTrailMockup } from "./DecisionTrailMockup";
import { WorkspaceMockup } from "./WorkspaceMockup";
import { GuestRolesMockup } from "./GuestRolesMockup";
import { cn } from "@/lib/utils";

const featureIcons: Record<FeatureId, typeof Inbox> = {
  inbox: Inbox,
  decisions: GitCommitHorizontal,
  workspace: Zap,
  access: Shield,
};

const featureColors: Record<FeatureId, string> = {
  inbox: "#EF4444",
  decisions: "#F59E0B",
  workspace: "#22C55E",
  access: "#5E6AD2",
};

const mockupComponents: Record<FeatureId, React.ComponentType> = {
  inbox: InboxMockup,
  decisions: DecisionTrailMockup,
  workspace: WorkspaceMockup,
  access: GuestRolesMockup,
};

export function FeaturesShowcase() {
  const [active, setActive] = useState<FeatureId>("inbox");
  const ActiveMockup = mockupComponents[active];
  const Icon = featureIcons[active];
  const color = featureColors[active];

  return (
    <Section className="border-t border-white/[0.04]">
      <SectionHeader
        eyebrow="Features"
        title="Every feature reduces coordination drag"
        description="Not another notification firehose. Every feature is designed to surface what needs a decision and mute what doesn't."
      />

      <div className="grid gap-8 lg:grid-cols-[340px,1fr] lg:gap-12">
        {/* Feature tabs */}
        <Reveal direction="left" className="space-y-2">
          {FEATURES.map((feature) => {
            const FIcon = featureIcons[feature.id];
            const fColor = featureColors[feature.id];
            const isActive = active === feature.id;

            return (
              <button
                key={feature.id}
                onClick={() => setActive(feature.id)}
                className={cn(
                  "group w-full text-left rounded-xl border px-5 py-4 transition-all",
                  isActive
                    ? "border-white/[0.1] bg-white/[0.04]"
                    : "border-transparent bg-transparent hover:bg-white/[0.02]"
                )}
              >
                <div className="flex items-start gap-3">
                  <div
                    className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors"
                    style={{
                      backgroundColor: isActive ? `${fColor}15` : "rgba(255,255,255,0.04)",
                    }}
                  >
                    <FIcon
                      className="h-4 w-4"
                      style={{ color: isActive ? fColor : "rgba(255,255,255,0.3)" }}
                    />
                  </div>
                  <div>
                    <h3
                      className={cn(
                        "text-[14px] font-semibold transition-colors",
                        isActive ? "text-white" : "text-white/50"
                      )}
                    >
                      {feature.title}
                    </h3>
                    <p
                      className={cn(
                        "mt-0.5 text-[12px] transition-colors",
                        isActive
                          ? "text-muted-foreground"
                          : "text-muted-foreground/40"
                      )}
                    >
                      {feature.subtitle}
                    </p>
                    {isActive && (
                      <motion.p
                        className="mt-2 text-[13px] leading-relaxed text-muted-foreground/70"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        transition={SPRING}
                      >
                        {feature.description}
                      </motion.p>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </Reveal>

        {/* Mockup preview */}
        <div className="relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={active}
              initial={{ opacity: 0, y: 8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.98 }}
              transition={SPRING}
            >
              <ActiveMockup />

              {/* Metric badge */}
              <motion.div
                className="mt-4 inline-flex items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-2"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
              >
                <Icon className="h-3.5 w-3.5" style={{ color }} />
                <span className="text-[12px] font-medium text-white/60">
                  {FEATURES.find((f) => f.id === active)?.metric}
                </span>
              </motion.div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </Section>
  );
}
