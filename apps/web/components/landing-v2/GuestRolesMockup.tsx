"use client";

import { motion, useInView } from "motion/react";
import { useRef } from "react";
import { Shield, Eye, Edit, Lock } from "lucide-react";
import { MockupFrame } from "./MockupFrame";
import { SPRING } from "./constants";

const roles = [
  {
    role: "Admin",
    access: "Full access",
    icon: Shield,
    color: "#5E6AD2",
    channels: "All channels",
    actions: ["Manage members", "Configure workspace", "View analytics"],
  },
  {
    role: "Member",
    access: "Team access",
    icon: Edit,
    color: "#22C55E",
    channels: "Assigned channels",
    actions: ["Post messages", "Create channels", "Use AI features"],
  },
  {
    role: "Guest",
    access: "Scoped access",
    icon: Eye,
    color: "#F59E0B",
    channels: "Invited channels only",
    actions: ["Read & reply", "No internal channels", "Time-limited"],
  },
  {
    role: "External",
    access: "View only",
    icon: Lock,
    color: "#EF4444",
    channels: "Shared links only",
    actions: ["Read access", "No posting", "Audit logged"],
  },
];

export function GuestRolesMockup() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <div ref={ref}>
      <MockupFrame title="Access Control">
        <div className="p-3 space-y-1.5">
          {roles.map((r, i) => (
            <motion.div
              key={r.role}
              className="flex items-center gap-3 rounded-lg bg-white/[0.02] px-3 py-2.5 transition-colors hover:bg-white/[0.04]"
              initial={{ opacity: 0, x: 12 }}
              animate={isInView ? { opacity: 1, x: 0 } : {}}
              transition={{ ...SPRING, delay: i * 0.1 + 0.2 }}
            >
              <div
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
                style={{ backgroundColor: `${r.color}15` }}
              >
                <r.icon className="h-3.5 w-3.5" style={{ color: r.color }} />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[12px] font-semibold text-white/80">
                    {r.role}
                  </span>
                  <span className="text-[10px] text-muted-foreground/40">
                    {r.access}
                  </span>
                </div>
                <p className="text-[10px] text-muted-foreground/50">
                  {r.channels}
                </p>
              </div>

              <div className="hidden sm:flex shrink-0 gap-1">
                {r.actions.slice(0, 2).map((a) => (
                  <span
                    key={a}
                    className="rounded px-1.5 py-0.5 text-[9px] text-muted-foreground/40 border border-white/[0.04]"
                  >
                    {a}
                  </span>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      </MockupFrame>
    </div>
  );
}
