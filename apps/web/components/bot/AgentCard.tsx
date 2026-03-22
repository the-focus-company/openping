"use client";

import { useState, useEffect } from "react";
import {
  Settings, Power, Bot, Key, Globe, Lock, Trash2,
  Wrench, ShieldCheck, Zap, CalendarClock, Check,
} from "lucide-react";
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

// ── Preconfigured options ───────────────────────────────────────────

export const AGENT_TOOLS = [
  { key: "read_channels", label: "Read channels", description: "Read messages from workspace channels" },
  { key: "send_messages", label: "Send messages", description: "Post messages in channels and DMs" },
  { key: "search_knowledge", label: "Knowledge graph", description: "Search the team's knowledge graph for context" },
  { key: "linear_tickets", label: "Linear tickets", description: "Read and create Linear tickets" },
  { key: "github_prs", label: "GitHub PRs", description: "Read pull request status and details" },
  { key: "summarize", label: "Summarize", description: "Generate conversation and channel summaries" },
  { key: "draft_responses", label: "Draft responses", description: "Suggest reply drafts for team members" },
  { key: "web_search", label: "Web search", description: "Search the web for up-to-date information" },
] as const;

export const AGENT_RESTRICTIONS = [
  { key: "no_external", label: "No external channels", description: "Cannot send to channels it's not assigned to" },
  { key: "no_private", label: "No private channels", description: "Cannot access private or DM channels" },
  { key: "read_only", label: "Read-only mode", description: "Can read but cannot send any messages" },
  { key: "no_mentions", label: "No @everyone", description: "Cannot use @channel or @everyone mentions" },
  { key: "rate_limit", label: "Rate limited", description: "Max 20 messages per hour" },
] as const;

export const AGENT_TRIGGERS = [
  { key: "on_mention", label: "When @mentioned", description: "Activates when someone mentions the agent" },
  { key: "on_dm", label: "When DM'd", description: "Responds to direct messages" },
  { key: "on_aided_always", label: "Aided: always reply", description: "Responds to every message in aided group chats" },
  { key: "on_aided_smart", label: "Aided: smart reply", description: "Only replies when the agent's input seems needed" },
  { key: "on_channel_message", label: "New channel message", description: "Reacts to new messages in assigned channels" },
  { key: "on_keyword", label: "Keyword match", description: "Triggers when specific keywords appear" },
  { key: "on_integration", label: "Integration event", description: "Triggers on new PR, ticket, or deploy" },
] as const;

export const AGENT_JOBS = [
  { key: "daily_summary", label: "Daily channel digest", description: "Posts a summary of channel activity each morning" },
  { key: "weekly_report", label: "Weekly sprint report", description: "Generates a weekly progress report" },
  { key: "triage_inbox", label: "Triage incoming", description: "Classifies and routes incoming messages" },
  { key: "unanswered_scan", label: "Unanswered questions", description: "Flags questions left unanswered for 2+ hours" },
  { key: "standup_reminder", label: "Standup reminder", description: "Reminds team to post async standup updates" },
] as const;

export const AGENT_MODELS = [
  { key: "gpt-5.4-nano", label: "GPT-5.4 Nano", description: "Fast, low-cost — best for simple tasks" },
  { key: "gpt-5.4", label: "GPT-5.4", description: "Most capable — best for complex reasoning" },
] as const;

const AGENT_COLORS = ["#5E6AD2", "#22C55E", "#F59E0B", "#EF4444", "#A855F7", "#3B82F6"];

// ── Types ───────────────────────────────────────────────────────────

export interface Agent {
  _id: Id<"agents">;
  _creationTime: number;
  name: string;
  description?: string;
  status: "active" | "inactive" | "revoked";
  color?: string;
  systemPrompt?: string;
  model?: string;
  scope?: "workspace" | "private";
  tools?: string[];
  restrictions?: string[];
  triggers?: string[];
  jobs?: string[];
  lastActiveAt?: number;
  createdBy: Id<"users">;
  agentUserId?: Id<"users">;
  agentUserName?: string;
  agentUserEmail?: string;
  agentUserAvatarUrl?: string;
  isManaged?: boolean;
  managedSlug?: string;
}

export interface AgentSaveData {
  name: string;
  description: string;
  systemPrompt: string;
  color: string;
  model?: string;
  scope?: "workspace" | "private";
  tools?: string[];
  restrictions?: string[];
  triggers?: string[];
  jobs?: string[];
}

// ── AgentCard ───────────────────────────────────────────────────────

interface AgentCardProps {
  agent: Agent;
  isManaged?: boolean;
  onConfigure?: (id: Id<"agents">) => void;
}

