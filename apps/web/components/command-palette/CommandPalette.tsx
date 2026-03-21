"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { useConvexAuth } from "convex/react";
import { api } from "@convex/_generated/api";
import {
  Inbox,
  Hash,
  Users,
  Bot,
  GitBranch,
  BarChart2,
  Shield,
  PanelLeftClose,
  User,
  Building2,
  MessageSquare,
  FileText,
} from "lucide-react";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
} from "@/components/ui/command";

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onToggleSidebar?: () => void;
}

const PAGES = [
  { label: "Inbox",           href: "/inbox",                     icon: Inbox,      shortcut: "G I" },
  { label: "Direct Messages", href: "/dms",                       icon: MessageSquare },
  { label: "Workspace",       href: "/settings/workspace",        icon: Building2 },
  { label: "Profile",         href: "/settings/profile",          icon: User },
  { label: "Team",            href: "/settings/team",             icon: Users },
  { label: "Agents",          href: "/settings/agents",           icon: Bot },
  { label: "Knowledge Graph", href: "/settings/knowledge-graph",  icon: GitBranch },
  { label: "Analytics",       href: "/settings/analytics",        icon: BarChart2 },
  { label: "Backoffice",      href: "/admin",                     icon: Shield },
];

export function CommandPalette({ open, onOpenChange, onToggleSidebar }: CommandPaletteProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const { isAuthenticated } = useConvexAuth();

  const channels = useQuery(api.channels.list, isAuthenticated ? {} : "skip");
  const dmConversations = useQuery(api.directConversations.list, isAuthenticated ? {} : "skip");
  const currentUser = useQuery(api.users.getMe, isAuthenticated ? {} : "skip");
  const messageResults = useQuery(
    api.messages.search,
    isAuthenticated && search.length >= 2 ? { query: search } : "skip",
  );

  // Reset search when closed
  useEffect(() => {
    if (!open) setSearch("");
  }, [open]);

  const navigate = (href: string) => {
    router.push(href);
    onOpenChange(false);
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder="Search pages, channels, messages..."
        value={search}
        onValueChange={setSearch}
      />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        <CommandGroup heading="Pages">
          {PAGES.map(({ label, href, icon: Icon, shortcut }) => (
            <CommandItem key={href} onSelect={() => navigate(href)}>
              <Icon className="h-3.5 w-3.5 text-white/40" />
              <span>{label}</span>
              {shortcut && <CommandShortcut>{shortcut}</CommandShortcut>}
            </CommandItem>
          ))}
        </CommandGroup>

        {channels && channels.length > 0 && (
          <CommandGroup heading="Channels">
            {channels.map((channel) => (
              <CommandItem
                key={channel._id}
                onSelect={() => navigate(`/channel/${channel._id}`)}
              >
                <Hash className="h-3.5 w-3.5 text-white/40" />
                <span>{channel.name}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {dmConversations && dmConversations.length > 0 && (
          <CommandGroup heading="Conversations">
            {dmConversations.slice(0, 5).map((conv) => {
              const otherMembers = conv.members.filter(
                (m) => m.userId !== currentUser?._id,
              );
              const displayName =
                conv.name ||
                otherMembers.map((m) => m.name).join(", ") ||
                "DM";
              const isAgent =
                conv.kind === "agent_1to1" || conv.kind === "agent_group";

              return (
                <CommandItem
                  key={conv._id}
                  onSelect={() => navigate(`/dm/${conv._id}`)}
                >
                  {isAgent ? (
                    <Bot className="h-3.5 w-3.5 text-ping-purple" />
                  ) : (
                    <MessageSquare className="h-3.5 w-3.5 text-white/40" />
                  )}
                  <span>{displayName}</span>
                  {isAgent && (
                    <span className="ml-1 rounded border border-ping-purple/30 bg-ping-purple/10 px-1 py-px text-2xs text-ping-purple">
                      Agent
                    </span>
                  )}
                </CommandItem>
              );
            })}
          </CommandGroup>
        )}

        {messageResults && messageResults.length > 0 && (
          <CommandGroup heading="Messages">
            {messageResults.map((msg) => (
              <CommandItem
                key={msg._id}
                onSelect={() => navigate(`/channel/${msg.channelId}`)}
              >
                <FileText className="h-3.5 w-3.5 text-white/40" />
                <div className="flex-1 min-w-0">
                  <span className="truncate text-sm">{msg.body.slice(0, 80)}{msg.body.length > 80 ? "…" : ""}</span>
                  <span className="ml-2 text-2xs text-muted-foreground">
                    #{msg.channelName} · {msg.authorName}
                  </span>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        <CommandGroup heading="Commands">
          <CommandItem
            onSelect={() => {
              onToggleSidebar?.();
              onOpenChange(false);
            }}
          >
            <PanelLeftClose className="h-3.5 w-3.5 text-white/40" />
            <span>Toggle sidebar</span>
            <CommandShortcut>⌘B</CommandShortcut>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
