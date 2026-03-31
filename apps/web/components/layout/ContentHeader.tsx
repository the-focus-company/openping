"use client";

import { useState } from "react";
import {
  Pin,
  Paperclip,
  MoreHorizontal,
  Archive,
  Trash2,
  Copy,
  Bot,
  Users,
  Settings,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Member {
  userId: string;
  name: string;
  avatarUrl?: string | null;
  isAgent: boolean;
}

interface ContentHeaderProps {
  /** "channel" | "dm" — drives which elements to show */
  variant: "channel" | "dm";
  /** Members (excluding current user for DMs) */
  members?: Member[];
  /** Total member count (channels pass this directly) */
  memberCount?: number;
  /** DM kind — only relevant for variant="dm" */
  kind?: "1to1" | "group" | "agent_1to1" | "agent_group";

  /* Actions — only rendered when provided */
  onPinned?: () => void;
  onAttachments?: () => void;
  onCopyLink?: () => void;
  onArchive?: () => void;
  onDelete?: () => void;
  onSettings?: () => void;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function ContentHeader({
  variant,
  members = [],
  memberCount,
  kind,
  onPinned,
  onAttachments,
  onCopyLink,
  onArchive,
  onDelete,
  onSettings,
}: ContentHeaderProps) {
  const [showMembers, setShowMembers] = useState(false);

  const isAgent = kind === "agent_1to1" || kind === "agent_group";
  const displayCount =
    memberCount ?? (variant === "dm" ? members.length + 1 : undefined);

  const visible = members.slice(0, 4);
  const overflow = members.length - 4;

  const hasMoreMenu = onCopyLink || onArchive || onDelete;

  return (
    <div className="flex items-center gap-3 border-b border-subtle bg-surface-1 px-4 py-2 shrink-0">
      {/* ---- Left: avatars (DM only) + member badge + AI badge ---- */}
      <div className="flex items-center gap-2.5 flex-1 min-w-0">
        {/* DM: stacked avatars */}
        {variant === "dm" && members.length > 0 && (
          <div className="relative flex items-center shrink-0">
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
        )}

        {/* Member count badge — clickable, opens member list */}
        {displayCount !== undefined && members.length > 0 && (
          <div className="relative">
            <button
              onClick={() => setShowMembers((v) => !v)}
              className="flex shrink-0 items-center gap-1 rounded bg-surface-3 px-1.5 py-px text-2xs text-muted-foreground tabular-nums transition-colors hover:bg-surface-3/80 hover:text-foreground"
            >
              <Users className="h-3 w-3" />
              {displayCount}
            </button>

            {showMembers && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowMembers(false)}
                />
                <div className="absolute left-0 top-full z-20 mt-1 w-48 rounded border border-subtle bg-surface-2 py-1 shadow-lg">
                  {members.map((m) => (
                    <div
                      key={m.userId}
                      className="flex items-center gap-2 px-3 py-1.5"
                    >
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
                      <span className="truncate text-xs text-foreground">
                        {m.name}
                      </span>
                      {m.isAgent && (
                        <span className="ml-auto text-2xs text-ping-purple/60">
                          Agent
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* AI badge (DM only) */}
        {isAgent && (
          <span className="shrink-0 rounded border border-ping-purple/20 bg-ping-purple/10 px-1.5 py-px text-2xs text-ping-purple">
            AI
          </span>
        )}
      </div>

      {/* ---- Right: action icons ---- */}
      <div className="flex items-center gap-0.5 shrink-0">
        {onPinned && (
          <button
            onClick={onPinned}
            className="rounded p-1.5 text-foreground/45 transition-colors hover:bg-surface-3 hover:text-foreground/80"
            title="Pinned messages"
          >
            <Pin className="h-3.5 w-3.5" />
          </button>
        )}

        {onAttachments && (
          <button
            onClick={onAttachments}
            className="rounded p-1.5 text-foreground/45 transition-colors hover:bg-surface-3 hover:text-foreground/80"
            title="Attachments"
          >
            <Paperclip className="h-3.5 w-3.5" />
          </button>
        )}

        {onSettings && (
          <button
            onClick={onSettings}
            className="rounded p-1.5 text-foreground/45 transition-colors hover:bg-surface-3 hover:text-foreground/80"
            title="Settings"
          >
            <Settings className="h-3.5 w-3.5" />
          </button>
        )}

        {/* More options dropdown */}
        {hasMoreMenu && (
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
              {onCopyLink && (
                <DropdownMenuItem
                  onClick={onCopyLink}
                  className="gap-2 text-xs"
                >
                  <Copy className="h-3.5 w-3.5" />
                  Copy link
                </DropdownMenuItem>
              )}
              {onCopyLink && (onArchive || onDelete) && (
                <DropdownMenuSeparator />
              )}
              {onArchive && (
                <DropdownMenuItem
                  onClick={onArchive}
                  className="gap-2 text-xs"
                >
                  <Archive className="h-3.5 w-3.5" />
                  Archive
                </DropdownMenuItem>
              )}
              {onDelete && (
                <DropdownMenuItem
                  onClick={onDelete}
                  className="gap-2 text-xs text-red-400 focus:text-red-400"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  );
}
