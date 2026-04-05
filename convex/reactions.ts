import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { requireUser, requireConversationMember } from "./auth";

export const toggle = mutation({
  args: {
    messageId: v.id("messages"),
    emoji: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const message = await ctx.db.get(args.messageId);
    if (!message) throw new Error("Message not found");

    await requireConversationMember(ctx, message.conversationId!, user._id);

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

export const getByMessages = query({
  args: {
    messageIds: v.array(v.id("messages")),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    // Verify membership for all unique conversations referenced by these messages
    const messages = await Promise.all(
      args.messageIds.map((id) => ctx.db.get(id)),
    );
    const conversationIds = new Set<Id<"conversations">>();
    for (const msg of messages) {
      if (msg) conversationIds.add(msg.conversationId!);
    }
    for (const conversationId of conversationIds) {
      await requireConversationMember(ctx, conversationId, user._id);
    }

    const result: Record<
      string,
      Array<{
        emoji: string;
        count: number;
        userIds: string[];
        userNames: string[];
      }>
    > = {};

    // Fetch all reactions for all messages in parallel
    const allReactionsByMessage = await Promise.all(
      args.messageIds.map((messageId) =>
        ctx.db
          .query("reactions")
          .withIndex("by_message", (q) => q.eq("messageId", messageId))
          .take(500),
      ),
    );

    // Collect all unique user IDs and batch fetch
    const allUserIds: Id<"users">[] = [];
    const seenIds = new Set<string>();
    for (const reactions of allReactionsByMessage) {
      for (const r of reactions) {
        if (!seenIds.has(r.userId as string)) {
          seenIds.add(r.userId as string);
          allUserIds.push(r.userId);
        }
      }
    }
    const users = await Promise.all(
      allUserIds.map((id) => ctx.db.get(id)),
    );
    const userMap = new Map<string, string>();
    for (const u of users) {
      if (u) userMap.set(u._id as string, u.name);
    }

    // Group and build results synchronously
    for (let i = 0; i < args.messageIds.length; i++) {
      const messageId = args.messageIds[i];
      const reactions = allReactionsByMessage[i];

      const grouped = new Map<string, (typeof reactions)[number][]>();
      for (const reaction of reactions) {
        const entry = grouped.get(reaction.emoji);
        if (entry) entry.push(reaction);
        else grouped.set(reaction.emoji, [reaction]);
      }

      result[messageId] = Array.from(grouped.entries()).map(([emoji, emojiReactions]) => ({
        emoji,
        count: emojiReactions.length,
        userIds: emojiReactions.map((r) => r.userId as string),
        userNames: emojiReactions.map((r) => userMap.get(r.userId as string) ?? "Unknown"),
      }));
    }

    return result;
  },
});
