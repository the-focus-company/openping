"use client";

import { useState } from "react";
import {
  Pin,
  Paperclip,
  MoreHorizontal,
  Archive,
  ArchiveRestore,
  Copy,
  Bot,
  Users,
  Star,
  LogOut,
  Hash,
  Lock,
  Video,
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
  _id: string;
  name: string;
  avatarUrl?: string | null;
  role: string;
  presenceStatus?: string;
}

interface ChannelTopBarProps {
  name: string;
  description?: string;
  members: Member[];
  memberCount: number;
  isStarred: boolean;
  isPrivate?: boolean;
  isArchived?: boolean;
  isDefault?: boolean;
  isOwnerOrAdmin?: boolean;
  onToggleStar?: () => void;
  onArchive?: () => void;
  onUnarchive?: () => void;
  onCopyLink?: () => void;
  onLeave?: () => void;
  onStartMeeting?: () => void;
  hasActiveMeeting?: boolean;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function ChannelTopBar({
  name,
  description,
  members,
  memberCount,
  isStarred,
  isPrivate,
  isArchived,
  isDefault,
  isOwnerOrAdmin,
  onToggleStar,
  onArchive,
  onUnarchive,
  onCopyLink,
  onLeave,
  onStartMeeting,
  hasActiveMeeting,
}: ChannelTopBarProps) {
  const [showMembers, setShowMembers] = useState(false);

  return (
    <div className="flex h-10 items-center gap-3 border-b border-subtle bg-surface-1 px-4 shrink-0">
      {/* Channel name + member count */}
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {isPrivate ? (
          <Lock className="h-3.5 w-3.5 shrink-0 text-foreground/50" />
        ) : (
          <Hash className="h-3.5 w-3.5 shrink-0 text-foreground/50" />
        )}
        <span className="text-sm font-medium text-foreground truncate">{name}</span>
        {isArchived && (
          <span className="shrink-0 rounded border border-subtle bg-surface-3 px-1.5 py-0.5 text-2xs text-muted-foreground">
            archived
          </span>
        )}
        {description && (
          <>
            <span className="text-foreground/50">|</span>
            <span className="text-2xs text-muted-foreground truncate">{description}</span>
          </>
        )}
      </div>

      {/* Action icons */}
      <div className="flex items-center gap-0.5">
        <button
          onClick={onToggleStar}
          className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-surface-3 hover:text-foreground"
          title={isStarred ? "Unstar channel" : "Star channel"}
        >
          <Star className={cn("h-3.5 w-3.5", isStarred && "fill-yellow-400 text-yellow-400")} />
        </button>

        <button
          onClick={onStartMeeting}
          className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-surface-3 hover:text-foreground"
          title={hasActiveMeeting ? "Join active meeting" : "Start meeting"}
        >
          <Video className={cn("h-3.5 w-3.5", hasActiveMeeting && "text-green-400")} />
        </button>

        <button
          className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-surface-3 hover:text-foreground"
          title="Pinned messages"
        >
          <Pin className="h-3.5 w-3.5" />
        </button>

        <button
          className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-surface-3 hover:text-foreground"
          title="Attachments"
        >
          <Paperclip className="h-3.5 w-3.5" />
        </button>

        {/* Members dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowMembers((v) => !v)}
            className="flex items-center gap-1 rounded p-1.5 text-muted-foreground transition-colors hover:bg-surface-3 hover:text-foreground"
            title="Members"
          >
            <Users className="h-3.5 w-3.5" />
            <span className="text-2xs tabular-nums">{memberCount}</span>
          </button>

          {showMembers && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowMembers(false)}
              />
              <div className="absolute right-0 top-full z-20 mt-1 w-48 max-h-64 overflow-y-auto rounded border border-subtle bg-surface-2 py-1 shadow-lg scrollbar-thin">
                {members.map((m) => (
                  <div key={m._id} className="flex items-center gap-2 px-3 py-1.5">
                    <div
                      className={cn(
                        "relative flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-2xs font-medium overflow-hidden",
                        m.role === "agent"
                          ? "bg-ping-purple/20 text-ping-purple"
                          : "bg-surface-3 text-foreground",
                      )}
                    >
                      {m.role === "agent" ? (
                        <Bot className="h-2.5 w-2.5" />
                      ) : m.avatarUrl ? (
                        <img src={m.avatarUrl} alt={m.name} className="h-full w-full object-cover" />
                      ) : (
                        getInitials(m.name)
                      )}
                    </div>
                    <span className="truncate text-xs text-foreground">{m.name}</span>
                    {m.presenceStatus === "online" && (
                      <span className="ml-auto h-1.5 w-1.5 rounded-full bg-green-400" />
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* More options */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-surface-3 hover:text-foreground"
              title="Options"
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem onClick={onCopyLink} className="gap-2 text-xs">
              <Copy className="h-3.5 w-3.5" />
              Copy link
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {!isArchived && !isDefault && (
              <DropdownMenuItem onClick={onLeave} className="gap-2 text-xs">
                <LogOut className="h-3.5 w-3.5" />
                Leave channel
              </DropdownMenuItem>
            )}
            {isArchived && isOwnerOrAdmin ? (
              <DropdownMenuItem onClick={onUnarchive} className="gap-2 text-xs">
                <ArchiveRestore className="h-3.5 w-3.5" />
                Unarchive
              </DropdownMenuItem>
            ) : !isArchived && !isDefault && isOwnerOrAdmin ? (
              <DropdownMenuItem onClick={onArchive} className="gap-2 text-xs text-red-400 focus:text-red-400">
                <Archive className="h-3.5 w-3.5" />
                Archive
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
