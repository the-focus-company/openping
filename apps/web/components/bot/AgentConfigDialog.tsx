"use client";

import { useState, useEffect } from "react";
import {
  Power, Key, Globe, Lock, Trash2,
  Wrench, ShieldCheck, Zap, CalendarClock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { Id } from "@convex/_generated/dataModel";
import { ChipGrid } from "./ChipGrid";
import {
  AGENT_TOOLS,
  AGENT_RESTRICTIONS,
  AGENT_TRIGGERS,
  AGENT_JOBS,
  AGENT_MODELS,
  AGENT_COLORS,
  type Agent,
  type AgentSaveData,
} from "./agent-config";

interface AgentConfigDialogProps {
  agent: Agent | null;
  mode: "edit" | "create";
  open: boolean;
  onClose: () => void;
  onSave?: (data: AgentSaveData) => void;
  onToggle?: (id: Id<"agents">, status: "active" | "inactive") => void;
  onGenerateToken?: (id: Id<"agents">) => void;
  onDelete?: (id: Id<"agents">) => void;
  isManaged?: boolean;
}

export function AgentConfigDialog({ agent, mode, open, onClose, onSave, onToggle, onGenerateToken, onDelete, isManaged }: AgentConfigDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [color, setColor] = useState(AGENT_COLORS[0]);
  const [model, setModel] = useState("gpt-5.4-nano");
  const [scope, setScope] = useState<"workspace" | "private">("workspace");
  const [tools, setTools] = useState<string[]>([]);
  const [restrictions, setRestrictions] = useState<string[]>([]);
  const [triggers, setTriggers] = useState<string[]>([]);
  const [jobs, setJobs] = useState<string[]>([]);

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
        setModel(agent.model || "gpt-5.4-nano");
        setScope(agent.scope || "workspace");
        setTools(agent.tools ?? []);
        setRestrictions(agent.restrictions ?? []);
        setTriggers(agent.triggers ?? []);
        setJobs(agent.jobs ?? []);
      } else {
        setName("");
        setDescription("");
        setSystemPrompt(
          "You are a helpful AI agent for the PING Platform. Answer questions concisely using the team's shared knowledge graph. Always cite sources.",
        );
        setColor(AGENT_COLORS[Math.floor(Math.random() * AGENT_COLORS.length)]);
        setModel("gpt-5.4-nano");
        setScope("workspace");
        setTools(["read_channels", "send_messages", "search_knowledge"]);
        setRestrictions(["no_external"]);
        setTriggers(["on_mention", "on_dm"]);
        setJobs([]);
      }
    }
  }, [open, mode, agent]);

  const toggle = (list: string[], setList: (v: string[]) => void, key: string) => {
    setList(list.includes(key) ? list.filter((k) => k !== key) : [...list, key]);
  };

  const handleSave = () => {
    if (!name.trim()) return;
    onSave?.({
      name: name.trim(),
      description: description.trim() || systemPrompt.slice(0, 120),
      systemPrompt,
      color,
      model,
      scope,
      tools,
      restrictions,
      triggers,
      jobs,
    });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="border-subtle bg-surface-2 sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold">
            {mode === "create" ? "Create agent" : `Configure ${agent?.name ?? ""}`}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          {/* ── Identity ─────────────────────────────────── */}
          <div className="space-y-3">
            <div>
              <label className="mb-1.5 block text-2xs font-medium uppercase tracking-widest text-foreground/40">
                Name
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. SalesBot"
                className="w-full rounded border border-subtle bg-background px-2.5 py-1.5 text-xs text-foreground placeholder:text-foreground/40 focus:border-ring focus:outline-none"
                autoFocus
                readOnly={isManaged}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-2xs font-medium uppercase tracking-widest text-foreground/40">
                Description
              </label>
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description of what this agent does"
                className="w-full rounded border border-subtle bg-background px-2.5 py-1.5 text-xs text-foreground placeholder:text-foreground/40 focus:border-ring focus:outline-none"
                readOnly={isManaged}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-2xs font-medium uppercase tracking-widest text-foreground/40">
                System Prompt
              </label>
              <textarea
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                rows={3}
                className="w-full resize-none rounded border border-subtle bg-surface-3 px-2.5 py-1.5 font-mono text-xs text-foreground placeholder:text-foreground/40 focus:border-ring focus:outline-none"
                readOnly={isManaged}
              />
            </div>
          </div>

          {/* ── Model & Scope ────────────────────────────── */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-2xs font-medium uppercase tracking-widest text-foreground/40">
                Model
              </label>
              <div className="space-y-1">
                {AGENT_MODELS.map((m) => (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => setModel(m.key)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded border px-2.5 py-1.5 text-left transition-colors",
                      model === m.key
                        ? "border-foreground/20 bg-surface-3"
                        : "border-subtle hover:border-foreground/10",
                    )}
                  >
                    <div
                      className={cn(
                        "h-2.5 w-2.5 shrink-0 rounded-full border",
                        model === m.key ? "border-ping-purple bg-ping-purple" : "border-foreground/20",
                      )}
                    />
                    <div>
                      <p className="text-xs font-medium text-foreground">{m.label}</p>
                      <p className="text-2xs text-foreground/50">{m.description}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-2xs font-medium uppercase tracking-widest text-foreground/40">
                Scope
              </label>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => setScope("workspace")}
                  className={cn(
                    "flex flex-1 items-center justify-center gap-1.5 rounded border px-2 py-1.5 text-xs transition-colors",
                    scope === "workspace"
                      ? "border-foreground/20 bg-surface-3 text-foreground"
                      : "border-subtle text-foreground/40 hover:border-foreground/15",
                  )}
                >
                  <Globe className="h-3 w-3" />
                  Team
                </button>
                <button
                  type="button"
                  onClick={() => setScope("private")}
                  className={cn(
                    "flex flex-1 items-center justify-center gap-1.5 rounded border px-2 py-1.5 text-xs transition-colors",
                    scope === "private"
                      ? "border-foreground/20 bg-surface-3 text-foreground"
                      : "border-subtle text-foreground/40 hover:border-foreground/15",
                  )}
                >
                  <Lock className="h-3 w-3" />
                  Private
                </button>
              </div>
              {/* Color */}
              <label className="mt-3 mb-1.5 block text-2xs font-medium uppercase tracking-widest text-foreground/40">
                Color
              </label>
              <div className="flex gap-2">
                {AGENT_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={cn(
                      "h-5 w-5 rounded-full border-2 transition-all",
                      color === c ? "border-foreground scale-110" : "border-transparent hover:border-foreground/30",
                    )}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* ── Tools ────────────────────────────────────── */}
          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-2xs font-medium uppercase tracking-widest text-foreground/40">
              <Wrench className="h-3 w-3 text-blue-400" />
              Tools
            </label>
            <ChipGrid
              options={AGENT_TOOLS}
              selected={tools}
              onToggle={(k) => toggle(tools, setTools, k)}
              accentColor="#3B82F6"
            />
          </div>

          {/* ── Triggers ─────────────────────────────────── */}
          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-2xs font-medium uppercase tracking-widest text-foreground/40">
              <Zap className="h-3 w-3 text-amber-400" />
              Triggers
            </label>
            <ChipGrid
              options={AGENT_TRIGGERS}
              selected={triggers}
              onToggle={(k) => toggle(triggers, setTriggers, k)}
              accentColor="#F59E0B"
            />
          </div>

          {/* ── Jobs ─────────────────────────────────────── */}
          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-2xs font-medium uppercase tracking-widest text-foreground/40">
              <CalendarClock className="h-3 w-3 text-green-400" />
              Scheduled Jobs
            </label>
            <ChipGrid
              options={AGENT_JOBS}
              selected={jobs}
              onToggle={(k) => toggle(jobs, setJobs, k)}
              accentColor="#22C55E"
            />
          </div>

          {/* ── Restrictions ─────────────────────────────── */}
          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-2xs font-medium uppercase tracking-widest text-foreground/40">
              <ShieldCheck className="h-3 w-3 text-red-400" />
              Restrictions
            </label>
            <ChipGrid
              options={AGENT_RESTRICTIONS}
              selected={restrictions}
              onToggle={(k) => toggle(restrictions, setRestrictions, k)}
              accentColor="#EF4444"
            />
          </div>

          {/* ── Danger zone (edit only) ─────────────────── */}
          {mode === "edit" && agent && (
            <div className="space-y-2 border-t border-red-500/10 pt-4">
              <label className="mb-1.5 flex items-center gap-1.5 text-2xs font-medium uppercase tracking-widest text-red-400/60">
                Danger zone
              </label>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1.5 border-subtle text-xs text-foreground/60 hover:border-foreground/15"
                  onClick={() => onGenerateToken?.(agent._id)}
                >
                  <Key className="h-3 w-3" />
                  Generate token
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1.5 border-subtle text-xs text-foreground/60 hover:border-foreground/15"
                  onClick={() => {
                    onToggle?.(agent._id, agent.status === "active" ? "inactive" : "active");
                    onClose();
                  }}
                >
                  <Power className="h-3 w-3" />
                  {agent.status === "active" ? "Disable agent" : "Enable agent"}
                </Button>
                {onDelete && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 gap-1.5 border-red-500/20 text-xs text-red-400 hover:bg-red-500/10 hover:border-red-500/30"
                    onClick={() => {
                      onDelete(agent._id);
                      onClose();
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                    Delete agent
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* ── Save ─────────────────────────────────────── */}
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
