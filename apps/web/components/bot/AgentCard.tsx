"use client";

import { useState, useEffect } from "react";
import { Settings, Power, Bot, Key } from "lucide-react";
import { StatusDot } from "@/components/ui/status-dot";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { Id } from "@convex/_generated/dataModel";

export interface Agent {
  _id: Id<"agents">;
  _creationTime: number;
  name: string;
  description?: string;
  status: "active" | "inactive" | "revoked";
  color?: string;
  systemPrompt?: string;
  lastActiveAt?: number;
  createdBy: Id<"users">;
  agentUserName?: string;
  agentUserEmail?: string;
}

interface AgentCardProps {
  agent: Agent;
  onToggle?: (id: Id<"agents">, status: "active" | "inactive") => void;
  onConfigure?: (id: Id<"agents">) => void;
  onGenerateToken?: (id: Id<"agents">) => void;
}

export function AgentCard({ agent, onToggle, onConfigure, onGenerateToken }: AgentCardProps) {
  const isActive = agent.status === "active";
  const color = agent.color || "#5E6AD2";

  return (
    <div
      className={cn(
        "group flex flex-col rounded border border-subtle bg-surface-1 p-4",
        "transition-all duration-150 hover:border-foreground/10 hover:bg-surface-2",
        agent.status === "revoked" && "opacity-50"
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
            style={{ backgroundColor: `${color}20`, border: `1px solid ${color}30` }}
          >
            <Bot className="h-4 w-4" style={{ color }} />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">{agent.name}</p>
            <div className="flex items-center gap-1.5">
              <StatusDot variant={isActive ? "online" : "offline"} size="xs" />
              <span className="text-2xs text-muted-foreground">
                {agent.status === "revoked" ? "Revoked" : isActive ? "Active" : "Inactive"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Description */}
      {agent.description && (
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground line-clamp-2">
          {agent.description}
        </p>
      )}

      {/* Footer */}
      {agent.status !== "revoked" && (
        <div className="mt-4 flex items-center justify-between border-t border-subtle pt-3">
          <span className="text-2xs text-muted-foreground">
            {agent.lastActiveAt
              ? `Last active ${new Date(agent.lastActiveAt).toLocaleDateString()}`
              : "Never connected"}
          </span>
          <div className="flex items-center gap-1.5">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 gap-1 px-2 text-2xs text-muted-foreground hover:text-foreground"
              onClick={() => onGenerateToken?.(agent._id)}
            >
              <Key className="h-2.5 w-2.5" />
              Token
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 gap-1 px-2 text-2xs text-muted-foreground hover:text-foreground"
              onClick={() => onToggle?.(agent._id, isActive ? "inactive" : "active")}
            >
              <Power className="h-2.5 w-2.5" />
              {isActive ? "Disable" : "Enable"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-6 gap-1 border-subtle px-2 text-2xs hover:border-foreground/15"
              onClick={() => onConfigure?.(agent._id)}
            >
              <Settings className="h-2.5 w-2.5" />
              Configure
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

const AGENT_COLORS = ["#5E6AD2", "#22C55E", "#F59E0B", "#EF4444", "#A855F7", "#3B82F6"];

interface AgentConfigDialogProps {
  agent: Agent | null;
  mode: "edit" | "create";
  open: boolean;
  onClose: () => void;
  onSave?: (data: {
    name: string;
    description: string;
    systemPrompt: string;
    color: string;
  }) => void;
}

export function AgentConfigDialog({ agent, mode, open, onClose, onSave }: AgentConfigDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [color, setColor] = useState(AGENT_COLORS[0]);

  useEffect(() => {
    if (open) {
      if (mode === "edit" && agent) {
        setName(agent.name);
        setDescription(agent.description || "");
        setSystemPrompt(
          agent.systemPrompt ||
            `You are ${agent.name}, a helpful AI agent for the PING Platform. Answer questions concisely using the team's shared knowledge graph. Always cite sources.`,
        );
        setColor(agent.color || AGENT_COLORS[0]);
      } else {
        setName("");
        setDescription("");
        setSystemPrompt(
          "You are a helpful AI agent for the PING Platform. Answer questions concisely using the team's shared knowledge graph. Always cite sources.",
        );
        setColor(AGENT_COLORS[Math.floor(Math.random() * AGENT_COLORS.length)]);
      }
    }
  }, [open, mode, agent]);

  const handleSave = () => {
    if (!name.trim()) return;
    onSave?.({
      name: name.trim(),
      description: description.trim() || systemPrompt.slice(0, 120),
      systemPrompt,
      color,
    });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="border-subtle bg-surface-2 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold">
            {mode === "create" ? "Create agent" : `Configure ${agent?.name ?? ""}`}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Name */}
          <div>
            <label className="mb-1.5 block text-2xs font-medium uppercase tracking-widest text-foreground/40">
              Name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. KnowledgeBot"
              className="w-full rounded border border-subtle bg-surface-3 px-2.5 py-1.5 text-xs text-foreground placeholder:text-foreground/25 focus:border-foreground/20 focus:outline-none"
              autoFocus
            />
          </div>

          {/* Description */}
          <div>
            <label className="mb-1.5 block text-2xs font-medium uppercase tracking-widest text-white/40">
              Description
            </label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of what this agent does"
              className="w-full rounded border border-subtle bg-surface-3 px-2.5 py-1.5 text-xs text-foreground placeholder:text-white/25 focus:border-white/20 focus:outline-none"
            />
          </div>

          {/* System prompt */}
          <div>
            <label className="mb-1.5 block text-2xs font-medium uppercase tracking-widest text-foreground/40">
              System Prompt
            </label>
            <textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              rows={4}
              className="w-full resize-none rounded border border-subtle bg-surface-3 px-2.5 py-1.5 font-mono text-xs text-foreground placeholder:text-foreground/25 focus:border-foreground/20 focus:outline-none"
            />
          </div>

          {/* Color */}
          <div>
            <label className="mb-1.5 block text-2xs font-medium uppercase tracking-widest text-foreground/40">
              Color
            </label>
            <div className="flex gap-2">
              {AGENT_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={cn(
                    "h-6 w-6 rounded-full border-2 transition-all",
                    color === c ? "border-foreground scale-110" : "border-transparent hover:border-foreground/30",
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          {/* Save */}
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" size="sm" onClick={onClose} className="h-7 text-xs">
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={!name.trim()}
              className="h-7 bg-ping-purple text-xs text-white hover:bg-ping-purple-hover disabled:opacity-40"
              onClick={handleSave}
            >
              {mode === "create" ? "Create agent" : "Save changes"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
