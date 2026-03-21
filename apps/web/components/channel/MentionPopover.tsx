"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useConvexAuth } from "convex/react";
import { api } from "@convex/_generated/api";
import { Bot } from "lucide-react";
import { cn } from "@/lib/utils";
import { useWorkspace } from "@/hooks/useWorkspace";

export interface MentionUser {
  id: string;
  name: string;
  role: string;
  isBot?: boolean;
}

interface MentionPopoverProps {
  /** The search query typed after @ */
  query: string;
  /** Whether the popover is visible */
  isOpen: boolean;
  /** Position of the popover (relative to the composer) */
  position: { top: number; left: number };
  /** Called when a user is selected */
  onSelect: (user: MentionUser) => void;
  /** Called when the popover should be dismissed */
  onDismiss: () => void;
}

const KNOWLEDGE_BOT: MentionUser = {
  id: "knowledge-bot",
  name: "KnowledgeBot",
  role: "bot",
  isBot: true,
};

export function MentionPopover({
  query,
  isOpen,
  position,
  onSelect,
  onDismiss,
}: MentionPopoverProps) {
  const { isAuthenticated } = useConvexAuth();
  const { workspaceId } = useWorkspace();
  const allUsers = useQuery(api.users.listAll, isAuthenticated && workspaceId ? { workspaceId } : "skip");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  // Build filtered list: KnowledgeBot first, then workspace users
  const filteredUsers: MentionUser[] = (() => {
    const lowerQuery = query.toLowerCase();

    const botMatches =
      !lowerQuery || "knowledgebot".includes(lowerQuery) || "bot".includes(lowerQuery);

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
      }));

    const result: MentionUser[] = [];
    if (botMatches) result.push(KNOWLEDGE_BOT);
    result.push(...workspaceUsers);
    return result;
  })();

  // Reset selected index when query or list changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query, filteredUsers.length]);

  // Scroll selected item into view
  useEffect(() => {
    if (!listRef.current) return;
    const items = listRef.current.querySelectorAll("[data-mention-item]");
    items[selectedIndex]?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  // Keyboard handler — attached to window so it captures events from the textarea
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isOpen) return;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev < filteredUsers.length - 1 ? prev + 1 : 0
          );
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev > 0 ? prev - 1 : filteredUsers.length - 1
          );
          break;
        case "Enter":
        case "Tab":
          if (filteredUsers.length > 0) {
            e.preventDefault();
            onSelect(filteredUsers[selectedIndex]);
          }
          break;
        case "Escape":
          e.preventDefault();
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
        <span className="text-2xs font-medium uppercase tracking-widest text-white/25">
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
            {/* Avatar */}
            {user.isBot ? (
              <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ping-purple/20">
                <Bot className="h-3 w-3 text-ping-purple" />
              </div>
            ) : (
              <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-surface-3 text-2xs font-medium text-foreground">
                {user.name[0]?.toUpperCase() ?? "?"}
              </div>
            )}

            {/* Name */}
            <span className="flex-1 truncate">{user.name}</span>

            {/* Role badge */}
            {user.isBot ? (
              <span className="rounded border border-ping-purple/30 bg-ping-purple/10 px-1 py-px text-2xs text-ping-purple">
                AI
              </span>
            ) : user.role === "admin" ? (
              <span className="rounded border border-white/10 bg-white/5 px-1 py-px text-2xs text-white/40">
                admin
              </span>
            ) : null}
          </button>
        ))}
      </div>
    </div>
  );
}
