"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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

const KIND_CONFIG: Record<
  ConversationKind,
  { label: string; icon: React.ElementType; className: string }
> = {
  "1to1": {
    label: "Direct",
    icon: User,
    className: "border-white/15 bg-white/5 text-white/60",
  },
  group: {
    label: "Group",
    icon: Users,
    className: "border-white/15 bg-white/5 text-white/60",
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

export default function DMsPage() {
  const router = useRouter();
  const { workspaceId, buildPath } = useWorkspace();
  const conversations = useQuery(api.directConversations.list, {});
  const allUsers = useQuery(api.users.listAll, { workspaceId });
  const currentUser = useQuery(api.users.getMe, {});
  const createConversation = useMutation(api.directConversations.create);

  const [newDmOpen, setNewDmOpen] = useState(false);
  const [newKind, setNewKind] = useState<ConversationKind>("1to1");
  const [selectedUsers, setSelectedUsers] = useState<Id<"users">[]>([]);
  const [groupName, setGroupName] = useState("");

  const handleCreate = async () => {
    if (selectedUsers.length === 0) return;

    const isAgent = newKind === "agent_1to1" || newKind === "agent_group";
    const agentMembers = isAgent
      ? selectedUsers.filter((id) => {
          const u = allUsers?.find((u) => u._id === id);
          return u?.role === "admin"; // placeholder: agents would have a flag
        })
      : [];

    const conversationId = await createConversation({
      workspaceId,
      kind: newKind,
      name: newKind === "group" || newKind === "agent_group" ? groupName || undefined : undefined,
      memberIds: selectedUsers,
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

  if (conversations === undefined) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-white/20" />
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-subtle px-4 py-2">
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">
            {conversations.length} conversation{conversations.length !== 1 ? "s" : ""}
          </span>
        </div>
        <Button
          size="sm"
          className="h-7 gap-1.5 bg-ping-purple text-xs text-white hover:bg-ping-purple-hover"
          onClick={() => setNewDmOpen(true)}
        >
          <Plus className="h-3 w-3" />
          New message
        </Button>
      </div>

      {/* Conversations list */}
      {conversations.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center gap-3">
          <MessageSquare className="h-10 w-10 text-white/15" />
          <h2 className="text-sm font-medium text-foreground">No conversations yet</h2>
          <p className="text-xs text-muted-foreground">
            Start a direct message or group chat
          </p>
        </div>
      ) : (
        <div>
          {conversations.map((conv) => {
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
                {/* Avatar */}
                <div
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-2xs font-medium",
                    conv.kind === "agent_1to1" || conv.kind === "agent_group"
                      ? "bg-ping-purple/20 text-ping-purple"
                      : "bg-surface-3 text-foreground",
                  )}
                >
                  {conv.kind === "agent_1to1" || conv.kind === "agent_group" ? (
                    <Bot className="h-3.5 w-3.5" />
                  ) : (
                    initials
                  )}
                </div>

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
                      <span className="text-white/40">
                        {conv.lastMessage.authorName}:
                      </span>{" "}
                      {conv.lastMessage.body}
                    </p>
                  )}
                </div>

                {/* Meta */}
                <div className="flex shrink-0 flex-col items-end gap-1">
                  {conv.lastMessage && (
                    <span className="text-2xs text-white/30">
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
              <label className="mb-1.5 block text-2xs font-medium uppercase tracking-widest text-white/40">
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
                          : "border-subtle bg-surface-3 text-muted-foreground hover:border-white/10",
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
                <label className="mb-1.5 block text-2xs font-medium uppercase tracking-widest text-white/40">
                  Group name (optional)
                </label>
                <input
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="e.g. Project Alpha"
                  className="w-full rounded border border-subtle bg-surface-3 px-2.5 py-1.5 text-xs text-foreground placeholder:text-white/25 focus:border-white/20 focus:outline-none"
                />
              </div>
            )}

            {/* Member picker */}
            <div>
              <label className="mb-1.5 block text-2xs font-medium uppercase tracking-widest text-white/40">
                Members
              </label>
              <div className="max-h-40 space-y-1 overflow-y-auto scrollbar-thin">
                {allUsers === undefined ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-4 w-4 animate-spin text-white/20" />
                  </div>
                ) : (
                  allUsers
                    .filter((u) => u._id !== currentUser?._id)
                    .map((u) => (
                      <label
                        key={u._id}
                        className="flex cursor-pointer items-center gap-2 rounded border border-subtle bg-surface-3 px-2.5 py-1.5 transition-colors hover:border-white/10"
                      >
                        <input
                          type="checkbox"
                          checked={selectedUsers.includes(u._id)}
                          onChange={() => toggleUser(u._id)}
                          className="h-3.5 w-3.5 rounded border-subtle bg-surface-3"
                        />
                        <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-surface-2 text-2xs font-medium text-foreground">
                          {getInitials(u.name)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="truncate text-xs text-foreground">
                            {u.name}
                          </span>
                        </div>
                        <span className="text-2xs text-white/30">{u.email}</span>
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
