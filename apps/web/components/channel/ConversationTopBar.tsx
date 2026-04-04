"use client";

import { useState, useMemo } from "react";
import {
  Pin,
  Paperclip,
  MoreHorizontal,
  Archive,
  Trash2,
  Copy,
  Bot,
  Users,
  Video,
  Link2,
  UserPlus,
  Search,
  Check,
  Loader2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface Member {
  userId: string;
  name: string;
  avatarUrl?: string | null;
  isAgent: boolean;
}

interface WorkspaceMember {
  _id: string;
  name: string;
  avatarUrl?: string | null;
}

interface InviteLink {
  token: string;
  expiresAt: number;
}

interface ConversationTopBarProps {
  name: string;
  members: Member[];
  kind: "1to1" | "group" | "agent_1to1" | "agent_group";
  onArchive?: () => void;
  onDelete?: () => void;
  onCopyId?: () => void;
  onPinned?: () => void;
  onAttachments?: () => void;
  onStartMeeting?: () => void;
  hasActiveMeeting?: boolean;
  onShareLink?: () => void;
  isGuest?: boolean;
  workspaceMembers?: WorkspaceMember[];
  onInviteMembers?: (userIds: string[]) => void;
  inviteLink?: InviteLink | null;
  onGenerateInviteLink?: () => void;
  onRevokeInviteLink?: () => void;
  onCopyInviteLink?: () => void;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function ConversationTopBar({
  name,
  members,
  kind,
  onArchive,
  onDelete,
  onCopyId,
  onPinned,
  onAttachments,
  onStartMeeting,
  hasActiveMeeting,
  onShareLink,
  isGuest,
  workspaceMembers,
  onInviteMembers,
  inviteLink,
  onGenerateInviteLink,
  onRevokeInviteLink,
  onCopyInviteLink,
}: ConversationTopBarProps) {
  const [showMembers, setShowMembers] = useState(false);
  const [panelTab, setPanelTab] = useState<"members" | "add" | "link">("members");
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [inviting, setInviting] = useState(false);
  const isAgent = kind === "agent_1to1" || kind === "agent_group";
  const isGroup = kind === "group" || kind === "agent_group";
  const totalMembers = members.length + 1; // +1 for current user

  const visible = members.slice(0, 4);
  const overflow = members.length - 4;

  const memberUserIds = useMemo(
    () => new Set(members.map((m) => m.userId)),
    [members],
  );

  const addableMembers = useMemo(() => {
    if (!workspaceMembers) return [];
    return workspaceMembers.filter(
      (wm) =>
        !memberUserIds.has(wm._id) &&
        wm.name.toLowerCase().includes(search.toLowerCase()),
    );
  }, [workspaceMembers, memberUserIds, search]);

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleInviteSelected = async () => {
    if (selectedIds.size === 0 || !onInviteMembers) return;
    setInviting(true);
    try {
      onInviteMembers(Array.from(selectedIds));
      setSelectedIds(new Set());
      setPanelTab("members");
    } finally {
      setInviting(false);
    }
  };

  const handleOpenPanel = (tab: "members" | "add" | "link") => {
    if (showMembers && panelTab === tab) {
      setShowMembers(false);
    } else {
      setPanelTab(tab);
      setShowMembers(true);
      setSearch("");
      setSelectedIds(new Set());
    }
  };

  return (
    <div className="flex h-10 items-center gap-3 border-b border-subtle bg-surface-1 px-4 shrink-0">
      {/* Stacked avatars — always shown */}
      <div className="relative flex items-center">
        {visible.map((m, i) => (
          <div
            key={m.userId}
            title={m.name}
            className={cn(
              "relative flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-background text-2xs font-medium overflow-hidden",
              m.isAgent
                ? "bg-ping-purple/20 text-ping-purple"
                : "bg-surface-3 text-foreground",
              i > 0 && "-ml-2",
            )}
          >
            {m.isAgent ? (
              <Bot className="h-3 w-3" />
            ) : m.avatarUrl ? (
              <img src={m.avatarUrl} alt={m.name} className="h-full w-full object-cover" />
            ) : (
              getInitials(m.name)
            )}
          </div>
        ))}
        {overflow > 0 && (
          <div className="-ml-2 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-background bg-surface-3 text-2xs font-medium text-muted-foreground">
            +{overflow}
          </div>
        )}
      </div>

      {/* Name + member count */}
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <span className="text-sm font-medium text-foreground truncate">{name}</span>
        {isGroup && (
          <span className="shrink-0 rounded bg-surface-3 px-1.5 py-px text-2xs text-muted-foreground tabular-nums">
            {totalMembers}
          </span>
        )}
        {isAgent && (
          <span className="shrink-0 rounded border border-ping-purple/20 bg-ping-purple/10 px-1.5 py-px text-2xs text-ping-purple">
            AI
          </span>
        )}
      </div>

      {/* Action icons */}
      <div className="flex items-center gap-0.5">
        <button
          onClick={onStartMeeting}
          className="rounded p-1.5 text-foreground/45 transition-colors hover:bg-surface-3 hover:text-foreground/80"
          title={hasActiveMeeting ? "Join active meeting" : "Start meeting"}
        >
          <Video className={cn("h-3.5 w-3.5", hasActiveMeeting && "text-green-400")} />
        </button>

        <button
          onClick={onPinned}
          className="rounded p-1.5 text-foreground/45 transition-colors hover:bg-surface-3 hover:text-foreground/80"
          title="Pinned messages"
        >
          <Pin className="h-3.5 w-3.5" />
        </button>

        <button
          onClick={onAttachments}
          className="rounded p-1.5 text-foreground/45 transition-colors hover:bg-surface-3 hover:text-foreground/80"
          title="Attachments"
        >
          <Paperclip className="h-3.5 w-3.5" />
        </button>

        {/* Members panel */}
        <div className="relative">
          <button
            onClick={() => handleOpenPanel("members")}
            className="rounded p-1.5 text-foreground/45 transition-colors hover:bg-surface-3 hover:text-foreground/80"
            title="Members"
          >
            <Users className="h-3.5 w-3.5" />
          </button>

          {showMembers && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowMembers(false)}
              />
              <div className="absolute right-0 top-full z-20 mt-1 w-64 rounded-lg border border-subtle bg-surface-2 shadow-lg">
                {/* Tab bar */}
                <div className="flex border-b border-subtle">
                  <button
                    onClick={() => setPanelTab("members")}
                    className={cn(
                      "flex-1 px-3 py-2 text-2xs font-medium transition-colors",
                      panelTab === "members"
                        ? "text-foreground border-b-2 border-ping-purple"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    Members
                  </button>
                  {!isGuest && onInviteMembers && (
                    <button
                      onClick={() => setPanelTab("add")}
                      className={cn(
                        "flex-1 px-3 py-2 text-2xs font-medium transition-colors",
                        panelTab === "add"
                          ? "text-foreground border-b-2 border-ping-purple"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      Add people
                    </button>
                  )}
                  {!isGuest && onGenerateInviteLink && (
                    <button
                      onClick={() => setPanelTab("link")}
                      className={cn(
                        "flex-1 px-3 py-2 text-2xs font-medium transition-colors",
                        panelTab === "link"
                          ? "text-foreground border-b-2 border-ping-purple"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      Guest link
                    </button>
                  )}
                </div>

                {/* Members tab */}
                {panelTab === "members" && (
                  <div className="max-h-56 overflow-y-auto py-1 scrollbar-thin">
                    {members.map((m) => (
                      <div key={m.userId} className="flex items-center gap-2 px-3 py-1.5">
                        <div
                          className={cn(
                            "relative flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-2xs font-medium overflow-hidden",
                            m.isAgent
                              ? "bg-ping-purple/20 text-ping-purple"
                              : "bg-surface-3 text-foreground",
                          )}
                        >
                          {m.isAgent ? (
                            <Bot className="h-2.5 w-2.5" />
                          ) : m.avatarUrl ? (
                            <img src={m.avatarUrl} alt={m.name} className="h-full w-full object-cover" />
                          ) : (
                            getInitials(m.name)
                          )}
                        </div>
                        <span className="truncate text-xs text-foreground">{m.name}</span>
                        {m.isAgent && (
                          <span className="ml-auto text-2xs text-ping-purple/60">Agent</span>
                        )}
                      </div>
                    ))}
                    {members.length === 0 && (
                      <p className="px-3 py-3 text-2xs text-muted-foreground text-center">No members</p>
                    )}
                  </div>
                )}

                {/* Add people tab */}
                {panelTab === "add" && (
                  <div className="py-1">
                    <div className="px-3 py-1.5">
                      <div className="flex items-center gap-2 rounded border border-subtle bg-surface-1 px-2 py-1">
                        <Search className="h-3 w-3 text-muted-foreground shrink-0" />
                        <input
                          type="text"
                          placeholder="Search workspace members..."
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                          className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground outline-none"
                          autoFocus
                        />
                      </div>
                    </div>
                    <div className="max-h-40 overflow-y-auto scrollbar-thin">
                      {addableMembers.map((wm) => (
                        <button
                          key={wm._id}
                          onClick={() => handleToggleSelect(wm._id)}
                          className="flex w-full items-center gap-2 px-3 py-1.5 text-left transition-colors hover:bg-surface-3"
                        >
                          <div className="relative flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-surface-3 text-2xs font-medium overflow-hidden">
                            {wm.avatarUrl ? (
                              <img src={wm.avatarUrl} alt={wm.name} className="h-full w-full object-cover" />
                            ) : (
                              getInitials(wm.name)
                            )}
                          </div>
                          <span className="truncate text-xs text-foreground flex-1">{wm.name}</span>
                          {selectedIds.has(wm._id) && (
                            <Check className="h-3 w-3 text-ping-purple shrink-0" />
                          )}
                        </button>
                      ))}
                      {addableMembers.length === 0 && (
                        <p className="px-3 py-3 text-2xs text-muted-foreground text-center">
                          {search ? "No matching members" : "Everyone is already in this chat"}
                        </p>
                      )}
                    </div>
                    {selectedIds.size > 0 && (
                      <div className="border-t border-subtle px-3 py-2">
                        <button
                          onClick={handleInviteSelected}
                          disabled={inviting}
                          className="flex w-full items-center justify-center gap-1.5 rounded-md bg-ping-purple px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-ping-purple/90 disabled:opacity-50"
                        >
                          {inviting ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <UserPlus className="h-3 w-3" />
                          )}
                          Add {selectedIds.size} {selectedIds.size === 1 ? "person" : "people"}
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Guest link tab */}
                {panelTab === "link" && (
                  <div className="px-3 py-3 space-y-3">
                    <p className="text-2xs text-muted-foreground">
                      Generate a one-time link for guests outside your workspace.
                    </p>
                    {inviteLink ? (
                      <>
                        <div className="flex items-center gap-2 rounded border border-subtle bg-surface-1 px-2 py-1.5 min-w-0">
                          <Link2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          <code className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-2xs text-foreground/70 select-all">
                            /conversation-invite/{inviteLink.token.slice(0, 12)}...
                          </code>
                          <button
                            onClick={onCopyInviteLink}
                            className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-surface-3 hover:text-foreground"
                            title="Copy link"
                          >
                            <Copy className="h-3 w-3" />
                          </button>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-2xs text-muted-foreground">
                            Expires {new Date(inviteLink.expiresAt).toLocaleDateString()}
                          </span>
                          <button
                            onClick={onRevokeInviteLink}
                            className="text-2xs text-status-danger hover:underline"
                          >
                            Revoke
                          </button>
                        </div>
                      </>
                    ) : (
                      <button
                        onClick={onGenerateInviteLink}
                        className="flex w-full items-center justify-center gap-1.5 rounded-md bg-ping-purple px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-ping-purple/90"
                      >
                        <Link2 className="h-3 w-3" />
                        Generate guest link
                      </button>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* More options */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="rounded p-1.5 text-foreground/45 transition-colors hover:bg-surface-3 hover:text-foreground/80"
              title="Options"
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem onClick={onCopyId} className="gap-2 text-xs">
              <Copy className="h-3.5 w-3.5" />
              Copy link
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onArchive} className="gap-2 text-xs">
              <Archive className="h-3.5 w-3.5" />
              Archive
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={onDelete}
              className="gap-2 text-xs text-red-400 focus:text-red-400"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
