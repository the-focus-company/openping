"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { UserPlus } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

interface DelegatePickerProps {
  workspaceId: Id<"workspaces">;
  onSelect: (userId: Id<"users">) => void;
  excludeUserId?: Id<"users">;
  children?: React.ReactNode;
}

export function DelegatePicker({
  workspaceId,
  onSelect,
  excludeUserId,
  children,
}: DelegatePickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const members = useQuery(
    api.workspaceMembers.listMembers,
    open ? { workspaceId } : "skip",
  );

  const filteredMembers = (members ?? [])
    .filter((m) => (excludeUserId ? m.userId !== excludeUserId : true))
    .filter((m) => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        m.name.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q)
      );
    });

  const handleSelect = (userId: Id<"users">) => {
    onSelect(userId);
    setOpen(false);
    setSearch("");
  };

  return (
    <Popover open={open} onOpenChange={(val) => {
      setOpen(val);
      if (!val) setSearch("");
    }}>
      <PopoverTrigger asChild>
        {children ?? (
          <Button variant="ghost" size="sm" className="gap-1.5 text-xs">
            <UserPlus className="h-3.5 w-3.5" />
            Delegate
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start">
        <div className="p-2">
          <input
            type="text"
            placeholder="Search members..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            autoFocus
          />
        </div>
        <div className="max-h-48 overflow-y-auto px-1 pb-1">
          {filteredMembers.length === 0 && (
            <p className="px-2 py-3 text-center text-xs text-muted-foreground">
              No members found
            </p>
          )}
          {filteredMembers.map((member) => {
            const initials = member.name
              .split(" ")
              .map((w) => w[0])
              .join("")
              .toUpperCase()
              .slice(0, 2);
            return (
              <button
                key={member.userId}
                onClick={() => handleSelect(member.userId)}
                className="flex w-full items-center gap-2.5 rounded-sm px-2 py-1.5 text-sm transition-colors hover:bg-muted focus:bg-muted focus:outline-none"
              >
                <Avatar className="h-6 w-6">
                  {member.avatarUrl && (
                    <AvatarImage src={member.avatarUrl} alt={member.name} />
                  )}
                  <AvatarFallback className="text-2xs">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col items-start">
                  <span className="text-foreground">{member.name}</span>
                  <span className="text-2xs text-muted-foreground">
                    {member.email}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
