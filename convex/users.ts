import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAuth } from "./auth";

export const getMe = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    return await ctx.db
      .query("users")
      .withIndex("by_workos_id", (q) =>
        q.eq("workosUserId", identity.subject),
      )
      .unique();
  },
});

export const listAll = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireAuth(ctx);
    const users = await ctx.db
      .query("users")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", user.workspaceId))
      .take(200);
    return users
      .filter((u) => u.status === "active")
      .map((u) => ({
        _id: u._id,
        name: u.name,
        email: u.email,
        avatarUrl: u.avatarUrl,
        role: u.role,
      }));
  },
});

export const getByWorkosId = query({
  args: { workosUserId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_workos_id", (q) =>
        q.eq("workosUserId", args.workosUserId),
      )
      .unique();
  },
});

export const updateProfile = mutation({
  args: {
    name: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_workos_id", (q) =>
        q.eq("workosUserId", identity.subject),
      )
      .unique();

    if (!user) throw new Error("User not found");

    const updates: Record<string, unknown> = { lastSeenAt: Date.now() };
    if (args.name !== undefined) updates.name = args.name;

    await ctx.db.patch(user._id, updates);
    return user._id;
  },
});

export const createOrUpdate = mutation({
  args: {
    workosUserId: v.string(),
    email: v.string(),
    name: v.string(),
    avatarUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_workos_id", (q) =>
        q.eq("workosUserId", args.workosUserId),
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        email: args.email,
        name: args.name,
        avatarUrl: args.avatarUrl,
        lastSeenAt: Date.now(),
      });
      return existing._id;
    }

    // For new users, find or create default workspace
    let workspace = await ctx.db
      .query("workspaces")
      .withIndex("by_slug", (q) => q.eq("slug", "default"))
      .unique();

    if (!workspace) {
      // Create a temporary user ID placeholder - we'll update after
      const workspaceId = await ctx.db.insert("workspaces", {
        name: "Default Workspace",
        slug: "default",
        createdBy: "" as any, // Will be updated
        integrations: {},
      });
      workspace = await ctx.db.get(workspaceId);
    }

    const userId = await ctx.db.insert("users", {
      workosUserId: args.workosUserId,
      email: args.email,
      name: args.name,
      avatarUrl: args.avatarUrl,
      role: "member",
      workspaceId: workspace!._id,
      status: "active",
      lastSeenAt: Date.now(),
    });

    // Auto-join default channels
    const defaultChannels = await ctx.db
      .query("channels")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspace!._id))
      .collect();

    for (const channel of defaultChannels) {
      if (channel.isDefault) {
        await ctx.db.insert("channelMembers", {
          channelId: channel._id,
          userId,
        });
      }
    }

    return userId;
  },
});
