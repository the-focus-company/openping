import { mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { requireUser, requireChannelMember, requireDMmember, requirePublicChannelOrMember } from "./auth";
import { attachmentValidator } from "./files";

// ── Channel threads ─────────────────────────────────────────────────

export const sendReply = mutation({
  args: {
    channelId: v.id("channels"),
    threadId: v.id("messages"),
    body: v.string(),
    alsoSendToChannel: v.optional(v.boolean()),
    attachments: v.optional(v.array(attachmentValidator)),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    await requireChannelMember(ctx, args.channelId, user._id);

    // Validate parent exists in this channel and is top-level
    const parent = await ctx.db.get(args.threadId);
    if (!parent) throw new Error("Parent message not found");
    if (parent.channelId !== args.channelId)
      throw new Error("Parent message is not in this channel");
    if (parent.threadId)
      throw new Error("Cannot create nested threads");

    // Insert reply
    const replyId = await ctx.db.insert("messages", {
      channelId: args.channelId,
      authorId: user._id,
      body: args.body,
      type: "user",
      isEdited: false,
      threadId: args.threadId,
      alsoSentToChannel: args.alsoSendToChannel ?? false,
      ...(args.attachments && args.attachments.length > 0
        ? { attachments: args.attachments }
        : {}),
    });

    // Ingest into knowledge graph with thread context
    await ctx.scheduler.runAfter(0, internal.ingest.processMessage, {
      messageId: replyId,
      threadId: args.threadId,
    });

    // Update parent denormalized thread fields
    const currentParticipants = parent.threadParticipantIds ?? [];
    const newParticipants = currentParticipants.includes(user._id)
      ? currentParticipants
      : [...currentParticipants, user._id].slice(0, 20);

    await ctx.db.patch(args.threadId, {
      threadReplyCount: (parent.threadReplyCount ?? 0) + 1,
      threadLastReplyAt: Date.now(),
      threadLastReplyAuthorId: user._id,
      threadParticipantIds: newParticipants,
    });

    // Update sender's lastReadAt on channel membership
    const membership = await ctx.db
      .query("channelMembers")
      .withIndex("by_channel_user", (q) =>
        q.eq("channelId", args.channelId).eq("userId", user._id),
      )
      .unique();
    if (membership) {
      await ctx.db.patch(membership._id, { lastReadAt: Date.now() });
    }

    return replyId;
  },
});

export const listReplies = query({
  args: { threadId: v.id("messages") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const parent = await ctx.db.get(args.threadId);
    if (!parent) throw new Error("Parent message not found");

    await requirePublicChannelOrMember(ctx, parent.channelId, user._id);

    const replies = await ctx.db
      .query("messages")
      .withIndex("by_thread", (q) => q.eq("threadId", args.threadId))
      .order("asc")
      .take(200);

    const parentAuthor = await ctx.db.get(parent.authorId);
    const enrichedParent = {
      ...parent,
      author: parentAuthor
        ? { name: parentAuthor.name, avatarUrl: parentAuthor.avatarUrl }
        : null,
    };

    const enrichedReplies = await Promise.all(
      replies.map(async (reply) => {
        const author = await ctx.db.get(reply.authorId);
        return {
          ...reply,
          author: author
            ? { name: author.name, avatarUrl: author.avatarUrl }
            : null,
        };
      }),
    );

    return { parent: enrichedParent, replies: enrichedReplies };
  },
});

// ── DM threads ──────────────────────────────────────────────────────

export const sendReplyDM = mutation({
  args: {
    conversationId: v.id("directConversations"),
    threadId: v.id("directMessages"),
    body: v.string(),
    alsoSendToConversation: v.optional(v.boolean()),
    attachments: v.optional(v.array(attachmentValidator)),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const membership = await requireDMmember(
      ctx,
      args.conversationId,
      user._id,
    );

    // Validate parent exists in this conversation and is top-level
    const parent = await ctx.db.get(args.threadId);
    if (!parent) throw new Error("Parent message not found");
    if (parent.conversationId !== args.conversationId)
      throw new Error("Parent message is not in this conversation");
    if (parent.threadId)
      throw new Error("Cannot create nested threads");

    // Insert reply
    const replyId = await ctx.db.insert("directMessages", {
      conversationId: args.conversationId,
      authorId: user._id,
      body: args.body,
      type: membership.isAgent ? "bot" : "user",
      isEdited: false,
      threadId: args.threadId,
      alsoSentToConversation: args.alsoSendToConversation ?? false,
      ...(args.attachments && args.attachments.length > 0
        ? { attachments: args.attachments }
        : {}),
    });

    // Ingest into knowledge graph with thread context
    await ctx.scheduler.runAfter(0, internal.ingest.processDirectMessage, {
      messageId: replyId,
      threadId: args.threadId,
    });

    // Update parent denormalized thread fields
    const currentParticipants = parent.threadParticipantIds ?? [];
    const newParticipants = currentParticipants.includes(user._id)
      ? currentParticipants
      : [...currentParticipants, user._id].slice(0, 20);

    await ctx.db.patch(args.threadId, {
      threadReplyCount: (parent.threadReplyCount ?? 0) + 1,
      threadLastReplyAt: Date.now(),
      threadLastReplyAuthorId: user._id,
      threadParticipantIds: newParticipants,
    });

    // Update sender's lastReadAt
    await ctx.db.patch(membership._id, { lastReadAt: Date.now() });

    return replyId;
  },
});

export const listRepliesDM = query({
  args: { threadId: v.id("directMessages") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const parent = await ctx.db.get(args.threadId);
    if (!parent) throw new Error("Parent message not found");

    await requireDMmember(ctx, parent.conversationId, user._id);

    const replies = await ctx.db
      .query("directMessages")
      .withIndex("by_thread", (q) => q.eq("threadId", args.threadId))
      .order("asc")
      .take(200);

    const parentAuthor = await ctx.db.get(parent.authorId);
    const enrichedParent = {
      ...parent,
      author: parentAuthor
        ? { name: parentAuthor.name, avatarUrl: parentAuthor.avatarUrl }
        : null,
    };

    const enrichedReplies = await Promise.all(
      replies.map(async (reply) => {
        const author = await ctx.db.get(reply.authorId);
        return {
          ...reply,
          author: author
            ? { name: author.name, avatarUrl: author.avatarUrl }
            : null,
        };
      }),
    );

    return { parent: enrichedParent, replies: enrichedReplies };
  },
});
