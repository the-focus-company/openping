import { query, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAuth, requireUser } from "./auth";

export const getLayout = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx, args.workspaceId);

    const sections = await ctx.db
      .query("sidebarSections")
      .withIndex("by_user_workspace", (q) =>
        q.eq("userId", user._id).eq("workspaceId", args.workspaceId),
      )
      .collect();

    const items = await ctx.db
      .query("sidebarItems")
      .withIndex("by_user_workspace", (q) =>
        q.eq("userId", user._id).eq("workspaceId", args.workspaceId),
      )
      .collect();

    const prefs = await ctx.db
      .query("sidebarPreferences")
      .withIndex("by_user_workspace", (q) =>
        q.eq("userId", user._id).eq("workspaceId", args.workspaceId),
      )
      .unique();

    return {
      sections: sections.sort((a, b) => a.sortOrder - b.sortOrder),
      items,
      preferences: prefs,
    };
  },
});

export const initializeDefaultSection = mutation({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx, args.workspaceId);

    // Check if default section already exists
    const existing = await ctx.db
      .query("sidebarSections")
      .withIndex("by_user_workspace", (q) =>
        q.eq("userId", user._id).eq("workspaceId", args.workspaceId),
      )
      .collect();

    if (existing.some((s) => s.isDefault)) return;

    await ctx.db.insert("sidebarSections", {
      userId: user._id,
      workspaceId: args.workspaceId,
      name: "Conversations",
      sortOrder: 0,
      isCollapsed: false,
      isDefault: true,
    });
  },
});

export const createSection = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx, args.workspaceId);

    const sections = await ctx.db
      .query("sidebarSections")
      .withIndex("by_user_workspace", (q) =>
        q.eq("userId", user._id).eq("workspaceId", args.workspaceId),
      )
      .collect();

    // New sections go before the default section
    const defaultSection = sections.find((s) => s.isDefault);
    const nonDefaultSections = sections.filter((s) => !s.isDefault);
    const maxNonDefault = nonDefaultSections.length > 0
      ? Math.max(...nonDefaultSections.map((s) => s.sortOrder))
      : -1;

    // Place new section after all non-default sections but before default
    const newSortOrder = maxNonDefault + 1;

    // Ensure default section is pushed after
    if (defaultSection && defaultSection.sortOrder <= newSortOrder) {
      await ctx.db.patch(defaultSection._id, {
        sortOrder: newSortOrder + 1,
      });
    }

    return await ctx.db.insert("sidebarSections", {
      userId: user._id,
      workspaceId: args.workspaceId,
      name: args.name.trim(),
      sortOrder: newSortOrder,
      isCollapsed: false,
      isDefault: false,
    });
  },
});

export const renameSection = mutation({
  args: {
    sectionId: v.id("sidebarSections"),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const section = await ctx.db.get(args.sectionId);
    if (!section) throw new Error("Section not found");
    if (section.userId !== user._id) throw new Error("Not your section");
    if (section.isDefault) throw new Error("Cannot rename default section");

    await ctx.db.patch(args.sectionId, { name: args.name.trim() });
  },
});

export const deleteSection = mutation({
  args: { sectionId: v.id("sidebarSections") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const section = await ctx.db.get(args.sectionId);
    if (!section) throw new Error("Section not found");
    if (section.userId !== user._id) throw new Error("Not your section");
    if (section.isDefault) throw new Error("Cannot delete default section");

    // Find the default section to move items to
    const defaultSection = await ctx.db
      .query("sidebarSections")
      .withIndex("by_user_workspace", (q) =>
        q.eq("userId", user._id).eq("workspaceId", section.workspaceId),
      )
      .collect()
      .then((sections) => sections.find((s) => s.isDefault));

    if (!defaultSection) throw new Error("Default section not found");

    // Move all items from deleted section to default
    const items = await ctx.db
      .query("sidebarItems")
      .withIndex("by_section", (q) => q.eq("sectionId", args.sectionId))
      .collect();

    // Get current max sortOrder in default section
    const defaultItems = await ctx.db
      .query("sidebarItems")
      .withIndex("by_section", (q) => q.eq("sectionId", defaultSection._id))
      .collect();
    let maxOrder = defaultItems.length > 0
      ? Math.max(...defaultItems.map((i) => i.sortOrder))
      : -1;

    for (const item of items) {
      maxOrder += 1;
      await ctx.db.patch(item._id, {
        sectionId: defaultSection._id,
        sortOrder: maxOrder,
      });
    }

    await ctx.db.delete(args.sectionId);
  },
});

export const reorderSections = mutation({
  args: {
    sectionIdOrder: v.array(v.id("sidebarSections")),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    for (let i = 0; i < args.sectionIdOrder.length; i++) {
      const section = await ctx.db.get(args.sectionIdOrder[i]);
      if (!section) throw new Error("Section not found");
      if (section.userId !== user._id) throw new Error("Not your section");
      await ctx.db.patch(args.sectionIdOrder[i], { sortOrder: i });
    }
  },
});

