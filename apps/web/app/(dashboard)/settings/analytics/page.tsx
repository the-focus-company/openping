"use client";

import { useState } from "react";
import { TrendingUp, Clock, Zap, Bot } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";

const PERIODS = ["7d", "30d", "90d"] as const;
type Period = (typeof PERIODS)[number];

const BREAKDOWN_COLORS = ["#5E6AD2", "#22C55E", "#F59E0B", "#6B7280"];
const LEADERBOARD_COLORS = [
  "#5E6AD2",
  "#22C55E",
  "#F59E0B",
  "#6B7280",
  "#EF4444",
  "#8B5CF6",
  "#EC4899",
  "#14B8A6",
  "#F97316",
  "#06B6D4",
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
          <span className="text-2xs font-medium text-status-online">{Number(delta) >= 0 ? "\u2191" : "\u2193"} {Math.abs(Number(delta))}%</span>
        )}
      </div>
      <p className="text-2xl font-semibold tabular-nums text-foreground">{value}</p>
      {sub && <p className="mt-0.5 text-2xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="rounded border border-subtle bg-surface-1 px-4 py-3 animate-pulse">
      <div className="h-3 w-24 rounded bg-surface-3 mb-3" />
      <div className="h-7 w-16 rounded bg-surface-3" />
    </div>
  );
}

function SkeletonPanel() {
  return (
    <div className="rounded border border-subtle bg-surface-1 p-4 animate-pulse">
      <div className="h-4 w-32 rounded bg-surface-3 mb-4" />
      <div className="space-y-3">
        <div className="h-3 w-full rounded bg-surface-3" />
        <div className="h-3 w-3/4 rounded bg-surface-3" />
        <div className="h-3 w-1/2 rounded bg-surface-3" />
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  const [period, setPeriod] = useState<Period>("30d");

  const kpis = useQuery(api.analytics.getKPIs, { period });
  const leaderboard = useQuery(api.analytics.getAgentLeaderboard, { period });

  const isLoading = kpis === undefined;
  const breakdown = kpis?.breakdown;

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
        {isLoading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : (
          <>
            <KpiCard
              icon={Zap}
              label="Agent Queries"
              value={kpis.botMessages.toLocaleString()}
              delta={String(kpis.queryDelta)}
              sub={`vs previous ${period}`}
            />
            <KpiCard
              icon={Clock}
              label="Hrs Saved (est.)"
              value={`~${kpis.hoursSaved}`}
              delta={String(kpis.hoursDelta)}
              sub="at 2min avg per bot interaction"
            />
            <KpiCard
              icon={TrendingUp}
              label="Total Messages"
              value={kpis.totalMessages.toLocaleString()}
              sub={`${kpis.summaryCount} summaries \u00b7 ${kpis.alertCount} alerts`}
            />
          </>
        )}
      </div>

      {/* Two column */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Agent leaderboard */}
        {leaderboard === undefined ? (
          <SkeletonPanel />
        ) : (
          <div className="rounded border border-subtle bg-surface-1 p-4">
            <div className="mb-4 flex items-center gap-2">
              <Bot className="h-3.5 w-3.5 text-white/30" />
              <span className="text-xs font-medium text-foreground">Agent Leaderboard</span>
            </div>

            {leaderboard.length === 0 ? (
              <p className="text-xs text-muted-foreground">No agent activity in this period.</p>
            ) : (
              <div className="space-y-3">
                {leaderboard.map((agent, i) => (
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
                        style={{
                          width: `${agent.pct}%`,
                          backgroundColor: LEADERBOARD_COLORS[i % LEADERBOARD_COLORS.length],
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Activity breakdown */}
        {!breakdown ? (
          <SkeletonPanel />
        ) : (
          <div className="rounded border border-subtle bg-surface-1 p-4">
            <div className="mb-4 flex items-center gap-2">
              <TrendingUp className="h-3.5 w-3.5 text-white/30" />
              <span className="text-xs font-medium text-foreground">Activity Breakdown</span>
            </div>

            {/* Stacked bar */}
            <div className="mb-4 h-3 overflow-hidden rounded-full flex">
              {breakdown.map((segment, i) => (
                <div
                  key={segment.label}
                  className="h-full first:rounded-l-full last:rounded-r-full"
                  style={{
                    width: `${segment.pct}%`,
                    backgroundColor: BREAKDOWN_COLORS[i % BREAKDOWN_COLORS.length],
                  }}
                  title={`${segment.label}: ${segment.pct}%`}
                />
              ))}
            </div>

            <div className="space-y-2">
              {breakdown.map((segment, i) => (
                <div key={segment.label} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: BREAKDOWN_COLORS[i % BREAKDOWN_COLORS.length] }}
                    />
                    <span className="text-xs text-muted-foreground">{segment.label}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs tabular-nums text-muted-foreground">
                      {segment.count.toLocaleString()}
                    </span>
                    <span className="w-8 text-right font-mono text-2xs text-white/30">
                      {segment.pct}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ROI note */}
      {kpis && (
        <div className="mt-4 rounded border border-subtle bg-surface-1 px-4 py-3">
          <div className="flex items-start gap-3">
            <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-status-online" />
            <div>
              <p className="text-xs font-medium text-foreground">
                Estimated {kpis.hoursSaved} hours saved this period
              </p>
              <p className="mt-0.5 text-2xs text-muted-foreground">
                Based on avg 2min per bot interaction resolved by agents. At $75/hr avg eng cost,
                that&apos;s{" "}
                <span className="font-medium text-foreground">
                  ${Math.round(kpis.hoursSaved * 75).toLocaleString()} in productivity recovered
                </span>
                .
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
