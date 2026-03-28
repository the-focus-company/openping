import { mutation, query, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { MutationCtx } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { requireUser, requireChannelMember } from "./auth";
import { attachmentValidator } from "./files";

/** Insert a system message into a channel (no unread tracking, no agent dispatch). */
export async function insertSystemMsg(
  ctx: MutationCtx,
  channelId: Id<"channels">,
  authorId: Id<"users">,
  body: string,
) {
  await ctx.db.insert("messages", {
    channelId,
    authorId,
    body,
    type: "system",
    isEdited: false,
  });
}

export const insertSystemMessage = internalMutation({
  args: {
    channelId: v.id("channels"),
    authorId: v.id("users"),
    body: v.string(),
  },
  handler: async (ctx, args) => {
    await insertSystemMsg(ctx, args.channelId, args.authorId, args.body);
  },
});

export const send = mutation({
  args: {
    channelId: v.id("channels"),
    body: v.string(),
    attachments: v.optional(v.array(attachmentValidator)),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    await requireChannelMember(ctx, args.channelId, user._id);

    const messageId = await ctx.db.insert("messages", {
      channelId: args.channelId,
      authorId: user._id,
      body: args.body,
      type: "user",
      isEdited: false,
      ...(args.attachments && args.attachments.length > 0
        ? { attachments: args.attachments }
        : {}),
    });

    // Ingest into knowledge graph
    await ctx.scheduler.runAfter(0, internal.ingest.processMessage, {
      messageId,
    });

    // Dispatch to agents (@mention or channel-trigger)
    await ctx.scheduler.runAfter(0, internal.agentRunner.dispatchChannelMention, {
      channelId: args.channelId,
      messageId,
      body: args.body,
      authorId: user._id,
    });

    // Update sender's lastReadAt and reset their unreadCount,
    // then increment unreadCount for all other channel members.
    // Also track @mention counts.
    const allMembers = await ctx.db
      .query("channelMembers")
      .withIndex("by_channel", (q) => q.eq("channelId", args.channelId))
      .collect();

    // Resolve member names for mention detection
    const memberUsers = await Promise.all(
      allMembers.map(async (m) => {
        const u = await ctx.db.get(m.userId);
        return { membership: m, userName: u?.name ?? "" };
      }),
    );

    const bodyLower = args.body.toLowerCase();

    for (const { membership: member, userName } of memberUsers) {
      if (member.userId === user._id) {
        await ctx.db.patch(member._id, {
          lastReadAt: Date.now(),
          unreadCount: 0,
          unreadMentionCount: 0,
        });
      } else {
        // Check if this member is @mentioned
        const isMentioned = userName && bodyLower.includes(`@${userName.toLowerCase()}`);
        await ctx.db.patch(member._id, {
          unreadCount: (member.unreadCount ?? 0) + 1,
          ...(isMentioned ? { unreadMentionCount: (member.unreadMentionCount ?? 0) + 1 } : {}),
        });
      }
    }

    return messageId;
  },
});

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
    if (message.authorId !== user._id) throw new Error("Not authorized");
    if (message.type !== "user") throw new Error("Only user messages can be deleted");

    // Delete reactions for this message
    const reactions = await ctx.db
      .query("reactions")
      .withIndex("by_message", (q) => q.eq("messageId", args.messageId))
      .collect();
    for (const reaction of reactions) {
      await ctx.db.delete(reaction._id);
    }

    // If this is a thread parent, delete all replies and their reactions
    const replies = await ctx.db
      .query("messages")
      .withIndex("by_thread", (q) => q.eq("threadId", args.messageId))
      .collect();
    for (const reply of replies) {
      const replyReactions = await ctx.db
        .query("reactions")
        .withIndex("by_message", (q) => q.eq("messageId", reply._id))
        .collect();
      for (const r of replyReactions) {
        await ctx.db.delete(r._id);
      }
      await ctx.db.delete(reply._id);
    }

    // If this is a thread reply, update parent's denormalized fields
    if (message.threadId) {
      const parent = await ctx.db.get(message.threadId);
      if (parent) {
        const remainingReplies = await ctx.db
          .query("messages")
          .withIndex("by_thread", (q) => q.eq("threadId", message.threadId!))
          .collect();
        // Exclude the message being deleted
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

export const listByChannel = query({
  args: { channelId: v.id("channels"), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requireUser(ctx);

    const allMessages = await ctx.db
      .query("messages")
      .withIndex("by_channel", (q) => q.eq("channelId", args.channelId))
      .order("desc")
      .take((args.limit ?? 50) * 2);

    // Filter out thread replies unless they were also sent to channel
    const messages = allMessages
      .filter((msg) => !msg.threadId || msg.alsoSentToChannel)
      .slice(0, args.limit ?? 50);

    return Promise.all(
      messages.map(async (msg) => {
        const author = await ctx.db.get(msg.authorId);

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
          threadParticipants,
          integrationObject,
          meeting,
        };
      }),
    );
  },
});
