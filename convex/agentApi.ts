import { v } from "convex/values";
import { internalQuery, internalMutation } from "./_generated/server";

/**
 * Internal query: Get agent info by token hash.
 */
export const getAgentByTokenHash = internalQuery({
  args: { tokenHash: v.string() },
  handler: async (ctx, { tokenHash }) => {
    const tokenRecord = await ctx.db
      .query("agentApiTokens")
      .withIndex("by_token_hash", (q) => q.eq("tokenHash", tokenHash))
      .unique();

    if (!tokenRecord || tokenRecord.status !== "active") {
      return null;
    }

    if (tokenRecord.expiresAt && tokenRecord.expiresAt < Date.now()) {
      return null;
    }

    const agent = await ctx.db.get(tokenRecord.agentId);
    if (!agent || agent.status !== "active") {
      return null;
    }

    const user = await ctx.db.get(agent.userId);
    if (!user) {
      return null;
    }

    return {
      agent: { _id: agent._id, name: agent.name, description: agent.description },
      user: { _id: user._id, name: user.name, email: user.email },
      workspaceId: agent.workspaceId,
      tokenId: tokenRecord._id,
    };
  },
});

/**
 * Internal query: List channels the agent's workspace has access to.
 */
export const listChannelsForWorkspace = internalQuery({
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
      }));
  },
});

/**
 * Internal query: Read messages from a channel.
 */
export const readChannelMessages = internalQuery({
  args: {
    channelId: v.id("channels"),
    workspaceId: v.id("workspaces"),
    limit: v.number(),
  },
  handler: async (ctx, { channelId, workspaceId, limit }) => {
    const channel = await ctx.db.get(channelId);
    if (!channel || channel.workspaceId !== workspaceId) {
      throw new Error("Channel not found or access denied");
    }

    const messages = await ctx.db
      .query("messages")
      .withIndex("by_channel", (q) => q.eq("channelId", channelId))
      .order("desc")
      .take(limit);

    const messagesWithAuthors = await Promise.all(
      messages.map(async (msg) => {
        const author = await ctx.db.get(msg.authorId);
        return {
          _id: msg._id,
          body: msg.body,
          type: msg.type,
          authorName: author?.name ?? "Unknown",
          authorId: msg.authorId,
          _creationTime: msg._creationTime,
        };
      }),
    );

    return messagesWithAuthors.reverse();
  },
});

/**
 * Internal mutation: Send a message to a channel as an agent.
 */
export const sendChannelMessage = internalMutation({
  args: {
    channelId: v.id("channels"),
    workspaceId: v.id("workspaces"),
    authorId: v.id("users"),
    body: v.string(),
  },
  handler: async (ctx, { channelId, workspaceId, authorId, body }) => {
    const channel = await ctx.db.get(channelId);
    if (!channel || channel.workspaceId !== workspaceId) {
      throw new Error("Channel not found or access denied");
    }

    const messageId = await ctx.db.insert("messages", {
      channelId,
      authorId,
      body,
      type: "bot",
      isEdited: false,
    });

    return { messageId };
  },
});

/**
 * Internal query: List DM conversations for an agent's workspace.
 */
export const listConversationsForUser = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const memberships = await ctx.db
      .query("directConversationMembers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const conversations = await Promise.all(
      memberships.map(async (m) => {
        const conv = await ctx.db.get(m.conversationId);
        if (!conv || conv.isArchived) return null;

        const members = await ctx.db
          .query("directConversationMembers")
          .withIndex("by_conversation", (q) =>
            q.eq("conversationId", conv._id),
          )
          .collect();

        const memberNames = await Promise.all(
          members.map(async (mem) => {
            const user = await ctx.db.get(mem.userId);
            return user?.name ?? "Unknown";
          }),
        );

        return {
          _id: conv._id,
          kind: conv.kind,
          name: conv.name,
          members: memberNames,
        };
      }),
    );

    return conversations.filter(Boolean);
  },
});

/**
 * Internal query: Read messages from a DM conversation.
 */
export const readConversationMessages = internalQuery({
  args: {
    conversationId: v.id("directConversations"),
    userId: v.id("users"),
    limit: v.number(),
  },
  handler: async (ctx, { conversationId, userId, limit }) => {
    // Verify the user is a member of this conversation
    const membership = await ctx.db
      .query("directConversationMembers")
      .withIndex("by_conversation_user", (q) =>
        q.eq("conversationId", conversationId).eq("userId", userId),
      )
      .unique();

    if (!membership) {
      throw new Error("Not a member of this conversation");
    }

    const messages = await ctx.db
      .query("directMessages")
      .withIndex("by_conversation", (q) =>
        q.eq("conversationId", conversationId),
      )
      .order("desc")
      .take(limit);

    const messagesWithAuthors = await Promise.all(
      messages.map(async (msg) => {
        const author = await ctx.db.get(msg.authorId);
        return {
          _id: msg._id,
          body: msg.body,
          type: msg.type,
          authorName: author?.name ?? "Unknown",
          authorId: msg.authorId,
          _creationTime: msg._creationTime,
        };
      }),
    );

    return messagesWithAuthors.reverse();
  },
});

/**
 * Internal mutation: Send a DM as an agent.
 */
export const sendDirectMessage = internalMutation({
  args: {
    conversationId: v.id("directConversations"),
    userId: v.id("users"),
    body: v.string(),
  },
  handler: async (ctx, { conversationId, userId, body }) => {
    // Verify the user is a member of this conversation
    const membership = await ctx.db
      .query("directConversationMembers")
      .withIndex("by_conversation_user", (q) =>
        q.eq("conversationId", conversationId).eq("userId", userId),
      )
      .unique();

    if (!membership) {
      throw new Error("Not a member of this conversation");
    }

    const messageId = await ctx.db.insert("directMessages", {
      conversationId,
      authorId: userId,
      body,
      type: "bot",
      isEdited: false,
    });

    return { messageId };
  },
});

/**
 * Internal mutation: Update last-used timestamp on a token.
 */
export const touchToken = internalMutation({
  args: { tokenId: v.id("agentApiTokens") },
  handler: async (ctx, { tokenId }) => {
    await ctx.db.patch(tokenId, { lastUsedAt: Date.now() });
  },
});
