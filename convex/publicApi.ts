import { v } from "convex/values";
import { internalQuery, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";

// ── Channel CRUD Operations ─────────────────────────────────────────

export const listChannels = internalQuery({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, { workspaceId }) => {
    const channels = await ctx.db
      .query("channels")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();

    return channels
      .filter((c) => !c.isArchived)
      .map((c) => ({
        _id: c._id,
        name: c.name,
        description: c.description,
        type: c.type,
        isPrivate: c.isPrivate ?? false,
        isDefault: c.isDefault,
        _creationTime: c._creationTime,
      }));
  },
});

export const createChannel = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    userId: v.id("users"),
    name: v.string(),
    description: v.optional(v.string()),
    isPrivate: v.optional(v.boolean()),
  },
  handler: async (ctx, { workspaceId, userId, name, description, isPrivate }) => {
    const existing = await ctx.db
      .query("channels")
      .withIndex("by_workspace_name", (q) =>
        q.eq("workspaceId", workspaceId).eq("name", name),
      )
      .first();
    if (existing) throw new Error("Channel name already taken");

    const membership = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_user_workspace", (q) =>
        q.eq("userId", userId).eq("workspaceId", workspaceId),
      )
      .unique();
    if (!membership) throw new Error("Not a workspace member");

    const channelId = await ctx.db.insert("channels", {
      name,
      description,
      workspaceId,
      createdBy: userId,
      isDefault: false,
      isArchived: false,
      isPrivate: isPrivate ?? false,
      type: isPrivate ? "group" : "public",
    });

    await ctx.db.insert("channelMembers", {
      channelId,
      userId,
      lastReadAt: Date.now(),
    });

    return { channelId };
  },
});

export const listChannelMembers = internalQuery({
  args: {
    channelId: v.id("channels"),
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, { channelId, workspaceId }) => {
    const channel = await ctx.db.get(channelId);
    if (!channel || channel.workspaceId !== workspaceId) {
      throw new Error("Channel not found or access denied");
    }

    const members = await ctx.db
      .query("channelMembers")
      .withIndex("by_channel", (q) => q.eq("channelId", channelId))
      .collect();

    const enriched = await Promise.all(
      members.map(async (m) => {
        const user = await ctx.db.get(m.userId);
        return user
          ? {
              userId: user._id,
              name: user.name,
              email: user.email,
              avatarUrl: user.avatarUrl,
              presenceStatus: user.presenceStatus,
            }
          : null;
      }),
    );

    return enriched.filter(Boolean);
  },
});

// ── Channel Message Operations ──────────────────────────────────────

export const readChannelMessages = internalQuery({
  args: {
    channelId: v.id("channels"),
    workspaceId: v.id("workspaces"),
    userId: v.id("users"),
    limit: v.number(),
    startTime: v.optional(v.number()),
    endTime: v.optional(v.number()),
  },
  handler: async (
    ctx,
    { channelId, workspaceId, userId, limit, startTime, endTime },
  ) => {
    const channel = await ctx.db.get(channelId);
    if (!channel || channel.workspaceId !== workspaceId) {
      throw new Error("Channel not found or access denied");
    }

    // For private channels, verify membership
    if (channel.isPrivate) {
      const membership = await ctx.db
        .query("channelMembers")
        .withIndex("by_channel_user", (q) =>
          q.eq("channelId", channelId).eq("userId", userId),
        )
        .first();
      if (!membership) throw new Error("Not a member of this private channel");
    }

    // Fetch more than needed to account for thread-only replies being filtered
    const fetchLimit = Math.min(limit * 2, 200);
    let messages = await ctx.db
      .query("messages")
      .withIndex("by_channel", (q) => q.eq("channelId", channelId))
      .order("desc")
      .take(fetchLimit);

    // Apply date filtering
    if (startTime) {
      messages = messages.filter((m) => m._creationTime >= startTime);
    }
    if (endTime) {
      messages = messages.filter((m) => m._creationTime <= endTime);
    }

    // Filter out thread-only replies (same as existing listByChannel behavior)
    messages = messages.filter((m) => !m.threadId || m.alsoSentToChannel);

    // Trim to requested limit
    messages = messages.slice(0, limit);

    // Enrich with author info
    const enriched = await Promise.all(
      messages.map(async (msg) => {
        const author = await ctx.db.get(msg.authorId);
        return {
          _id: msg._id,
          body: msg.body,
          type: msg.type,
          authorId: msg.authorId,
          authorName: author?.name ?? "Unknown",
          authorEmail: author?.email,
          _creationTime: msg._creationTime,
          isEdited: msg.isEdited,
          threadId: msg.threadId,
          threadReplyCount: msg.threadReplyCount,
          threadLastReplyAt: msg.threadLastReplyAt,
          mentions: msg.mentions,
        };
      }),
    );

    return enriched.reverse(); // Return in chronological order
  },
});

