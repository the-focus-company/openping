import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAuth, requireUser, requireDMmember, getGuestVisibleUserIds } from "./auth";

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
        if (!conversation || conversation.isArchived || conversation.deletedAt) return null;

        // Get all members of this conversation
        const members = await ctx.db
          .query("directConversationMembers")
          .withIndex("by_conversation", (q) =>
            q.eq("conversationId", conversation._id),
          )
          .take(50);

        // Deduplicate members by userId
        const seenUserIds = new Set<string>();
        const uniqueMembers = members.filter((m) => {
          if (seenUserIds.has(m.userId)) return false;
          seenUserIds.add(m.userId);
          return true;
        });

        const memberDetails = await Promise.all(
          uniqueMembers.map(async (m) => {
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
          isStarred: membership.isStarred ?? false,
          isMuted: membership.isMuted ?? false,
          folder: membership.folder ?? null,
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

export const listArchived = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);

    const memberships = await ctx.db
      .query("directConversationMembers")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .take(500);

    const conversations = await Promise.all(
      memberships.map(async (membership) => {
        const conversation = await ctx.db.get(membership.conversationId);
        if (!conversation || !conversation.isArchived || conversation.deletedAt) return null;

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

        const lastMessage = await ctx.db
          .query("directMessages")
          .withIndex("by_conversation", (q) =>
            q.eq("conversationId", conversation._id),
          )
          .order("desc")
          .first();

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
          unreadCount: 0,
          lastMessage: lastMessagePreview,
          myLastReadAt: membership.lastReadAt,
        };
      }),
    );

    return conversations
      .filter((c): c is NonNullable<typeof c> => c !== null)
      .sort((a, b) => (b.archivedAt ?? 0) - (a.archivedAt ?? 0));
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
      .first();
    if (!membership) throw new Error("Not a member");

    const allMembers = await ctx.db
      .query("directConversationMembers")
      .withIndex("by_conversation", (q) =>
        q.eq("conversationId", conversation._id),
      )
      .take(50);

    // Deduplicate
    const seenIds = new Set<string>();
    const members = allMembers.filter((m) => {
      if (seenIds.has(m.userId)) return false;
      seenIds.add(m.userId);
      return true;
    });

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

    // Guests can only DM members of shared channels
    const visibleUserIds = await getGuestVisibleUserIds(ctx, user._id, user.role);
    if (visibleUserIds) {
      for (const memberId of args.memberIds) {
        if (!visibleUserIds.has(memberId)) {
          throw new Error("Guests can only message members of shared channels");
        }
      }
    }

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
            .first();
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

    // Track added members to prevent duplicates
    const addedUserIds = new Set<string>();

    // Add creator as member
    await ctx.db.insert("directConversationMembers", {
      conversationId,
      userId: user._id,
      isAgent: false,
      lastReadAt: Date.now(),
    });
    addedUserIds.add(user._id);

    // Add agent members first (so they get isAgent: true)
    for (const agentId of args.agentMemberIds ?? []) {
      if (addedUserIds.has(agentId)) continue;
      await ctx.db.insert("directConversationMembers", {
        conversationId,
        userId: agentId,
        isAgent: true,
      });
      addedUserIds.add(agentId);
    }

    // Add other (human) members
    for (const memberId of args.memberIds) {
      if (addedUserIds.has(memberId)) continue;
      await ctx.db.insert("directConversationMembers", {
        conversationId,
        userId: memberId,
        isAgent: false,
      });
      addedUserIds.add(memberId);
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
      .first();

    if (membership) {
      await ctx.db.patch(membership._id, { lastReadAt: Date.now() });
    }
  },
});

export const archive = mutation({
  args: { conversationId: v.id("directConversations") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    await requireDMmember(ctx, args.conversationId, user._id);
    await ctx.db.patch(args.conversationId, {
      isArchived: true,
      archivedAt: Date.now(),
    });
  },
});

export const unarchive = mutation({
  args: { conversationId: v.id("directConversations") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    await requireDMmember(ctx, args.conversationId, user._id);
    await ctx.db.patch(args.conversationId, {
      isArchived: false,
      archivedAt: undefined,
    });
  },
});

export const remove = mutation({
  args: { conversationId: v.id("directConversations") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    await requireDMmember(ctx, args.conversationId, user._id);
    await ctx.db.patch(args.conversationId, {
      deletedAt: Date.now(),
    });
  },
});

export const toggleStar = mutation({
  args: { conversationId: v.id("directConversations") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const membership = await ctx.db
      .query("directConversationMembers")
      .withIndex("by_conversation_user", (q) =>
        q.eq("conversationId", args.conversationId).eq("userId", user._id),
      )
      .first();
    if (!membership) throw new Error("Not a member");
    await ctx.db.patch(membership._id, { isStarred: !membership.isStarred });
    return !membership.isStarred;
  },
});

export const toggleMute = mutation({
  args: { conversationId: v.id("directConversations") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const membership = await ctx.db
      .query("directConversationMembers")
      .withIndex("by_conversation_user", (q) =>
        q.eq("conversationId", args.conversationId).eq("userId", user._id),
      )
      .first();
    if (!membership) throw new Error("Not a member");
    await ctx.db.patch(membership._id, { isMuted: !membership.isMuted });
    return !membership.isMuted;
  },
});

export const setFolder = mutation({
  args: { conversationId: v.id("directConversations"), folder: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const membership = await ctx.db
      .query("directConversationMembers")
      .withIndex("by_conversation_user", (q) =>
        q.eq("conversationId", args.conversationId).eq("userId", user._id),
      )
      .first();
    if (!membership) throw new Error("Not a member");
    await ctx.db.patch(membership._id, { folder: args.folder });
  },
});
