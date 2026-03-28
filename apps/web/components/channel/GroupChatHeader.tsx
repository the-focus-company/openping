"use client";

import { useState } from "react";
import { Users } from "lucide-react";
import { cn } from "@/lib/utils";

interface Member {
  userId: string;
  name: string;
  avatarUrl?: string | null;
  isAgent: boolean;
}

interface GroupChatHeaderProps {
  name: string;
  members: Member[];
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function GroupChatHeader({ name, members }: GroupChatHeaderProps) {
  const [showMembers, setShowMembers] = useState(false);
  const visible = members.slice(0, 3);
  const overflow = members.length - 3;

  return (
    <div className="flex items-center gap-3 border-b border-subtle bg-surface-1 px-4 py-2">
      {/* Stacked avatars */}
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
            {m.avatarUrl ? (
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

      {/* Name */}
      <span className="text-sm font-medium text-foreground">{name}</span>
      <span className="text-2xs text-muted-foreground">{members.length} members</span>

      {/* Member list toggle */}
      <div className="relative ml-auto">
        <button
          onClick={() => setShowMembers((v) => !v)}
          className="rounded p-1 text-foreground/50 transition-colors hover:bg-surface-3 hover:text-foreground"
          title="Members"
        >
          <Users className="h-3.5 w-3.5" />
        </button>

        {showMembers && (
          <div className="absolute right-0 top-full z-20 mt-1 w-48 rounded border border-subtle bg-surface-2 py-1 shadow-lg">
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
                  {m.avatarUrl ? (
                    <img src={m.avatarUrl} alt={m.name} className="h-full w-full object-cover" />
                  ) : (
                    getInitials(m.name)
                  )}
                </div>
                <span className="truncate text-xs text-foreground">{m.name}</span>
                {m.isAgent && (
                  <span className="ml-auto text-2xs text-ping-purple">AI</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
