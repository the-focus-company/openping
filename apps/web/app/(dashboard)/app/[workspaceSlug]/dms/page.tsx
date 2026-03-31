"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import { Id } from "@convex/_generated/dataModel";
import {
  MessageSquare,
  Bot,
  Users,
  User,
  Plus,
  Loader2,
  Archive,
  ArchiveRestore,
  ChevronDown,
  Sparkles,
  ArrowUpDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useWorkspace } from "@/hooks/useWorkspace";

type ConversationKind = "1to1" | "group" | "agent_1to1" | "agent_group";
type FilterType = "all" | "direct" | "group" | "agent" | "email";
type SortType = "date" | "unread";

const KIND_CONFIG: Record<
  ConversationKind,
  { label: string; icon: React.ElementType; className: string }
> = {
  "1to1": {
    label: "Direct",
    icon: User,
    className: "border-foreground/15 bg-foreground/5 text-foreground/60",
  },
  group: {
    label: "Group",
    icon: Users,
    className: "border-foreground/15 bg-foreground/5 text-foreground/60",
  },
  agent_1to1: {
    label: "Agent",
    icon: Bot,
    className: "border-ping-purple/40 bg-ping-purple/10 text-ping-purple",
  },
  agent_group: {
    label: "Agent-aided",
    icon: Bot,
    className: "border-status-online/40 bg-status-online/10 text-status-online",
  },
};

const FILTER_OPTIONS: { key: FilterType; label: string }[] = [
  { key: "all", label: "All" },
  { key: "direct", label: "Direct" },
  { key: "group", label: "Groups" },
  { key: "agent", label: "AI" },
];

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  if (diff < 60_000) return "now";
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m`;
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}h`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** Sparkle-based conversation icon — uses `kind` as source of truth */
function ConvIcon({ kind, initials }: {
  kind: string;
  initials: string;
}) {
  // user + sparkle (1:1 agent)
  if (kind === "agent_1to1") {
    return (
      <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-3">
        <User className="h-3.5 w-3.5 text-foreground/40" />
        <Sparkles className="absolute -right-0.5 -top-0.5 h-3 w-3 text-ping-purple" />
      </div>
    );
  }
  // users + sparkle (aided group)
  if (kind === "agent_group") {
    return (
      <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-3">
        <Users className="h-3.5 w-3.5 text-foreground/40" />
        <Sparkles className="absolute -right-0.5 -top-0.5 h-3 w-3 text-ping-purple" />
      </div>
    );
  }
  // users (group)
  if (kind === "group") {
    return (
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-3">
        <Users className="h-3.5 w-3.5 text-foreground/40" />
      </div>
    );
  }
  // user (1:1)
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-3 text-2xs font-medium text-foreground">
      {initials}
    </div>
  );
}

