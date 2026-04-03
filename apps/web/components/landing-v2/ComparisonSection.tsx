"use client";

import { Check, X } from "lucide-react";
import { Section, SectionHeader, Reveal } from "./primitives";

const rows = [
  {
    label: "Message triage",
    slack: "Manual or basic AI",
    openping: "AI-ranked Eisenhower inbox",
  },
  {
    label: "Context for decisions",
    slack: "Search threads yourself",
    openping: "Auto-assembled with sources",
  },
  {
    label: "Decision tracking",
    slack: "Lost in chat history",
    openping: "Traced with full evidence trail",
  },
  {
    label: "Post-decision action",
    slack: "Manual follow-up",
    openping: "Orchestrated: notify, create tasks, update stakeholders",
  },
  {
    label: "Expert interruptions",
    slack: "DMs and @mentions",
    openping: "Routed context, fewer pings",
  },
  {
    label: "Cross-project visibility",
    slack: "Channel-per-project silos",
    openping: "Unified inbox across all projects",
  },
  {
    label: "Client access",
    slack: "Slack Connect (paid)",
    openping: "Guest roles, scoped by default",
  },
  {
    label: "Pricing",
    slack: "Per seat, scales with headcount",
    openping: "Value-led, scales with capacity",
  },
];

export function ComparisonSection() {
  return (
    <Section className="border-t border-white/[0.04]">
      <SectionHeader
        eyebrow="Comparison"
        title="What coordination looks like with and without"
        description="Slack + PM tools patch the symptoms. OpenPing eliminates the underlying coordination tax."
      />

      <Reveal>
        <div className="overflow-x-auto rounded-2xl border border-white/[0.06]">
          <table className="w-full min-w-[600px] text-sm">
            <thead>
              <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                <th className="px-5 py-3.5 text-left text-[12px] font-medium text-muted-foreground/60 w-[200px]" />
                <th className="px-5 py-3.5 text-left text-[12px] font-medium text-muted-foreground/60">
                  Slack + PM tools
                </th>
                <th className="px-5 py-3.5 text-left">
                  <span className="text-[12px] font-bold text-ping-purple">
                    OpenPing
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.label}
                  className="border-t border-white/[0.04] transition-colors hover:bg-white/[0.015]"
                >
                  <td className="px-5 py-3 text-[13px] font-medium text-white/70">
                    {row.label}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-start gap-2">
                      <X className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-400/50" />
                      <span className="text-[13px] text-muted-foreground/60">
                        {row.slack}
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-start gap-2">
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
                      <span className="text-[13px] text-white/70">
                        {row.openping}
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Reveal>
    </Section>
  );
}
