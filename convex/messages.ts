import { mutation, query, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { MutationCtx } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { paginationOptsValidator } from "convex/server";
import { requireUser, requireConversationMember } from "./auth";
import { attachmentValidator } from "./files";

/** Insert a system message into a conversation (no unread tracking, no agent dispatch). */
export async function insertSystemMsg(
  ctx: MutationCtx,
  conversationId: Id<"conversations">,
  authorId: Id<"users">,
  body: string,
) {
  await ctx.db.insert("messages", {
    conversationId,
    authorId,
    body,
    type: "system",
    isEdited: false,
  });
}

export const insertSystemMessage = internalMutation({
  args: {
    conversationId: v.id("conversations"),
    authorId: v.id("users"),
    body: v.string(),
  },
  handler: async (ctx, args) => {
    await insertSystemMsg(ctx, args.conversationId, args.authorId, args.body);
  },
});

export const send = mutation({
  args: {
    conversationId: v.id("conversations"),
    body: v.string(),
    attachments: v.optional(v.array(attachmentValidator)),
    threadId: v.optional(v.id("messages")),
  },
  handler: async (ctx, args) => {
    if (args.body.length > 16384) throw new Error("Message too long");
    const user = await requireUser(ctx);
    const membership = await requireConversationMember(ctx, args.conversationId, user._id);

    // Check workspace message quota
    const conv = await ctx.db.get(args.conversationId);
    if (conv) {
      const workspace = await ctx.db.get(conv.workspaceId);
      if (workspace?.maxMessagesPerMonth) {
        const oneMonth = 30 * 24 * 60 * 60 * 1000;
        const monthStart = workspace.currentMonthStart ?? 0;
        if (Date.now() - monthStart > oneMonth) {
          await ctx.db.patch(workspace._id, { currentMonthMessageCount: 1, currentMonthStart: Date.now() });
        } else {
          const count = workspace.currentMonthMessageCount ?? 0;
          if (count >= workspace.maxMessagesPerMonth) {
            throw new Error("Workspace message quota exceeded");
          }
          await ctx.db.patch(workspace._id, { currentMonthMessageCount: count + 1 });
        }
      }
    }

    const messageId = await ctx.db.insert("messages", {
      conversationId: args.conversationId,
      authorId: user._id,
      body: args.body,
      type: membership.isAgent ? "bot" : "user",
      isEdited: false,
      ...(args.attachments && args.attachments.length > 0
        ? { attachments: args.attachments }
        : {}),
      ...(args.threadId ? { threadId: args.threadId } : {}),
    });

    // Ingest into knowledge graph
    await ctx.scheduler.runAfter(0, internal.ingest.processMessage, {
      messageId,
    });

    // Dispatch to agents (@mention, conversation-trigger, or DM response)
    if (!membership.isAgent) {
      const conversation = await ctx.db.get(args.conversationId);
      const kind = conversation?.kind;
      if (kind === "agent_1to1" || kind === "agent_group") {
        // Agent DM — dispatch direct response
        await ctx.scheduler.runAfter(0, internal.agentRunner.dispatchDMResponse, {
          conversationId: args.conversationId,
          messageId,
          body: args.body,
          authorId: user._id,
        });
      } else {
        // Regular channel/group — check @mentions and triggers
        await ctx.scheduler.runAfter(0, internal.agentRunner.dispatchChannelMention, {
          channelId: args.conversationId,
          messageId,
          body: args.body,
          authorId: user._id,
        });
      }
    }

    // Update unread counts for all conversation members
    const allMembers = await ctx.db
      .query("conversationMembers")
      .withIndex("by_conversation", (q) => q.eq("conversationId", args.conversationId))
      .take(200);

    // Resolve member names for mention detection
    const memberUsers = await Promise.all(
      allMembers.map(async (m) => {
        const u = await ctx.db.get(m.userId);
        return { membership: m, userName: u?.name ?? "" };
      }),
    );

    const bodyLower = args.body.toLowerCase();

    await Promise.all(
      memberUsers.map(async ({ membership: member, userName }) => {
        if (member.userId === user._id) {
          await ctx.db.patch(member._id, {
            lastReadAt: Date.now(),
            unreadCount: 0,
            unreadMentionCount: 0,
          });
        } else {
          const isMentioned = userName && bodyLower.includes(`@${userName.toLowerCase()}`);
          await ctx.db.patch(member._id, {
            unreadCount: (member.unreadCount ?? 0) + 1,
            ...(isMentioned ? { unreadMentionCount: (member.unreadMentionCount ?? 0) + 1 } : {}),
          });
        }
      }),
    );

    // Update thread parent denormalized fields if this is a thread reply
    if (args.threadId) {
      const parent = await ctx.db.get(args.threadId);
      if (parent) {
        const existingParticipants = parent.threadParticipantIds ?? [];
        const participantSet = new Set(existingParticipants.map((id) => id as string));
        participantSet.add(user._id);
        const participantIds = [...participantSet].slice(0, 20) as Id<"users">[];

        await ctx.db.patch(args.threadId, {
          threadReplyCount: (parent.threadReplyCount ?? 0) + 1,
          threadLastReplyAt: Date.now(),
          threadLastReplyAuthorId: user._id,
          threadParticipantIds: participantIds,
        });
      }
    }

    return messageId;
  },
});

export const listByConversation = query({
  args: {
    conversationId: v.id("conversations"),
    limit: v.optional(v.number()),
    paginationOpts: v.optional(paginationOptsValidator),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    // Auth check: for non-public, require membership
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) throw new Error("Conversation not found");
    if (conversation.visibility !== "public") {
      await requireConversationMember(ctx, args.conversationId, user._id);
    }

    // Use pagination if provided
    if (args.paginationOpts) {
      const results = await ctx.db
        .query("messages")
        .withIndex("by_conversation", (q) => q.eq("conversationId", args.conversationId))
        .order("desc")
        .paginate(args.paginationOpts);

      // Filter out deleted and thread-only messages
      const filteredPage = results.page.filter(
        (msg) => !msg.deletedAt && (!msg.threadId || msg.alsoSentToConversation),
      );

      // Batch fetch authors for all messages
      const authorIds = [...new Set(filteredPage.map((m) => m.authorId))];
      const authors = await Promise.all(authorIds.map((id) => ctx.db.get(id)));
      const authorMap = new Map(
        authors.filter((a): a is NonNullable<typeof a> => a !== null).map((a) => [a._id, a]),
      );

      const messagesWithAuthors = await Promise.all(
        filteredPage.map((msg) => enrichMessage(ctx, msg, args.conversationId, authorMap)),
      );

      return { ...results, page: messagesWithAuthors };
    }

    // Simple take-based query
    const limit = args.limit ?? 50;
    const allMessages = await ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) => q.eq("conversationId", args.conversationId))
      .order("desc")
      .take(limit * 2);

    // Filter out deleted and thread-only messages
    const messages = allMessages
      .filter((msg) => !msg.deletedAt && (!msg.threadId || msg.alsoSentToConversation))
      .slice(0, limit);

    // Batch fetch authors
    const authorIds = [...new Set(messages.map((m) => m.authorId))];
    const authors = await Promise.all(authorIds.map((id) => ctx.db.get(id)));
    const authorMap = new Map(
      authors.filter((a): a is NonNullable<typeof a> => a !== null).map((a) => [a._id, a]),
    );

    return Promise.all(
      messages.map((msg) => enrichMessage(ctx, msg, args.conversationId, authorMap)),
    );
  },
});