export function AgentCard({ agent, isManaged, onConfigure }: AgentCardProps) {
  const isActive = agent.status === "active";
  const color = agent.color || "#5E6AD2";
  const toolCount = (agent.tools?.length ?? 0);
  const triggerCount = (agent.triggers?.length ?? 0);
  const jobCount = (agent.jobs?.length ?? 0);
  const capsuleCount = toolCount + triggerCount + jobCount;

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
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
            style={{ backgroundColor: `${color}20`, border: `1px solid ${color}30` }}
          >
            <Bot className="h-4 w-4" style={{ color }} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-medium text-foreground truncate">{agent.name}</p>
              {isManaged && (
                <span className="shrink-0 rounded border border-violet-500/20 bg-violet-500/10 px-1.5 py-px text-[10px] font-medium text-violet-400">
                  Platform
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <StatusDot variant={isActive ? "online" : "offline"} size="xs" />
              <span className="text-2xs text-muted-foreground">
                {agent.status === "revoked" ? "Revoked" : isActive ? "Active" : "Inactive"}
              </span>
              {agent.scope && (
                <>
                  <span className="text-foreground/45">·</span>
                  {agent.scope === "workspace" ? (
                    <Globe className="h-2.5 w-2.5 text-foreground/45" />
                  ) : (
                    <Lock className="h-2.5 w-2.5 text-foreground/45" />
                  )}
                </>
              )}
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

      {/* Capability pills */}
      {capsuleCount > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {agent.model && (
            <span className="inline-flex items-center rounded bg-surface-3 px-1.5 py-0.5 text-2xs text-foreground/40 font-mono">
              {agent.model}
            </span>
          )}
          {toolCount > 0 && (
            <span className="inline-flex items-center gap-0.5 rounded bg-blue-500/10 px-1.5 py-0.5 text-2xs text-blue-400">
              <Wrench className="h-2.5 w-2.5" />{toolCount} tool{toolCount !== 1 ? "s" : ""}
            </span>
          )}
          {triggerCount > 0 && (
            <span className="inline-flex items-center gap-0.5 rounded bg-amber-500/10 px-1.5 py-0.5 text-2xs text-amber-400">
              <Zap className="h-2.5 w-2.5" />{triggerCount} trigger{triggerCount !== 1 ? "s" : ""}
            </span>
          )}
          {jobCount > 0 && (
            <span className="inline-flex items-center gap-0.5 rounded bg-green-500/10 px-1.5 py-0.5 text-2xs text-green-400">
              <CalendarClock className="h-2.5 w-2.5" />{jobCount} job{jobCount !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      )}

      {/* Footer */}
      {agent.status !== "revoked" && (
        <div className="mt-auto pt-3">
          <div className="flex items-center justify-between border-t border-subtle pt-3">
            <span className="text-2xs text-muted-foreground shrink-0">
              {agent.lastActiveAt
                ? `Active ${new Date(agent.lastActiveAt).toLocaleDateString()}`
                : "Never connected"}
            </span>
            <Button
              variant="outline"
              size="sm"
              className="h-6 gap-1 border-subtle px-1.5 text-2xs hover:border-foreground/15"
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

// ── Toggle Chip Grid ────────────────────────────────────────────────

function ChipGrid({
  options,
  selected,
  onToggle,
  accentColor,
}: {
  options: ReadonlyArray<{ key: string; label: string; description: string }>;
  selected: string[];
  onToggle: (key: string) => void;
  accentColor: string;
}) {
  return (
    <div className="grid grid-cols-2 gap-1.5">
      {options.map((opt) => {
        const active = selected.includes(opt.key);
        return (
          <button
            key={opt.key}
            type="button"
            onClick={() => onToggle(opt.key)}
            className={cn(
              "flex items-start gap-2 rounded border px-2.5 py-2 text-left transition-colors",
              active
                ? "border-foreground/15 bg-surface-3"
                : "border-subtle hover:border-foreground/10",
            )}
          >
            <div
              className={cn(
                "mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-sm border transition-colors",
                active ? `border-transparent` : "border-foreground/20",
              )}
              style={active ? { backgroundColor: accentColor } : undefined}
            >
              {active && <Check className="h-2.5 w-2.5 text-white" />}
            </div>
            <div className="min-w-0">
              <p className={cn("text-xs font-medium truncate", active ? "text-foreground" : "text-foreground/60")}>
                {opt.label}
              </p>
              <p className="text-2xs text-foreground/50 line-clamp-1">{opt.description}</p>
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ── AgentConfigDialog ───────────────────────────────────────────────

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
