import { query, mutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { requireUser, requireDMmember } from "./auth";
import { attachmentValidator } from "./files";

export const list = query({
  args: {
    conversationId: v.id("directConversations"),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    // Verify membership
    const membership = await ctx.db
      .query("directConversationMembers")
      .withIndex("by_conversation_user", (q) =>
        q
          .eq("conversationId", args.conversationId)
          .eq("userId", user._id),
      )
      .first();
    if (!membership) throw new Error("Not a member");

    const results = await ctx.db
      .query("directMessages")
      .withIndex("by_conversation", (q) =>
        q.eq("conversationId", args.conversationId),
      )
      .order("desc")
      .paginate(args.paginationOpts);

    // Filter out thread replies unless also sent to conversation
    const filteredPage = results.page.filter(
      (msg) => !msg.threadId || msg.alsoSentToConversation,
    );

    const messagesWithAuthors = await Promise.all(
      filteredPage.map(async (message) => {
        const author = await ctx.db.get(message.authorId);
        const memberRecord = await ctx.db
          .query("directConversationMembers")
          .withIndex("by_conversation_user", (q) =>
            q
              .eq("conversationId", args.conversationId)
              .eq("userId", message.authorId),
          )
          .first();

        // Resolve thread participant info for parent messages
        let threadParticipants: Array<{
          _id: string;
          name: string;
          avatarUrl?: string | null;
        }> | undefined;
        if (message.threadReplyCount && message.threadReplyCount > 0 && message.threadParticipantIds) {
          const participants = await Promise.all(
            message.threadParticipantIds.map((id) => ctx.db.get(id)),
          );
          threadParticipants = participants
            .filter((u) => u !== null)
            .map((u) => ({ _id: u._id, name: u.name, avatarUrl: u.avatarUrl }));
        }

        // Resolve meeting data
        let meeting: {
          _id: string;
          title: string;
          provider: string;
          meetingUrl: string;
          status: string;
          startedBy: { name: string; avatarUrl?: string | null };
          startedAt: number;
          endedAt?: number;
          participants: Array<{
            userId: string;
            name: string;
            avatarUrl?: string | null;
            joinedAt: number;
          }>;
        } | undefined;
        if (message.meetingId) {
          const m = await ctx.db.get(message.meetingId);
          if (m) {
            const starter = await ctx.db.get(m.startedBy);
            const participants = await Promise.all(
              (m.participants ?? []).map(async (p) => {
                const u = await ctx.db.get(p.userId);
                return {
                  userId: p.userId as string,
                  name: u?.name ?? "Unknown",
                  avatarUrl: u?.avatarUrl,
                  joinedAt: p.joinedAt,
                };
              }),
            );
            meeting = {
              _id: m._id,
              title: m.title,
              provider: m.provider,
              meetingUrl: m.meetingUrl,
              status: m.status,
              startedBy: { name: starter?.name ?? "Unknown", avatarUrl: starter?.avatarUrl },
              startedAt: m.startedAt,
              endedAt: m.endedAt,
              participants,
            };
          }
        }

        return {
          ...message,
          author: author
            ? { name: author.name, avatarUrl: author.avatarUrl }
            : null,
          isAgent: memberRecord?.isAgent ?? false,
          threadParticipants,
          meeting,
        };
      }),
    );

    return { ...results, page: messagesWithAuthors };
  },
});

export const edit = mutation({
  args: {
    messageId: v.id("directMessages"),
    body: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const message = await ctx.db.get(args.messageId);
    if (!message) throw new Error("Message not found");
    if (message.authorId !== user._id) throw new Error("Not authorized");
    if (message.type !== "user") throw new Error("Only user messages can be edited");
    const trimmed = args.body.trim();
    if (!trimmed) throw new Error("Message body cannot be empty");

    await requireDMmember(ctx, message.conversationId, user._id);
    await ctx.db.patch(args.messageId, { body: trimmed, isEdited: true });
  },
});

export const remove = mutation({
  args: {
    messageId: v.id("directMessages"),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const message = await ctx.db.get(args.messageId);
    if (!message) throw new Error("Message not found");
    if (message.authorId !== user._id) throw new Error("Not authorized");
    if (message.type !== "user") throw new Error("Only user messages can be deleted");

    await requireDMmember(ctx, message.conversationId, user._id);

    // If this is a thread parent, delete all replies
    const replies = await ctx.db
      .query("directMessages")
      .withIndex("by_thread", (q) => q.eq("threadId", args.messageId))
      .collect();
    for (const reply of replies) {
      await ctx.db.delete(reply._id);
    }

    // If this is a thread reply, update parent's denormalized fields
    if (message.threadId) {
      const parent = await ctx.db.get(message.threadId);
      if (parent) {
        const remainingReplies = await ctx.db
          .query("directMessages")
          .withIndex("by_thread", (q) => q.eq("threadId", message.threadId!))
          .collect();
        const otherReplies = remainingReplies.filter((r) => r._id !== args.messageId);

        if (otherReplies.length === 0) {
          await ctx.db.patch(message.threadId, {
            threadReplyCount: 0,
            threadLastReplyAt: undefined,
            threadLastReplyAuthorId: undefined,
            threadParticipantIds: undefined,
          });
        } else {
          const lastReply = otherReplies[otherReplies.length - 1];
          const participantIds = [...new Set(otherReplies.map((r) => r.authorId))].slice(0, 20);
          await ctx.db.patch(message.threadId, {
            threadReplyCount: otherReplies.length,
            threadLastReplyAt: lastReply._creationTime,
            threadLastReplyAuthorId: lastReply.authorId,
            threadParticipantIds: participantIds,
          });
        }
      }
    }

    await ctx.db.delete(args.messageId);
  },
});

export const send = mutation({
  args: {
    conversationId: v.id("directConversations"),
    body: v.string(),
    attachments: v.optional(v.array(attachmentValidator)),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    // Verify membership
    const membership = await ctx.db
      .query("directConversationMembers")
      .withIndex("by_conversation_user", (q) =>
        q
          .eq("conversationId", args.conversationId)
          .eq("userId", user._id),
      )
      .first();
    if (!membership) throw new Error("Not a member");

    const messageId = await ctx.db.insert("directMessages", {
      conversationId: args.conversationId,
      authorId: user._id,
      body: args.body,
      type: membership.isAgent ? "bot" : "user",
      isEdited: false,
      ...(args.attachments && args.attachments.length > 0
        ? { attachments: args.attachments }
        : {}),
    });

    // Ingest into knowledge graph
    await ctx.scheduler.runAfter(0, internal.ingest.processDirectMessage, {
      messageId,
    });

    // Dispatch to agent members if this is an agent conversation
    if (!membership.isAgent) {
      await ctx.scheduler.runAfter(0, internal.agentRunner.dispatchDMResponse, {
        conversationId: args.conversationId,
        messageId,
        body: args.body,
        authorId: user._id,
      });
    }

    // Update sender's lastReadAt
    await ctx.db.patch(membership._id, { lastReadAt: Date.now() });

    return messageId;
  },
});
