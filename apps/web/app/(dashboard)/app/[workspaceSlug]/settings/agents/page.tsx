"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { AgentCard, AgentConfigDialog, type Agent } from "@/components/bot/AgentCard";
import { useToast } from "@/components/ui/toast-provider";

const MOCK_AGENTS: Agent[] = [
  {
    id: "1",
    name: "KnowledgeBot",
    description: "Answers questions about your team's codebase, past decisions, and historical context. Queries GitHub, Linear, and chat history with citations.",
    status: "active",
    scopes: ["general", "engineering", "product"],
    queryCount: 47,
    color: "#5E6AD2",
  },
  {
    id: "2",
    name: "SupportRouterBot",
    description: "Automatically triages incoming support messages, routes to the right team member, and drafts initial responses based on past resolution patterns.",
    status: "active",
    scopes: ["general", "product"],
    queryCount: 12,
    color: "#22C55E",
  },
  {
    id: "3",
    name: "SprintCoach",
    description: "Monitors sprint health, flags blocked tickets, pings assignees on overdue items, and generates weekly summaries for planning meetings.",
    status: "inactive",
    scopes: ["engineering", "product"],
    queryCount: 0,
    color: "#F59E0B",
  },
];

export default function AgentsPage() {
  const [agents, setAgents] = useState(MOCK_AGENTS);
  const [configuring, setConfiguring] = useState<Agent | null>(null);
  const [creating, setCreating] = useState(false);
  const { toast } = useToast();

  const handleToggle = (id: string, status: "active" | "inactive") => {
    setAgents((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status } : a))
    );
    toast(status === "active" ? "Agent enabled" : "Agent disabled", "success");
  };

  const handleSave = (updated: Agent) => {
    setAgents((prev) => {
      const exists = prev.find((a) => a.id === updated.id);
      if (exists) {
        return prev.map((a) => (a.id === updated.id ? updated : a));
      }
      return [...prev, updated];
    });
    toast(configuring ? "Agent updated" : "Agent created", "success");
  };

  return (
    <div className="mx-auto max-w-4xl animate-fade-in px-6 py-6">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-md font-semibold text-foreground">Agents</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {agents.filter((a) => a.status === "active").length} active ·{" "}
            {agents.length} total agents in this workspace
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

      {/* Grid */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {agents.map((agent) => (
          <AgentCard
            key={agent.id}
            agent={agent}
            onToggle={handleToggle}
            onConfigure={(id) => setConfiguring(agents.find((a) => a.id === id) ?? null)}
          />
        ))}

        {/* Create new */}
        <button
          onClick={() => setCreating(true)}
          className="flex flex-col items-center justify-center gap-2 rounded border border-dashed border-white/10 bg-transparent py-10 text-center transition-colors hover:border-white/20 hover:bg-surface-2"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-dashed border-white/15">
            <Plus className="h-4 w-4 text-white/30" />
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">Create agent</p>
            <p className="text-2xs text-white/25">Custom AI for your workflow</p>
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
      />

      {/* Create dialog */}
      <AgentConfigDialog
        agent={null}
        mode="create"
        open={creating}
        onClose={() => setCreating(false)}
        onSave={handleSave}
      />
    </div>
  );
}
