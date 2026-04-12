"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast-provider";
import { StatusDot } from "@/components/ui/status-dot";
import {
  Link,
  Github,
  Loader2,
  Copy,
  Check,
  Plug,
  Unplug,
  ChevronDown,
  ChevronRight,
  X,
} from "lucide-react";
import { useWorkspace } from "@/hooks/useWorkspace";
import { LinearIcon } from "@/components/icons/LinearIcon";
import { useLoadingTimeout } from "@/hooks/useLoadingTimeout";
import type { Id } from "@convex/_generated/dataModel";

function getSiteUrl() {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL ?? "";
  return url.replace(".convex.cloud", ".convex.site");
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={copy}
      className="shrink-0 rounded p-1 text-foreground/50 hover:text-foreground/80 transition-colors"
      title="Copy"
    >
      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
    </button>
  );
}

export default function WorkspacePage() {
  const { role } = useWorkspace();

  if (role !== "admin") {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
        You don&apos;t have permission to view workspace settings.
      </div>
    );
  }

  return <WorkspacePageContent />;
}

function WorkspacePageContent() {
  const { toast } = useToast();
  const { workspaceId } = useWorkspace();
  const workspace = useQuery(api.workspaces.get, { workspaceId });
  const updateWorkspace = useMutation(api.workspaces.update);
  const connectIntegration = useMutation(api.workspaces.connectIntegration);
  const disconnectIntegration = useMutation(api.workspaces.disconnectIntegration);
  const conversations = useQuery(api.conversations.list, { workspaceId });
  const addRouting = useMutation(api.integrations.addRouting);
  const removeRouting = useMutation(api.integrations.removeRouting);
  const routingRules = useQuery(api.integrations.listRoutingByWorkspace, { workspaceId });

  const [workspaceName, setWorkspaceName] = useState("");
  const [saving, setSaving] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [expanded, setExpanded] = useState<"github" | "linear" | null>(null);
  const [githubOrg, setGithubOrg] = useState("");
  const [githubSecret, setGithubSecret] = useState("");
  const [linearOrg, setLinearOrg] = useState("");
  const [linearSecret, setLinearSecret] = useState("");
  const [selectedChannel, setSelectedChannel] = useState<Record<string, string>>({});
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    if (workspace && !initialized) {
      setWorkspaceName(workspace.name);
      setInitialized(true);
    }
  }, [workspace, initialized]);

  const handleSave = async () => {
    if (!workspaceName.trim()) return;
    setSaving(true);
    try {
      await updateWorkspace({ workspaceId, name: workspaceName.trim() });
      toast("Workspace settings saved", "success");
    } catch {
      toast("Failed to save", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleConnect = async (provider: "github" | "linear") => {
    const orgValue = provider === "github" ? githubOrg : linearOrg;
    const secretValue = provider === "github" ? githubSecret : linearSecret;
    setConnecting(true);
    try {
      await connectIntegration({
        workspaceId,
        provider,
        accountName: orgValue.trim() || (workspace?.name ?? ""),
        orgId: orgValue.trim() || undefined,
        webhookSecret: secretValue.trim() || undefined,
      });
      toast(
        `${provider === "github" ? "GitHub" : "Linear"} connected — now add the webhook URL to your ${provider === "github" ? "repository" : "workspace"} settings`,
        "success",
      );
    } catch {
      toast("Failed to connect", "error");
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async (provider: "github" | "linear") => {
    await disconnectIntegration({ workspaceId, provider });
    setExpanded(null);
    toast(`${provider === "github" ? "GitHub" : "Linear"} disconnected`, "success");
  };

  const handleAddRouting = async (integrationType: "github" | "linear") => {
    const conversationId = selectedChannel[integrationType];
    if (!conversationId) return;
    try {
      await addRouting({
        conversationId: conversationId as Id<"conversations">,
        workspaceId,
        integrationType,
        externalTarget: "*",
        externalTargetLabel: "All",
      });
      setSelectedChannel((prev) => ({ ...prev, [integrationType]: "" }));
      toast("Channel routing added", "success");
    } catch (e: unknown) {
      toast((e as Error).message ?? "Failed to add routing", "error");
    }
  };

  const handleRemoveRouting = async (routingId: string) => {
    await removeRouting({ routingId: routingId as Id<"integrationRouting">, workspaceId });
    toast("Routing removed", "success");
  };

  const wsTimedOut = useLoadingTimeout(workspace === undefined, 12_000);
  if (workspace === undefined) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3">
        {wsTimedOut ? (
          <>
            <p className="text-sm text-muted-foreground">Could not load workspace settings.</p>
            <button onClick={() => window.location.reload()} className="text-xs text-foreground/60 underline hover:text-foreground">Retry</button>
          </>
        ) : (
          <Loader2 className="h-5 w-5 animate-spin text-foreground/40" />
        )}
      </div>
    );
  }

  const githubConfig = workspace?.integrationConfig?.github;
  const linearConfig = workspace?.integrationConfig?.linear;
  const siteUrl = getSiteUrl();
  const githubWebhookUrl = `${siteUrl}/webhooks/github`;
  const linearWebhookUrl = `${siteUrl}/webhooks/linear`;
  const normalizeRule = (r: { _id: string; conversationId?: string; channelId?: string; integrationType: string; externalTargetLabel?: string }) => ({
    _id: r._id,
    conversationId: (r.conversationId ?? r.channelId) as string,
    externalTargetLabel: r.externalTargetLabel,
  });
  const githubRules = (routingRules ?? []).filter((r) => r.integrationType === "github").map(normalizeRule);
  const linearRules = (routingRules ?? []).filter((r) => r.integrationType === "linear").map(normalizeRule);
  const publicChannels = (conversations ?? []).filter((c) => c.visibility === "public" && c.name);

  return (
    <div className="mx-auto max-w-lg animate-fade-in px-6 py-6">
      <div className="mb-6">
        <h1 className="text-md font-semibold text-foreground">Workspace</h1>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Manage your workspace settings and integrations
        </p>
      </div>

      <div className="space-y-5">
        {/* Workspace Name */}
        <div>
          <label className="mb-1.5 block text-2xs font-medium uppercase tracking-widest text-foreground/40">
            Workspace name
          </label>
          <input
            value={workspaceName}
            onChange={(e) => setWorkspaceName(e.target.value)}
            className="w-full rounded border border-subtle bg-background px-2.5 py-1.5 text-xs text-foreground placeholder:text-foreground/45 focus:border-ring focus:outline-none"
          />
        </div>

        {/* Workspace Slug */}
        <div>
          <label className="mb-1.5 block text-2xs font-medium uppercase tracking-widest text-foreground/40">
            Workspace slug
          </label>
          <input
            value={workspace?.slug ?? ""}
            disabled
            className="w-full rounded border border-subtle bg-surface-1 px-2.5 py-1.5 text-xs text-muted-foreground"
          />
          <p className="mt-1 text-2xs text-foreground/40">Read-only identifier</p>
        </div>

        {/* Integrations */}
        <div>
          <label className="mb-2 block text-2xs font-medium uppercase tracking-widest text-foreground/40">
            <span className="flex items-center gap-1.5">
              <Link className="h-3 w-3" />
              Integrations
            </span>
          </label>
          <div className="space-y-2">
            {/* GitHub */}
            <IntegrationPanel
              icon={<Github className="h-3.5 w-3.5 text-foreground/50" />}
              label="GitHub"
              connected={!!githubConfig?.connected}
              expanded={expanded === "github"}
              onToggle={() => setExpanded(expanded === "github" ? null : "github")}
              onDisconnect={() => handleDisconnect("github")}
              connectSection={
                <div className="space-y-3">
                  <div>
                    <p className="mb-1.5 text-2xs text-foreground/50">
                      GitHub organization or user login (e.g.{" "}
                      <code className="text-foreground/70">my-org</code>)
                    </p>
                    <input
                      value={githubOrg}
                      onChange={(e) => setGithubOrg(e.target.value)}
                      placeholder="my-org"
                      className="w-full rounded border border-subtle bg-background px-2.5 py-1.5 text-xs text-foreground placeholder:text-foreground/45 focus:border-ring focus:outline-none"
                    />
                  </div>
                  <div>
                    <p className="mb-1.5 text-2xs text-foreground/50">
                      Add this webhook URL to your GitHub repository or organization settings under{" "}
                      <strong className="text-foreground/60">Settings → Webhooks → Add webhook</strong>.
                      Select content type <code className="text-foreground/70">application/json</code> and
                      check <code className="text-foreground/70">Pull requests</code> events.
                    </p>
                    <div className="flex items-center gap-1.5 rounded border border-subtle bg-surface-1 px-2.5 py-1.5">
                      <span className="flex-1 truncate font-mono text-2xs text-foreground/60">
                        {githubWebhookUrl}
                      </span>
                      <CopyButton text={githubWebhookUrl} />
                    </div>
                  </div>
                  <div>
                    <p className="mb-1.5 text-2xs text-foreground/50">
                      Webhook secret — paste the secret from the GitHub webhook settings to verify signatures.
                    </p>
                    <input
                      value={githubSecret}
                      onChange={(e) => setGithubSecret(e.target.value)}
                      placeholder="whsec_... (optional)"
                      type="password"
                      className="w-full rounded border border-subtle bg-background px-2.5 py-1.5 text-xs text-foreground placeholder:text-foreground/25 focus:border-ring focus:outline-none"
                    />
                  </div>
                  <Button
                    className="h-7 w-full bg-ping-purple text-xs text-white hover:bg-ping-purple-hover"
                    onClick={() => handleConnect("github")}
                    disabled={connecting}
                  >
                    {connecting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plug className="h-3 w-3" />}
                    <span className="ml-1.5">Mark as Connected</span>
                  </Button>
                </div>
              }
              connectedSection={
                <RoutingSection
                  type="github"
                  rules={githubRules}
                  channels={publicChannels}
                  selectedChannel={selectedChannel["github"] ?? ""}
                  onSelectChannel={(v) => setSelectedChannel((prev) => ({ ...prev, github: v }))}
                  onAddRouting={() => handleAddRouting("github")}
                  onRemoveRouting={handleRemoveRouting}
                  channelById={(id) => publicChannels.find((c) => c._id === id)}
                />
              }
            />

            {/* Linear */}
            <IntegrationPanel
              icon={<LinearIcon className="h-3.5 w-3.5 text-foreground/50" />}
              label="Linear"
              connected={!!linearConfig?.connected}
              expanded={expanded === "linear"}
              onToggle={() => setExpanded(expanded === "linear" ? null : "linear")}
              onDisconnect={() => handleDisconnect("linear")}
              connectSection={
                <div className="space-y-3">
                  <div>
                    <p className="mb-1.5 text-2xs text-foreground/50">
                      Linear organization ID — found in your Linear workspace URL:{" "}
                      <code className="text-foreground/70">linear.app/[org-slug]</code>. Leave blank to
                      auto-detect (works for single-workspace setups).
                    </p>
                    <input
                      value={linearOrg}
                      onChange={(e) => setLinearOrg(e.target.value)}
                      placeholder="my-team (optional)"
                      className="w-full rounded border border-subtle bg-background px-2.5 py-1.5 text-xs text-foreground placeholder:text-foreground/45 focus:border-ring focus:outline-none"
                    />
                  </div>
                  <div>
                    <p className="mb-1.5 text-2xs text-foreground/50">
                      Add this webhook URL in Linear under{" "}
                      <strong className="text-foreground/60">
                        Settings → API → Webhooks → New webhook
                      </strong>
                      . Select <code className="text-foreground/70">Issues</code> events.
                    </p>
                    <div className="flex items-center gap-1.5 rounded border border-subtle bg-surface-1 px-2.5 py-1.5">
                      <span className="flex-1 truncate font-mono text-2xs text-foreground/60">
                        {linearWebhookUrl}
                      </span>
                      <CopyButton text={linearWebhookUrl} />
                    </div>
                  </div>
                  <div>
                    <p className="mb-1.5 text-2xs text-foreground/50">
                      Webhook signing secret — paste the secret shown after creating the webhook in Linear.
                    </p>
                    <input
                      value={linearSecret}
                      onChange={(e) => setLinearSecret(e.target.value)}
                      placeholder="lin_wh_... (optional)"
                      type="password"
                      className="w-full rounded border border-subtle bg-background px-2.5 py-1.5 text-xs text-foreground placeholder:text-foreground/25 focus:border-ring focus:outline-none"
                    />
                  </div>
                  <Button
                    className="h-7 w-full bg-ping-purple text-xs text-white hover:bg-ping-purple-hover"
                    onClick={() => handleConnect("linear")}
                    disabled={connecting}
                  >
                    {connecting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plug className="h-3 w-3" />}
                    <span className="ml-1.5">Mark as Connected</span>
                  </Button>
                </div>
              }
              connectedSection={
                <RoutingSection
                  type="linear"
                  rules={linearRules}
                  channels={publicChannels}
                  selectedChannel={selectedChannel["linear"] ?? ""}
                  onSelectChannel={(v) => setSelectedChannel((prev) => ({ ...prev, linear: v }))}
                  onAddRouting={() => handleAddRouting("linear")}
                  onRemoveRouting={handleRemoveRouting}
                  channelById={(id) => publicChannels.find((c) => c._id === id)}
                />
              }
            />
          </div>
        </div>

        {/* Save */}
        <div className="pt-2">
          <Button
            className="h-8 w-full bg-ping-purple text-xs text-white hover:bg-ping-purple-hover"
            onClick={handleSave}
            disabled={saving || !workspaceName.trim()}
          >
            {saving ? "Saving..." : "Save changes"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function IntegrationPanel({
  icon,
  label,
  connected,
  expanded,
  onToggle,
  onDisconnect,
  connectSection,
  connectedSection,
}: {
  icon: React.ReactNode;
  label: string;
  connected: boolean;
  expanded: boolean;
  onToggle: () => void;
  onDisconnect: () => void;
  connectSection: React.ReactNode;
  connectedSection: React.ReactNode;
}) {
  return (
    <div className="rounded border border-subtle bg-surface-1">
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left"
      >
        {icon}
        <div className="flex-1">
          <p className="text-xs text-foreground">{label}</p>
          <div className="flex items-center gap-1.5">
            <StatusDot variant={connected ? "online" : "offline"} size="xs" />
            <p className="text-2xs text-muted-foreground">
              {connected ? "Connected" : "Not connected"}
            </p>
          </div>
        </div>
        {expanded ? (
          <ChevronDown className="h-3.5 w-3.5 text-foreground/50" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-foreground/50" />
        )}
      </button>

      {expanded && (
        <div className="border-t border-subtle px-3 py-3">
          {connected ? (
            <div className="space-y-3">
              {connectedSection}
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-full text-2xs text-muted-foreground hover:text-destructive"
                onClick={onDisconnect}
              >
                <Unplug className="mr-1.5 h-3 w-3" />
                Disconnect {label}
              </Button>
            </div>
          ) : (
            connectSection
          )}
        </div>
      )}
    </div>
  );
}

function RoutingSection({
  type,
  rules,
  channels,
  selectedChannel,
  onSelectChannel,
  onAddRouting,
  onRemoveRouting,
  channelById,
}: {
  type: "github" | "linear";
  rules: Array<{ _id: string; conversationId: string; externalTargetLabel?: string }>;
  channels: Array<{ _id: string; name?: string }>;
  selectedChannel: string;
  onSelectChannel: (v: string) => void;
  onAddRouting: () => void;
  onRemoveRouting: (id: string) => void;
  channelById: (id: string) => { name?: string } | undefined;
}) {
  return (
    <div className="space-y-2">
      <p className="text-2xs font-medium uppercase tracking-widest text-foreground/40">
        Channel routing
      </p>
      <p className="text-2xs text-foreground/50">
        {type === "github" ? "Pull request" : "Issue"} notifications will be posted to these channels.
      </p>

      {rules.length > 0 && (
        <div className="space-y-1">
          {rules.map((rule) => (
            <div
              key={rule._id}
              className="flex items-center justify-between rounded bg-surface-2 px-2.5 py-1.5"
            >
              <span className="text-2xs text-foreground/70">
                # {channelById(rule.conversationId)?.name ?? rule.conversationId}
              </span>
              <button
                onClick={() => onRemoveRouting(rule._id)}
                className="text-foreground/40 hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2">
        <select
          value={selectedChannel}
          onChange={(e) => onSelectChannel(e.target.value)}
          className="flex-1 rounded border border-subtle bg-background px-2 py-1.5 text-2xs text-foreground focus:border-ring focus:outline-none"
        >
          <option value="">Select a channel…</option>
          {channels.map((c) => (
            <option key={c._id} value={c._id}>
              # {c.name}
            </option>
          ))}
        </select>
        <Button
          size="sm"
          className="h-7 shrink-0 bg-ping-purple px-3 text-2xs text-white hover:bg-ping-purple-hover"
          onClick={onAddRouting}
          disabled={!selectedChannel}
        >
          Add
        </Button>
      </div>
    </div>
  );
}
