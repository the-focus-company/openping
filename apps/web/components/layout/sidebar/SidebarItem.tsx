"use client";

import Link from "next/link";
import { Lock, User, Users, Sparkles, Star, GripVertical } from "lucide-react";
import { StatusDot } from "@/components/ui/status-dot";
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubTrigger,
  ContextMenuSubContent,
} from "@/components/ui/context-menu";
import { cn } from "@/lib/utils";
import type { UnifiedSidebarItem, SidebarSectionModel } from "@/hooks/useSidebarLayout";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface SidebarItemProps {
  item: UnifiedSidebarItem;
  sortMode: "alphabetical" | "recent" | "custom";
  inFavorites?: boolean;
  onlineUserIds: Set<string>;
  userId?: string;
  buildPath: (p: string) => string;
  pathname: string;
  onToggleStar?: (itemId: string) => void;
  onMoveToSection?: (
    itemId: string,
    targetSectionId: string,
  ) => void;
  sections: SidebarSectionModel[];
}

/** Returns true if this conversation looks like a traditional "channel" (public/secret group). */
function isChannelLike(item: UnifiedSidebarItem): boolean {
  return item.kind === "group" && item.visibility !== "secret";
}

function ItemIcon({ item }: { item: UnifiedSidebarItem }) {
  // Channel-like conversations (public groups) get # or lock icon
  if (isChannelLike(item)) {
    return (
      <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center">
        <span className="text-2xs font-medium text-foreground/50">#</span>
      </span>
    );
  }

  // Secret groups get a lock icon
  if (item.kind === "group" && item.visibility === "secret") {
    return (
      <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center">
        <Lock className="h-3 w-3 text-foreground/50" />
      </span>
    );
  }

  // Agent conversations
  if (item.kind === "agent_group") {
    return (
      <div className="relative flex h-3.5 w-3.5 shrink-0 items-center justify-center">
        <Users className="h-3.5 w-3.5 text-foreground/50" />
        <Sparkles className="absolute -right-1.5 -top-1 h-2 w-2 text-ping-purple" />
      </div>
    );
  }
  if (item.kind === "agent_1to1") {
    return (
      <div className="relative flex h-3.5 w-3.5 shrink-0 items-center justify-center">
        <User className="h-3.5 w-3.5 text-foreground/50" />
        <Sparkles className="absolute -right-1.5 -top-1 h-2 w-2 text-ping-purple" />
      </div>
    );
  }

  // 1:1 DM
  return <User className="h-3.5 w-3.5 shrink-0 text-foreground/50" />;
}

/** Show presence dot for DM-like conversations (1:1, agent). */
function isDMLike(item: UnifiedSidebarItem): boolean {
  return item.kind === "1to1" || item.kind === "agent_1to1";
}

export function SidebarItem({
  item,
  sortMode,
  inFavorites,
  onlineUserIds,
  userId,
  buildPath,
  pathname,
  onToggleStar,
  onMoveToSection,
  sections,
}: SidebarItemProps) {
  const href = buildPath(`/c/${item.id}`);
  const isActive = pathname.endsWith(`/c/${item.id}`);

  const isCustom = sortMode === "custom";
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: item.id,
    disabled: !isCustom,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const otherMembersOnline =
    isDMLike(item) &&
    item.members?.some(
      (m) => m.userId !== userId && onlineUserIds.has(m.userId),
    );

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          ref={setNodeRef}
          style={style}
          className={cn(isDragging && "opacity-50")}
          {...attributes}
        >
          <Link
            href={href}
            data-nav-item
            tabIndex={-1}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "group/ch relative flex h-7 items-center gap-2 rounded px-2 text-sm",
              "transition-colors duration-100",
              isActive
                ? "bg-ping-purple-muted text-foreground before:absolute before:left-0 before:top-1/2 before:h-4 before:-translate-y-1/2 before:w-0.5 before:rounded-r before:bg-ping-purple"
                : "text-muted-foreground hover:bg-surface-3 hover:text-foreground",
            )}
          >
            {isCustom && (
              <GripVertical
                className="h-3 w-3 shrink-0 cursor-grab text-foreground/20 opacity-0 transition-opacity group-hover/ch:opacity-100"
                {...listeners}
              />
            )}
            <ItemIcon item={item} />
            {isDMLike(item) && (
              <StatusDot
                variant={otherMembersOnline ? "online" : "offline"}
                size="xs"
              />
            )}
            <span
              className={cn(
                "flex-1 truncate",
                item.unreadCount > 0 && "font-semibold text-foreground",
              )}
            >
              {item.name}
            </span>
            {!inFavorites && onToggleStar && item.isMember && (
              <Star
                className={cn(
                  "h-3 w-3 shrink-0 cursor-pointer transition-opacity",
                  item.isStarred
                    ? "fill-yellow-400 text-yellow-400 opacity-100"
                    : "text-foreground/40 opacity-0 group-hover/ch:opacity-100",
                )}
                tabIndex={-1}
                aria-label="Add to favorites"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onToggleStar(item.id);
                }}
              />
            )}
            {item.unreadMentionCount > 0 && (
              <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-ping-purple px-1 text-2xs font-medium text-white tabular-nums">
                {item.unreadMentionCount > 99
                  ? "99+"
                  : item.unreadMentionCount}
              </span>
            )}
            {item.unreadMentionCount === 0 && item.unreadCount > 0 && (
              <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-ping-purple px-1 text-2xs font-medium text-white tabular-nums">
                {item.unreadCount > 99 ? "99+" : item.unreadCount}
              </span>
            )}
          </Link>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-48 bg-surface-2 border-subtle">
        {onToggleStar && item.isMember && (
          <ContextMenuItem
            className="cursor-pointer text-xs"
            onClick={() => onToggleStar(item.id)}
          >
            <Star className="mr-2 h-3 w-3" />
            {item.isStarred ? "Remove from favorites" : "Add to favorites"}
          </ContextMenuItem>
        )}
        {onMoveToSection && sections.length > 1 && (
          <ContextMenuSub>
            <ContextMenuSubTrigger className="cursor-pointer text-xs">
              Move to section
            </ContextMenuSubTrigger>
            <ContextMenuSubContent className="bg-surface-2 border-subtle">
              {sections
                .filter((s) => s.id !== item.sectionId)
                .map((s) => (
                  <ContextMenuItem
                    key={s.id}
                    className="cursor-pointer text-xs"
                    onClick={() =>
                      onMoveToSection(item.id, s.id)
                    }
                  >
                    {s.name}
                  </ContextMenuItem>
                ))}
            </ContextMenuSubContent>
          </ContextMenuSub>
        )}
        <ContextMenuSeparator />
        <ContextMenuItem className="cursor-pointer text-xs" disabled>
          Mute
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