export const sendChannelMessageApi = internalMutation({
  args: {
    channelId: v.id("channels"),
    workspaceId: v.id("workspaces"),
    userId: v.id("users"),
    body: v.string(),
    messageType: v.union(v.literal("user"), v.literal("bot")),
    threadId: v.optional(v.id("messages")),
  },
  handler: async (
    ctx,
    { channelId, workspaceId, userId, body, messageType, threadId },
  ) => {
    const channel = await ctx.db.get(channelId);
    if (!channel || channel.workspaceId !== workspaceId) {
      throw new Error("Channel not found or access denied");
    }

    // Verify channel membership
    const membership = await ctx.db
      .query("channelMembers")
      .withIndex("by_channel_user", (q) =>
        q.eq("channelId", channelId).eq("userId", userId),
      )
      .first();
    if (!membership) throw new Error("Not a member of this channel");

    // If threadId provided, validate parent message and keep reference for later update
    let parentMessage: Awaited<ReturnType<typeof ctx.db.get>> | null = null;
    if (threadId) {
      parentMessage = await ctx.db.get(threadId);
      if (!parentMessage) throw new Error("Parent message not found");
      if (parentMessage.channelId !== channelId)
        throw new Error("Parent message is not in this channel");
      if (parentMessage.threadId)
        throw new Error("Cannot create nested threads");
    }

    const messageId = await ctx.db.insert("messages", {
      channelId,
      authorId: userId,
      body,
      type: messageType,
      isEdited: false,
      ...(threadId ? { threadId, alsoSentToChannel: false } : {}),
    });

    // If thread reply, update parent denormalized fields
    if (threadId && parentMessage) {
      const currentParticipants = parentMessage.threadParticipantIds ?? [];
      const newParticipants = currentParticipants.includes(userId)
        ? currentParticipants
        : [...currentParticipants, userId].slice(0, 20);

      await ctx.db.patch(threadId, {
        threadReplyCount: (parentMessage.threadReplyCount ?? 0) + 1,
        threadLastReplyAt: Date.now(),
        threadLastReplyAuthorId: userId,
        threadParticipantIds: newParticipants,
      });
    }

    // Update unread counts for other members
    const allMembers = await ctx.db
      .query("channelMembers")
      .withIndex("by_channel", (q) => q.eq("channelId", channelId))
      .collect();

    for (const member of allMembers) {
      if (member.userId === userId) {
        // Sender: reset unread
        await ctx.db.patch(member._id, {
          lastReadAt: Date.now(),
          unreadCount: 0,
        });
      } else if (!threadId) {
        // Only increment for top-level messages
        await ctx.db.patch(member._id, {
          unreadCount: (member.unreadCount ?? 0) + 1,
        });
      }
    }

    return { messageId };
  },
});

