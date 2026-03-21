import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { Doc } from "./_generated/dataModel";
import { requireUser } from "./auth";

function authorSummary(user: Doc<"users"> | null) {
  return user ? { name: user.name, avatarUrl: user.avatarUrl } : null;
}

export const send = mutation({
  args: {
    channelId: v.id("channels"),
    body: v.string(),
    threadParentId: v.optional(v.id("messages")),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    let parentReplyCount = 0;
    if (args.threadParentId) {
      const parent = await ctx.db.get(args.threadParentId);
      if (!parent) throw new Error("Thread parent message not found");
      if (parent.channelId !== args.channelId) {
        throw new Error("Thread parent must belong to the same channel");
      }
      // Prevent nested threads
      if (parent.threadParentId) {
        throw new Error("Cannot create nested threads");
      }
      parentReplyCount = parent.replyCount ?? 0;
    }

    const messageId = await ctx.db.insert("messages", {
      channelId: args.channelId,
      authorId: user._id,
      body: args.body,
      type: "user",
      isEdited: false,
      threadParentId: args.threadParentId,
    });

    if (args.threadParentId) {
      await ctx.db.patch(args.threadParentId, {
        replyCount: parentReplyCount + 1,
      });
    }

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

    const limit = args.limit ?? 50;

    // Over-fetch to compensate for filtered-out thread replies
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_channel", (q) => q.eq("channelId", args.channelId))
      .order("desc")
      .take(limit * 2);

    const topLevelMessages = messages
      .filter((msg) => !msg.threadParentId)
      .slice(0, limit);

    return Promise.all(
      topLevelMessages.map(async (msg) => {
        const author = await ctx.db.get(msg.authorId);

        let lastRepliers: Array<{ name: string; avatarUrl?: string }> = [];
        if (msg.replyCount && msg.replyCount > 0) {
          const recentReplies = await ctx.db
            .query("messages")
            .withIndex("by_thread_parent", (q) =>
              q.eq("threadParentId", msg._id),
            )
            .order("desc")
            .take(3);

          const seenIds = new Set<string>();
          const uniqueReplierIds = recentReplies
            .map((r) => r.authorId)
            .filter((id) => {
              if (seenIds.has(id)) return false;
              seenIds.add(id);
              return true;
            });
          const replierUsers = await Promise.all(
            uniqueReplierIds.map((id) => ctx.db.get(id)),
          );
          lastRepliers = replierUsers
            .filter(Boolean)
            .map((u) => ({ name: u!.name, avatarUrl: u!.avatarUrl }));
        }

        return {
          ...msg,
          author: authorSummary(author),
          lastRepliers,
        };
      }),
    );
  },
});

export const listThread = query({
  args: { parentMessageId: v.id("messages") },
  handler: async (ctx, args) => {
    await requireUser(ctx);

    const parent = await ctx.db.get(args.parentMessageId);
    if (!parent) throw new Error("Parent message not found");

    const replies = await ctx.db
      .query("messages")
      .withIndex("by_thread_parent", (q) =>
        q.eq("threadParentId", args.parentMessageId),
      )
      .order("asc")
      .take(200);

    const parentAuthor = await ctx.db.get(parent.authorId);

    const repliesWithAuthors = await Promise.all(
      replies.map(async (msg) => {
        const author = await ctx.db.get(msg.authorId);
        return { ...msg, author: authorSummary(author) };
      }),
    );

    const participantIds = [
      ...new Set([parent.authorId, ...replies.map((r) => r.authorId)]),
    ];

    return {
      parent: { ...parent, author: authorSummary(parentAuthor) },
      replies: repliesWithAuthors,
      participantIds,
      replyCount: parent.replyCount ?? 0,
    };
  },
});
