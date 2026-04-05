"use client";

import { use, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { AlertTriangle, ArrowLeft, Shield, Power, Lock, ArrowRight } from "lucide-react";
import Link from "next/link";
import { StatusDot } from "@/components/ui/status-dot";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface AuditEntry {
  id: string;
  timestamp: string;
  agent: string;
  action: string;
  resource: string;
  status: "allowed" | "denied" | "flagged";
}

const MOCK_AUDIT: AuditEntry[] = [
  { id: "1", timestamp: "2026-03-20 14:32:11", agent: "mrPING",  action: "READ",   resource: "#private-salary",    status: "denied" },
  { id: "2", timestamp: "2026-03-20 14:32:09", agent: "mrPING",  action: "READ",   resource: "#private-salary",    status: "denied" },
  { id: "3", timestamp: "2026-03-20 14:32:05", agent: "mrPING",  action: "READ",   resource: "#private-salary",    status: "flagged" },
  { id: "4", timestamp: "2026-03-20 14:31:22", agent: "SupportRouter", action: "READ",   resource: "#engineering",       status: "allowed" },
  { id: "5", timestamp: "2026-03-20 14:30:55", agent: "mrPING",  action: "SEARCH", resource: "vector-store:main",  status: "allowed" },
  { id: "6", timestamp: "2026-03-20 14:29:12", agent: "mrPING",  action: "READ",   resource: "#product",           status: "allowed" },
  { id: "7", timestamp: "2026-03-20 14:28:43", agent: "SupportRouter", action: "WRITE",  resource: "#general",           status: "allowed" },
  { id: "8", timestamp: "2026-03-20 14:28:01", agent: "SprintCoach",   action: "READ",   resource: "linear:all-tickets", status: "denied" },
];

const statusConfig = {
  allowed: { color: "text-status-online",  bg: "bg-status-online/10 border-status-online/20",  label: "Allowed" },
  denied:  { color: "text-status-danger",  bg: "bg-status-danger/10 border-status-danger/20",   label: "Denied" },
  flagged: { color: "text-status-warning", bg: "bg-status-warning/10 border-status-warning/20", label: "Flagged" },
};

interface Props {
  params: Promise<{ tenantId: string }>;
}

export default function SecurityPage({ params }: Props) {
  // Auth gate: only admins can access
  const adminWorkspaces = useQuery(api.admin.listWorkspaces);
  if (!adminWorkspaces) return <div className="flex h-screen items-center justify-center text-muted-foreground">Loading...</div>;
  if (adminWorkspaces.length === 0) return <div className="flex h-screen items-center justify-center text-red-500">Access denied. Admin privileges required.</div>;
  const { tenantId } = use(params);
  const [killSwitchOpen, setKillSwitchOpen] = useState(false);
  const [killed, setKilled] = useState(false);

  const anomalyCount = MOCK_AUDIT.filter((e) => e.status === "denied" || e.status === "flagged").length;

  return (
    <div className="mx-auto max-w-4xl animate-fade-in px-6 py-6">
      {/* Breadcrumb */}
      <div className="mb-6 flex items-center gap-2">
        <Link
          href="/admin"
          className="flex items-center gap-1 text-2xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" />
          Backoffice
        </Link>
        <span className="text-2xs text-foreground/40">›</span>
        <span className="text-2xs text-muted-foreground capitalize">{tenantId}</span>
        <span className="text-2xs text-foreground/40">›</span>
        <span className="text-2xs text-foreground">Security</span>
      </div>

      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-foreground/50" />
            <h1 className="text-md font-semibold text-foreground">AI Security Panel</h1>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground capitalize">
            {tenantId} · Civic Nexus integration
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={`/admin/${tenantId}/proxy`}
            className="flex items-center gap-1.5 rounded border border-subtle px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:border-foreground/10 hover:text-foreground"
          >
            Impersonate
            <ArrowRight className="h-3 w-3" />
          </Link>
          <Button
            variant="destructive"
            size="sm"
            className="h-7 gap-1.5 text-xs"
            onClick={() => setKillSwitchOpen(true)}
            disabled={killed}
          >
            <Power className="h-3 w-3" />
            {killed ? "Access Revoked" : "Kill Switch"}
          </Button>
        </div>
      </div>

      {/* Anomaly alert */}
      {anomalyCount > 0 && !killed && (
        <div className="mb-4 flex items-start gap-3 rounded border border-l-4 border-status-danger/20 border-l-status-danger bg-surface-1 px-4 py-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-status-danger" />
          <div className="flex-1">
            <p className="text-xs font-semibold text-foreground">Anomaly Detected</p>
            <p className="mt-0.5 text-2xs text-muted-foreground">
              mrPING attempted to access <code className="font-mono text-foreground/70">#private-salary</code> 3 times in 2 minutes — access denied by scope policy. Possible prompt injection attempt.
            </p>
          </div>
          <span className="shrink-0 rounded border border-status-danger/30 bg-status-danger/10 px-1.5 py-0.5 text-2xs font-medium text-status-danger">
            {anomalyCount} events
          </span>
        </div>
      )}

      {killed && (
        <div className="mb-4 flex items-center gap-3 rounded border border-status-warning/30 bg-status-warning/10 px-4 py-3">
          <Lock className="h-4 w-4 text-status-warning" />
          <p className="text-xs text-status-warning">
            Agent access revoked for this workspace. All AI features are disabled until manually re-enabled.
          </p>
        </div>
      )}

      {/* Audit ledger */}
      <div className="overflow-hidden rounded border border-subtle">
        <div className="flex items-center justify-between border-b border-subtle bg-surface-1 px-4 py-2">
          <span className="text-2xs font-medium uppercase tracking-widest text-foreground/45">
            Immutable Audit Ledger
          </span>
          <div className="flex items-center gap-1.5">
            <StatusDot variant="online" size="xs" />
            <span className="text-2xs text-muted-foreground">Live</span>
          </div>
        </div>

        <div className="grid grid-cols-[140px_1fr_80px_1fr_70px] gap-3 border-b border-subtle bg-surface-1/50 px-4 py-2">
          {["Timestamp", "Agent", "Action", "Resource", "Status"].map((h) => (
            <span key={h} className="text-2xs font-medium uppercase tracking-widest text-foreground/45">
              {h}
            </span>
          ))}
        </div>

        {MOCK_AUDIT.map((entry) => {
          const sc = statusConfig[entry.status];
          return (
            <div
              key={entry.id}
              className={cn(
                "grid grid-cols-[140px_1fr_80px_1fr_70px] items-center gap-3",
                "border-b border-subtle px-4 py-2 last:border-0 hover:bg-surface-2",
                (entry.status === "denied" || entry.status === "flagged") && "bg-surface-2"
              )}
            >
              <span className="font-mono text-2xs text-foreground/50">{entry.timestamp}</span>
              <span className="text-xs font-medium text-foreground">{entry.agent}</span>
              <span className="font-mono text-2xs text-muted-foreground">{entry.action}</span>
              <span className="font-mono text-2xs text-muted-foreground truncate">{entry.resource}</span>
              <span
                className={cn(
                  "inline-flex items-center rounded border px-1.5 py-px text-2xs font-medium",
                  sc.bg,
                  sc.color
                )}
              >
                {sc.label}
              </span>
            </div>
          );
        })}
      </div>

      <p className="mt-3 text-2xs text-foreground/40">
        All entries are cryptographically immutable · Powered by Civic Nexus
      </p>

      {/* Kill switch dialog */}
      <Dialog open={killSwitchOpen} onOpenChange={setKillSwitchOpen}>
        <DialogContent className="border-subtle bg-surface-2 sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm text-destructive">
              <Power className="h-4 w-4" />
              Revoke Agent Access
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <p className="text-xs text-muted-foreground">
              This will immediately revoke all AI agent access for{" "}
              <span className="font-medium text-foreground capitalize">{tenantId}</span>.
              All AI features will be disabled until manually re-enabled.
            </p>
            <div className="rounded border border-status-warning/30 bg-status-warning/10 px-3 py-2">
              <p className="text-2xs text-status-warning">
                This action is logged with your identity and timestamp. Customer operations will be disrupted.
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setKillSwitchOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                className="h-7 text-xs"
                onClick={() => { setKilled(true); setKillSwitchOpen(false); }}
              >
                Revoke access
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
