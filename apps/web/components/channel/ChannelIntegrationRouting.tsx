"use client";

import { useContext, useState, type ReactNode } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { Id } from "@convex/_generated/dataModel";
import { WorkspaceContext } from "@/components/workspace/WorkspaceProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { LinearIcon } from "@/components/icons/LinearIcon";
import { Github, X, Plus } from "lucide-react";

interface ChannelIntegrationRoutingProps {
  channelId: Id<"channels">;
}

export function ChannelIntegrationRouting({
  channelId,
}: ChannelIntegrationRoutingProps) {
  const wsCtx = useContext(WorkspaceContext);
  const routingRules = useQuery(api.integrations.listRoutingByChannel, {
    channelId,
  });
  const workspace = useQuery(
    api.workspaces.get,
    wsCtx ? { workspaceId: wsCtx.workspaceId } : "skip",
  );
  const addRouting = useMutation(api.integrations.addRouting);
  const removeRouting = useMutation(api.integrations.removeRouting);

  const [adding, setAdding] = useState<"github" | "linear" | null>(null);
  const [target, setTarget] = useState("");
  const [label, setLabel] = useState("");

  if (!wsCtx || !routingRules || !workspace) {
    return null;
  }

  const githubConnected = workspace.integrationConfig?.github?.connected;
  const linearConnected = workspace.integrationConfig?.linear?.connected;

  async function handleAdd() {
    if (!adding || !target.trim()) return;
    await addRouting({
      channelId,
      workspaceId: wsCtx!.workspaceId,
      integrationType: adding,
      externalTarget: target.trim(),
      externalTargetLabel: label.trim() || undefined,
    });
    setAdding(null);
    setTarget("");
    setLabel("");
  }

  async function handleRemove(routingId: Id<"integrationRouting">) {
    await removeRouting({
      routingId,
      workspaceId: wsCtx!.workspaceId,
    });
  }

  function resetAdding() {
    setAdding(null);
    setTarget("");
    setLabel("");
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold">Integration Routing</h3>
      <p className="text-xs text-muted-foreground">
        Configure which GitHub repos and Linear projects post updates to this
        channel. Use <code>*</code> to receive all updates.
      </p>

      {githubConnected && (
        <RoutingSection
          icon={<Github className="h-4 w-4" />}
          title="GitHub Repos"
          rules={routingRules.filter((r) => r.integrationType === "github")}
          emptyLabel="No GitHub repos routed to this channel."
          isAdding={adding === "github"}
          targetPlaceholder="owner/repo or *"
          addLabel="Add GitHub repo"
          target={target}
          label={label}
          onTargetChange={setTarget}
          onLabelChange={setLabel}
          onStartAdding={() => setAdding("github")}
          onAdd={handleAdd}
          onCancel={resetAdding}
          onRemove={handleRemove}
        />
      )}

      {linearConnected && (
        <RoutingSection
          icon={<LinearIcon className="h-4 w-4" />}
          title="Linear Projects"
          rules={routingRules.filter((r) => r.integrationType === "linear")}
          emptyLabel="No Linear projects routed to this channel."
          isAdding={adding === "linear"}
          targetPlaceholder="project-slug or *"
          addLabel="Add Linear project"
          target={target}
          label={label}
          onTargetChange={setTarget}
          onLabelChange={setLabel}
          onStartAdding={() => setAdding("linear")}
          onAdd={handleAdd}
          onCancel={resetAdding}
          onRemove={handleRemove}
        />
      )}

      {!githubConnected && !linearConnected && (
        <p className="text-xs text-muted-foreground">
          No integrations connected. Go to{" "}
          <strong>Settings &gt; Workspace</strong> to connect GitHub or Linear.
        </p>
      )}
    </div>
  );
}

interface RoutingSectionProps {
  icon: ReactNode;
  title: string;
  rules: Array<{
    _id: Id<"integrationRouting">;
    externalTarget: string;
    externalTargetLabel?: string;
  }>;
  emptyLabel: string;
  isAdding: boolean;
  targetPlaceholder: string;
  addLabel: string;
  target: string;
  label: string;
  onTargetChange: (val: string) => void;
  onLabelChange: (val: string) => void;
  onStartAdding: () => void;
  onAdd: () => void;
  onCancel: () => void;
  onRemove: (id: Id<"integrationRouting">) => void;
}

function RoutingSection({
  icon,
  title,
  rules,
  emptyLabel,
  isAdding,
  targetPlaceholder,
  addLabel,
  target,
  label,
  onTargetChange,
  onLabelChange,
  onStartAdding,
  onAdd,
  onCancel,
  onRemove,
}: RoutingSectionProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium">
        {icon}
        {title}
      </div>
      {rules.length === 0 && !isAdding && (
        <p className="text-xs text-muted-foreground">{emptyLabel}</p>
      )}
      <div className="space-y-1">
        {rules.map((rule) => (
          <div
            key={rule._id}
            className="flex items-center justify-between rounded border border-subtle px-3 py-1.5 text-sm"
          >
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs font-mono">
                {rule.externalTarget}
              </Badge>
              {rule.externalTargetLabel && (
                <span className="text-muted-foreground text-xs">
                  {rule.externalTargetLabel}
                </span>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => onRemove(rule._id)}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        ))}
      </div>
      {isAdding ? (
        <div className="flex items-center gap-2">
          <Input
            className="h-8 text-sm"
            placeholder={targetPlaceholder}
            value={target}
            onChange={(e) => onTargetChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onAdd();
              if (e.key === "Escape") onCancel();
            }}
            autoFocus
          />
          <Input
            className="h-8 text-sm"
            placeholder="Label (optional)"
            value={label}
            onChange={(e) => onLabelChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onAdd();
              if (e.key === "Escape") onCancel();
            }}
          />
          <Button size="sm" className="h-8" onClick={onAdd}>
            Add
          </Button>
          <Button size="sm" variant="ghost" className="h-8" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      ) : (
        <Button variant="outline" size="sm" onClick={onStartAdding}>
          <Plus className="mr-1 h-3 w-3" />
          {addLabel}
        </Button>
      )}
    </div>
  );
}
