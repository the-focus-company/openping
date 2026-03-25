"use client";

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { useConvexAuth } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import {
  Inbox,
  Hash,
  Users,
  Bot,
  GitBranch,
  BarChart2,
  Shield,
  PanelLeftClose,
  User,
  Building2,
  MessageSquare,
  Check,
  X,
  UserPlus,
  Clock,
  LayoutDashboard,
  ArrowRight,
  Loader2,
  AlertCircle,
  Sparkles,
  ChevronRight,
  CornerDownLeft,
} from "lucide-react";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
} from "@/components/ui/command";
import { UserProfileDialog } from "@/components/user/UserProfileDialog";

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onToggleSidebar?: () => void;
}

const PAGES = [
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

const DECISIONS = [
  { label: "Go to My Deck",         href: "/inbox", icon: LayoutDashboard },
  { label: "Approve Decision",      href: "/inbox", icon: Check,           shortcut: "Y" },
  { label: "Reject Decision",       href: "/inbox", icon: X,               shortcut: "N" },
  { label: "Delegate Decision",     href: "/inbox", icon: UserPlus,        shortcut: "⇧D" },
  { label: "Snooze Decision",       href: "/inbox", icon: Clock,           shortcut: "S" },
];

/** Icon/color mapping for managed agents by slug */
const MANAGED_AGENT_STYLE: Record<string, { icon: typeof Sparkles; color: string }> = {
  "mr-ping": { icon: Sparkles, color: "text-violet-400" },
};
const DEFAULT_AGENT_STYLE = { icon: Bot, color: "text-white/70" };

type AgentPickerItem = {
  id: string;
  agentId: Id<"agents">;
  name: string;
  description: string;
  icon: typeof Sparkles;
  color: string;
};

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

function SkeletonRow() {
  return (
    <div className="flex items-center gap-2 px-2.5 py-1.5">
      <div className="h-4 w-4 rounded bg-white/[0.06] animate-pulse" />
      <div className="h-3 flex-1 rounded bg-white/[0.06] animate-pulse" />
    </div>
  );
}

function SkeletonGroup({ heading, rows = 3 }: { heading: string; rows?: number }) {
  return (
    <div className="overflow-hidden p-1">
      <div className="px-3 py-1.5 text-[11px] font-medium uppercase tracking-wider text-white/50">
        {heading}
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonRow key={i} />
      ))}
    </div>
  );
}

function truncate(text: string, maxLen = 80): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen).trimEnd() + "…";
}

function timeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function CommandPalette({ open, onOpenChange, onToggleSidebar }: CommandPaletteProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [search, setSearch] = useState("");
  const { isAuthenticated } = useConvexAuth();
  const inputRef = useRef<HTMLInputElement>(null);

  const debouncedSearch = useDebouncedValue(search, 250);
  const hasSearch = debouncedSearch.trim().length >= 2;

  const workspaceSlug = pathname.match(/^\/app\/([^/]+)/)?.[1];
  const workspacePrefix = workspaceSlug ? `/app/${workspaceSlug}` : "";
  const workspace = useQuery(api.workspaces.getBySlug, isAuthenticated && workspaceSlug ? { slug: workspaceSlug } : "skip");
  const workspaceId = workspace?._id as Id<"workspaces"> | undefined;

  const channels = useQuery(api.channels.list, isAuthenticated && workspaceId ? { workspaceId } : "skip");
  const dmConversations = useQuery(api.directConversations.list, isAuthenticated ? {} : "skip");
  const currentUser = useQuery(api.users.getMe, isAuthenticated ? {} : "skip");

  // Fetch managed agents from DB
  const managedAgentsRaw = useQuery(
    api.managedAgents.listManaged,
    isAuthenticated && workspaceId ? { workspaceId } : "skip",
  );
  const managedAgents: AgentPickerItem[] = useMemo(() => {
    if (!managedAgentsRaw) return [];
    return managedAgentsRaw.map((a) => {
      const style = (a.managedSlug && MANAGED_AGENT_STYLE[a.managedSlug]) || DEFAULT_AGENT_STYLE;
      return {
        id: a._id,
        agentId: a._id,
        name: a.name,
        description: a.description ?? "AI agent",
        icon: style.icon,
        color: style.color,
      };
    });
  }, [managedAgentsRaw]);

  const peopleResults = useQuery(
    api.search.searchPeople,
    isAuthenticated && workspaceId && hasSearch
      ? { workspaceId, query: debouncedSearch.trim() }
      : "skip",
  );
  const messageResults = useQuery(
    api.search.searchMessages,
    isAuthenticated && workspaceId && hasSearch
      ? { workspaceId, query: debouncedSearch.trim() }
      : "skip",
  );
  const dmResults = useQuery(
    api.search.searchDirectMessages,
    isAuthenticated && hasSearch
      ? { query: debouncedSearch.trim() }
      : "skip",
  );

  const isSearching = hasSearch && (peopleResults === undefined || messageResults === undefined || dmResults === undefined);

  // Agent mention state
  const [selectedAgent, setSelectedAgent] = useState<AgentPickerItem | null>(null);
  const [quickChatId, setQuickChatId] = useState<Id<"quickChats"> | null>(null);
  const quickChat = useQuery(api.quickChat.get, quickChatId ? { quickChatId } : "skip");
  const sendQuickChat = useMutation(api.quickChat.send);

  // Detect @mention mode: either selecting an agent or already have one selected
  const isAtMode = search.startsWith("@");
  const isAgentPickerMode = isAtMode && !selectedAgent;
  const isChatMode = isAtMode && selectedAgent !== null;

  // Filter agents by what's typed after @
  const agentFilter = isAgentPickerMode ? search.slice(1).toLowerCase().trim() : "";
  const filteredAgents = managedAgents.filter(
    (a) => !agentFilter || a.name.toLowerCase().includes(agentFilter) || a.description.toLowerCase().includes(agentFilter),
  );

  const handleAgentSelect = useCallback((agent: AgentPickerItem) => {
    setSelectedAgent(agent);
    setSearch("@");
    // Focus back on input after selection
    setTimeout(() => inputRef.current?.focus(), 0);
  }, []);

  const handleQuickChatSubmit = useCallback(async () => {
    if (!workspaceId || !selectedAgent) return;
    const query = search.replace(/^@\s*/, "").trim();
    if (!query) return;
    const id = await sendQuickChat({
      workspaceId,
      query,
      agentId: selectedAgent.agentId,
    });
    setQuickChatId(id);
  }, [workspaceId, search, sendQuickChat, selectedAgent]);

  // Reset state when closed
  useEffect(() => {
    if (!open) {
      setSearch("");
      setQuickChatId(null);
      setSelectedAgent(null);
    }
  }, [open]);

  // Clear agent if user deletes the @ prefix
  useEffect(() => {
    if (!isAtMode && selectedAgent) {
      setSelectedAgent(null);
      setQuickChatId(null);
    }
  }, [isAtMode, selectedAgent]);

  const navigate = (href: string) => {
    const fullHref = href.startsWith("/admin") ? href : `${workspacePrefix}${href}`;
    router.push(fullHref);
    onOpenChange(false);
  };

  const allMessageResults = useMemo(() => {
    const msgs: Array<{
      _id: string;
      body: string;
      authorName: string;
      _creationTime: number;
      href: string;
      context: string;
    }> = [];

    if (messageResults) {
      for (const m of messageResults) {
        msgs.push({
          _id: m._id,
          body: m.body,
          authorName: m.authorName,
          _creationTime: m._creationTime,
          href: `/channel/${m.channelId}`,
          context: m.channelName ? `#${m.channelName}` : "channel",
        });
      }
    }

    if (dmResults) {
      for (const m of dmResults) {
        msgs.push({
          _id: m._id,
          body: m.body,
          authorName: m.authorName,
          _creationTime: m._creationTime,
          href: `/dm/${m.conversationId}`,
          context: m.conversationName || "DM",
        });
      }
    }

    msgs.sort((a, b) => b._creationTime - a._creationTime);
    return msgs.slice(0, 15);
  }, [messageResults, dmResults]);

  const showSearchResults = hasSearch && !isAtMode;
  const hasAnyResults = (peopleResults && peopleResults.length > 0) || allMessageResults.length > 0;

  const [profileUserId, setProfileUserId] = useState<Id<"users"> | null>(null);

  const openProfile = useCallback((userId: string) => {
    onOpenChange(false);
    setTimeout(() => setProfileUserId(userId as Id<"users">), 150);
  }, [onOpenChange]);

  useEffect(() => {
    if (open) setProfileUserId(null);
  }, [open]);

  return (
    <>
    <CommandDialog open={open} onOpenChange={onOpenChange} shouldFilter={isAtMode ? false : undefined}>
      <CommandInput
        ref={inputRef}
        placeholder={
          isChatMode
            ? `Ask ${selectedAgent?.name}...`
            : isAgentPickerMode
              ? "Choose an agent..."
              : "Search or type @ to chat with an agent..."
        }
        value={search}
        onValueChange={(v) => {
          setSearch(v);
          if (!v.startsWith("@")) {
            setQuickChatId(null);
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && isChatMode && !quickChatId) {
            e.preventDefault();
            e.stopPropagation();
            handleQuickChatSubmit();
          }
          if (e.key === "Backspace" && isChatMode && search === "@") {
            e.preventDefault();
            setSelectedAgent(null);
            setSearch("");
            setQuickChatId(null);
          }
        }}
        leading={
          selectedAgent ? (
            <button
              type="button"
              onClick={() => { setSelectedAgent(null); setSearch(""); setQuickChatId(null); }}
              className="flex shrink-0 items-center gap-1.5 rounded-md bg-white/[0.07] px-2 py-0.5 text-[12px] font-medium text-white/70 hover:bg-white/[0.12] transition-colors"
            >
              <selectedAgent.icon className={`h-3 w-3 ${selectedAgent.color}`} />
              {selectedAgent.name}
              <X className="h-2.5 w-2.5 text-white/30" />
            </button>
          ) : isAtMode ? (
            <Bot className="shrink-0 h-4 w-4 text-violet-400/60" />
          ) : undefined
        }
        trailing={
          isChatMode && !quickChatId && search.length > 1 ? (
            <button
              type="button"
              onClick={handleQuickChatSubmit}
              className="shrink-0 flex items-center gap-1 rounded-md bg-violet-500/20 px-2 py-1 text-[11px] font-medium text-violet-300 hover:bg-violet-500/30 transition-colors"
            >
              <CornerDownLeft className="h-3 w-3" />
            </button>
          ) : undefined
        }
      />

      <div className="h-[min(360px,50vh)]">
        {isAgentPickerMode ? (
          // ── Agent picker ──
          <div className="p-1.5">
            <div className="px-3 py-1.5 text-[11px] font-medium uppercase tracking-wider text-white/50">
              Agents
            </div>
            {filteredAgents.map((agent) => (
              <button
                key={agent.id}
                type="button"
                onClick={() => handleAgentSelect(agent)}
                className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left hover:bg-white/[0.07] transition-colors group"
              >
                <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/[0.06] ${agent.color}`}>
                  <agent.icon className="h-3.5 w-3.5" />
                </div>
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="text-[13px] font-medium text-white/90 group-hover:text-white">{agent.name}</span>
                  <span className="text-[11px] text-white/50">{agent.description}</span>
                </div>
                <ChevronRight className="h-3 w-3 text-white/30 group-hover:text-white/50 transition-colors" />
              </button>
            ))}
            {filteredAgents.length === 0 && (
              <div className="px-3 py-6 text-center text-[13px] text-white/50">
                No matching agents
              </div>
            )}
          </div>
        ) : isChatMode ? (
          // ── Chat with agent ──
          <div className="flex h-full flex-col p-3">
            {!quickChatId ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.05] ${selectedAgent?.color}`}>
                  {selectedAgent && <selectedAgent.icon className="h-5 w-5" />}
                </div>
                <p className="text-[13px] text-white/60">
                  Type your message and press{" "}
                  <kbd className="rounded border border-white/10 bg-white/[0.05] px-1.5 py-0.5 text-[11px] font-medium text-white/70">↵</kbd>
                </p>
              </div>
            ) : quickChat?.status === "pending" ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-violet-400" />
                <p className="text-[12px] text-white/50">Thinking...</p>
              </div>
            ) : quickChat?.status === "error" ? (
              <div className="flex flex-col gap-2">
                <div className="flex items-start gap-2 rounded-lg bg-red-500/10 border border-red-500/20 p-3">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0 text-red-400 mt-0.5" />
                  <p className="text-[13px] text-red-300/80">{quickChat.response}</p>
                </div>
              </div>
            ) : quickChat?.status === "done" ? (
              <div className="flex flex-col gap-2 overflow-y-auto">
                <div className="flex items-start gap-2.5">
                  <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-white/[0.06] mt-0.5 ${selectedAgent?.color}`}>
                    {selectedAgent && <selectedAgent.icon className="h-3 w-3" />}
                  </div>
                  <p className="text-[13px] text-white/70 leading-relaxed whitespace-pre-wrap">{quickChat.response}</p>
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          <CommandList className="h-full max-h-full">
            {showSearchResults ? (
              <>
                {isSearching ? (
                  <div className="py-1">
                    <SkeletonGroup heading="People" rows={2} />
                    <SkeletonGroup heading="Messages" rows={3} />
                  </div>
                ) : !hasAnyResults ? (
                  <CommandEmpty>
                    <span className="text-white/50">No results for &ldquo;{debouncedSearch}&rdquo;</span>
                  </CommandEmpty>
                ) : (
                  <>
                    {peopleResults && peopleResults.length > 0 && (
                      <CommandGroup heading="People">
                        {peopleResults.map((person) => {
                          const existingDm = dmConversations?.find(
                            (c) =>
                              c.kind === "1to1" &&
                              c.members.some((m) => m.userId === person._id),
                          );
                          return (
                            <CommandItem
                              key={person._id}
                              value={`person-${person.name}-${person.email}`}
                              onSelect={() => openProfile(person._id)}
                            >
                              {person.avatarUrl ? (
                                <img
                                  src={person.avatarUrl}
                                  alt=""
                                  className="h-5 w-5 rounded-full object-cover"
                                />
                              ) : (
                                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-white/[0.07]">
                                  <User className="h-3 w-3 text-white/60" />
                                </div>
                              )}
                              <div className="flex flex-col min-w-0 flex-1">
                                <span className="truncate text-[13px] text-white/90">{person.name}</span>
                                <span className="truncate text-[11px] text-white/50">
                                  {person.email}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 ml-auto shrink-0">
                                {person.presenceStatus === "online" && (
                                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                                )}
                                {existingDm && (
                                  <button
                                    type="button"
                                    className="rounded-md p-1 text-white/20 hover:bg-white/[0.07] hover:text-white/50 transition-colors"
                                    title="Go to conversation"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      navigate(`/dm/${existingDm._id}`);
                                    }}
                                  >
                                    <MessageSquare className="h-3 w-3" />
                                  </button>
                                )}
                              </div>
                            </CommandItem>
                          );
                        })}
                      </CommandGroup>
                    )}

                    {allMessageResults.length > 0 && (
                      <CommandGroup heading="Messages">
                        {allMessageResults.map((msg) => (
                          <CommandItem
                            key={msg._id}
                            value={`msg-${msg._id}-${msg.body.slice(0, 30)}`}
                            onSelect={() => navigate(`${msg.href}?msg=${msg._id}`)}
                          >
                            <MessageSquare className="h-3.5 w-3.5 text-white/40 shrink-0" />
                            <div className="flex flex-col min-w-0 flex-1">
                              <span className="truncate text-[13px] text-white/90">
                                {truncate(msg.body)}
                              </span>
                              <span className="truncate text-[11px] text-white/50">
                                {msg.authorName} in {msg.context} · {timeAgo(msg._creationTime)}
                              </span>
                            </div>
                            <ArrowRight className="h-3 w-3 text-white/20 shrink-0" />
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    )}
                  </>
                )}
              </>
            ) : (
              <>
                <CommandEmpty>
                  <span className="text-white/50">No results found.</span>
                </CommandEmpty>

                <CommandGroup heading="Pages">
                  {PAGES.map(({ label, href, icon: Icon, shortcut }) => (
                    <CommandItem key={href} onSelect={() => navigate(href)}>
                      <Icon className="h-3.5 w-3.5 text-white/40" />
                      <span className="text-white/90">{label}</span>
                      {shortcut && <CommandShortcut className="text-[12px] text-white/40">{shortcut}</CommandShortcut>}
                    </CommandItem>
                  ))}
                </CommandGroup>

                {channels && channels.length > 0 && (
                  <CommandGroup heading="Channels">
                    {channels.map((channel) => (
                      <CommandItem
                        key={channel._id}
                        onSelect={() => navigate(`/channel/${channel._id}`)}
                      >
                        <Hash className="h-3.5 w-3.5 text-white/40" />
                        <span className="text-white/90">{channel.name}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}

                {dmConversations && dmConversations.length > 0 && (
                  <CommandGroup heading="Conversations">
                    {dmConversations.slice(0, 5).map((conv) => {
                      const otherMembers = conv.members.filter(
                        (m) => m.userId !== currentUser?._id,
                      );
                      const displayName =
                        conv.name ||
                        otherMembers.map((m) => m.name).join(", ") ||
                        "DM";
                      const isAgent =
                        conv.kind === "agent_1to1" || conv.kind === "agent_group";

                      return (
                        <CommandItem
                          key={conv._id}
                          onSelect={() => navigate(`/dm/${conv._id}`)}
                        >
                          {isAgent ? (
                            <Bot className="h-3.5 w-3.5 text-violet-400" />
                          ) : (
                            <MessageSquare className="h-3.5 w-3.5 text-white/40" />
                          )}
                          <span className="text-white/90">{displayName}</span>
                          {isAgent && (
                            <span className="ml-1 rounded-md border border-violet-500/20 bg-violet-500/10 px-1.5 py-px text-[10px] font-medium text-violet-400">
                              Agent
                            </span>
                          )}
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                )}

                <CommandGroup heading="Decisions">
                  {DECISIONS.map(({ label, href, icon: Icon, shortcut }) => (
                    <CommandItem key={label} onSelect={() => navigate(href)}>
                      <Icon className="h-3.5 w-3.5 text-white/40" />
                      <span className="text-white/90">{label}</span>
                      {shortcut && <CommandShortcut className="text-[12px] text-white/40">{shortcut}</CommandShortcut>}
                    </CommandItem>
                  ))}
                </CommandGroup>

                <CommandGroup heading="Commands">
                  <CommandItem
                    onSelect={() => {
                      onToggleSidebar?.();
                      onOpenChange(false);
                    }}
                  >
                    <PanelLeftClose className="h-3.5 w-3.5 text-white/40" />
                    <span className="text-white/90">Toggle sidebar</span>
                    <CommandShortcut className="text-[12px] text-white/40">⌘B</CommandShortcut>
                  </CommandItem>
                </CommandGroup>
              </>
            )}
          </CommandList>
        )}
      </div>

      {/* Footer bar — Raycast-style hints */}
      <div className="flex items-center justify-between border-t border-white/[0.06] px-3 py-1.5">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 text-[12px] text-white/50">
            <kbd className="rounded border border-white/10 bg-white/[0.04] px-1 py-px text-[11px]">↑↓</kbd>
            Navigate
          </span>
          <span className="flex items-center gap-1 text-[12px] text-white/50">
            <kbd className="rounded border border-white/10 bg-white/[0.04] px-1 py-px text-[11px]">↵</kbd>
            Select
          </span>
          <span className="flex items-center gap-1 text-[12px] text-white/50">
            <kbd className="rounded border border-white/10 bg-white/[0.04] px-1 py-px text-[11px]">esc</kbd>
            Close
          </span>
        </div>
        <span className="flex items-center gap-1 text-[12px] text-white/50">
          <kbd className="rounded border border-white/10 bg-white/[0.04] px-1 py-px text-[11px]">@</kbd>
          Talk to mrPING
        </span>
      </div>
    </CommandDialog>

    <UserProfileDialog
      userId={profileUserId}
      open={profileUserId !== null}
      onOpenChange={(open) => { if (!open) setProfileUserId(null); }}
    />
    </>
  );
}
