"use client";

import { motion, useInView } from "motion/react";
import { useRef } from "react";
import { Hash, ChevronRight, Bell, CheckCircle2 } from "lucide-react";
import { MockupFrame } from "./MockupFrame";
import { SPRING } from "./constants";

const channels = [
  { name: "platform", unread: 3, active: true },
  { name: "delivery-ops", unread: 1, active: false },
  { name: "client-acme", unread: 0, active: false },
  { name: "design", unread: 0, active: false },
];

const actions = [
  {
    icon: Bell,
    text: "Notified @sarah about deploy approval",
    time: "Just now",
    color: "#3B82F6",
  },
  {
    icon: CheckCircle2,
    text: "Linear ticket PLAT-412 created from decision",
    time: "1m ago",
    color: "#22C55E",
  },
];

export function WorkspaceMockup() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <div ref={ref}>
      <MockupFrame title="Workspace">
        <div className="flex min-h-[220px]">
          {/* Sidebar */}
          <div className="w-[140px] shrink-0 border-r border-white/[0.06] bg-white/[0.01] p-2.5">
            <p className="mb-2 px-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/40">
              Channels
            </p>
            {channels.map((ch, i) => (
              <motion.div
                key={ch.name}
                className={`flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[11px] ${
                  ch.active
                    ? "bg-white/[0.06] text-white"
                    : "text-muted-foreground/60"
                }`}
                initial={{ opacity: 0, x: -8 }}
                animate={isInView ? { opacity: 1, x: 0 } : {}}
                transition={{ ...SPRING, delay: i * 0.06 + 0.15 }}
              >
                <Hash className="h-3 w-3 shrink-0 opacity-40" />
                <span className="truncate">{ch.name}</span>
                {ch.unread > 0 && (
                  <span className="ml-auto flex h-4 w-4 items-center justify-center rounded-full bg-ping-purple/20 text-[9px] font-bold text-ping-purple">
                    {ch.unread}
                  </span>
                )}
              </motion.div>
            ))}
          </div>

          {/* Main content: orchestrated actions */}
          <div className="flex-1 p-3">
            <div className="mb-3 flex items-center gap-1.5">
              <Hash className="h-3 w-3 text-muted-foreground/40" />
              <span className="text-[12px] font-medium text-white/70">
                platform
              </span>
              <ChevronRight className="h-3 w-3 text-muted-foreground/30" />
              <span className="text-[11px] text-muted-foreground/50">
                Orchestrated actions
              </span>
            </div>

            <div className="space-y-2">
              {actions.map((action, i) => (
                <motion.div
                  key={action.text}
                  className="flex items-start gap-2.5 rounded-lg bg-white/[0.02] px-3 py-2.5"
                  initial={{ opacity: 0, y: 8 }}
                  animate={isInView ? { opacity: 1, y: 0 } : {}}
                  transition={{ ...SPRING, delay: i * 0.12 + 0.4 }}
                >
                  <div
                    className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md"
                    style={{ backgroundColor: `${action.color}15` }}
                  >
                    <action.icon
                      className="h-3 w-3"
                      style={{ color: action.color }}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] text-white/70">{action.text}</p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground/40">
                      {action.time}
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
