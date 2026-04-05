"use client";

import { use, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { ArrowLeft, Eye, EyeOff, Shield, AlertTriangle, Clock, X } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Props {
  params: Promise<{ tenantId: string }>;
}

type Step = "authorize" | "active";
type Duration = "15m" | "30m" | "1h";

const MOCK_USERS = [
  { name: "A*** C***", email: "a***@acme.com", role: "Admin",  status: "active",  joined: "Jan 2024" },
  { name: "S*** K***", email: "s***@acme.com", role: "Member", status: "active",  joined: "Feb 2024" },
  { name: "M*** R***", email: "m***@acme.com", role: "Member", status: "active",  joined: "Mar 2024" },
];

export default function ProxyPage({ params }: Props) {
  // Auth gate: only admins can access
  const adminWorkspaces = useQuery(api.admin.listWorkspaces);
  if (!adminWorkspaces) return <div className="flex h-screen items-center justify-center text-muted-foreground">Loading...</div>;
  if (adminWorkspaces.length === 0) return <div className="flex h-screen items-center justify-center text-red-500">Access denied. Admin privileges required.</div>;
  const { tenantId } = use(params);
  const [step, setStep] = useState<Step>("authorize");
  const [reason, setReason] = useState("");
  const [duration, setDuration] = useState<Duration>("30m");
  const [piiVisible, setPiiVisible] = useState(false);
  const [sessionElapsed] = useState("00:04:22");

  if (step === "authorize") {
    return (
      <div className="mx-auto max-w-lg animate-fade-in px-6 py-10">
        {/* Breadcrumb */}
        <div className="mb-8 flex items-center gap-2">
          <Link
            href={`/admin/${tenantId}/security`}
            className="flex items-center gap-1 text-2xs text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-3 w-3" />
            Security
          </Link>
          <span className="text-2xs text-foreground/40">›</span>
          <span className="text-2xs text-foreground">Impersonation</span>
        </div>

        {/* Audit notice */}
        <div className="mb-6 flex items-start gap-3 rounded border border-l-4 border-status-warning/20 border-l-status-warning bg-surface-1 px-4 py-3.5">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-status-warning" />
          <div>
            <p className="text-xs font-semibold text-foreground">Audit Notice</p>
            <p className="mt-1 text-2xs leading-relaxed text-muted-foreground">
              This session will be logged with your identity, timestamp, and stated reason. Access is recorded in the immutable audit ledger. PII is obfuscated by default.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {/* Tenant */}
          <div>
            <label className="mb-1.5 block text-2xs font-medium uppercase tracking-widest text-foreground/40">
              Workspace
            </label>
            <div className="rounded border border-subtle bg-surface-2 px-3 py-2">
              <p className="text-xs font-medium capitalize text-foreground">{tenantId}</p>
            </div>
          </div>

          {/* Reason */}
          <div>
            <label className="mb-1.5 block text-2xs font-medium uppercase tracking-widest text-foreground/40">
              Reason for access <span className="text-status-danger">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Customer reported misconfigured agent — investigating knowledge scope"
              rows={3}
              className="w-full resize-none rounded border border-subtle bg-surface-2 px-3 py-2 text-xs text-foreground placeholder:text-foreground/40 focus:border-foreground/15 focus:outline-none"
            />
          </div>

          {/* Duration */}
          <div>
            <label className="mb-1.5 block text-2xs font-medium uppercase tracking-widest text-foreground/40">
              Session Duration
            </label>
            <div className="flex gap-2">
              {(["15m", "30m", "1h"] as Duration[]).map((d) => (
                <button
                  key={d}
                  onClick={() => setDuration(d)}
                  className={cn(
                    "flex-1 rounded border py-1.5 text-xs font-medium transition-colors",
                    duration === d
                      ? "border-ping-purple/40 bg-ping-purple/10 text-ping-purple"
                      : "border-subtle bg-surface-2 text-muted-foreground hover:border-foreground/10"
                  )}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Link href={`/admin/${tenantId}/security`} className="flex-1">
              <Button variant="ghost" size="sm" className="h-8 w-full text-xs">
                Cancel
              </Button>
            </Link>
            <Button
              size="sm"
              disabled={!reason.trim()}
              className="h-8 flex-1 gap-1.5 bg-ping-purple text-xs text-white hover:bg-ping-purple-hover disabled:opacity-40"
              onClick={() => setStep("active")}
            >
              <Shield className="h-3 w-3" />
              Begin Secure Session
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Active impersonation view
  return (
    <div className="flex h-full flex-col">
      {/* Session banner */}
      <div className="flex items-center justify-between border-b border-status-warning/30 bg-status-warning/10 px-4 py-2">
        <div className="flex items-center gap-2">
          <Shield className="h-3.5 w-3.5 text-status-warning" />
          <span className="text-xs font-medium text-status-warning">
            Secure session active — {tenantId}
          </span>
          <span className="text-2xs text-status-warning/60">·</span>
          <div className="flex items-center gap-1 text-2xs text-status-warning/60">
            <Clock className="h-3 w-3" />
            {sessionElapsed} elapsed
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPiiVisible((v) => !v)}
            className="flex items-center gap-1.5 rounded border border-status-warning/30 bg-status-warning/10 px-2 py-1 text-2xs text-status-warning transition-colors hover:bg-status-warning/20"
          >
            {piiVisible ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
            {piiVisible ? "Hide PII" : "Show PII"}
          </button>
          <button
            onClick={() => setStep("authorize")}
            className="flex items-center gap-1 rounded border border-status-warning/30 px-2 py-1 text-2xs text-status-warning hover:bg-status-warning/10"
          >
            <X className="h-3 w-3" />
            End session
          </button>
        </div>
      </div>

      {/* Proxied admin view */}
      <div className="flex-1 overflow-auto p-6 animate-fade-in">
        <div className="mx-auto max-w-3xl">
          <div className="mb-4 flex items-center gap-2">
            <h2 className="text-sm font-semibold text-foreground capitalize">
              {tenantId} — Admin View
            </h2>
            <span className="rounded border border-subtle bg-surface-2 px-1.5 py-px text-2xs text-muted-foreground">
              proxied
            </span>
          </div>

          {/* PII warning */}
          {!piiVisible && (
            <div className="mb-4 flex items-center gap-2 rounded border border-subtle bg-surface-1 px-3 py-2">
              <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
              <p className="text-2xs text-muted-foreground">
                PII is obfuscated by default. Toggle &quot;Show PII&quot; in the session banner to reveal.
              </p>
            </div>
          )}

          {/* Members table (proxied) */}
          <div className="overflow-hidden rounded border border-subtle">
            <div className="border-b border-subtle bg-surface-1 px-4 py-2">
              <span className="text-2xs font-medium uppercase tracking-widest text-foreground/45">
                Team Members
              </span>
            </div>
            <div className="grid grid-cols-[1fr_1fr_80px_80px] gap-4 border-b border-subtle bg-surface-1/50 px-4 py-2">
              {["Name", "Email", "Role", "Status"].map((h) => (
                <span key={h} className="text-2xs font-medium uppercase tracking-widest text-foreground/45">
                  {h}
                </span>
              ))}
            </div>
            {MOCK_USERS.map((user) => (
              <div
                key={user.email}
                className="grid grid-cols-[1fr_1fr_80px_80px] items-center gap-4 border-b border-subtle px-4 py-2.5 last:border-0"
              >
                <span className={cn("text-xs", !piiVisible && "font-mono text-foreground/50")}>
                  {piiVisible ? user.name.replace(/\*/g, "a").replace(/\*\*\*/g, "lex Chen") : user.name}
                </span>
                <span className={cn("text-xs text-muted-foreground", !piiVisible && "font-mono")}>
                  {piiVisible ? user.email.replace("a***", "alex").replace("s***", "sarah").replace("m***", "maya") : user.email}
                </span>
                <span className="text-2xs text-muted-foreground">{user.role}</span>
                <span className="text-2xs text-status-online">{user.status}</span>
              </div>
            ))}
          </div>

          <p className="mt-4 text-2xs text-foreground/40">
            All actions in this session are logged · Session ID: proxy_{Date.now().toString(36)}
          </p>
        </div>
      </div>
    </div>
  );
}
