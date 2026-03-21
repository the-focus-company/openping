"use client";

import { useQuery, useMutation, useConvexAuth } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Mail, Unplug } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusDot } from "@/components/ui/status-dot";
import { cn } from "@/lib/utils";
import { formatRelativeTime } from "@/lib/utils";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useToast } from "@/components/ui/toast-provider";

const PROVIDER_CONFIG = {
  gmail: {
    label: "Gmail",
    icon: "G",
    color: "bg-red-500/10 text-red-400 border-red-500/20",
  },
  outlook: {
    label: "Outlook",
    icon: "O",
    color: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  },
} as const;

export default function EmailSettingsPage() {
  useWorkspace(); // Ensure we're in a workspace context
  const { isAuthenticated } = useConvexAuth();
  const { toast } = useToast();

  const accounts = useQuery(
    api.emails.listAccounts,
    isAuthenticated ? {} : "skip",
  );
  const disconnectMutation = useMutation(api.emails.disconnectAccount);

  const handleConnect = (provider: "gmail" | "outlook") => {
    // In production, this would redirect to the OAuth URL
    toast(
      `Email connection for ${provider} is not yet configured. OAuth integration coming soon.`,
      "info",
    );
  };

  const handleDisconnect = async (accountId: Id<"emailAccounts">) => {
    try {
      await disconnectMutation({ accountId });
      toast("Email account disconnected", "success");
    } catch (err) {
      toast(
        err instanceof Error ? err.message : "Failed to disconnect account",
        "error",
      );
    }
  };

  if (accounts === undefined) {
    return (
      <div className="mx-auto max-w-4xl animate-fade-in px-6 py-6">
        <h1 className="text-md font-semibold text-foreground">
          Email Settings
        </h1>
        <p className="mt-2 text-xs text-muted-foreground">
          Loading email accounts...
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl animate-fade-in px-6 py-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-md font-semibold text-foreground">
          Email Settings
        </h1>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Connect your email accounts to receive AI-triaged emails in your inbox
        </p>
      </div>

      {/* Connect buttons */}
      <div className="mb-6 grid grid-cols-2 gap-3">
        <button
          onClick={() => handleConnect("gmail")}
          className="flex items-center gap-3 rounded border border-subtle bg-surface-1 px-4 py-3 text-left transition-colors hover:border-white/10 hover:bg-surface-2"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded bg-red-500/10 text-sm font-bold text-red-400">
            G
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">
              Connect Gmail
            </p>
            <p className="text-2xs text-muted-foreground">
              Google Workspace or personal Gmail
            </p>
          </div>
        </button>

        <button
          onClick={() => handleConnect("outlook")}
          className="flex items-center gap-3 rounded border border-subtle bg-surface-1 px-4 py-3 text-left transition-colors hover:border-white/10 hover:bg-surface-2"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded bg-blue-500/10 text-sm font-bold text-blue-400">
            O
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">
              Connect Outlook
            </p>
            <p className="text-2xs text-muted-foreground">
              Microsoft 365 or Outlook.com
            </p>
          </div>
        </button>
      </div>

      {/* Connected accounts */}
      <div>
        <h2 className="mb-3 text-2xs font-medium uppercase tracking-widest text-foreground/30">
          Connected Accounts
        </h2>

        {accounts.length === 0 ? (
          <div className="rounded border border-subtle bg-surface-1 px-4 py-8 text-center">
            <Mail className="mx-auto h-8 w-8 text-white/15" />
            <p className="mt-2 text-sm text-foreground">
              No email accounts connected
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Connect Gmail or Outlook above to get started
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded border border-subtle">
            {accounts.map((account) => {
              const config = PROVIDER_CONFIG[account.provider];
              const statusVariant =
                account.status === "connected"
                  ? "online"
                  : account.status === "error"
                    ? "pending"
                    : "offline";

              return (
                <div
                  key={account._id}
                  className="flex items-center gap-3 border-b border-subtle px-4 py-3 last:border-0"
                >
                  <div
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded border text-sm font-bold",
                      config.color,
                    )}
                  >
                    {config.icon}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground">
                        {account.email}
                      </span>
                      <span
                        className={cn(
                          "rounded px-1.5 py-px text-2xs font-medium",
                          config.color,
                        )}
                      >
                        {config.label}
                      </span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-2">
                      <StatusDot variant={statusVariant} size="xs" />
                      <span className="text-2xs text-muted-foreground capitalize">
                        {account.status}
                      </span>
                      {account.lastSyncedAt && (
                        <>
                          <span className="text-2xs text-white/15">·</span>
                          <span className="text-2xs text-muted-foreground">
                            Synced {formatRelativeTime(account.lastSyncedAt)}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1.5 text-xs text-destructive hover:text-destructive"
                    onClick={() => handleDisconnect(account._id)}
                  >
                    <Unplug className="h-3 w-3" />
                    Disconnect
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Info box */}
      <div className="mt-6 rounded border border-subtle bg-surface-1 px-4 py-3">
        <p className="text-2xs font-medium uppercase tracking-widest text-foreground/30">
          How it works
        </p>
        <ul className="mt-2 space-y-1.5 text-xs text-muted-foreground">
          <li>
            1. Connect your email account via OAuth (no passwords stored)
          </li>
          <li>
            2. PING syncs your inbox and classifies emails using the Eisenhower
            Matrix
          </li>
          <li>
            3. View AI-triaged emails alongside your workspace messages
          </li>
          <li>4. Take action directly from the PING interface</li>
        </ul>
      </div>
    </div>
  );
}
