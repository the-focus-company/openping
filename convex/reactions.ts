import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { requireUser, requirePublicChannelOrMember } from "./auth";

function groupReactionsByEmoji<T extends { emoji: string }>(reactions: T[]) {
  const grouped = new Map<string, T[]>();
  for (const reaction of reactions) {
    const entry = grouped.get(reaction.emoji);
    if (entry) {
      entry.push(reaction);
    } else {
      grouped.set(reaction.emoji, [reaction]);
    }
  }
  return grouped;
}

export const toggle = mutation({
  args: {
    messageId: v.id("messages"),
    emoji: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const message = await ctx.db.get(args.messageId);
    if (!message) throw new Error("Message not found");

    const membership = await ctx.db
      .query("channelMembers")
      .withIndex("by_channel_user", (q) =>
        q.eq("channelId", message.channelId).eq("userId", user._id),
      )
      .unique();
    if (!membership) throw new Error("Not a member of this channel");

    const existingReactions = await ctx.db
      .query("reactions")
      .withIndex("by_message_user", (q) =>
        q.eq("messageId", args.messageId).eq("userId", user._id),
      )
      .take(100);

    const existing = existingReactions.find((r) => r.emoji === args.emoji);

    if (existing) {
      await ctx.db.delete(existing._id);
      return null;
    }

    return await ctx.db.insert("reactions", {
      messageId: args.messageId,
      userId: user._id,
      emoji: args.emoji,
    });
  },
});

export const getByMessage = query({
  args: {
    messageId: v.id("messages"),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const message = await ctx.db.get(args.messageId);
    if (!message) return [];
    await requirePublicChannelOrMember(ctx, message.channelId, user._id);

    const reactions = await ctx.db
      .query("reactions")
      .withIndex("by_message", (q) => q.eq("messageId", args.messageId))
      .take(500);

    const grouped = groupReactionsByEmoji(reactions);

    return await Promise.all(
      Array.from(grouped.entries()).map(async ([emoji, emojiReactions]) => {
        const users = await Promise.all(
          emojiReactions.map(async (r) => {
            const user = await ctx.db.get(r.userId);
            return user
              ? { _id: user._id, name: user.name }
              : { _id: r.userId as string, name: "Unknown" };
          }),
        );
        return {
          emoji,
          count: users.length,
          users,
        };
      }),
    );
  },
});

// ─── DM Reactions ────────────────────────────────────────────────

export const toggleDM = mutation({
  args: {
    messageId: v.id("directMessages"),
    emoji: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const message = await ctx.db.get(args.messageId);
    if (!message) throw new Error("Message not found");

    // Verify membership
    const membership = await ctx.db
      .query("directConversationMembers")
      .withIndex("by_conversation_user", (q) =>
        q.eq("conversationId", message.conversationId).eq("userId", user._id),
      )
      .first();
    if (!membership) throw new Error("Not a member of this conversation");

    const existingReactions = await ctx.db
      .query("dmReactions")
      .withIndex("by_message_user", (q) =>
        q.eq("messageId", args.messageId).eq("userId", user._id),
      )
      .take(100);

    const existing = existingReactions.find((r) => r.emoji === args.emoji);

    if (existing) {
      await ctx.db.delete(existing._id);
      return null;
    }

    return await ctx.db.insert("dmReactions", {
      messageId: args.messageId,
      userId: user._id,
      emoji: args.emoji,
    });
  },
});

export const getByDMMessages = query({
  args: {
    messageIds: v.array(v.id("directMessages")),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const result: Record<
      string,
      Array<{ emoji: string; count: number; userIds: string[]; userNames: string[] }>
    > = {};

    await Promise.all(
      args.messageIds.map(async (messageId) => {
        const reactions = await ctx.db
          .query("dmReactions")
          .withIndex("by_message", (q) => q.eq("messageId", messageId))
          .take(500);

        const grouped = groupReactionsByEmoji(reactions);

        result[messageId] = await Promise.all(
          Array.from(grouped.entries()).map(async ([emoji, emojiReactions]) => {
            const users = await Promise.all(
              emojiReactions.map((r) => ctx.db.get(r.userId)),
            );
            return {
              emoji,
              count: emojiReactions.length,
              userIds: emojiReactions.map((r) => r.userId as string),
              userNames: users.map((u) => u?.name ?? "Unknown"),
            };
          }),
        );
      }),
    );

    return result;
  },
});

// ─── Channel Reactions ────────────────────────────────────────────

export const getByMessages = query({
  args: {
    messageIds: v.array(v.id("messages")),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    // Verify membership for all unique channels referenced by these messages
    const messages = await Promise.all(
      args.messageIds.map((id) => ctx.db.get(id)),
    );
    const channelIds = new Set<Id<"channels">>();
    for (const msg of messages) {
      if (msg) channelIds.add(msg.channelId);
    }
    for (const channelId of channelIds) {
      await requirePublicChannelOrMember(ctx, channelId, user._id);
    }

    const result: Record<
      string,
      Array<{ emoji: string; count: number; userIds: string[]; userNames: string[] }>
    > = {};

    await Promise.all(
      args.messageIds.map(async (messageId) => {
        const reactions = await ctx.db
          .query("reactions")
          .withIndex("by_message", (q) => q.eq("messageId", messageId))
          .take(500);

        const grouped = groupReactionsByEmoji(reactions);

        result[messageId] = await Promise.all(
          Array.from(grouped.entries()).map(async ([emoji, emojiReactions]) => {
            const users = await Promise.all(
              emojiReactions.map((r) => ctx.db.get(r.userId)),
            );
            return {
              emoji,
              count: emojiReactions.length,
              userIds: emojiReactions.map((r) => r.userId as string),
              userNames: users.map((u) => u?.name ?? "Unknown"),
            };
          }),
        );
      }),
    );

    return result;
  },
});
