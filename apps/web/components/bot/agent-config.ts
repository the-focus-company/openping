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

export const AGENT_COLORS = ["#5E6AD2", "#22C55E", "#F59E0B", "#EF4444", "#A855F7", "#3B82F6"];

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
