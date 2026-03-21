import { query, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAuth, requireUser } from "./auth";

export const create = mutation({
  args: {
    name: v.string(),
    slug: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const existing = await ctx.db
      .query("workspaces")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
    if (existing) throw new Error("Workspace slug already taken");

    const workspaceId = await ctx.db.insert("workspaces", {
      name: args.name,
      slug: args.slug,
      createdBy: user._id,
    });

    await ctx.db.insert("workspaceMembers", {
      userId: user._id,
      workspaceId,
      role: "admin",
      joinedAt: Date.now(),
    });

    // Create a default #general channel
    const channelId = await ctx.db.insert("channels", {
      name: "general",
      description: "General discussion",
      workspaceId,
      createdBy: user._id,
      isDefault: true,
      isArchived: false,
    });

    await ctx.db.insert("channelMembers", {
      channelId,
      userId: user._id,
    });

    return workspaceId;
  },
});

export const get = query({
  args: {
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx, args.workspaceId);
    return await ctx.db.get(args.workspaceId);
  },
});

export const update = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    name: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx, args.workspaceId);
    if (user.role !== "admin") {
      throw new Error("Only admins can update the workspace");
    }
    if (args.name !== undefined) {
      await ctx.db.patch(args.workspaceId, { name: args.name });
    }
  },
});

export const setWorkosOrgId = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    workosOrgId: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.workspaceId, { workosOrgId: args.workosOrgId });
  },
});

export const getBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("workspaces")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
  },
});
