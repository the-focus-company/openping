import { Hash, Bot, MessageSquare, PanelLeftClose, Video } from "lucide-react";
import {
  CommandGroup,
  CommandItem,
  CommandEmpty,
  CommandShortcut,
} from "@/components/ui/command";
import { PAGES, DECISIONS } from "./command-palette-config";

interface Conversation {
  _id: string;
  kind: string;
  name?: string;
  visibility?: string;
  members: Array<{ userId: string; name: string }>;
}

interface DefaultCommandsProps {
  conversations: Conversation[] | undefined;
  currentUserId: string | undefined;
  onNavigate: (href: string) => void;
  onToggleSidebar?: () => void;
  onStartMeeting?: () => void;
  onClose: () => void;
}

export function DefaultCommands({
  conversations,
  currentUserId,
  onNavigate,
  onToggleSidebar,
  onStartMeeting,
  onClose,
}: DefaultCommandsProps) {
  const channels = conversations?.filter((c) => c.visibility === "public" && c.name);
  const dmConversations = conversations?.filter((c) => c.visibility !== "public" || !c.name);

  return (
    <>
      <CommandEmpty>
        <span className="text-white/30">No results found.</span>
      </CommandEmpty>

      <CommandGroup heading="Pages">
        {PAGES.map(({ label, href, icon: Icon, shortcut }) => (
          <CommandItem key={href} onSelect={() => onNavigate(href)}>
            <Icon className="h-3.5 w-3.5 text-white/25" />
            <span>{label}</span>
            {shortcut && <CommandShortcut className="text-[11px] text-white/20">{shortcut}</CommandShortcut>}
          </CommandItem>
        ))}
      </CommandGroup>

      {channels && channels.length > 0 && (
        <CommandGroup heading="Channels">
          {channels.map((channel) => (
            <CommandItem
              key={channel._id}
              onSelect={() => onNavigate(`/c/${channel._id}`)}
            >
              <Hash className="h-3.5 w-3.5 text-white/25" />
              <span>{channel.name}</span>
            </CommandItem>
          ))}
        </CommandGroup>
      )}

      {dmConversations && dmConversations.length > 0 && (
        <CommandGroup heading="Conversations">
          {dmConversations.slice(0, 5).map((conv) => {
            const otherMembers = conv.members.filter(
              (m) => m.userId !== currentUserId,
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
                onSelect={() => onNavigate(`/c/${conv._id}`)}
              >
                {isAgent ? (
                  <Bot className="h-3.5 w-3.5 text-violet-400" />
                ) : (
                  <MessageSquare className="h-3.5 w-3.5 text-white/25" />
                )}
                <span>{displayName}</span>
                {isAgent && (
                  <span className="ml-1 rounded-md border border-violet-500/20 bg-violet-500/10 px-1.5 py-px text-[10px] font-medium text-violet-400">
                    Agent
                  </span>
                )}
              </CommandItem>
            );
          })}
        </CommandGroup>
      )}

      <CommandGroup heading="Decisions">
        {DECISIONS.map(({ label, href, icon: Icon, shortcut }) => (
          <CommandItem key={label} onSelect={() => onNavigate(href)}>
            <Icon className="h-3.5 w-3.5 text-white/25" />
            <span>{label}</span>
            {shortcut && <CommandShortcut className="text-[11px] text-white/20">{shortcut}</CommandShortcut>}
          </CommandItem>
        ))}
      </CommandGroup>

      <CommandGroup heading="Commands">
        {onStartMeeting && (
          <CommandItem
            onSelect={() => {
              onStartMeeting();
              onClose();
            }}
          >
            <Video className="h-3.5 w-3.5 text-white/25" />
            <span>Start a meeting</span>
            <CommandShortcut className="text-[11px] text-white/20">⌘⇧M</CommandShortcut>
          </CommandItem>
        )}
        <CommandItem
          onSelect={() => {
            onToggleSidebar?.();
            onClose();
          }}
        >
          <PanelLeftClose className="h-3.5 w-3.5 text-white/25" />
          <span>Toggle sidebar</span>
          <CommandShortcut className="text-[11px] text-white/20">⌘B</CommandShortcut>
        </CommandItem>
      </CommandGroup>
    </>
  );
}
