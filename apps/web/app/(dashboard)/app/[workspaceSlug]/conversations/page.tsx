"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import { Id } from "@convex/_generated/dataModel";
import {
  Hash,
  MessageSquare,
  Users,
  User,
  Plus,
  Loader2,
  Lock,
  Archive,
  ArchiveRestore,
  ChevronDown,
  Sparkles,
  ArrowUpDown,
  Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useLoadingTimeout } from "@/hooks/useLoadingTimeout";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useVirtualizer } from "@tanstack/react-virtual";

type FilterType = "all" | "public" | "private" | "1to1" | "groups" | "ai";
type SortType = "date" | "unread";
type CreateMode = "channel" | "dm";
type ConversationKind = "1to1" | "group" | "agent_1to1" | "agent_group";

const FILTER_OPTIONS: { key: FilterType; label: string }[] = [
  { key: "all", label: "All" },
  { key: "public", label: "Public" },
  { key: "private", label: "Private" },
  { key: "1to1", label: "1:1" },
  { key: "groups", label: "Groups" },
  { key: "ai", label: "AI" },
];

const KIND_BADGE: Record<
  ConversationKind,
  { label: string; className: string }
> = {
  "1to1": {
    label: "Direct",
    className: "border-foreground/15 bg-foreground/5 text-foreground/60",
  },
  group: {
    label: "Group",
    className: "border-foreground/15 bg-foreground/5 text-foreground/60",
  },
  agent_1to1: {
    label: "Agent",
    className: "border-ping-purple/40 bg-ping-purple/10 text-ping-purple",
  },
  agent_group: {
    label: "Agent-aided",
    className: "border-status-online/40 bg-status-online/10 text-status-online",
  },
};

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

/** Derive display name and avatar initials from a conversation. */
function getConvDisplay(
  conv: { kind: string; visibility: string; name?: string | null; members: Array<{ userId: string; name: string }> },
  currentUserId: string | undefined,
) {
  const otherMembers = conv.members.filter((m) => m.userId !== currentUserId);
  const displayName =
    conv.visibility === "public"
      ? conv.name ?? "Unnamed channel"
      : conv.name || otherMembers.map((m) => m.name).join(", ") || "Unnamed";
  const initials =
    otherMembers.length === 1
      ? getInitials(otherMembers[0].name)
      : otherMembers.length > 1
        ? `${otherMembers.length}`
        : "?";
  return { displayName, initials };
}

/** Conversation icon based on kind and visibility */
function ConvIcon({
  kind,
  visibility,
  initials,
}: {
  kind: string;
  visibility: string;
  initials: string;
}) {
  // Public channel
  if (visibility === "public") {
    return (
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-3">
        <Hash className="h-3.5 w-3.5 text-foreground/40" />
      </div>
    );
  }
  // Agent 1:1
  if (kind === "agent_1to1") {
    return (
      <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-3">
        <User className="h-3.5 w-3.5 text-foreground/40" />
        <Sparkles className="absolute -right-0.5 -top-0.5 h-3 w-3 text-ping-purple" />
      </div>
    );
  }
  // Agent group
  if (kind === "agent_group") {
    return (
      <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-3">
        <Users className="h-3.5 w-3.5 text-foreground/40" />
        <Sparkles className="absolute -right-0.5 -top-0.5 h-3 w-3 text-ping-purple" />
      </div>
    );
  }
  // Private group
  if (kind === "group") {
    return (
      <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-3">
        <Users className="h-3.5 w-3.5 text-foreground/40" />
        <Lock className="absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 text-foreground/30" />
      </div>
    );
  }
  // 1:1
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-3 text-2xs font-medium text-foreground">
      {initials}
    </div>
  );
}

