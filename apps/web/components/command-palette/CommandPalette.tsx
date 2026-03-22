"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
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
  Send,
  Loader2,
  AlertCircle,
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
  { label: "Inbox",           href: "/inbox",                     icon: Inbox,      shortcut: "G I" },
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
  { label: "Go to Inbox Decisions", href: "/inbox", icon: LayoutDashboard },
  { label: "Approve Decision",      href: "/inbox", icon: Check,           shortcut: "Y" },
  { label: "Reject Decision",       href: "/inbox", icon: X,               shortcut: "N" },
  { label: "Delegate Decision",     href: "/inbox", icon: UserPlus,        shortcut: "⇧D" },
  { label: "Snooze Decision",       href: "/inbox", icon: Clock,           shortcut: "S" },
];

/** Debounce a value by the given delay in ms. */
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
    <div className="flex items-center gap-2 px-2 py-1.5">
      <div className="h-4 w-4 rounded bg-foreground/10 animate-pulse" />
      <div className="h-3.5 flex-1 rounded bg-foreground/10 animate-pulse" />
    </div>
  );
}

function SkeletonGroup({ heading, rows = 3 }: { heading: string; rows?: number }) {
  return (
    <div className="overflow-hidden p-1 text-foreground">
      <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
        {heading}
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonRow key={i} />
      ))}
    </div>
  );
}

/** Truncate message body for display */
function truncate(text: string, maxLen = 80): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen).trimEnd() + "…";
}