export const listChannelThreadReplies = internalQuery({
  args: {
    threadId: v.id("messages"),
    workspaceId: v.id("workspaces"),
    userId: v.id("users"),
  },
  handler: async (ctx, { threadId, workspaceId }) => {
    const parent = await ctx.db.get(threadId);
    if (!parent) throw new Error("Parent message not found");

    const channel = await ctx.db.get(parent.channelId);
    if (!channel || channel.workspaceId !== workspaceId) {
      throw new Error("Channel not found or access denied");
    }

    if (parent.threadId)
      throw new Error("Message is a reply, not a thread parent");

    const replies = await ctx.db
      .query("messages")
      .withIndex("by_thread", (q) => q.eq("threadId", threadId))
      .order("asc")
      .take(200);

    const parentAuthor = await ctx.db.get(parent.authorId);
    const enrichedParent = {
      _id: parent._id,
      body: parent.body,
      type: parent.type,
      authorId: parent.authorId,
      authorName: parentAuthor?.name ?? "Unknown",
      _creationTime: parent._creationTime,
      threadReplyCount: parent.threadReplyCount,
    };

    const enrichedReplies = await Promise.all(
      replies.map(async (reply) => {
        const author = await ctx.db.get(reply.authorId);
        return {
          _id: reply._id,
          body: reply.body,
          type: reply.type,
          authorId: reply.authorId,
          authorName: author?.name ?? "Unknown",
          _creationTime: reply._creationTime,
        };
      }),
    );

    return { parent: enrichedParent, replies: enrichedReplies };
  },
});

// ── DM Conversation Operations ──────────────────────────────────────

export const listConversations = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const memberships = await ctx.db
      .query("directConversationMembers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const conversations = await Promise.all(
      memberships.map(async (m) => {
        const conv = await ctx.db.get(m.conversationId);
        if (!conv || conv.isArchived || conv.deletedAt) return null;

        const members = await ctx.db
          .query("directConversationMembers")
          .withIndex("by_conversation", (q) =>
            q.eq("conversationId", conv._id),
          )
          .collect();

        const memberDetails = await Promise.all(
          members.map(async (mem) => {
            const user = await ctx.db.get(mem.userId);
            return {
              userId: mem.userId,
              name: user?.name ?? "Unknown",
              email: user?.email,
              isAgent: mem.isAgent,
            };
          }),
        );

        return {
          _id: conv._id,
          kind: conv.kind,
          name: conv.name,
          members: memberDetails,
          _creationTime: conv._creationTime,
        };
      }),
    );

    return conversations.filter(Boolean);
  },
});

export const createConversation = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    userId: v.id("users"),
    kind: v.union(v.literal("1to1"), v.literal("group")),
    memberIds: v.array(v.id("users")),
    name: v.optional(v.string()),
  },
  handler: async (ctx, { workspaceId, userId, kind, memberIds, name }) => {
    const creatorMembership = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_user_workspace", (q) =>
        q.eq("userId", userId).eq("workspaceId", workspaceId),
      )
      .unique();
    if (!creatorMembership) throw new Error("Not a workspace member");

    if (kind === "1to1") {
      if (memberIds.length !== 1) {
        throw new Error("1to1 conversations require exactly one other member");
      }
      const otherUserId = memberIds[0];

      const myMemberships = await ctx.db
        .query("directConversationMembers")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect();

      for (const m of myMemberships) {
        const conv = await ctx.db.get(m.conversationId);
        if (!conv || conv.kind !== "1to1" || conv.deletedAt) continue;

        const otherMember = await ctx.db
          .query("directConversationMembers")
          .withIndex("by_conversation_user", (q) =>
            q.eq("conversationId", conv._id).eq("userId", otherUserId),
          )
          .first();
        if (otherMember) {
          return { conversationId: conv._id, existing: true };
        }
      }
    }

    const conversationId = await ctx.db.insert("directConversations", {
      workspaceId,
      kind,
      name: kind === "group" ? name : undefined,
      createdBy: userId,
      isArchived: false,
    });

    await ctx.db.insert("directConversationMembers", {
      conversationId,
      userId,
      isAgent: false,
      lastReadAt: Date.now(),
    });

    for (const memberId of memberIds) {
      if (memberId === userId) continue;
      await ctx.db.insert("directConversationMembers", {
        conversationId,
        userId: memberId,
        isAgent: false,
      });
    }

    return { conversationId, existing: false };
  },
});

