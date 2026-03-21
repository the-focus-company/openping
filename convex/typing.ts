import { query, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { requireUser, requireChannelMember, requireDMmember } from "./auth";

const TYPING_TTL = 5000;

// ── Channel typing ──────────────────────────────────────────────────

export const setTyping = mutation({
  args: { channelId: v.id("channels") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    await requireChannelMember(ctx, args.channelId, user._id);

    const existing = await ctx.db
      .query("typingIndicators")
      .withIndex("by_channel_user", (q) =>
        q.eq("channelId", args.channelId).eq("userId", user._id),
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, { expiresAt: Date.now() + TYPING_TTL });
    } else {
      await ctx.db.insert("typingIndicators", {
        channelId: args.channelId,
        userId: user._id,
        expiresAt: Date.now() + TYPING_TTL,
      });
    }
  },
});

export const clearTyping = mutation({
  args: { channelId: v.id("channels") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    await requireChannelMember(ctx, args.channelId, user._id);

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
    const user = await requireUser(ctx);
    await requireChannelMember(ctx, args.channelId, user._id);

    const indicators = await ctx.db
      .query("typingIndicators")
      .withIndex("by_channel", (q) => q.eq("channelId", args.channelId))
      .take(50);

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

// ── DM typing ───────────────────────────────────────────────────────

export const setTypingDM = mutation({
  args: { conversationId: v.id("directConversations") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    await requireDMmember(ctx, args.conversationId, user._id);

    const existing = await ctx.db
      .query("typingIndicators")
      .withIndex("by_conversation_user", (q) =>
        q.eq("conversationId", args.conversationId).eq("userId", user._id),
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, { expiresAt: Date.now() + TYPING_TTL });
    } else {
      await ctx.db.insert("typingIndicators", {
        conversationId: args.conversationId,
        userId: user._id,
        expiresAt: Date.now() + TYPING_TTL,
      });
    }
  },
});

export const clearTypingDM = mutation({
  args: { conversationId: v.id("directConversations") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    await requireDMmember(ctx, args.conversationId, user._id);

    const existing = await ctx.db
      .query("typingIndicators")
      .withIndex("by_conversation_user", (q) =>
        q.eq("conversationId", args.conversationId).eq("userId", user._id),
      )
      .unique();

    if (existing) {
      await ctx.db.delete(existing._id);
    }
  },
});

export const getTypingUsersDM = query({
  args: { conversationId: v.id("directConversations") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    await requireDMmember(ctx, args.conversationId, user._id);

    const indicators = await ctx.db
      .query("typingIndicators")
      .withIndex("by_conversation", (q) =>
        q.eq("conversationId", args.conversationId),
      )
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

// ── Channel thread typing ───────────────────────────────────────────

export const setTypingThread = mutation({
  args: { threadMessageId: v.id("messages") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const parent = await ctx.db.get(args.threadMessageId);
    if (!parent) throw new Error("Parent message not found");
    await requireChannelMember(ctx, parent.channelId, user._id);

    const existing = await ctx.db
      .query("typingIndicators")
      .withIndex("by_thread_message_user", (q) =>
        q.eq("threadMessageId", args.threadMessageId).eq("userId", user._id),
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, { expiresAt: Date.now() + TYPING_TTL });
    } else {
      await ctx.db.insert("typingIndicators", {
        threadMessageId: args.threadMessageId,
        userId: user._id,
        expiresAt: Date.now() + TYPING_TTL,
      });
    }
  },
});

export const clearTypingThread = mutation({
  args: { threadMessageId: v.id("messages") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const parent = await ctx.db.get(args.threadMessageId);
    if (!parent) throw new Error("Parent message not found");
    await requireChannelMember(ctx, parent.channelId, user._id);

    const existing = await ctx.db
      .query("typingIndicators")
      .withIndex("by_thread_message_user", (q) =>
        q.eq("threadMessageId", args.threadMessageId).eq("userId", user._id),
      )
      .unique();

    if (existing) {
      await ctx.db.delete(existing._id);
    }
  },
});

export const getTypingUsersThread = query({
  args: { threadMessageId: v.id("messages") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const parent = await ctx.db.get(args.threadMessageId);
    if (!parent) throw new Error("Parent message not found");
    await requireChannelMember(ctx, parent.channelId, user._id);

    const indicators = await ctx.db
      .query("typingIndicators")
      .withIndex("by_thread_message", (q) =>
        q.eq("threadMessageId", args.threadMessageId),
      )
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

// ── DM thread typing ────────────────────────────────────────────────

export const setTypingThreadDM = mutation({
  args: { threadDmMessageId: v.id("directMessages") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const parent = await ctx.db.get(args.threadDmMessageId);
    if (!parent) throw new Error("Parent message not found");
    await requireDMmember(ctx, parent.conversationId, user._id);

    const existing = await ctx.db
      .query("typingIndicators")
      .withIndex("by_thread_dm_user", (q) =>
        q.eq("threadDmMessageId", args.threadDmMessageId).eq("userId", user._id),
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, { expiresAt: Date.now() + TYPING_TTL });
    } else {
      await ctx.db.insert("typingIndicators", {
        threadDmMessageId: args.threadDmMessageId,
        userId: user._id,
        expiresAt: Date.now() + TYPING_TTL,
      });
    }
  },
});

export const clearTypingThreadDM = mutation({
  args: { threadDmMessageId: v.id("directMessages") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const parent = await ctx.db.get(args.threadDmMessageId);
    if (!parent) throw new Error("Parent message not found");
    await requireDMmember(ctx, parent.conversationId, user._id);

    const existing = await ctx.db
      .query("typingIndicators")
      .withIndex("by_thread_dm_user", (q) =>
        q.eq("threadDmMessageId", args.threadDmMessageId).eq("userId", user._id),
      )
      .unique();

    if (existing) {
      await ctx.db.delete(existing._id);
    }
  },
});

export const getTypingUsersThreadDM = query({
  args: { threadDmMessageId: v.id("directMessages") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const parent = await ctx.db.get(args.threadDmMessageId);
    if (!parent) throw new Error("Parent message not found");
    await requireDMmember(ctx, parent.conversationId, user._id);

    const indicators = await ctx.db
      .query("typingIndicators")
      .withIndex("by_thread_dm", (q) =>
        q.eq("threadDmMessageId", args.threadDmMessageId),
      )
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

// ── Cleanup ─────────────────────────────────────────────────────────

export const cleanupExpired = internalMutation({
  args: {},
  handler: async (ctx) => {
    const indicators = await ctx.db.query("typingIndicators").take(1000);
    const now = Date.now();

    for (const ind of indicators) {
      if (ind.expiresAt < now) {
        await ctx.db.delete(ind._id);
      }
    }
  },
});