export default function DMsPage() {
  const router = useRouter();
  const { workspaceId, buildPath } = useWorkspace();
  const conversations = useQuery(api.directConversations.list, {});
  const archivedConversations = useQuery(api.directConversations.listArchived, {});
  const allUsers = useQuery(api.users.listAll, { workspaceId });
  const currentUser = useQuery(api.users.getMe, {});
  const createConversation = useMutation(api.directConversations.create);
  const unarchiveConversation = useMutation(api.directConversations.unarchive);

  const searchParams = useSearchParams();
  const [newDmOpen, setNewDmOpen] = useState(false);
  const [newKind, setNewKind] = useState<ConversationKind>("1to1");

  // Auto-open "New conversation" dialog when navigating with ?new=1
  useEffect(() => {
    if (searchParams.get("new") === "1") {
      setNewDmOpen(true);
    }
  }, [searchParams]);
  const [selectedUsers, setSelectedUsers] = useState<Id<"users">[]>([]);
  const [groupName, setGroupName] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [filter, setFilter] = useState<FilterType>("all");
  const [sort, setSort] = useState<SortType>("date");

  const handleCreate = async () => {
    if (selectedUsers.length === 0) return;

    const isAgentKind = newKind === "agent_1to1" || newKind === "agent_group";
    const agentMembers = isAgentKind
      ? selectedUsers.filter((id) => {
          const u = allUsers?.find((u) => u._id === id);
          return u?.isAgent;
        })
      : [];
    const humanMembers = selectedUsers.filter((id) => !agentMembers.includes(id));

    const conversationId = await createConversation({
      workspaceId,
      kind: newKind,
      name: newKind === "group" || newKind === "agent_group" ? groupName || undefined : undefined,
      memberIds: humanMembers,
      agentMemberIds: agentMembers.length > 0 ? agentMembers : undefined,
    });
    setNewDmOpen(false);
    setSelectedUsers([]);
    setGroupName("");
    router.push(buildPath(`/dm/${conversationId}`));
  };

  const toggleUser = (userId: Id<"users">) => {
    setSelectedUsers((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId],
    );
  };

  // Filter & sort conversations
  const filteredConversations = useMemo(() => {
    if (!conversations) return [];

    let filtered = conversations.filter((conv) => {
      if (filter === "all") return true;
      if (filter === "direct") return conv.kind === "1to1";
      if (filter === "group") return conv.kind === "group";
      if (filter === "agent") return conv.kind === "agent_1to1" || conv.kind === "agent_group";
      return true;
    });

    if (sort === "unread") {
      filtered = [...filtered].sort((a, b) => {
        // Unread first, then by date
        if (a.unreadCount > 0 && b.unreadCount === 0) return -1;
        if (a.unreadCount === 0 && b.unreadCount > 0) return 1;
        const aTime = a.lastMessage?.timestamp ?? a._creationTime;
        const bTime = b.lastMessage?.timestamp ?? b._creationTime;
        return bTime - aTime;
      });
    }
    // "date" sort is the default from the backend

    return filtered;
  }, [conversations, filter, sort]);

  if (conversations === undefined) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-foreground/40" />
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      {/* Header with filters */}
      <div className="border-b border-subtle px-4 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* Type filter pills */}
            {FILTER_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                onClick={() => setFilter(opt.key)}
                className={cn(
                  "rounded-full px-2.5 py-0.5 text-2xs font-medium transition-colors",
                  filter === opt.key
                    ? "bg-foreground/10 text-foreground"
                    : "text-foreground/50 hover:bg-surface-3 hover:text-foreground/80",
                )}
              >
                {opt.label}
              </button>
            ))}
            <div className="mx-1 h-3 w-px bg-foreground/10" />
            {/* Sort toggle */}
            <button
              onClick={() => setSort((s) => (s === "date" ? "unread" : "date"))}
              className={cn(
                "flex items-center gap-1 rounded-full px-2 py-0.5 text-2xs font-medium transition-colors",
                "text-foreground/50 hover:bg-surface-3 hover:text-foreground/80",
              )}
              title={sort === "date" ? "Sort by unread" : "Sort by date"}
            >
              <ArrowUpDown className="h-2.5 w-2.5" />
              {sort === "date" ? "Recent" : "Unread"}
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-2xs text-foreground/40 tabular-nums">
              {filteredConversations.length}
            </span>
            <Button
              size="sm"
              className="h-7 gap-1.5 bg-ping-purple text-xs text-white hover:bg-ping-purple-hover"
              onClick={() => setNewDmOpen(true)}
            >
              <Plus className="h-3 w-3" />
              New
            </Button>
          </div>
        </div>
      </div>

      {/* Conversations list */}
      {filteredConversations.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center gap-3">
          <MessageSquare className="h-10 w-10 text-foreground/50" />
          <h2 className="text-sm font-medium text-foreground">
            {filter === "all" ? "No conversations yet" : "No matching conversations"}
          </h2>
          <p className="text-xs text-muted-foreground">
            {filter === "all" ? "Start a direct message or group chat" : "Try a different filter"}
          </p>
        </div>
      ) : (
        <div>
          {filteredConversations.map((conv) => {
            const kindConf = KIND_CONFIG[conv.kind as ConversationKind];
            const otherMembers = conv.members.filter(
              (m) => m.userId !== currentUser?._id,
            );
            const displayName =
              conv.name ||
              otherMembers.map((m) => m.name).join(", ") ||
              "Unnamed";
            const initials =
              otherMembers.length === 1
                ? getInitials(otherMembers[0].name)
                : otherMembers.length > 1
                  ? `${otherMembers.length}`
                  : "?";

            return (
              <div
                key={conv._id}
                onClick={() => router.push(buildPath(`/dm/${conv._id}`))}
                className={cn(
                  "flex cursor-pointer items-center gap-3 border-b border-subtle px-4 py-3 transition-colors hover:bg-surface-2",
                  conv.unreadCount > 0 && "bg-surface-1",
                )}
              >
                <ConvIcon kind={conv.kind} initials={initials} />

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "truncate text-xs",
                        conv.unreadCount > 0
                          ? "font-semibold text-foreground"
                          : "font-medium text-foreground",
                      )}
                    >
                      {displayName}
                    </span>
                    <span
                      className={cn(
                        "inline-flex shrink-0 items-center rounded border px-1 py-px text-2xs font-medium",
                        kindConf.className,
                      )}
                    >
                      {kindConf.label}
                    </span>
                  </div>
                  {conv.lastMessage && (
                    <p className="mt-0.5 truncate text-2xs text-muted-foreground">
                      <span className="text-foreground/40">
                        {conv.lastMessage.authorName}:
                      </span>{" "}
                      {conv.lastMessage.body}
                    </p>
                  )}
                </div>

                {/* Meta */}
                <div className="flex shrink-0 flex-col items-end gap-1">
                  {conv.lastMessage && (
                    <span className="text-2xs text-foreground/50">
                      {formatTime(conv.lastMessage.timestamp)}
                    </span>
                  )}
                  {conv.unreadCount > 0 && (
                    <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-ping-purple px-1 text-2xs font-medium text-white tabular-nums">
                      {conv.unreadCount > 99 ? "99+" : conv.unreadCount}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Archived section */}
      {(archivedConversations?.length ?? 0) > 0 && (
        <div>
          <button
            onClick={() => setShowArchived((v) => !v)}
            className="flex w-full items-center gap-2 border-b border-subtle px-4 py-2 text-left transition-colors hover:bg-surface-2"
          >
            <Archive className="h-3.5 w-3.5 text-foreground/45" />
            <span className="text-xs font-medium text-muted-foreground">
              Archived
            </span>
            <span className="text-2xs text-foreground/40">{archivedConversations!.length}</span>
            <ChevronDown
              className={cn(
                "ml-auto h-3 w-3 text-foreground/40 transition-transform",
                showArchived && "rotate-180",
              )}
            />
          </button>

          {showArchived &&
            archivedConversations!.map((conv) => {
              const kindConf = KIND_CONFIG[conv.kind as ConversationKind];
              const otherMembers = conv.members.filter(
                (m) => m.userId !== currentUser?._id,
              );
              const displayName =
                conv.name ||
                otherMembers.map((m) => m.name).join(", ") ||
                "Unnamed";
              const initials =
                otherMembers.length === 1
                  ? getInitials(otherMembers[0].name)
                  : otherMembers.length > 1
                    ? `${otherMembers.length}`
                    : "?";

              return (
                <div
                  key={conv._id}
                  className="flex items-center gap-3 border-b border-subtle px-4 py-3 opacity-60"
                >
                  <ConvIcon kind={conv.kind} initials={initials} />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-xs font-medium text-foreground">
                        {displayName}
                      </span>
                      <span
                        className={cn(
                          "inline-flex shrink-0 items-center rounded border px-1 py-px text-2xs font-medium",
                          kindConf.className,
                        )}
                      >
                        {kindConf.label}
                      </span>
                    </div>
                    {conv.lastMessage && (
                      <p className="mt-0.5 truncate text-2xs text-muted-foreground">
                        {conv.lastMessage.body}
                      </p>
                    )}
                  </div>

                  <button
                    onClick={() => unarchiveConversation({ conversationId: conv._id })}
                    className="flex shrink-0 items-center gap-1 rounded px-2 py-1 text-2xs text-muted-foreground transition-colors hover:bg-surface-3 hover:text-foreground"
                    title="Unarchive"
                  >
                    <ArchiveRestore className="h-3 w-3" />
                    Restore
                  </button>
                </div>
              );
            })}
        </div>
      )}

      {/* New DM Dialog */}
      <Dialog open={newDmOpen} onOpenChange={setNewDmOpen}>
        <DialogContent className="border-subtle bg-surface-2 sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold">
              New conversation
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-1">
            {/* Kind selector */}
            <div>
              <label className="mb-1.5 block text-2xs font-medium uppercase tracking-widest text-foreground/40">
                Type
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                {(
                  ["1to1", "group", "agent_1to1", "agent_group"] as const
                ).map((k) => {
                  const conf = KIND_CONFIG[k];
                  const Icon = conf.icon;
                  return (
                    <button
                      key={k}
                      onClick={() => {
                        setNewKind(k);
                        setSelectedUsers([]);
                      }}
                      className={cn(
                        "flex items-center gap-1.5 rounded border py-1.5 px-2 text-xs font-medium transition-colors",
                        newKind === k
                          ? "border-ping-purple/40 bg-ping-purple/10 text-ping-purple"
                          : "border-subtle bg-surface-3 text-muted-foreground hover:border-foreground/10",
                      )}
                    >
                      <Icon className="h-3 w-3" />
                      {conf.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Group name */}
            {(newKind === "group" || newKind === "agent_group") && (
              <div>
                <label className="mb-1.5 block text-2xs font-medium uppercase tracking-widest text-foreground/40">
                  Group name (optional)
                </label>
                <input
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="e.g. Project Alpha"
                  className="w-full rounded border border-subtle bg-background px-2.5 py-1.5 text-xs text-foreground placeholder:text-foreground/45 focus:border-ring focus:outline-none"
                />
              </div>
            )}

            {/* Member picker */}
            <div>
              <label className="mb-1.5 block text-2xs font-medium uppercase tracking-widest text-foreground/40">
                {newKind === "agent_1to1" || newKind === "agent_group" ? "Select agent" : "Members"}
              </label>
              <div className="max-h-40 space-y-1 overflow-y-auto scrollbar-thin">
                {allUsers === undefined ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-4 w-4 animate-spin text-foreground/40" />
                  </div>
                ) : (
                  allUsers
                    .filter((u) => {
                      if (u._id === currentUser?._id) return false;
                      if (newKind === "agent_1to1") return !!u.isAgent;
                      if (newKind === "agent_group") return true;
                      return !u.isAgent;
                    })
                    .sort((a, b) => {
                      if (a.isAgent && !b.isAgent) return -1;
                      if (!a.isAgent && b.isAgent) return 1;
                      return a.name.localeCompare(b.name);
                    })
                    .map((u) => (
                      <label
                        key={u._id}
                        className={cn(
                          "flex cursor-pointer items-center gap-2 rounded border px-2.5 py-1.5 transition-colors hover:border-foreground/10",
                          u.isAgent ? "border-ping-purple/20 bg-ping-purple/5" : "border-subtle bg-surface-3",
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={selectedUsers.includes(u._id)}
                          onChange={() => toggleUser(u._id)}
                          className="h-3.5 w-3.5 rounded border-subtle bg-surface-3"
                        />
                        {u.isAgent ? (
                          <div className="relative flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-surface-2">
                            <User className="h-3 w-3 text-foreground/40" />
                            <Sparkles className="absolute -right-1 -top-0.5 h-2 w-2 text-ping-purple" />
                          </div>
                        ) : (
                          <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-surface-2 text-2xs font-medium text-foreground">
                            {getInitials(u.name)}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <span className="truncate text-xs text-foreground">
                            {u.name}
                          </span>
                        </div>
                        {u.isAgent ? (
                          <span className="text-2xs text-ping-purple/60">Agent</span>
                        ) : (
                          <span className="text-2xs text-foreground/50">{u.email}</span>
                        )}
                      </label>
                    ))
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => setNewDmOpen(false)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={selectedUsers.length === 0}
                className="h-7 bg-ping-purple text-xs text-white hover:bg-ping-purple-hover disabled:opacity-40"
                onClick={handleCreate}
              >
                Start conversation
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
