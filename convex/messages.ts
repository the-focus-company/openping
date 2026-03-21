import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { requireAuth } from "./auth";

export const list = query({
  args: {
    channelId: v.id("channels"),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx);

    const results = await ctx.db
      .query("messages")
      .withIndex("by_channel", (q) => q.eq("channelId", args.channelId))
      .order("desc")
      .paginate(args.paginationOpts);

    const messagesWithAuthors = await Promise.all(
      results.page.map(async (message) => {
        const author = await ctx.db.get(message.authorId);
        return {
          ...message,
          author: author
            ? { name: author.name, avatarUrl: author.avatarUrl }
            : null,
        };
      }),
    );

    return {
      ...results,
      page: messagesWithAuthors,
    };
  },
});

export const send = mutation({
  args: {
    channelId: v.id("channels"),
    body: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    const messageId = await ctx.db.insert("messages", {
      channelId: args.channelId,
      authorId: user._id,
      body: args.body,
      type: "user",
      isEdited: false,
    });

    // Update sender's lastReadAt so their own message doesn't count as unread
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

export const search = query({
  args: {
    query: v.string(),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx);

    if (!args.query.trim()) return [];

    const results = await ctx.db
      .query("messages")
      .withSearchIndex("search_body", (q) => q.search("body", args.query))
      .take(10);

    const enriched = await Promise.all(
      results.map(async (msg) => {
        const author = await ctx.db.get(msg.authorId);
        const channel = await ctx.db.get(msg.channelId);
        return {
          _id: msg._id,
          body: msg.body,
          channelId: msg.channelId,
          channelName: channel?.name ?? "unknown",
          authorName: author?.name ?? "Unknown",
          timestamp: msg._creationTime,
        };
      }),
    );

    return enriched;
  },
});
