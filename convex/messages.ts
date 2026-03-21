import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireUser } from "./auth";

export const send = mutation({
  args: {
    channelId: v.id("channels"),
    body: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const messageId = await ctx.db.insert("messages", {
      channelId: args.channelId,
      authorId: user._id,
      body: args.body,
      type: "user",
      isEdited: false,
    });

    // Update sender's lastReadAt
    const membership = await ctx.db
      .query("channelMembers")
      .withIndex("by_channel_user", (q) =>
        q.eq("channelId", args.channelId).eq("userId", user._id),
      )
      .unique();
    if (membership) {
      await ctx.db.patch(membership._id, { lastReadAt: Date.now() });
    }

    return messageId;
  },
});

export const listByChannel = query({
  args: { channelId: v.id("channels"), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requireUser(ctx);

    const messages = await ctx.db
      .query("messages")
      .withIndex("by_channel", (q) => q.eq("channelId", args.channelId))
      .order("desc")
      .take(args.limit ?? 50);

    return Promise.all(
      messages.map(async (msg) => {
        const author = await ctx.db.get(msg.authorId);
        return {
          ...msg,
          author: author ? { name: author.name, avatarUrl: author.avatarUrl } : null,
        };
      }),
    );
  },
});
