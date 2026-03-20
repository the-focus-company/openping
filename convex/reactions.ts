import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAuth } from "./auth";

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
    const user = await requireAuth(ctx);

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
      .collect();

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
    await requireAuth(ctx);

    const reactions = await ctx.db
      .query("reactions")
      .withIndex("by_message", (q) => q.eq("messageId", args.messageId))
      .collect();

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

export const getByMessages = query({
  args: {
    messageIds: v.array(v.id("messages")),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx);

    const result: Record<
      string,
      Array<{ emoji: string; count: number; userIds: string[] }>
    > = {};

    await Promise.all(
      args.messageIds.map(async (messageId) => {
        const reactions = await ctx.db
          .query("reactions")
          .withIndex("by_message", (q) => q.eq("messageId", messageId))
          .collect();

        const grouped = groupReactionsByEmoji(reactions);

        result[messageId] = Array.from(grouped.entries()).map(
          ([emoji, emojiReactions]) => ({
            emoji,
            count: emojiReactions.length,
            userIds: emojiReactions.map((r) => r.userId as string),
          }),
        );
      }),
    );

    return result;
  },
});
