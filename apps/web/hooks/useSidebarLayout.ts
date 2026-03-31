"use client";

import { useMemo, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";

export type SidebarItemType = "channel" | "dm";

export interface UnifiedSidebarItem {
  id: string;
  type: SidebarItemType;
  name: string;
  sidebarItemId?: Id<"sidebarItems">;
  sectionId: string;
  sortOrder: number;
  // Channel-specific
  isPrivate?: boolean;
  isStarred?: boolean;
  isMember?: boolean;
  // DM-specific
  kind?: "1to1" | "group" | "agent_1to1" | "agent_group";
  members?: Array<{
    userId: string;
    name: string;
    avatarUrl?: string;
    isAgent: boolean;
  }>;
  // Common
  unreadCount: number;
  unreadMentionCount: number;
  lastActivityAt: number;
}

export type SortMode = "alphabetical" | "recent" | "custom";

export interface SidebarSectionModel {
  id: string;
  name: string;
  sortOrder: number;
  isCollapsed: boolean;
  isDefault: boolean;
  isFavorites?: boolean;
  sortMode: SortMode;
  items: UnifiedSidebarItem[];
}

export interface SidebarLayoutModel {
  sections: SidebarSectionModel[];
  isLoading: boolean;
}

function sortItems(
  items: UnifiedSidebarItem[],
  mode: "alphabetical" | "recent" | "custom",
): UnifiedSidebarItem[] {
  const sorted = [...items];
  switch (mode) {
    case "alphabetical":
      sorted.sort((a, b) => a.name.localeCompare(b.name));
      break;
    case "recent":
      sorted.sort((a, b) => b.lastActivityAt - a.lastActivityAt);
      break;
    case "custom":
      sorted.sort((a, b) => a.sortOrder - b.sortOrder);
      break;
  }
  return sorted;
}

export function useSidebarLayout(
  workspaceId: Id<"workspaces"> | undefined,
  isAuthenticated: boolean,
  pathname: string,
  buildPath: (p: string) => string,
): SidebarLayoutModel {
  const layout = useQuery(
    api.sidebarLayout.getLayout,
    isAuthenticated && workspaceId ? { workspaceId } : "skip",
  );
  const channels = useQuery(
    api.channels.list,
    isAuthenticated && workspaceId ? { workspaceId } : "skip",
  );
  const dmConversations = useQuery(
    api.directConversations.list,
    isAuthenticated ? {} : "skip",
  );
  const user = useQuery(api.users.getMe, isAuthenticated ? {} : "skip");

  const initDefaultSection = useMutation(api.sidebarLayout.initializeDefaultSection);

  // Auto-initialize default section when layout has no sections
  useEffect(() => {
    if (
      layout &&
      layout.sections.length === 0 &&
      workspaceId
    ) {
      initDefaultSection({ workspaceId });
    }
  }, [layout, workspaceId, initDefaultSection]);

  return useMemo(() => {
    const isLoading = !layout || !channels || !dmConversations || !user;

    if (isLoading) {
      return { sections: [], isLoading: true };
    }

    // Global sortMode from preferences is used as fallback for sections without their own sortMode
    const globalSortMode = layout.preferences?.sortMode ?? "recent";
    const sections = layout.sections;
    const items = layout.items;

    // Build maps for fast lookup
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const channelMap = new Map<string, any>();
    for (const ch of channels) {
      channelMap.set(ch._id, ch);
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dmMap = new Map<string, any>();
    for (const dm of dmConversations) {
      dmMap.set(dm._id, dm);
    }

    // Track which channels/DMs are explicitly placed
    const placedChannelIds = new Set<string>();
    const placedDmIds = new Set<string>();

    // Build unified items from sidebarItems
    const itemsBySectionId = new Map<string, UnifiedSidebarItem[]>();
    for (const section of sections) {
      itemsBySectionId.set(section._id, []);
    }

    for (const item of items) {
      let unified: UnifiedSidebarItem | null = null;

      if (item.channelId) {
        const ch = channelMap.get(item.channelId);
        if (ch) {
          placedChannelIds.add(item.channelId);
          unified = {
            id: ch._id,
            type: "channel",
            name: ch.name,
            sidebarItemId: item._id,
            sectionId: item.sectionId,
            sortOrder: item.sortOrder,
            isPrivate: ch.isPrivate,
            isStarred: ch.isStarred,
            isMember: ch.isMember,
            unreadCount: ch.unreadCount,
            unreadMentionCount: ch.unreadMentionCount,
            lastActivityAt: ch.lastMessageAt ?? ch._creationTime,
          };
        }
      } else if (item.conversationId) {
        const dm = dmMap.get(item.conversationId);
        if (dm) {
          placedDmIds.add(item.conversationId);
          const otherMembers = dm.members.filter(
            (m: { userId: string }) => m.userId !== user._id,
          );
          unified = {
            id: dm._id,
            type: "dm",
            name:
              dm.name ||
              otherMembers
                .map((m: { name: string }) => m.name)
                .join(", ") ||
              "DM",
            sidebarItemId: item._id,
            sectionId: item.sectionId,
            sortOrder: item.sortOrder,
            isStarred: dm.isStarred,
            kind: dm.kind,
            members: dm.members,
            unreadCount: dm.unreadCount,
            unreadMentionCount: 0,
            lastActivityAt:
              dm.lastMessage?.timestamp ?? dm._creationTime,
          };
        }
      }

      if (unified && itemsBySectionId.has(item.sectionId)) {
        itemsBySectionId.get(item.sectionId)!.push(unified);
      }
    }

    // Collect unplaced items into the default section
    const defaultSection = sections.find((s) => s.isDefault);
    const defaultSectionId = defaultSection?._id ?? "";
    const unplacedItems: UnifiedSidebarItem[] = [];

    // Unplaced channels
    for (const ch of channels) {
      if (!placedChannelIds.has(ch._id)) {
        unplacedItems.push({
          id: ch._id,
          type: "channel",
          name: ch.name,
          sectionId: defaultSectionId,
          sortOrder: 999999,
          isPrivate: ch.isPrivate,
          isStarred: ch.isStarred,
          isMember: ch.isMember,
          unreadCount: ch.unreadCount,
          unreadMentionCount: ch.unreadMentionCount,
          lastActivityAt: ch.lastMessageAt ?? ch._creationTime,
        });
      }
    }

    // Unplaced DMs
    for (const dm of dmConversations) {
      if (!placedDmIds.has(dm._id)) {
        const otherMembers = dm.members.filter(
          (m: { userId: string }) => m.userId !== user._id,
        );
        unplacedItems.push({
          id: dm._id,
          type: "dm",
          name:
            dm.name ||
            otherMembers
              .map((m: { name: string }) => m.name)
              .join(", ") ||
            "DM",
          sectionId: defaultSectionId,
          isStarred: dm.isStarred,
          kind: dm.kind,
          members: dm.members,
          sortOrder: 999999,
          unreadCount: dm.unreadCount,
          unreadMentionCount: 0,
          lastActivityAt:
            dm.lastMessage?.timestamp ?? dm._creationTime,
        });
      }
    }

    if (defaultSectionId && itemsBySectionId.has(defaultSectionId)) {
      itemsBySectionId.get(defaultSectionId)!.push(...unplacedItems);
    }

    // Build section models
    const sectionModels: SidebarSectionModel[] = sections.map(
      (section) => {
        const sectionSortMode = section.sortMode ?? globalSortMode;
        return {
          id: section._id,
          name: section.name,
          sortOrder: section.sortOrder,
          isCollapsed: section.isCollapsed,
          isDefault: section.isDefault,
          sortMode: sectionSortMode,
          items: sortItems(
            itemsBySectionId.get(section._id) ?? [],
            sectionSortMode,
          ),
        };
      },
    );

    // Extract starred items into a virtual "Favorites" section
    const starredItems: UnifiedSidebarItem[] = [];
    for (const section of sectionModels) {
      const starred = section.items.filter((item) => item.isStarred);
      starredItems.push(...starred);
      section.items = section.items.filter((item) => !item.isStarred);
    }

    if (starredItems.length > 0) {
      const favoritesSection: SidebarSectionModel = {
        id: "__favorites__",
        name: "Favorites",
        sortOrder: -1,
        isCollapsed: false,
        isDefault: false,
        isFavorites: true,
        sortMode: "recent",
        items: sortItems(starredItems, "recent"),
      };
      sectionModels.unshift(favoritesSection);
    }

    return { sections: sectionModels, isLoading: false };
  }, [layout, channels, dmConversations, user, pathname, buildPath]);
}
