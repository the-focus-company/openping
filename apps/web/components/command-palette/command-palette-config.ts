import type { Id } from "@convex/_generated/dataModel";
import {
  Inbox,
  Users,
  Bot,
  GitBranch,
  BarChart2,
  Shield,
  User,
  Building2,
  MessageSquare,
  Check,
  X,
  UserPlus,
  Clock,
  LayoutDashboard,
  Sparkles,
} from "lucide-react";

export const PAGES = [
  { label: "My Deck",         href: "/inbox",                     icon: Inbox,      shortcut: "G I" },
  { label: "Direct Messages", href: "/dms",                       icon: MessageSquare },
  { label: "Workspace",       href: "/settings/workspace",        icon: Building2 },
  { label: "Profile",         href: "/settings/profile",          icon: User },
  { label: "Team",            href: "/settings/team",             icon: Users },
  { label: "Agents",          href: "/settings/agents",           icon: Bot },
  { label: "Knowledge Graph", href: "/settings/knowledge-graph",  icon: GitBranch },
  { label: "Analytics",       href: "/settings/analytics",        icon: BarChart2 },
  { label: "Backoffice",      href: "/admin",                     icon: Shield },
];

export const DECISIONS = [
  { label: "Go to My Deck",         href: "/inbox", icon: LayoutDashboard },
  { label: "Approve Decision",      href: "/inbox", icon: Check,           shortcut: "Y" },
  { label: "Reject Decision",       href: "/inbox", icon: X,               shortcut: "N" },
  { label: "Delegate Decision",     href: "/inbox", icon: UserPlus,        shortcut: "⇧D" },
  { label: "Snooze Decision",       href: "/inbox", icon: Clock,           shortcut: "S" },
];

/** Icon/color mapping for managed agents by slug */
export const MANAGED_AGENT_STYLE: Record<string, { icon: typeof Sparkles; color: string }> = {
  "mr-ping": { icon: Sparkles, color: "text-violet-400" },
};
export const DEFAULT_AGENT_STYLE = { icon: Bot, color: "text-white/50" };

export type AgentPickerItem = {
  id: string;
  agentId: Id<"agents">;
  name: string;
  description: string;
  icon: typeof Sparkles;
  color: string;
};
