import { User, MessageSquare, ArrowRight } from "lucide-react";
import {
  CommandGroup,
  CommandItem,
  CommandEmpty,
} from "@/components/ui/command";
import { SkeletonGroup } from "./CommandPaletteSkeletons";

function truncate(text: string, maxLen = 80): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen).trimEnd() + "…";
}

function timeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

interface PersonResult {
  _id: string;
  name: string;
  email?: string;
  avatarUrl?: string | null;
  presenceStatus?: string;
}

interface MessageResult {
  _id: string;
  body: string;
  authorName: string;
  _creationTime: number;
  href: string;
  context: string;
}

interface DmConversation {
  _id: string;
  kind: string;
  members: Array<{ userId: string; name: string }>;
}

interface SearchResultsProps {
  isSearching: boolean;
  hasAnyResults: boolean;
  debouncedSearch: string;
  peopleResults: PersonResult[] | undefined;
  allMessageResults: MessageResult[];
  dmConversations: DmConversation[] | undefined;
  onNavigate: (href: string) => void;
  onOpenProfile: (userId: string) => void;
}

export function SearchResults({
  isSearching,
  hasAnyResults,
  debouncedSearch,
  peopleResults,
  allMessageResults,
  dmConversations,
  onNavigate,
  onOpenProfile,
}: SearchResultsProps) {
  if (isSearching) {
    return (
      <div className="py-1">
        <SkeletonGroup heading="People" rows={2} />
        <SkeletonGroup heading="Messages" rows={3} />
      </div>
    );
  }

  if (!hasAnyResults) {
    return (
      <CommandEmpty>
        <span className="text-white/30">No results for &ldquo;{debouncedSearch}&rdquo;</span>
      </CommandEmpty>
    );
  }

  return (
    <>
      {peopleResults && peopleResults.length > 0 && (
        <CommandGroup heading="People">
          {peopleResults.map((person) => {
            const existingDm = dmConversations?.find(
              (c) =>
                c.kind === "1to1" &&
                c.members.some((m) => m.userId === person._id),
            );
            return (
              <CommandItem
                key={person._id}
                value={`person-${person.name}-${person.email}`}
                onSelect={() => onOpenProfile(person._id)}
              >
                {person.avatarUrl ? (
                  <img
                    src={person.avatarUrl}
                    alt=""
                    className="h-5 w-5 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-white/[0.07]">
                    <User className="h-3 w-3 text-white/40" />
                  </div>
                )}
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="truncate text-[13px]">{person.name}</span>
                  <span className="truncate text-[11px] text-white/30">
                    {person.email}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 ml-auto shrink-0">
                  {person.presenceStatus === "online" && (
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  )}
                  {existingDm && (
                    <button
                      type="button"
                      className="rounded-md p-1 text-white/20 hover:bg-white/[0.07] hover:text-white/50 transition-colors"
                      title="Go to conversation"
                      onClick={(e) => {
                        e.stopPropagation();
                        onNavigate(`/dm/${existingDm._id}`);
                      }}
                    >
                      <MessageSquare className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </CommandItem>
            );
          })}
        </CommandGroup>
      )}

      {allMessageResults.length > 0 && (
        <CommandGroup heading="Messages">
          {allMessageResults.map((msg) => (
            <CommandItem
              key={msg._id}
              value={`msg-${msg._id}-${msg.body.slice(0, 30)}`}
              onSelect={() => onNavigate(`${msg.href}?msg=${msg._id}`)}
            >
              <MessageSquare className="h-3.5 w-3.5 text-white/20 shrink-0" />
              <div className="flex flex-col min-w-0 flex-1">
                <span className="truncate text-[13px]">
                  {truncate(msg.body)}
                </span>
                <span className="truncate text-[11px] text-white/30">
                  {msg.authorName} in {msg.context} · {timeAgo(msg._creationTime)}
                </span>
              </div>
              <ArrowRight className="h-3 w-3 text-white/10 shrink-0" />
            </CommandItem>
          ))}
        </CommandGroup>
      )}
    </>
  );
}