export default function ConversationsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { workspaceId, buildPath, role } = useWorkspace();
  const isGuest = role === "guest";

  const conversations = useQuery(
    api.conversations.list,
    workspaceId ? { workspaceId } : "skip",
  );
  const archivedConversations = useQuery(
    api.conversations.listArchived,
    workspaceId ? { workspaceId } : "skip",
  );
  const allUsers = useQuery(
    api.users.listAll,
    workspaceId ? { workspaceId } : "skip",
  );
  const currentUser = useQuery(api.users.getMe, {});
  const createConversation = useMutation(api.conversations.create);
  const unarchiveConversation = useMutation(api.conversations.unarchive);

  const [filter, setFilter] = useState<FilterType>("all");
  const [sort, setSort] = useState<SortType>("date");
  const [showArchived, setShowArchived] = useState(false);

  // Create dialog state
  const [createOpen, setCreateOpen] = useState(false);
  const [createMode, setCreateMode] = useState<CreateMode>("channel");
  const [newChannelName, setNewChannelName] = useState("");
  const [newChannelPrivate, setNewChannelPrivate] = useState(false);
  const [newDmKind, setNewDmKind] = useState<ConversationKind>("1to1");
  const [selectedUsers, setSelectedUsers] = useState<Id<"users">[]>([]);
  const [groupName, setGroupName] = useState("");

  // Auto-open create dialog when navigating with ?new=1
  useEffect(() => {
    if (searchParams.get("new") === "1") {
      setCreateOpen(true);
    }
  }, [searchParams]);

  const handleCreateChannel = async () => {
    const name = newChannelName.trim().toLowerCase().replace(/\s+/g, "-");
    if (!name || !workspaceId) return;
    try {
      const conversationId = await createConversation({
        workspaceId,
        kind: "group",
        name,
        visibility: newChannelPrivate ? "secret" : "public",
      });
      resetCreateForm();
      router.push(buildPath(`/c/${conversationId}`));
    } catch (err) {
      console.error("Failed to create channel:", err);
    }
  };

  const handleCreateDm = async () => {
    if (selectedUsers.length === 0 || !workspaceId) return;

    const isAgentKind = newDmKind === "agent_1to1" || newDmKind === "agent_group";
    const agentMembers = isAgentKind
      ? selectedUsers.filter((id) => {
          const u = allUsers?.find((u) => u._id === id);
          return u?.isAgent;
        })
      : [];
    const humanMembers = selectedUsers.filter((id) => !agentMembers.includes(id));

    try {
      const conversationId = await createConversation({
        workspaceId,
        kind: newDmKind,
        name: newDmKind === "group" || newDmKind === "agent_group" ? groupName || undefined : undefined,
        visibility: "secret_can_be_public",
        memberIds: humanMembers,
        agentMemberIds: agentMembers.length > 0 ? agentMembers : undefined,
      });
      resetCreateForm();
      router.push(buildPath(`/c/${conversationId}`));
    } catch (err) {
      console.error("Failed to create conversation:", err);
    }
  };

  const resetCreateForm = () => {
    setCreateOpen(false);
    setNewChannelName("");
    setNewChannelPrivate(false);
    setSelectedUsers([]);
    setGroupName("");
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
      if (filter === "public") return conv.visibility === "public";
      if (filter === "private") return conv.visibility !== "public" && conv.kind === "group";
      if (filter === "1to1") return conv.kind === "1to1";
      if (filter === "groups") return conv.kind === "group" || conv.kind === "agent_group";
      if (filter === "ai") return conv.kind === "agent_1to1" || conv.kind === "agent_group";
      return true;
    });

    if (sort === "unread") {
      filtered = [...filtered].sort((a, b) => {
        if (a.unreadCount > 0 && b.unreadCount === 0) return -1;
        if (a.unreadCount === 0 && b.unreadCount > 0) return 1;
        const aTime = a.lastMessage?.timestamp ?? a._creationTime;
        const bTime = b.lastMessage?.timestamp ?? b._creationTime;
        return bTime - aTime;
      });
    }

    return filtered;
  }, [conversations, filter, sort]);

  const convsTimedOut = useLoadingTimeout(conversations === undefined, 12_000);
  if (conversations === undefined) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3">
        {convsTimedOut ? (
          <>
            <p className="text-sm text-muted-foreground">Could not load conversations.</p>
            <button onClick={() => window.location.reload()} className="text-xs text-foreground/60 underline hover:text-foreground">Retry</button>
          </>
        ) : (
          <Loader2 className="h-5 w-5 animate-spin text-foreground/40" />
        )}
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      {/* Header with filters */}
      <div className="border-b border-subtle px-4 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
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
            {!isGuest && (
              <Button
                size="sm"
                className="h-7 gap-1.5 bg-ping-purple text-xs text-white hover:bg-ping-purple-hover"
                onClick={() => setCreateOpen(true)}
              >
                <Plus className="h-3 w-3" />
                New
              </Button>
            )}
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
            {filter === "all"
              ? "Create a channel or start a direct message"
              : "Try a different filter"}
          </p>
        </div>
      ) : (
        <VirtualConversationList
          conversations={filteredConversations}
          currentUserId={currentUser?._id}
          onNavigate={(id) => router.push(buildPath(`/c/${id}`))}
        />
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
            <span className="text-2xs text-foreground/40">
              {archivedConversations!.length}
            </span>
            <ChevronDown
              className={cn(
                "ml-auto h-3 w-3 text-foreground/40 transition-transform",
                showArchived && "rotate-180",
              )}
            />
          </button>

          {showArchived &&
            archivedConversations!.map((conv) => {
              const { displayName, initials } = getConvDisplay(conv, currentUser?._id);

              return (
                <div
                  key={conv._id}
                  className="flex items-center gap-3 border-b border-subtle px-4 py-3 opacity-60"
                >
                  <ConvIcon
                    kind={conv.kind}
                    visibility={conv.visibility}
                    initials={initials}
                  />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-xs font-medium text-foreground">
                        {conv.visibility === "public" ? `# ${displayName}` : displayName}
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

      {/* Create Conversation Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="border-subtle bg-surface-2 sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold">
              New conversation
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-1">
            {/* Mode tabs: Channel vs DM */}
            <div className="flex rounded-lg border border-subtle bg-surface-3 p-0.5">
              <button
                onClick={() => setCreateMode("channel")}
                className={cn(
                  "flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                  createMode === "channel"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Hash className="mr-1.5 inline h-3 w-3" />
                Channel
              </button>
              <button
                onClick={() => setCreateMode("dm")}
                className={cn(
                  "flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                  createMode === "dm"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <User className="mr-1.5 inline h-3 w-3" />
                Direct message
              </button>
            </div>

            {createMode === "channel" ? (
              /* Channel creation form */
              <>
                <div>
                  <label className="mb-1.5 block text-2xs font-medium uppercase tracking-widest text-foreground/40">
                    Channel name
                  </label>
                  <input
                    value={newChannelName}
                    onChange={(e) => setNewChannelName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleCreateChannel()}
                    placeholder="e.g. announcements"
                    className="w-full rounded border border-subtle bg-background px-2.5 py-1.5 text-xs text-foreground placeholder:text-foreground/45 focus:border-ring focus:outline-none"
                    autoFocus
                  />
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newChannelPrivate}
                    onChange={(e) => setNewChannelPrivate(e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-subtle bg-surface-3"
                  />
                  <div className="flex items-center gap-1.5">
                    <Lock className="h-3 w-3 text-foreground/50" />
                    <span className="text-xs text-muted-foreground">Private channel</span>
                  </div>
                </label>
                <div className="flex justify-end gap-2 pt-1">
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={resetCreateForm}>
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    disabled={!newChannelName.trim()}
                    className="h-7 bg-ping-purple text-xs text-white hover:bg-ping-purple-hover disabled:opacity-40"
                    onClick={handleCreateChannel}
                  >
                    Create
                  </Button>
                </div>
              </>
            ) : (
              /* DM creation form */
              <>
                {/* Kind selector */}
                <div>
                  <label className="mb-1.5 block text-2xs font-medium uppercase tracking-widest text-foreground/40">
                    Type
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {([
                      { kind: "1to1" as const, Icon: User },
                      { kind: "group" as const, Icon: Users },
                      { kind: "agent_1to1" as const, Icon: Sparkles },
                      { kind: "agent_group" as const, Icon: Sparkles },
                    ]).map(({ kind: k, Icon }) => (
                      <button
                        key={k}
                        onClick={() => {
                          setNewDmKind(k);
                          setSelectedUsers([]);
                        }}
                        className={cn(
                          "flex items-center gap-1.5 rounded border py-1.5 px-2 text-xs font-medium transition-colors",
                          newDmKind === k
                            ? "border-ping-purple/40 bg-ping-purple/10 text-ping-purple"
                            : "border-subtle bg-surface-3 text-muted-foreground hover:border-foreground/10",
                        )}
                      >
                        <Icon className="h-3 w-3" />
                        {KIND_BADGE[k].label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Group name */}
                {(newDmKind === "group" || newDmKind === "agent_group") && (
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
                    {newDmKind === "agent_1to1" || newDmKind === "agent_group"
                      ? "Select agent"
                      : "Members"}
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
                          if (newDmKind === "agent_1to1") return !!u.isAgent;
                          if (newDmKind === "agent_group") return true;
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
                              u.isAgent
                                ? "border-ping-purple/20 bg-ping-purple/5"
                                : "border-subtle bg-surface-3",
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
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={resetCreateForm}>
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    disabled={selectedUsers.length === 0}
                    className="h-7 bg-ping-purple text-xs text-white hover:bg-ping-purple-hover disabled:opacity-40"
                    onClick={handleCreateDm}
                  >
                    Start conversation
                  </Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function VirtualConversationList({
  conversations,
  currentUserId,
  onNavigate,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  conversations: any[];
  currentUserId?: string;
  onNavigate: (id: string) => void;
}) {
  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: conversations.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 64,
    overscan: 10,
  });

  return (
    <div ref={parentRef} className="flex-1 overflow-auto">
      <div style={{ height: `${virtualizer.getTotalSize()}px`, position: "relative" }}>
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const conv = conversations[virtualRow.index];
          const { displayName, initials } = getConvDisplay(conv, currentUserId);
          const kindConf = KIND_BADGE[conv.kind as ConversationKind];

          return (
            <div
              key={conv._id}
              data-index={virtualRow.index}
              ref={virtualizer.measureElement}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform: `translateY(${virtualRow.start}px)`,
              }}
              onClick={() => onNavigate(conv._id)}
              className={cn(
                "flex cursor-pointer items-center gap-3 border-b border-subtle px-4 py-3 transition-colors hover:bg-surface-2",
                conv.unreadCount > 0 && "bg-surface-1",
              )}
            >
              <ConvIcon kind={conv.kind} visibility={conv.visibility} initials={initials} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  {conv.isStarred && (
                    <Star className="h-3 w-3 shrink-0 fill-yellow-400 text-yellow-400" />
                  )}
                  <span
                    className={cn(
                      "truncate text-xs",
                      conv.unreadCount > 0 ? "font-semibold text-foreground" : "font-medium text-foreground",
                    )}
                  >
                    {conv.visibility === "public" ? `# ${displayName}` : displayName}
                  </span>
                  {kindConf && conv.visibility !== "public" && (
                    <span className={cn("inline-flex shrink-0 items-center rounded border px-1 py-px text-2xs font-medium", kindConf.className)}>
                      {kindConf.label}
                    </span>
                  )}
                  {conv.visibility === "public" && (
                    <span className="inline-flex shrink-0 items-center rounded border border-foreground/15 bg-foreground/5 px-1 py-px text-2xs font-medium text-foreground/60">
                      Public
                    </span>
                  )}
                </div>
                {conv.lastMessage && (
                  <p className="mt-0.5 truncate text-2xs text-muted-foreground">
                    <span className="text-foreground/40">{conv.lastMessage.authorName}:</span>{" "}
                    {conv.lastMessage.body}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                {conv.lastMessage && (
                  <span className="text-2xs text-foreground/50">{formatTime(conv.lastMessage.timestamp)}</span>
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
    </div>
  );
}
