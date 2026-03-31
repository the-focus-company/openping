"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Plus } from "lucide-react";
import { AgentCard, AgentConfigDialog, type AgentSaveData } from "@/components/bot/AgentCard";
import type { Agent } from "@/components/bot/AgentCard";
import { AgentTokenDialog } from "@/components/bot/AgentTokenDialog";
import { AgentApiInfo } from "@/components/bot/AgentApiInfo";
import { useToast } from "@/components/ui/toast-provider";
import { useWorkspace } from "@/hooks/useWorkspace";

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
  const { toast } = useToast();

  const [configOpen, setConfigOpen] = useState(false);
  const [configMode, setConfigMode] = useState<"edit" | "create">("create");
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);

  const [tokenDialogOpen, setTokenDialogOpen] = useState(false);
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [tokenAgentName, setTokenAgentName] = useState<string>("");

  if (agents === undefined) {
    return (
      <div className="mx-auto max-w-4xl p-6">
        <h1 className="mb-1 text-lg font-semibold text-foreground">Agent Settings</h1>
        <p className="mb-6 text-sm text-muted-foreground">Loading agents...</p>
      </div>
    );
  }

  const activeAgents = agents.filter((a) => a.status !== "revoked");

  const handleCreate = () => {
    setSelectedAgent(null);
    setConfigMode("create");
    setConfigOpen(true);
  };

  const handleConfigure = (id: Id<"agents">) => {
    const agent = agents.find((a) => a._id === id);
    if (agent) {
      setSelectedAgent(agent);
      setConfigMode("edit");
      setConfigOpen(true);
    }
  };

  const handleSave = async (data: AgentSaveData) => {
    try {
      if (configMode === "create") {
        await createAgent({
          workspaceId,
          name: data.name,
          description: data.description,
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
      } else if (selectedAgent) {
        await updateAgent({
          agentId: selectedAgent._id,
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
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to save agent", "error");
    }
  };

  return (
    <div className="mx-auto max-w-4xl p-6">
      <h1 className="mb-1 text-lg font-semibold text-foreground">Agent Settings</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Manage external AI agents that can connect to your workspace.
      </p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {activeAgents.map((agent) => (
          <AgentCard
            key={agent._id}
            agent={agent}
            onConfigure={handleConfigure}
          />
        ))}

        {/* Create agent card */}
        <button
          onClick={handleCreate}
          className="flex min-h-[140px] flex-col items-center justify-center gap-2 rounded border border-dashed border-subtle bg-surface-1 p-4 text-muted-foreground transition-colors hover:border-white/15 hover:bg-surface-2 hover:text-foreground"
        >
          <Plus className="h-5 w-5" />
          <span className="text-xs font-medium">Create agent</span>
        </button>
      </div>

      {tokenAgentName && (
        <div className="mt-8">
          <AgentApiInfo agentName={tokenAgentName} />
        </div>
      )}

      <AgentConfigDialog
        agent={selectedAgent}
        mode={configMode}
        open={configOpen}
        onClose={() => setConfigOpen(false)}
        onSave={handleSave}
      />

      <AgentTokenDialog
        token={generatedToken}
        open={tokenDialogOpen}
        onClose={() => {
          setTokenDialogOpen(false);
          setGeneratedToken(null);
        }}
      />
    </div>
  );
}
