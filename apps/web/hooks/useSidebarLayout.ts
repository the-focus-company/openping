"use client";

import { useMemo, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";

export interface UnifiedSidebarItem {
  id: string;
  name: string;
  kind: "1to1" | "group" | "agent_1to1" | "agent_group";
  visibility: "public" | "secret" | "secret_can_be_public";
  sidebarItemId?: Id<"sidebarItems">;
  sectionId: string;
  sortOrder: number;
  isStarred?: boolean;
  isMember?: boolean;
  members?: Array<{
    userId: string;
    name: string;
    avatarUrl?: string;
    isAgent: boolean;
  }>;
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
  const conversations = useQuery(
    api.conversations.list,
    isAuthenticated && workspaceId ? { workspaceId } : "skip",
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
    const isLoading = !layout || !conversations || !user;

    if (isLoading) {
      return { sections: [], isLoading: true };
    }

    // Global sortMode from preferences is used as fallback for sections without their own sortMode
    const globalSortMode = layout.preferences?.sortMode ?? "recent";
    const sections = layout.sections;
    const items = layout.items;

    // Build map for fast lookup
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const conversationMap = new Map<string, any>();
    for (const conv of conversations) {
      conversationMap.set(conv._id, conv);
    }

    // Track which conversations are explicitly placed
    const placedConversationIds = new Set<string>();

    // Build unified items from sidebarItems
    const itemsBySectionId = new Map<string, UnifiedSidebarItem[]>();
    for (const section of sections) {
      itemsBySectionId.set(section._id, []);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const toSidebarItem = (conv: any, overrides: Partial<UnifiedSidebarItem>): UnifiedSidebarItem => {
      const otherMembers = conv.members.filter(
        (m: { userId: string }) => m.userId !== user._id,
      );
      return {
        id: conv._id,
        name:
          conv.name ||
          otherMembers.map((m: { name: string }) => m.name).join(", ") ||
          "Conversation",
        kind: conv.kind,
        visibility: conv.visibility,
        isStarred: conv.isStarred,
        isMember: conv.isMember,
        members: conv.members,
        unreadCount: conv.unreadCount,
        unreadMentionCount: conv.unreadMentionCount ?? 0,
        lastActivityAt: conv.lastMessageAt ?? conv._creationTime,
        sectionId: "",
        sortOrder: 0,
        ...overrides,
      };
    };

    for (const item of items) {
      if (!item.conversationId) continue;
      const conv = conversationMap.get(item.conversationId);
      if (!conv) continue;

      placedConversationIds.add(item.conversationId);
      const unified = toSidebarItem(conv, {
        sidebarItemId: item._id,
        sectionId: item.sectionId,
        sortOrder: item.sortOrder,
      });

      if (itemsBySectionId.has(item.sectionId)) {
        itemsBySectionId.get(item.sectionId)!.push(unified);
      }
    }

    // Collect unplaced conversations into the default section
    const defaultSection = sections.find((s) => s.isDefault);
    const defaultSectionId = defaultSection?._id ?? "";
    const unplacedItems: UnifiedSidebarItem[] = [];

    for (const conv of conversations) {
      if (placedConversationIds.has(conv._id)) continue;
      unplacedItems.push(toSidebarItem(conv, {
        sectionId: defaultSectionId,
        sortOrder: 999999,
      }));
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
  // eslint-disable-next-line react-hooks/exhaustive-deps -- pathname/buildPath not used in memo
  }, [layout, conversations, user]);
}
