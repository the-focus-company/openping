import { query, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAuth } from "./auth";

export const setTyping = mutation({
  args: { channelId: v.id("channels") },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    const existing = await ctx.db
      .query("typingIndicators")
      .withIndex("by_channel_user", (q) =>
        q.eq("channelId", args.channelId).eq("userId", user._id),
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, { expiresAt: Date.now() + 5000 });
    } else {
      await ctx.db.insert("typingIndicators", {
        channelId: args.channelId,
        userId: user._id,
        expiresAt: Date.now() + 5000,
      });
    }
  },
});

export const clearTyping = mutation({
  args: { channelId: v.id("channels") },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    const existing = await ctx.db
      .query("typingIndicators")
      .withIndex("by_channel_user", (q) =>
        q.eq("channelId", args.channelId).eq("userId", user._id),
      )
      .unique();

    if (existing) {
      await ctx.db.delete(existing._id);
    }
  },
});

export const getTypingUsers = query({
  args: { channelId: v.id("channels") },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    const indicators = await ctx.db
      .query("typingIndicators")
      .withIndex("by_channel", (q) => q.eq("channelId", args.channelId))
      .collect();

    const now = Date.now();
    const activeIndicators = indicators.filter(
      (ind) => ind.expiresAt > now && ind.userId !== user._id,
    );

    const users = await Promise.all(
      activeIndicators.map((ind) => ctx.db.get(ind.userId)),
    );

    return users
      .filter((u) => u !== null)
      .map((u) => ({ _id: u._id, name: u.name, avatarUrl: u.avatarUrl }));
  },
});

export const cleanupExpired = internalMutation({
  args: {},
  handler: async (ctx) => {
    const indicators = await ctx.db.query("typingIndicators").collect();
    const now = Date.now();

    for (const ind of indicators) {
      if (ind.expiresAt < now) {
        await ctx.db.delete(ind._id);
      }
    }
  },
});
