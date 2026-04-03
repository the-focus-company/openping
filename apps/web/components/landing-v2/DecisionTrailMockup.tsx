"use client";

import { motion, useInView } from "motion/react";
import { useRef } from "react";
import { GitCommitHorizontal, MessageSquare, CheckCircle2, ArrowRight } from "lucide-react";
import { MockupFrame } from "./MockupFrame";
import { SPRING } from "./constants";

const trailSteps = [
  {
    icon: MessageSquare,
    label: "Discussion",
    detail: "API versioning approach debated in #platform",
    time: "Mon 10:23",
    color: "#5E6AD2",
  },
  {
    icon: GitCommitHorizontal,
    label: "Context gathered",
    detail: "3 related PRs, 2 prior decisions, 1 RFC linked",
    time: "Mon 10:45",
    color: "#F59E0B",
  },
  {
    icon: CheckCircle2,
    label: "Decision made",
    detail: "Go with URL-based versioning. Owner: @james",
    time: "Mon 11:02",
    color: "#22C55E",
  },
  {
    icon: ArrowRight,
    label: "Action triggered",
    detail: "Linear ticket created, #frontend notified, RFC updated",
    time: "Mon 11:03",
    color: "#3B82F6",
  },
];

export function DecisionTrailMockup() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <div ref={ref}>
      <MockupFrame title="Decision Trail">
        <div className="p-4">
          <div className="relative">
            {/* Vertical connector line */}
            <div className="absolute left-[15px] top-3 bottom-3 w-px bg-gradient-to-b from-ping-purple/40 via-white/[0.06] to-white/[0.06]" />

            <div className="space-y-4">
              {trailSteps.map((step, i) => (
                <motion.div
                  key={step.label}
                  className="relative flex items-start gap-3.5 pl-0"
                  initial={{ opacity: 0, y: 12 }}
                  animate={isInView ? { opacity: 1, y: 0 } : {}}
                  transition={{ ...SPRING, delay: i * 0.15 + 0.2 }}
                >
                  {/* Icon node */}
                  <div
                    className="relative z-10 flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full border border-white/[0.08]"
                    style={{ backgroundColor: `${step.color}15` }}
                  >
                    <step.icon
                      className="h-3.5 w-3.5"
                      style={{ color: step.color }}
                    />
                  </div>

                  <div className="min-w-0 flex-1 pt-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[12px] font-semibold text-white/80">
                        {step.label}
                      </span>
                      <span className="text-[10px] text-muted-foreground/40">
                        {step.time}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground/60">
                      {step.detail}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </MockupFrame>
    </div>
  );
}