export const toggleSectionCollapse = mutation({
  args: { sectionId: v.id("sidebarSections") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const section = await ctx.db.get(args.sectionId);
    if (!section) throw new Error("Section not found");
    if (section.userId !== user._id) throw new Error("Not your section");

    await ctx.db.patch(args.sectionId, {
      isCollapsed: !section.isCollapsed,
    });
  },
});

export const moveItemToSection = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    conversationId: v.id("conversations"),
    targetSectionId: v.id("sidebarSections"),
    sortOrder: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx, args.workspaceId);

    // Verify target section belongs to user
    const section = await ctx.db.get(args.targetSectionId);
    if (!section || section.userId !== user._id) {
      throw new Error("Section not found");
    }

    // Find existing sidebarItem
    const existingItem = await ctx.db
      .query("sidebarItems")
      .withIndex("by_user_and_conversation", (q) =>
        q.eq("userId", user._id).eq("conversationId", args.conversationId),
      )
      .first();

    // Calculate sortOrder if not provided
    let sortOrder = args.sortOrder;
    if (sortOrder === undefined) {
      const sectionItems = await ctx.db
        .query("sidebarItems")
        .withIndex("by_section", (q) => q.eq("sectionId", args.targetSectionId))
        .collect();
      sortOrder = sectionItems.length > 0
        ? Math.max(...sectionItems.map((i) => i.sortOrder)) + 1
        : 0;
    }

    if (existingItem) {
      await ctx.db.patch(existingItem._id, {
        sectionId: args.targetSectionId,
        sortOrder,
      });
      return existingItem._id;
    }

    return await ctx.db.insert("sidebarItems", {
      userId: user._id,
      workspaceId: args.workspaceId,
      sectionId: args.targetSectionId,
      conversationId: args.conversationId,
      sortOrder,
    });
  },
});

export const reorderItemsInSection = mutation({
  args: {
    sectionId: v.id("sidebarSections"),
    itemIdOrder: v.array(v.id("sidebarItems")),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const section = await ctx.db.get(args.sectionId);
    if (!section || section.userId !== user._id) {
      throw new Error("Section not found");
    }

    for (let i = 0; i < args.itemIdOrder.length; i++) {
      const item = await ctx.db.get(args.itemIdOrder[i]);
      if (!item) throw new Error("Item not found");
      if (item.userId !== user._id) throw new Error("Not your item");
      await ctx.db.patch(args.itemIdOrder[i], { sortOrder: i });
    }
  },
});

export const removeItemFromSection = mutation({
  args: { itemId: v.id("sidebarItems") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const item = await ctx.db.get(args.itemId);
    if (!item) throw new Error("Item not found");
    if (item.userId !== user._id) throw new Error("Not your item");

    await ctx.db.delete(args.itemId);
  },
});

export const setSectionSortMode = mutation({
  args: {
    sectionId: v.id("sidebarSections"),
    sortMode: v.union(
      v.literal("alphabetical"),
      v.literal("recent"),
      v.literal("custom"),
    ),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const section = await ctx.db.get(args.sectionId);
    if (!section) throw new Error("Section not found");
    if (section.userId !== user._id) throw new Error("Not your section");

    await ctx.db.patch(args.sectionId, { sortMode: args.sortMode });
  },
});

export const setSortMode = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    sortMode: v.union(
      v.literal("alphabetical"),
      v.literal("recent"),
      v.literal("custom"),
    ),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx, args.workspaceId);

    const existing = await ctx.db
      .query("sidebarPreferences")
      .withIndex("by_user_workspace", (q) =>
        q.eq("userId", user._id).eq("workspaceId", args.workspaceId),
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, { sortMode: args.sortMode });
    } else {
      await ctx.db.insert("sidebarPreferences", {
        userId: user._id,
        workspaceId: args.workspaceId,
        sortMode: args.sortMode,
      });
    }
  },
});

export const bakeCurrentOrder = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    itemOrder: v.array(
      v.object({
        conversationId: v.id("conversations"),
        sectionId: v.id("sidebarSections"),
        sortOrder: v.number(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx, args.workspaceId);

    // Delete all existing items for this user+workspace
    const existing = await ctx.db
      .query("sidebarItems")
      .withIndex("by_user_workspace", (q) =>
        q.eq("userId", user._id).eq("workspaceId", args.workspaceId),
      )
      .collect();

    for (const item of existing) {
      await ctx.db.delete(item._id);
    }

    // Create new items in the specified order
    for (const entry of args.itemOrder) {
      await ctx.db.insert("sidebarItems", {
        userId: user._id,
        workspaceId: args.workspaceId,
        sectionId: entry.sectionId,
        conversationId: entry.conversationId,
        sortOrder: entry.sortOrder,
      });
    }
  },
});

/** One-time migration: rename "Channels & DMs" default sections to "Communication". */
export const migrateDefaultSectionName = internalMutation({
  args: {},
  handler: async (ctx) => {
    const sections = await ctx.db
      .query("sidebarSections")
      .filter((q) => q.eq(q.field("isDefault"), true))
      .collect();

    let updated = 0;
    for (const section of sections) {
      if (section.name === "Channels & DMs") {
        await ctx.db.patch(section._id, { name: "Conversations" });
        updated++;
      }
    }
    console.log(`[migration] Renamed ${updated} default sections to "Communication"`);
  },
});
