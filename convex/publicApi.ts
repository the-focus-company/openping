import { v } from "convex/values";
import { internalMutation } from "./_generated/server";

export const toggleReaction = internalMutation({
  args: {
    messageId: v.id("messages"),
    userId: v.id("users"),
    workspaceId: v.id("workspaces"),
    emoji: v.string(),
  },
  handler: async (ctx, { messageId, userId, workspaceId, emoji }) => {
    // Verify message exists and belongs to workspace
    const message = await ctx.db.get(messageId);
    if (!message) throw new Error("Message not found");

    const channel = await ctx.db.get(message.channelId);
    if (!channel || channel.workspaceId !== workspaceId) {
      throw new Error("Message not found or access denied");
    }

    // Verify user is channel member
    const membership = await ctx.db
      .query("channelMembers")
      .withIndex("by_channel_user", (q) =>
        q.eq("channelId", channel._id).eq("userId", userId),
      )
      .first();
    if (!membership) throw new Error("Not a member of this channel");

    // Check for existing reaction
    const existingReactions = await ctx.db
      .query("reactions")
      .withIndex("by_message_user", (q) =>
        q.eq("messageId", messageId).eq("userId", userId),
      )
      .take(100);

    const existing = existingReactions.find((r) => r.emoji === emoji);

    if (existing) {
      // Remove reaction
      await ctx.db.delete(existing._id);
      return { added: false, emoji };
    }

    // Add reaction
    const reactionId = await ctx.db.insert("reactions", {
      messageId,
      userId,
      emoji,
    });

    return { added: true, emoji, reactionId };
  },
});
