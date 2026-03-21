import { query, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { requireUser } from "./auth";

const ONLINE_THRESHOLD_MS = 5 * 60 * 1000;

export const heartbeat = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
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
    const user = await requireUser(ctx);
    await ctx.db.patch(user._id, {
      statusMessage: args.statusMessage,
      statusEmoji: args.statusEmoji,
    });
  },
});

export const clearStatus = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    await ctx.db.patch(user._id, {
      statusMessage: undefined,
      statusEmoji: undefined,
    });
  },
});

export const getOnlineUsers = query({
  args: {
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    const cutoff = Date.now() - ONLINE_THRESHOLD_MS;

    const wsMembers = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .take(1000);

    const users = await Promise.all(
      wsMembers.map(async (m) => {
        const u = await ctx.db.get(m.userId);
        return u;
      }),
    );

    return users
      .filter((u): u is NonNullable<typeof u> =>
        u !== null && u !== undefined && u.status === "active" && !!u.lastSeenAt && u.lastSeenAt > cutoff,
      )
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
    await requireUser(ctx);
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
    const users = await ctx.db.query("users").take(10000);

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
