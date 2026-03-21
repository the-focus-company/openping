import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAuth, requireUser } from "./auth";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);

    // Get all conversations this user is a member of
    const memberships = await ctx.db
      .query("directConversationMembers")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .take(500);

    const conversations = await Promise.all(
      memberships.map(async (membership) => {
        const conversation = await ctx.db.get(membership.conversationId);
        if (!conversation || conversation.isArchived) return null;

        // Get all members of this conversation
        const members = await ctx.db
          .query("directConversationMembers")
          .withIndex("by_conversation", (q) =>
            q.eq("conversationId", conversation._id),
          )
          .take(50);

        const memberDetails = await Promise.all(
          members.map(async (m) => {
            const memberUser = await ctx.db.get(m.userId);
            return {
              userId: m.userId,
              name: memberUser?.name ?? "Unknown",
              avatarUrl: memberUser?.avatarUrl,
              isAgent: m.isAgent,
            };
          }),
        );

        // Count unread messages
        const lastReadAt = membership.lastReadAt ?? 0;
        const unreadMessages = await ctx.db
          .query("directMessages")
          .withIndex("by_conversation", (q) =>
            q.eq("conversationId", conversation._id),
          )
          .order("desc")
          .take(100);
        const unreadCount = unreadMessages.filter(
          (msg) => msg._creationTime > lastReadAt && msg.authorId !== user._id,
        ).length;

        // Get last message for preview
        const lastMessage = unreadMessages[0] ?? null;
        let lastMessagePreview = null;
        if (lastMessage) {
          const author = await ctx.db.get(lastMessage.authorId);
          lastMessagePreview = {
            body: lastMessage.body,
            authorName: author?.name ?? "Unknown",
            timestamp: lastMessage._creationTime,
          };
        }

        return {
          ...conversation,
          members: memberDetails,
          unreadCount,
          lastMessage: lastMessagePreview,
          myLastReadAt: membership.lastReadAt,
        };
      }),
    );

    return conversations
      .filter((c): c is NonNullable<typeof c> => c !== null)
      .sort((a, b) => {
        const aTime = a.lastMessage?.timestamp ?? a._creationTime;
        const bTime = b.lastMessage?.timestamp ?? b._creationTime;
        return bTime - aTime;
      });
  },
});

export const get = query({
  args: { conversationId: v.id("directConversations") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) throw new Error("Conversation not found");

    // Verify membership
    const membership = await ctx.db
      .query("directConversationMembers")
      .withIndex("by_conversation_user", (q) =>
        q
          .eq("conversationId", args.conversationId)
          .eq("userId", user._id),
      )
      .unique();
    if (!membership) throw new Error("Not a member");

    const members = await ctx.db
      .query("directConversationMembers")
      .withIndex("by_conversation", (q) =>
        q.eq("conversationId", conversation._id),
      )
      .take(50);

    const memberDetails = await Promise.all(
      members.map(async (m) => {
        const memberUser = await ctx.db.get(m.userId);
        return {
          userId: m.userId,
          name: memberUser?.name ?? "Unknown",
          avatarUrl: memberUser?.avatarUrl,
          isAgent: m.isAgent,
        };
      }),
    );

    return { ...conversation, members: memberDetails };
  },
});

export const create = mutation({
  args: {
    kind: v.union(
      v.literal("1to1"),
      v.literal("group"),
      v.literal("agent_1to1"),
      v.literal("agent_group"),
    ),
    name: v.optional(v.string()),
    memberIds: v.array(v.id("users")),
    agentMemberIds: v.optional(v.array(v.id("users"))),
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx, args.workspaceId);

    // For 1-to-1, check if conversation already exists
    if (args.kind === "1to1" && args.memberIds.length === 1) {
      const otherUserId = args.memberIds[0];
      const myMemberships = await ctx.db
        .query("directConversationMembers")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .take(500);

      for (const m of myMemberships) {
        const conv = await ctx.db.get(m.conversationId);
        if (conv && conv.kind === "1to1" && !conv.isArchived) {
          const otherMembership = await ctx.db
            .query("directConversationMembers")
            .withIndex("by_conversation_user", (q) =>
              q
                .eq("conversationId", m.conversationId)
                .eq("userId", otherUserId),
            )
            .unique();
          if (otherMembership) return m.conversationId;
        }
      }
    }

    const conversationId = await ctx.db.insert("directConversations", {
      workspaceId: args.workspaceId,
      kind: args.kind,
      name: args.name,
      createdBy: user._id,
      isArchived: false,
    });

    // Add creator as member
    await ctx.db.insert("directConversationMembers", {
      conversationId,
      userId: user._id,
      isAgent: false,
      lastReadAt: Date.now(),
    });

    // Add other members
    for (const memberId of args.memberIds) {
      if (memberId === user._id) continue;
      await ctx.db.insert("directConversationMembers", {
        conversationId,
        userId: memberId,
        isAgent: false,
      });
    }

    // Add agent members
    for (const agentId of args.agentMemberIds ?? []) {
      await ctx.db.insert("directConversationMembers", {
        conversationId,
        userId: agentId,
        isAgent: true,
      });
    }

    return conversationId;
  },
});

export const markRead = mutation({
  args: { conversationId: v.id("directConversations") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const membership = await ctx.db
      .query("directConversationMembers")
      .withIndex("by_conversation_user", (q) =>
        q
          .eq("conversationId", args.conversationId)
          .eq("userId", user._id),
      )
      .unique();

    if (membership) {
      await ctx.db.patch(membership._id, { lastReadAt: Date.now() });
    }
  },
});
