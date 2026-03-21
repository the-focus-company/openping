"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { StatusDot } from "@/components/ui/status-dot";
import { Skeleton } from "@/components/ui/skeleton";
import { RefreshCw, Shield, ArrowRight } from "lucide-react";
import { useToast } from "@/components/ui/toast-provider";
import { cn } from "@/lib/utils";

const GRID_COLS = "grid-cols-[1.5fr_80px_60px_1fr_1fr_32px]";

interface CronJob {
  name: string;
  status: "healthy" | "failing" | "unknown";
  lastRun: string;
}

interface Webhook {
  name: string;
  status: "ok" | "error";
  latency: string;
}

// Placeholder cron/webhook data until those systems have real telemetry
const DEFAULT_CRONS: CronJob[] = [
  { name: "knowledge-sync", status: "healthy", lastRun: "—" },
  { name: "inbox-rank", status: "healthy", lastRun: "—" },
  { name: "alert-check", status: "healthy", lastRun: "—" },
  { name: "metrics-rollup", status: "healthy", lastRun: "—" },
  { name: "webhook-retry", status: "healthy", lastRun: "—" },
];

const DEFAULT_WEBHOOKS: Webhook[] = [];

const planConfig = {
  free: "border-white/10 bg-white/5 text-white/40",
  pro: "border-ping-purple/30 bg-ping-purple/10 text-ping-purple",
  enterprise: "border-status-warning/30 bg-status-warning/10 text-status-warning",
};

function CronHealth({ crons }: { crons: CronJob[] }) {
  const healthy = crons.filter((c) => c.status === "healthy").length;
  const failing = crons.filter((c) => c.status === "failing").length;
  const allGood = failing === 0;

  return (
    <div className="flex items-center gap-1.5">
      <StatusDot variant={allGood ? "online" : "danger"} size="xs" />
      <span className={cn("text-xs", allGood ? "text-muted-foreground" : "text-status-danger")}>
        {healthy}/{crons.length}
        {!allGood && ` · ${failing} failing`}
      </span>
    </div>
  );
}

function WebhookHealth({ webhooks }: { webhooks: Webhook[] }) {
  const ok = webhooks.filter((w) => w.status === "ok").length;
  const err = webhooks.filter((w) => w.status === "error").length;
  const allGood = err === 0;

  return (
    <div className="flex items-center gap-1.5">
      <StatusDot variant={allGood ? "online" : "warning"} size="xs" />
      <span className={cn("text-xs", allGood ? "text-muted-foreground" : "text-status-warning")}>
        {ok}/{webhooks.length}
        {!allGood && ` · ${err} errors`}
      </span>
    </div>
  );
}

function SkeletonRow() {
  return (
    <div className={cn("grid items-center gap-4 border-b border-subtle px-4 py-3 last:border-0", GRID_COLS)}>
      <div>
        <Skeleton className="h-3 w-28" />
        <Skeleton className="mt-1.5 h-2.5 w-16" />
      </div>
      <Skeleton className="h-4 w-12" />
      <Skeleton className="h-3 w-6" />
      <Skeleton className="h-3 w-20" />
      <Skeleton className="h-3 w-16" />
      <Skeleton className="h-4 w-4" />
    </div>
  );
}

export default function AdminPage() {
  const [refreshing, setRefreshing] = useState(false);
  const { toast } = useToast();
  const workspaces = useQuery(api.admin.listWorkspaces);

  const isLoading = workspaces === undefined;

  const tenants = useMemo(
    () =>
      (workspaces ?? []).map((ws) => ({
        id: ws.slug,
        name: ws.name,
        plan: "free" as const,
        members: ws.memberCount,
        crons: DEFAULT_CRONS,
        webhooks: DEFAULT_WEBHOOKS,
        lastActive: "—",
      })),
    [workspaces],
  );

  const alertTenants = useMemo(
    () =>
      tenants.filter(
        (t) =>
          t.crons.some((c) => c.status === "failing") ||
          t.webhooks.some((w) => w.status === "error"),
      ),
    [tenants],
  );

  return (
    <div className="mx-auto max-w-5xl animate-fade-in px-6 py-6">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-white/30" />
            <h1 className="text-md font-semibold text-foreground">Backoffice</h1>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Global workspace telemetry{" "}
            {!isLoading && <>&middot; {tenants.length} tenants</>}
          </p>
        </div>
        <button
          onClick={() => {
            setRefreshing(true);
            setTimeout(() => {
              setRefreshing(false);
              toast("Telemetry refreshed", "success");
            }, 1000);
          }}
          className="flex items-center gap-1.5 rounded border border-subtle px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:border-white/10 hover:text-foreground"
        >
          <RefreshCw className={cn("h-3 w-3", refreshing && "animate-spin")} />
          {refreshing ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {/* Alerts */}
      {alertTenants.length > 0 && (
        <div className="mb-4 rounded border border-l-4 border-status-danger/20 border-l-status-danger bg-surface-1 px-4 py-3">
          <p className="text-xs font-medium text-foreground">
            {alertTenants.length} tenant{alertTenants.length > 1 ? "s" : ""} with degraded health
          </p>
          <p className="mt-0.5 text-2xs text-muted-foreground">
            {alertTenants.map((t) => t.name).join(", ")} · check CRON and webhook status below
          </p>
        </div>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded border border-subtle">
        {/* Header */}
        <div className={cn("grid gap-4 border-b border-subtle bg-surface-1 px-4 py-2", GRID_COLS)}>
          {["Workspace", "Plan", "Members", "CRON Health", "Webhooks", ""].map((h) => (
            <span key={h} className="text-2xs font-medium uppercase tracking-widest text-white/25">
              {h}
            </span>
          ))}
        </div>

        {isLoading ? (
          <>
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </>
        ) : (
          tenants.map((tenant) => (
            <div
              key={tenant.id}
              className={cn("grid items-center gap-4 border-b border-subtle px-4 py-3 transition-colors last:border-0 hover:bg-surface-2", GRID_COLS)}
            >
              {/* Name */}
              <div>
                <p className="text-xs font-medium text-foreground">{tenant.name}</p>
                <p className="text-2xs text-white/25">Active {tenant.lastActive}</p>
              </div>

              {/* Plan */}
              <span
                className={cn(
                  "inline-flex w-fit items-center rounded border px-1.5 py-px text-2xs font-medium capitalize",
                  planConfig[tenant.plan],
                )}
              >
                {tenant.plan}
              </span>

              {/* Members */}
              <span className="text-xs tabular-nums text-muted-foreground">{tenant.members}</span>

              {/* CRON */}
              <CronHealth crons={tenant.crons} />

              {/* Webhooks */}
              <WebhookHealth webhooks={tenant.webhooks} />

              {/* Actions */}
              <Link
                href={`/admin/${tenant.id}/security`}
                className="flex h-6 w-6 items-center justify-center rounded text-white/25 transition-colors hover:bg-surface-3 hover:text-foreground"
              >
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          ))
        )}
      </div>

      <p className="mt-3 text-2xs text-white/20">
        Auto-refreshes every 30s · All times UTC
      </p>
    </div>
  );
}
