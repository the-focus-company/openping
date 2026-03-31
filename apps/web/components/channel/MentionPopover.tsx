"use client";

import { useState, useEffect, useRef, useCallback, useContext } from "react";
import { useQuery, useConvexAuth } from "convex/react";
import { api } from "@convex/_generated/api";
import { Bot } from "lucide-react";
import { cn } from "@/lib/utils";
import { WorkspaceContext } from "@/components/workspace/WorkspaceProvider";

export interface MentionUser {
  id: string;
  name: string;
  role: string;
  avatarUrl?: string | null;
  isBot?: boolean;
  isAgent?: boolean;
  agentColor?: string;
  isManagedAgent?: boolean;
}

interface MentionPopoverProps {
  query: string;
  isOpen: boolean;
  position: { top: number; left: number };
  onSelect: (user: MentionUser) => void;
  onDismiss: () => void;
}

export function MentionPopover({
  query,
  isOpen,
  position,
  onSelect,
  onDismiss,
}: MentionPopoverProps) {
  const { isAuthenticated } = useConvexAuth();
  const workspaceCtx = useContext(WorkspaceContext);
  const workspaceId = workspaceCtx?.workspaceId;
  const allUsers = useQuery(api.users.listAll, isAuthenticated && workspaceId ? { workspaceId } : "skip");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const filteredUsers: MentionUser[] = (() => {
    const lowerQuery = query.toLowerCase();

    const workspaceUsers: MentionUser[] = (allUsers ?? [])
      .filter(
        (u) =>
          u.status === "active" &&
          (!lowerQuery || u.name.toLowerCase().includes(lowerQuery) || u.email.toLowerCase().includes(lowerQuery))
      )
      .map((u) => ({
        id: u._id,
        name: u.name,
        role: u.role,
        avatarUrl: u.avatarUrl,
        isBot: !!u.isAgent,
        isAgent: !!u.isAgent,
        agentColor: u.agentColor ?? undefined,
        isManagedAgent: !!u.isManagedAgent,
      }));

    // Sort: managed agents first, then custom agents, then users alphabetically
    return workspaceUsers.sort((a, b) => {
      if (a.isManagedAgent && !b.isManagedAgent) return -1;
      if (!a.isManagedAgent && b.isManagedAgent) return 1;
      if (a.isAgent && !b.isAgent) return -1;
      if (!a.isAgent && b.isAgent) return 1;
      return a.name.localeCompare(b.name);
    });
  })();

  useEffect(() => {
    setSelectedIndex(0);
  }, [query, filteredUsers.length]);

  useEffect(() => {
    if (!listRef.current) return;
    const items = listRef.current.querySelectorAll("[data-mention-item]");
    items[selectedIndex]?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isOpen) return;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          e.stopPropagation();
          setSelectedIndex((prev) =>
            prev < filteredUsers.length - 1 ? prev + 1 : 0
          );
          break;
        case "ArrowUp":
          e.preventDefault();
          e.stopPropagation();
          setSelectedIndex((prev) =>
            prev > 0 ? prev - 1 : filteredUsers.length - 1
          );
          break;
        case "Enter":
        case "Tab":
          if (filteredUsers.length > 0) {
            e.preventDefault();
            e.stopPropagation();
            onSelect(filteredUsers[selectedIndex]);
          }
          break;
        case "Escape":
          e.preventDefault();
          e.stopPropagation();
          onDismiss();
          break;
      }
    },
    [isOpen, filteredUsers, selectedIndex, onSelect, onDismiss]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [handleKeyDown]);

  if (!isOpen || filteredUsers.length === 0) return null;

  return (
    <div
      className="absolute z-50 w-64 rounded-md border border-subtle bg-surface-2 shadow-xl"
      style={{
        bottom: position.top,
        left: position.left,
      }}
    >
      <div className="px-2 py-1.5 border-b border-subtle">
        <span className="text-2xs font-medium uppercase tracking-widest text-foreground/45">
          Mention someone
        </span>
      </div>
      <div
        ref={listRef}
        className="max-h-48 overflow-y-auto scrollbar-thin py-1"
      >
        {filteredUsers.map((user, index) => (
          <button
            key={user.id}
            data-mention-item
            onClick={() => onSelect(user)}
            onMouseEnter={() => setSelectedIndex(index)}
            className={cn(
              "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-xs transition-colors",
              index === selectedIndex
                ? "bg-ping-purple/20 text-foreground"
                : "text-foreground/80 hover:bg-surface-3"
            )}
          >
            {user.isAgent ? (
              <div
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
                style={{ backgroundColor: `${user.agentColor ?? "#5E6AD2"}20` }}
              >
                <Bot className="h-3 w-3" style={{ color: user.agentColor ?? "#5E6AD2" }} />
              </div>
            ) : user.avatarUrl ? (
              <div className="h-5 w-5 shrink-0 overflow-hidden rounded-full">
                <img src={user.avatarUrl} alt={user.name} className="h-full w-full object-cover" />
              </div>
            ) : (
              <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-surface-3 text-2xs font-medium text-foreground">
                {user.name[0]?.toUpperCase() ?? "?"}
              </div>
            )}

            <span className="flex-1 truncate">{user.name}</span>

            {user.isAgent ? (
              <span className="rounded border border-ping-purple/30 bg-ping-purple/10 px-1 py-px text-2xs text-ping-purple">
                Agent
              </span>
            ) : user.role === "admin" ? (
              <span className="rounded border border-foreground/10 bg-foreground/5 px-1 py-px text-2xs text-foreground/40">
                admin
              </span>
            ) : null}
          </button>
        ))}
      </div>
    </div>
  );
}
