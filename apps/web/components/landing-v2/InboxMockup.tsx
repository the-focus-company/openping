"use client";

import { motion, useInView } from "motion/react";
import { useRef } from "react";
import { AlertTriangle, Clock, ArrowUpRight, Minus } from "lucide-react";
import { MockupFrame } from "./MockupFrame";
import { SPRING } from "./constants";

const inboxItems = [
  {
    quadrant: "Do now",
    color: "#EF4444",
    icon: AlertTriangle,
    title: "Production deploy blocked",
    source: "#platform",
    time: "2m ago",
    badge: "Urgent + Important",
  },
  {
    quadrant: "Schedule",
    color: "#F59E0B",
    icon: Clock,
    title: "Q3 capacity plan needs your input",
    source: "#delivery",
    time: "18m ago",
    badge: "Important",
  },
  {
    quadrant: "Delegate",
    color: "#3B82F6",
    icon: ArrowUpRight,
    title: "Client onboarding checklist review",
    source: "Sarah K.",
    time: "1h ago",
    badge: "Delegate",
  },
  {
    quadrant: "FYI",
    color: "#5E6AD2",
    icon: Minus,
    title: "Design system v2 rollout update",
    source: "#design",
    time: "3h ago",
    badge: "Low priority",
  },
];

export function InboxMockup() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <div ref={ref}>
      <MockupFrame title="OpenPing Inbox">
        <div className="p-3 space-y-1.5">
          {inboxItems.map((item, i) => (
            <motion.div
              key={item.title}
              className="group flex items-start gap-3 rounded-lg border border-transparent bg-white/[0.02] px-3.5 py-3 transition-colors hover:border-white/[0.06] hover:bg-white/[0.04]"
              initial={{ opacity: 0, x: -16 }}
              animate={isInView ? { opacity: 1, x: 0 } : {}}
              transition={{ ...SPRING, delay: i * 0.1 + 0.2 }}
            >
              {/* Priority indicator */}
              <div
                className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md"
                style={{ backgroundColor: `${item.color}15` }}
              >
                <item.icon
                  className="h-3.5 w-3.5"
                  style={{ color: item.color }}
                />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-[13px] font-medium text-white/90">
                    {item.title}
                  </span>
                </div>
                <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground/60">
                  <span>{item.source}</span>
                  <span className="text-white/10">&middot;</span>
                  <span>{item.time}</span>
                </div>
              </div>

              {/* Quadrant badge */}
              <span
                className="shrink-0 rounded-md px-2 py-0.5 text-[10px] font-medium"
                style={{
                  backgroundColor: `${item.color}12`,
                  color: item.color,
                }}
              >
                {item.badge}
              </span>
            </motion.div>
          ))}
        </div>
      </MockupFrame>
    </div>
  );
}