/** @deprecated Use listByConversation instead */
export const listByChannel = listByConversation;

export const edit = mutation({
  args: {
    messageId: v.id("messages"),
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

    await requireConversationMember(ctx, message.conversationId!, user._id);
    await ctx.db.patch(args.messageId, { body: trimmed, isEdited: true });
  },
});

export const remove = mutation({
  args: {
    messageId: v.id("messages"),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const message = await ctx.db.get(args.messageId);
    if (!message) throw new Error("Message not found");

    // Verify author or admin
    if (message.authorId !== user._id) {
      // Check if user is admin in the workspace
      const conversation = await ctx.db.get(message.conversationId!);
      if (!conversation) throw new Error("Conversation not found");
      const wsMembership = await ctx.db
        .query("workspaceMembers")
        .withIndex("by_user_workspace", (q) =>
          q.eq("userId", user._id).eq("workspaceId", conversation.workspaceId),
        )
        .unique();
      if (wsMembership?.role !== "admin") {
        throw new Error("Not authorized");
      }
    }

    if (message.type !== "user" && message.type !== "bot") {
      throw new Error("Only user/bot messages can be deleted");
    }

    await requireConversationMember(ctx, message.conversationId!, user._id);

    // Delete reactions for this message
    const reactions = await ctx.db
      .query("reactions")
      .withIndex("by_message", (q) => q.eq("messageId", args.messageId))
      .take(200);
    await Promise.all(reactions.map((r) => ctx.db.delete(r._id)));

    // If this is a thread parent, soft-delete all replies and their reactions
    const replies = await ctx.db
      .query("messages")
      .withIndex("by_thread", (q) => q.eq("threadId", args.messageId))
      .take(200);
    const replyReactionPromises = replies.map(async (reply) => {
      const replyReactions = await ctx.db
        .query("reactions")
        .withIndex("by_message", (q) => q.eq("messageId", reply._id))
        .take(200);
      return replyReactions;
    });
    const allReplyReactions = (await Promise.all(replyReactionPromises)).flat();
    await Promise.all(allReplyReactions.map((r) => ctx.db.delete(r._id)));
    await Promise.all(
      replies.map((reply) =>
        ctx.db.patch(reply._id, { deletedAt: Date.now(), deletedBy: user._id, body: "[deleted]" }),
      ),
    );

    // If this is a thread reply, update parent's denormalized fields
    if (message.threadId) {
      const parent = await ctx.db.get(message.threadId);
      if (parent) {
        const remainingReplies = await ctx.db
          .query("messages")
          .withIndex("by_thread", (q) => q.eq("threadId", message.threadId!))
          .take(200);
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

    // Soft-delete: preserve record for compliance
    await ctx.db.patch(args.messageId, {
      deletedAt: Date.now(),
      deletedBy: user._id,
      body: "[deleted]",
    });
  },
});

// ── Helpers ──

import { QueryCtx } from "./_generated/server";
import { Doc } from "./_generated/dataModel";

async function enrichMessage(
  ctx: QueryCtx,
  msg: Doc<"messages">,
  conversationId: Id<"conversations">,
  authorMap?: Map<any, Doc<"users">>,
) {
  const author = authorMap?.get(msg.authorId) ?? await ctx.db.get(msg.authorId);

  // Check if author is an agent in this conversation
  const memberRecord = await ctx.db
    .query("conversationMembers")
    .withIndex("by_conversation_and_user", (q) =>
      q.eq("conversationId", conversationId).eq("userId", msg.authorId),
    )
    .unique();

  // Resolve thread participant info for parent messages
  let threadParticipants: Array<{
    _id: string;
    name: string;
    avatarUrl?: string | null;
  }> | undefined;
  if (msg.threadReplyCount && msg.threadReplyCount > 0 && msg.threadParticipantIds) {
    const participants = await Promise.all(
      msg.threadParticipantIds.map((id) => ctx.db.get(id)),
    );
    threadParticipants = participants
      .filter((u) => u !== null)
      .map((u) => ({ _id: u._id, name: u.name, avatarUrl: u.avatarUrl }));
  }

  // Resolve integration object metadata for integration messages
  let integrationObject: {
    identifier?: string;
    type?: string;
    title?: string;
    status?: string;
    url?: string;
    author?: string;
    metadata?: Record<string, unknown>;
  } | undefined;
  if (msg.type === "integration" && msg.integrationObjectId) {
    const obj = await ctx.db.get(msg.integrationObjectId);
    if (obj) {
      integrationObject = {
        identifier: (obj.metadata as Record<string, unknown>)?.identifier as string | undefined,
        type: obj.type,
        title: obj.title,
        status: obj.status,
        url: obj.url,
        author: obj.author,
        metadata: obj.metadata as Record<string, unknown>,
      };
    }
  }

  // Resolve meeting data for meeting messages
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
  if (msg.meetingId) {
    const m = await ctx.db.get(msg.meetingId);
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
    ...msg,
    author: author ? { name: author.name, avatarUrl: author.avatarUrl } : null,
    isAgent: memberRecord?.isAgent ?? false,
    threadParticipants,
    integrationObject,
    meeting,
  };
}