export const listConversationMembers = internalQuery({
  args: {
    conversationId: v.id("directConversations"),
    userId: v.id("users"),
  },
  handler: async (ctx, { conversationId, userId }) => {
    const callerMembership = await ctx.db
      .query("directConversationMembers")
      .withIndex("by_conversation_user", (q) =>
        q.eq("conversationId", conversationId).eq("userId", userId),
      )
      .first();
    if (!callerMembership)
      throw new Error("Not a member of this conversation");

    const members = await ctx.db
      .query("directConversationMembers")
      .withIndex("by_conversation", (q) =>
        q.eq("conversationId", conversationId),
      )
      .collect();

    const enriched = await Promise.all(
      members.map(async (m) => {
        const user = await ctx.db.get(m.userId);
        return {
          userId: m.userId,
          name: user?.name ?? "Unknown",
          email: user?.email,
          avatarUrl: user?.avatarUrl,
          isAgent: m.isAgent,
          presenceStatus: user?.presenceStatus,
        };
      }),
    );

    return enriched;
  },
});

// ── DM Message Operations ───────────────────────────────────────────

export const readDMMessages = internalQuery({
  args: {
    conversationId: v.id("directConversations"),
    userId: v.id("users"),
    limit: v.number(),
    startTime: v.optional(v.number()),
    endTime: v.optional(v.number()),
  },
  handler: async (
    ctx,
    { conversationId, userId, limit, startTime, endTime },
  ) => {
    const membership = await ctx.db
      .query("directConversationMembers")
      .withIndex("by_conversation_user", (q) =>
        q.eq("conversationId", conversationId).eq("userId", userId),
      )
      .first();
    if (!membership)
      throw new Error("Not a member of this conversation");

    const fetchLimit = Math.min(limit * 2, 200);
    let messages = await ctx.db
      .query("directMessages")
      .withIndex("by_conversation", (q) =>
        q.eq("conversationId", conversationId),
      )
      .order("desc")
      .take(fetchLimit);

    if (startTime)
      messages = messages.filter((m) => m._creationTime >= startTime);
    if (endTime)
      messages = messages.filter((m) => m._creationTime <= endTime);

    messages = messages.filter(
      (m) => !m.threadId || m.alsoSentToConversation,
    );

    messages = messages.slice(0, limit);

    const enriched = await Promise.all(
      messages.map(async (msg) => {
        const author = await ctx.db.get(msg.authorId);
        return {
          _id: msg._id,
          body: msg.body,
          type: msg.type,
          authorId: msg.authorId,
          authorName: author?.name ?? "Unknown",
          _creationTime: msg._creationTime,
          isEdited: msg.isEdited,
          threadId: msg.threadId,
          threadReplyCount: msg.threadReplyCount,
          threadLastReplyAt: msg.threadLastReplyAt,
        };
      }),
    );

    return enriched.reverse();
  },
});

