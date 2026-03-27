"use client";

import { useState, useEffect } from "react";
import { Plus, Loader2, Shield } from "lucide-react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { AgentCard, AgentConfigDialog, type Agent, type AgentSaveData } from "@/components/bot/AgentCard";
import { AgentTokenDialog } from "@/components/bot/AgentTokenDialog";
import { useToast } from "@/components/ui/toast-provider";
import { useWorkspace } from "@/hooks/useWorkspace";
import * as Sentry from "@sentry/nextjs";

export default function AgentsPage() {
  const { role } = useWorkspace();

  if (role !== "admin") {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
        You don&apos;t have permission to manage agents.
      </div>
    );
  }

  return <AgentsPageContent />;
}

function AgentsPageContent() {
  const { workspaceId } = useWorkspace();
  const agents = useQuery(api.agents.list, { workspaceId });
  const createAgent = useMutation(api.agents.create);
  const updateAgent = useMutation(api.agents.update);
  const removeAgent = useMutation(api.agents.remove);
  const generateTokenMutation = useMutation(api.agents.generateToken);
  const provisionManaged = useMutation(api.managedAgents.provision);

  const [configuring, setConfiguring] = useState<Agent | null>(null);
  const [creating, setCreating] = useState(false);
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);
  const { toast } = useToast();

  // Auto-provision managed agents if none exist
  const hasManaged = agents?.some((a) => a.isManaged);
  const [provisioned, setProvisioned] = useState(false);
  useEffect(() => {
    if (agents && !hasManaged && !provisioned) {
      setProvisioned(true);
      provisionManaged({ workspaceId }).catch((e) => Sentry.captureException(e));
    }
  }, [agents, hasManaged, provisioned, provisionManaged, workspaceId]);

  const handleToggle = async (id: Id<"agents">, status: "active" | "inactive") => {
    try {
      await updateAgent({ agentId: id, workspaceId, status });
      toast(status === "active" ? "Agent enabled" : "Agent disabled", "success");
    } catch (e) {
      Sentry.captureException(e);
      toast("Failed to update agent", "error");
    }
  };

  const handleSave = async (data: AgentSaveData) => {
    try {
      if (configuring) {
        await updateAgent({
          agentId: configuring._id,
          workspaceId,
          name: data.name,
          description: data.description,
          systemPrompt: data.systemPrompt,
          color: data.color,
          model: data.model,
          scope: data.scope,
          tools: data.tools,
          restrictions: data.restrictions,
          triggers: data.triggers,
          jobs: data.jobs,
        });
        toast("Agent updated", "success");
      } else {
        await createAgent({
          workspaceId,
          name: data.name,
          description: data.description || undefined,
          systemPrompt: data.systemPrompt,
          color: data.color,
          model: data.model,
          scope: data.scope ?? "workspace",
          tools: data.tools,
          restrictions: data.restrictions,
          triggers: data.triggers,
          jobs: data.jobs,
        });
        toast("Agent created", "success");
      }
    } catch (e) {
      Sentry.captureException(e);
      toast("Failed to save agent", "error");
    }
  };

  const handleGenerateToken = async (id: Id<"agents">) => {
    try {
      const token = await generateTokenMutation({ agentId: id, workspaceId });
      setGeneratedToken(token);
    } catch (e) {
      Sentry.captureException(e);
      toast("Failed to generate token", "error");
    }
  };

  const handleDelete = async (id: Id<"agents">) => {
    try {
      await removeAgent({ agentId: id, workspaceId });
      setConfiguring(null);
      toast("Agent deleted", "success");
    } catch (e) {
      Sentry.captureException(e);
      toast("Failed to delete agent", "error");
    }
  };

  if (agents === undefined) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-foreground/40" />
      </div>
    );
  }

  const visibleAgents = agents.filter((a) => a.status !== "revoked");
  const managedAgents = visibleAgents.filter((a) => a.isManaged);
  const customAgents = visibleAgents.filter((a) => !a.isManaged);
  const activeCount = agents.filter((a) => a.status === "active").length;

  return (
    <div className="mx-auto max-w-5xl animate-fade-in px-6 py-6">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-md font-semibold text-foreground">Agents</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {activeCount} active · {visibleAgents.length} total agent{visibleAgents.length !== 1 ? "s" : ""} in this workspace
          </p>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="flex items-center gap-1.5 rounded bg-ping-purple px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-ping-purple-hover"
        >
          <Plus className="h-3 w-3" />
          New Agent
        </button>
      </div>

      {/* Platform Agents */}
      {managedAgents.length > 0 && (
        <div className="mb-6">
          <div className="mb-2 flex items-center gap-1.5">
            <Shield className="h-3.5 w-3.5 text-violet-400" />
            <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Platform Agents</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {managedAgents.map((agent) => (
              <AgentCard
                key={agent._id}
                agent={agent}
                isManaged
                onConfigure={(id) =>
                  setConfiguring(agents.find((a) => a._id === id) ?? null)
                }
              />
            ))}
          </div>
        </div>
      )}

      {/* Custom Agents */}
      <div className="mb-2 flex items-center gap-1.5">
        <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Custom Agents</h2>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {customAgents.map((agent) => (
          <AgentCard
            key={agent._id}
            agent={agent}
            onConfigure={(id) =>
              setConfiguring(agents.find((a) => a._id === id) ?? null)
            }
          />
        ))}

        {/* Create new */}
        <button
          onClick={() => setCreating(true)}
          className="flex flex-col items-center justify-center gap-2 rounded border border-dashed border-foreground/10 bg-transparent py-10 text-center transition-colors hover:border-foreground/20 hover:bg-surface-2"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-dashed border-foreground/15">
            <Plus className="h-4 w-4 text-foreground/50" />
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">Create agent</p>
            <p className="text-2xs text-foreground/45">Custom AI for your workflow</p>
          </div>
        </button>
      </div>

      {/* Edit dialog */}
      <AgentConfigDialog
        agent={configuring}
        mode="edit"
        open={!!configuring}
        onClose={() => setConfiguring(null)}
        onSave={handleSave}
        onToggle={handleToggle}
        onGenerateToken={handleGenerateToken}
        onDelete={configuring?.isManaged ? undefined : handleDelete}
      />

      {/* Create dialog */}
      <AgentConfigDialog
        agent={null}
        mode="create"
        open={creating}
        onClose={() => setCreating(false)}
        onSave={handleSave}
      />

      {/* Token dialog */}
      <AgentTokenDialog
        token={generatedToken}
        open={!!generatedToken}
        onClose={() => setGeneratedToken(null)}
      />
    </div>
  );
}