/** Format relative time */
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

  // Debounce search to avoid excessive queries while typing
  const debouncedSearch = useDebouncedValue(search, 250);
  const hasSearch = debouncedSearch.trim().length >= 2;

  // Extract workspace slug from URL and resolve to workspaceId
  const workspaceSlug = pathname.match(/^\/app\/([^/]+)/)?.[1];
  const workspacePrefix = workspaceSlug ? `/app/${workspaceSlug}` : "";
  const workspace = useQuery(api.workspaces.getBySlug, isAuthenticated && workspaceSlug ? { slug: workspaceSlug } : "skip");
  const workspaceId = workspace?._id as Id<"workspaces"> | undefined;

  const channels = useQuery(api.channels.list, isAuthenticated && workspaceId ? { workspaceId } : "skip");
  const dmConversations = useQuery(api.directConversations.list, isAuthenticated ? {} : "skip");
  const currentUser = useQuery(api.users.getMe, isAuthenticated ? {} : "skip");

  // Search queries — only fire when there's a debounced search term
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

  // Loading state: queries have been sent but haven't returned yet
  const isSearching = hasSearch && (peopleResults === undefined || messageResults === undefined || dmResults === undefined);

  // Quick chat state
  const [quickChatId, setQuickChatId] = useState<Id<"quickChats"> | null>(null);
  const quickChat = useQuery(api.quickChat.get, quickChatId ? { quickChatId } : "skip");
  const sendQuickChat = useMutation(api.quickChat.send);
  const isQuickChatMode = search.startsWith("@");

  const handleQuickChatSubmit = useCallback(async () => {
    if (!workspaceId || !search.trim()) return;
    const query = search.replace(/^@\s*/, "").trim();
    if (!query) return;
    const id = await sendQuickChat({ workspaceId, query });
    setQuickChatId(id);
  }, [workspaceId, search, sendQuickChat]);

  // Reset state when closed
  useEffect(() => {
    if (!open) {
      setSearch("");
      setQuickChatId(null);
    }
  }, [open]);

  const navigate = (href: string) => {
    const fullHref = href.startsWith("/admin") ? href : `${workspacePrefix}${href}`;
    router.push(fullHref);
    onOpenChange(false);
  };

  // Combine channel + DM message results
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

    // Sort by most recent
    msgs.sort((a, b) => b._creationTime - a._creationTime);
    return msgs.slice(0, 15);
  }, [messageResults, dmResults]);

  const showSearchResults = hasSearch;
  const hasAnyResults = (peopleResults && peopleResults.length > 0) || allMessageResults.length > 0;

  // Profile dialog state for viewing user profiles from search
  const [profileUserId, setProfileUserId] = useState<Id<"users"> | null>(null);

  const openProfile = useCallback((userId: string) => {
    onOpenChange(false);
    // Small delay so the command palette closes before the profile dialog opens
    setTimeout(() => setProfileUserId(userId as Id<"users">), 150);
  }, [onOpenChange]);

  // Reset profile when command palette re-opens
  useEffect(() => {
    if (open) setProfileUserId(null);
  }, [open]);

  return (
    <>
    <CommandDialog open={open} onOpenChange={onOpenChange} shouldFilter={isQuickChatMode ? false : undefined}>
      <CommandInput
        placeholder={isQuickChatMode ? "Ask anything..." : "Search people, messages, and more... (@ to chat)"}
        value={search}
        onValueChange={(v) => { setSearch(v); if (!v.startsWith("@")) setQuickChatId(null); }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && isQuickChatMode && !quickChatId) {
            e.preventDefault();
            e.stopPropagation();
            handleQuickChatSubmit();
          }
        }}
      />
      {/* Fixed-height list — prevents dialog from jumping when content changes */}
      <div className="h-[400px]">
      {isQuickChatMode ? (
        // ── Quick chat mode ──
        <div className="flex h-full flex-col p-4">
          {!quickChatId ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
              <Bot className="h-8 w-8 text-ping-purple/40" />
              <p className="text-sm text-muted-foreground">
                Press <kbd className="rounded border border-subtle bg-surface-2 px-1.5 py-0.5 text-2xs font-medium">Enter</kbd> to send your message
              </p>
            </div>
          ) : quickChat?.status === "pending" ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-ping-purple" />
              <p className="text-xs text-muted-foreground">Thinking...</p>
            </div>
          ) : quickChat?.status === "error" ? (
            <div className="flex flex-1 flex-col gap-3">
              <div className="flex items-start gap-2 rounded-lg bg-red-500/10 p-3">
                <AlertCircle className="h-4 w-4 shrink-0 text-red-400 mt-0.5" />
                <p className="text-sm text-red-400">{quickChat.response}</p>
              </div>
            </div>
          ) : quickChat?.status === "done" ? (
            <div className="flex flex-1 flex-col gap-3 overflow-y-auto">
              <div className="flex items-start gap-2">
                <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ping-purple mt-0.5">
                  <Bot className="h-3 w-3 text-white" />
                </div>
                <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{quickChat.response}</p>
              </div>
            </div>
          ) : null}
        </div>
      ) : (
      <CommandList className="h-full max-h-full">
        {showSearchResults ? (
          // ── Search results mode ──
          <>
            {isSearching ? (
              // Skeleton loading state
              <div className="py-1">
                <SkeletonGroup heading="People" rows={2} />
                <SkeletonGroup heading="Messages" rows={3} />
              </div>
            ) : !hasAnyResults ? (
              <CommandEmpty>No results for &ldquo;{debouncedSearch}&rdquo;</CommandEmpty>
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
                            <User className="h-3.5 w-3.5 text-foreground/40" />
                          )}
                          <div className="flex flex-col min-w-0 flex-1">
                            <span className="truncate">{person.name}</span>
                            <span className="truncate text-2xs text-muted-foreground">
                              {person.email}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 ml-auto shrink-0">
                            {person.presenceStatus === "online" && (
                              <span className="h-2 w-2 rounded-full bg-green-500" />
                            )}
                            {existingDm && (
                              <button
                                type="button"
                                className="rounded p-1 text-muted-foreground hover:bg-surface-3 hover:text-foreground transition-colors"
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
                        <MessageSquare className="h-3.5 w-3.5 text-foreground/40 shrink-0" />
                        <div className="flex flex-col min-w-0 flex-1">
                          <span className="truncate text-sm">
                            {truncate(msg.body)}
                          </span>
                          <span className="truncate text-2xs text-muted-foreground">
                            {msg.authorName} in {msg.context} · {timeAgo(msg._creationTime)}
                          </span>
                        </div>
                        <ArrowRight className="h-3 w-3 text-foreground/20 shrink-0" />
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
              </>
            )}
          </>
        ) : (
          // ── Default browse mode ──
          <>
            <CommandEmpty>No results found.</CommandEmpty>

            <CommandGroup heading="Pages">
              {PAGES.map(({ label, href, icon: Icon, shortcut }) => (
                <CommandItem key={href} onSelect={() => navigate(href)}>
                  <Icon className="h-3.5 w-3.5 text-foreground/40" />
                  <span>{label}</span>
                  {shortcut && <CommandShortcut>{shortcut}</CommandShortcut>}
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
                    <Hash className="h-3.5 w-3.5 text-foreground/40" />
                    <span>{channel.name}</span>
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
                        <Bot className="h-3.5 w-3.5 text-ping-purple" />
                      ) : (
                        <MessageSquare className="h-3.5 w-3.5 text-foreground/40" />
                      )}
                      <span>{displayName}</span>
                      {isAgent && (
                        <span className="ml-1 rounded border border-ping-purple/30 bg-ping-purple/10 px-1 py-px text-2xs text-ping-purple">
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
                  <span>{label}</span>
                  {shortcut && <CommandShortcut>{shortcut}</CommandShortcut>}
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
                <PanelLeftClose className="h-3.5 w-3.5 text-foreground/40" />
                <span>Toggle sidebar</span>
                <CommandShortcut>⌘B</CommandShortcut>
              </CommandItem>
            </CommandGroup>
          </>
        )}
      </CommandList>
      )}
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