export const sendDMApi = internalMutation({
  args: {
    conversationId: v.id("directConversations"),
    userId: v.id("users"),
    body: v.string(),
    messageType: v.union(v.literal("user"), v.literal("bot")),
    threadId: v.optional(v.id("directMessages")),
  },
  handler: async (
    ctx,
    { conversationId, userId, body, messageType, threadId },
  ) => {
    const membership = await ctx.db
      .query("directConversationMembers")
      .withIndex("by_conversation_user", (q) =>
        q.eq("conversationId", conversationId).eq("userId", userId),
      )
      .first();
    if (!membership)
      throw new Error("Not a member of this conversation");

    let parent = threadId ? await ctx.db.get(threadId) : null;
    if (threadId) {
      if (!parent) throw new Error("Parent message not found");
      if (parent.conversationId !== conversationId)
        throw new Error("Parent not in this conversation");
      if (parent.threadId)
        throw new Error("Cannot create nested threads");
    }

    const messageId = await ctx.db.insert("directMessages", {
      conversationId,
      authorId: userId,
      body,
      type: messageType,
      isEdited: false,
      ...(threadId
        ? { threadId, alsoSentToConversation: false }
        : {}),
    });

    if (threadId && parent) {
      const currentParticipants = parent.threadParticipantIds ?? [];
      const newParticipants = currentParticipants.includes(userId)
        ? currentParticipants
        : [...currentParticipants, userId].slice(0, 20);

      await ctx.db.patch(threadId, {
        threadReplyCount: (parent.threadReplyCount ?? 0) + 1,
        threadLastReplyAt: Date.now(),
        threadLastReplyAuthorId: userId,
        threadParticipantIds: newParticipants,
      });
    }

    await ctx.db.patch(membership._id, { lastReadAt: Date.now() });

    return { messageId };
  },
});

export const listDMThreadReplies = internalQuery({
  args: {
    threadId: v.id("directMessages"),
    userId: v.id("users"),
  },
  handler: async (ctx, { threadId, userId }) => {
    const parent = await ctx.db.get(threadId);
    if (!parent) throw new Error("Parent message not found");

    const membership = await ctx.db
      .query("directConversationMembers")
      .withIndex("by_conversation_user", (q) =>
        q
          .eq("conversationId", parent.conversationId)
          .eq("userId", userId),
      )
      .first();
    if (!membership)
      throw new Error("Not a member of this conversation");

    if (parent.threadId)
      throw new Error("Message is a reply, not a thread parent");

    const replies = await ctx.db
      .query("directMessages")
      .withIndex("by_thread", (q) => q.eq("threadId", threadId))
      .order("asc")
      .take(200);

    const parentAuthor = await ctx.db.get(parent.authorId);
    const enrichedParent = {
      _id: parent._id,
      body: parent.body,
      type: parent.type,
      authorId: parent.authorId,
      authorName: parentAuthor?.name ?? "Unknown",
      _creationTime: parent._creationTime,
      threadReplyCount: parent.threadReplyCount,
    };

    const enrichedReplies = await Promise.all(
      replies.map(async (reply) => {
        const author = await ctx.db.get(reply.authorId);
        return {
          _id: reply._id,
          body: reply.body,
          type: reply.type,
          authorId: reply.authorId,
          authorName: author?.name ?? "Unknown",
          _creationTime: reply._creationTime,
        };
      }),
    );

    return { parent: enrichedParent, replies: enrichedReplies };
  },
});

// ── Reaction Operations ─────────────────────────────────────────────

export const toggleReaction = internalMutation({
  args: {
    messageId: v.id("messages"),
    userId: v.id("users"),
    workspaceId: v.id("workspaces"),
    emoji: v.string(),
  },
  handler: async (ctx, { messageId, userId, workspaceId, emoji }) => {
    const message = await ctx.db.get(messageId);
    if (!message) throw new Error("Message not found");

    const channel = await ctx.db.get(message.channelId);
    if (!channel || channel.workspaceId !== workspaceId) {
      throw new Error("Message not found or access denied");
    }

    const membership = await ctx.db
      .query("channelMembers")
      .withIndex("by_channel_user", (q) =>
        q.eq("channelId", channel._id).eq("userId", userId),
      )
      .first();
    if (!membership) throw new Error("Not a member of this channel");

    const existingReactions = await ctx.db
      .query("reactions")
      .withIndex("by_message_user", (q) =>
        q.eq("messageId", messageId).eq("userId", userId),
      )
      .take(100);

    const existing = existingReactions.find((r) => r.emoji === emoji);

    if (existing) {
      await ctx.db.delete(existing._id);
      return { added: false, emoji };
    }

    const reactionId = await ctx.db.insert("reactions", {
      messageId,
      userId,
      emoji,
    });

    return { added: true, emoji, reactionId };
  },
});
