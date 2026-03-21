import { internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";

// GET /api/agent/v1/me
export const getAgentSelf = internalQuery({
  args: { agentId: v.id("agents") },
  handler: async (ctx, args) => {
    const agent = await ctx.db.get(args.agentId);
    if (!agent) return null;
    const workspace = await ctx.db.get(agent.workspaceId);
    return {
      id: agent._id,
      name: agent.name,
      description: agent.description,
      status: agent.status,
      workspaceName: workspace?.name,
    };
  },
});

// GET /api/agent/v1/channels
export const listAgentChannels = internalQuery({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const channels = await ctx.db
      .query("channels")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .take(100);
    return channels
      .filter((c) => !c.isArchived && c.type !== "dm")
      .map((c) => ({
        id: c._id,
        name: c.name,
        description: c.description,
        type: c.type,
      }));
  },
});

// GET /api/agent/v1/channel-messages
export const readChannelMessages = internalQuery({
  args: {
    channelId: v.id("channels"),
    workspaceId: v.id("workspaces"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const channel = await ctx.db.get(args.channelId);
    if (!channel || channel.workspaceId !== args.workspaceId) return null;
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_channel", (q) => q.eq("channelId", args.channelId))
      .order("desc")
      .take(args.limit ?? 50);
    const result = [];
    for (const msg of messages) {
      const author = await ctx.db.get(msg.authorId);
      result.push({
        id: msg._id,
        body: msg.body,
        type: msg.type,
        authorName: author?.name ?? "Unknown",
        authorId: msg.authorId,
        createdAt: msg._creationTime,
        isEdited: msg.isEdited,
      });
    }
    return result;
  },
});

// POST /api/agent/v1/channel-messages
export const sendChannelMessage = internalMutation({
  args: {
    channelId: v.id("channels"),
    workspaceId: v.id("workspaces"),
    authorId: v.id("users"),
    body: v.string(),
  },
  handler: async (ctx, args) => {
    const channel = await ctx.db.get(args.channelId);
    if (!channel || channel.workspaceId !== args.workspaceId) {
      throw new Error("Channel not found or not in workspace");
    }
    const messageId = await ctx.db.insert("messages", {
      channelId: args.channelId,
      authorId: args.authorId,
      body: args.body,
      type: "bot",
      isEdited: false,
    });
    return { messageId };
  },
});

// GET /api/agent/v1/conversations
export const listAgentConversations = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const memberships = await ctx.db
      .query("directConversationMembers")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .take(50);
    const conversations = [];
    for (const m of memberships) {
      const conv = await ctx.db.get(m.conversationId);
      if (conv && !conv.isArchived) {
        conversations.push({
          id: conv._id,
          kind: conv.kind,
          name: conv.name,
        });
      }
    }
    return conversations;
  },
});

// GET /api/agent/v1/conversation-messages
export const readConversationMessages = internalQuery({
  args: {
    conversationId: v.id("directConversations"),
    userId: v.id("users"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const membership = await ctx.db
      .query("directConversationMembers")
      .withIndex("by_conversation_user", (q) =>
        q
          .eq("conversationId", args.conversationId)
          .eq("userId", args.userId),
      )
      .unique();
    if (!membership) return null;
    const messages = await ctx.db
      .query("directMessages")
      .withIndex("by_conversation", (q) =>
        q.eq("conversationId", args.conversationId),
      )
      .order("desc")
      .take(args.limit ?? 50);
    const result = [];
    for (const msg of messages) {
      const author = await ctx.db.get(msg.authorId);
      result.push({
        id: msg._id,
        body: msg.body,
        type: msg.type,
        authorName: author?.name ?? "Unknown",
        authorId: msg.authorId,
        createdAt: msg._creationTime,
      });
    }
    return result;
  },
});

// POST /api/agent/v1/conversation-messages
export const sendConversationMessage = internalMutation({
  args: {
    conversationId: v.id("directConversations"),
    userId: v.id("users"),
    body: v.string(),
  },
  handler: async (ctx, args) => {
    const membership = await ctx.db
      .query("directConversationMembers")
      .withIndex("by_conversation_user", (q) =>
        q
          .eq("conversationId", args.conversationId)
          .eq("userId", args.userId),
      )
      .unique();
    if (!membership) throw new Error("Not a member of this conversation");
    const messageId = await ctx.db.insert("directMessages", {
      conversationId: args.conversationId,
      authorId: args.userId,
      body: args.body,
      type: "bot",
      isEdited: false,
    });
    return { messageId };
  },
});
