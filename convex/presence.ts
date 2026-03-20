import { query, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAuth } from "./auth";

const ONLINE_THRESHOLD_MS = 5 * 60 * 1000;

export const heartbeat = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireAuth(ctx);
    await ctx.db.patch(user._id, {
      lastSeenAt: Date.now(),
      presenceStatus: "online",
    });
  },
});

export const setStatus = mutation({
  args: {
    statusMessage: v.optional(v.string()),
    statusEmoji: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    await ctx.db.patch(user._id, {
      statusMessage: args.statusMessage,
      statusEmoji: args.statusEmoji,
    });
  },
});

export const clearStatus = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireAuth(ctx);
    await ctx.db.patch(user._id, {
      statusMessage: undefined,
      statusEmoji: undefined,
    });
  },
});

export const getOnlineUsers = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireAuth(ctx);
    const cutoff = Date.now() - ONLINE_THRESHOLD_MS;

    const users = await ctx.db
      .query("users")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", user.workspaceId))
      .collect();

    return users
      .filter((u) => u.status === "active" && u.lastSeenAt && u.lastSeenAt > cutoff)
      .map((u) => ({
        _id: u._id,
        name: u.name,
        avatarUrl: u.avatarUrl,
        presenceStatus: u.presenceStatus ?? "offline",
        statusMessage: u.statusMessage,
        statusEmoji: u.statusEmoji,
        lastSeenAt: u.lastSeenAt,
      }));
  },
});

export const getUserPresence = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    await requireAuth(ctx);
    const target = await ctx.db.get(args.userId);
    if (!target) throw new Error("User not found");

    const isOnline =
      !!target.lastSeenAt &&
      target.lastSeenAt > Date.now() - ONLINE_THRESHOLD_MS;

    return {
      _id: target._id,
      name: target.name,
      avatarUrl: target.avatarUrl,
      presenceStatus: isOnline ? ("online" as const) : ("offline" as const),
      statusMessage: target.statusMessage,
      statusEmoji: target.statusEmoji,
      lastSeenAt: target.lastSeenAt,
    };
  },
});

export const decayPresence = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - ONLINE_THRESHOLD_MS;
    const users = await ctx.db.query("users").collect();

    for (const user of users) {
      if (
        user.presenceStatus === "online" &&
        (!user.lastSeenAt || user.lastSeenAt < cutoff)
      ) {
        await ctx.db.patch(user._id, { presenceStatus: "offline" });
      }
    }
  },
});
