"use client";

import { useState } from "react";
import { TrendingUp, Clock, Zap, Bot } from "lucide-react";
import { cn } from "@/lib/utils";

const PERIODS = ["7d", "30d", "90d"] as const;
type Period = (typeof PERIODS)[number];

const KPI_DATA: Record<Period, { queries: number; queryDelta: number; hoursSaved: number; hoursDelta: number; tokens: number; cost: number }> = {
  "7d":  { queries: 247,  queryDelta: 23, hoursSaved: 8.4,  hoursDelta: 12,  tokens: 2187,  cost: 0.48 },
  "30d": { queries: 1247, queryDelta: 18, hoursSaved: 34.2, hoursDelta: 9,   tokens: 8920,  cost: 2.14 },
  "90d": { queries: 4103, queryDelta: 31, hoursSaved: 112,  hoursDelta: 22,  tokens: 28440, cost: 6.89 },
};

const AGENT_LEADERBOARD = [
  { name: "KnowledgeBot",   queries: 847, pct: 100, color: "#5E6AD2" },
  { name: "SupportRouter",  queries: 312, pct: 37,  color: "#22C55E" },
  { name: "SprintCoach",    queries: 88,  pct: 10,  color: "#F59E0B" },
];

const TOKEN_BREAKDOWN = [
  { label: "Direct Queries",    pct: 58, tokens: 5174, color: "#5E6AD2" },
  { label: "Summarizations",    pct: 28, tokens: 2498, color: "#22C55E" },
  { label: "Proactive Alerts",  pct: 9,  tokens: 803,  color: "#F59E0B" },
  { label: "Background Sync",   pct: 5,  tokens: 446,  color: "#6B7280" },
];

interface KpiCardProps {
  icon: React.ElementType;
  label: string;
  value: string;
  delta?: string;
  sub?: string;
}

function KpiCard({ icon: Icon, label, value, delta, sub }: KpiCardProps) {
  return (
    <div className="rounded border border-subtle bg-surface-1 px-4 py-3">
      <div className="flex items-center justify-between pb-1.5">
        <div className="flex items-center gap-1.5">
          <Icon className="h-3.5 w-3.5 text-white/30" />
          <span className="text-2xs font-medium uppercase tracking-widest text-white/30">{label}</span>
        </div>
        {delta && (
          <span className="text-2xs font-medium text-status-online">↑ {delta}%</span>
        )}
      </div>
      <p className="text-2xl font-semibold tabular-nums text-foreground">{value}</p>
      {sub && <p className="mt-0.5 text-2xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

export default function AnalyticsPage() {
  const [period, setPeriod] = useState<Period>("30d");
  const kpi = KPI_DATA[period];

  return (
    <div className="mx-auto max-w-4xl animate-fade-in px-6 py-6">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-md font-semibold text-foreground">Analytics</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            AI usage, value telemetry, and team ROI metrics
          </p>
        </div>

        {/* Period selector */}
        <div className="flex rounded border border-subtle bg-surface-2 p-0.5">
          {PERIODS.map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={cn(
                "rounded px-2.5 py-1 text-2xs font-medium transition-colors",
                period === p
                  ? "bg-surface-3 text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* KPIs */}
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <KpiCard
          icon={Zap}
          label="Agent Queries"
          value={kpi.queries.toLocaleString()}
          delta={String(kpi.queryDelta)}
          sub={`vs previous ${period}`}
        />
        <KpiCard
          icon={Clock}
          label="Hrs Saved (est.)"
          value={`~${kpi.hoursSaved}`}
          delta={String(kpi.hoursDelta)}
          sub="at 25min avg per resolution"
        />
        <KpiCard
          icon={TrendingUp}
          label="Tokens Used"
          value={kpi.tokens.toLocaleString()}
          sub={`$${kpi.cost} est. cost this period`}
        />
      </div>

      {/* Two column */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Agent leaderboard */}
        <div className="rounded border border-subtle bg-surface-1 p-4">
          <div className="mb-4 flex items-center gap-2">
            <Bot className="h-3.5 w-3.5 text-white/30" />
            <span className="text-xs font-medium text-foreground">Agent Leaderboard</span>
          </div>

          <div className="space-y-3">
            {AGENT_LEADERBOARD.map((agent, i) => (
              <div key={agent.name}>
                <div className="mb-1.5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-4 text-right text-2xs text-white/25">#{i + 1}</span>
                    <span className="text-xs text-foreground">{agent.name}</span>
                  </div>
                  <span className="font-mono text-xs tabular-nums text-muted-foreground">
                    {agent.queries.toLocaleString()} queries
                  </span>
                </div>
                <div className="ml-6 h-1 overflow-hidden rounded-full bg-surface-3">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${agent.pct}%`, backgroundColor: agent.color }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Token usage breakdown */}
        <div className="rounded border border-subtle bg-surface-1 p-4">
          <div className="mb-4 flex items-center gap-2">
            <TrendingUp className="h-3.5 w-3.5 text-white/30" />
            <span className="text-xs font-medium text-foreground">Token Breakdown</span>
          </div>

          {/* Stacked bar */}
          <div className="mb-4 h-3 overflow-hidden rounded-full flex">
            {TOKEN_BREAKDOWN.map((segment) => (
              <div
                key={segment.label}
                className="h-full first:rounded-l-full last:rounded-r-full"
                style={{ width: `${segment.pct}%`, backgroundColor: segment.color }}
                title={`${segment.label}: ${segment.pct}%`}
              />
            ))}
          </div>

          <div className="space-y-2">
            {TOKEN_BREAKDOWN.map((segment) => (
              <div key={segment.label} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: segment.color }}
                  />
                  <span className="text-xs text-muted-foreground">{segment.label}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs tabular-nums text-muted-foreground">
                    {segment.tokens.toLocaleString()}
                  </span>
                  <span className="w-8 text-right font-mono text-2xs text-white/30">
                    {segment.pct}%
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 border-t border-subtle pt-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Total cost</span>
              <span className="font-mono text-xs font-medium text-foreground">${kpi.cost.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ROI note */}
      <div className="mt-4 rounded border border-subtle bg-surface-1 px-4 py-3">
        <div className="flex items-start gap-3">
          <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-status-online" />
          <div>
            <p className="text-xs font-medium text-foreground">
              Estimated {kpi.hoursSaved} hours saved this period
            </p>
            <p className="mt-0.5 text-2xs text-muted-foreground">
              Based on avg 25min per context-switch resolved by agents. At $75/hr avg eng cost,
              that&apos;s{" "}
              <span className="font-medium text-foreground">
                ${Math.round(kpi.hoursSaved * 75).toLocaleString()} in productivity recovered
              </span>{" "}
              vs ${kpi.cost.toFixed(2)} in AI spend.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
