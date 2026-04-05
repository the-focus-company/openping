import { query, mutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import { MutationCtx, QueryCtx } from "./_generated/server";
import {
  requireAuth,
  requireUser,
  requireConversationMember,
  getGuestVisibleUserIds,
} from "./auth";

// ── Helpers ──

function requireOwnerOrAdmin(
  conversation: Doc<"conversations">,
  user: { _id: Id<"users">; role: string },
  action: string,
) {
  if (conversation.createdBy !== user._id && user.role !== "admin") {
    throw new Error(`Only the creator or an admin can ${action} this conversation`);
  }
}

/** Fetch deduplicated members and last message preview for a conversation. */
async function enrichConversation(ctx: QueryCtx, conversationId: Id<"conversations">) {
  const members = await ctx.db
    .query("conversationMembers")
    .withIndex("by_conversation", (q) => q.eq("conversationId", conversationId))
    .take(50);

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
        isAgent: m.isAgent ?? false,
      };
    }),
  );

  const lastMsg = await ctx.db
    .query("messages")
    .withIndex("by_conversation", (q) => q.eq("conversationId", conversationId))
    .order("desc")
    .first();

  let lastMessage = null;
  if (lastMsg) {
    const author = await ctx.db.get(lastMsg.authorId);
    lastMessage = {
      body: lastMsg.body,
      authorName: author?.name ?? "Unknown",
      timestamp: lastMsg._creationTime,
    };
  }

  return { memberDetails, lastMessage, lastMsgTime: lastMsg?._creationTime };
}

/** Insert a system message into a conversation (no unread tracking). */
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

// ── Internal queries ──

export const isMember = internalQuery({
  args: {
    conversationId: v.id("conversations"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const membership = await ctx.db
      .query("conversationMembers")
      .withIndex("by_conversation_and_user", (q) =>
        q.eq("conversationId", args.conversationId).eq("userId", args.userId),
      )
      .unique();
    return !!membership;
  },
});

export const getByWorkspaceName = internalQuery({
  args: {
    workspaceId: v.id("workspaces"),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("conversations")
      .withIndex("by_workspace_and_name", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("name", args.name),
      )
      .unique();
  },
});

// ── Public mutations ──

export const create = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    kind: v.union(
      v.literal("1to1"),
      v.literal("group"),
      v.literal("agent_1to1"),
      v.literal("agent_group"),
    ),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    visibility: v.union(
      v.literal("public"),
      v.literal("secret"),
      v.literal("secret_can_be_public"),
    ),
    memberIds: v.optional(v.array(v.id("users"))),
    agentMemberIds: v.optional(v.array(v.id("users"))),
    isDefault: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx, args.workspaceId);

    // Guests cannot create conversations
    if (user.role === "guest") {
      throw new Error("Guests cannot create conversations");
    }

    // Force secret visibility for DM conversations
    if (args.kind === "1to1" || args.kind === "group") {
      args = { ...args, visibility: "secret" };
    }

    const name = args.name?.trim();
    if (name !== undefined && name.length > 200) {
      throw new Error("Conversation name must be 200 characters or fewer");
    }
    if (args.description !== undefined && args.description.length > 2000) {
      throw new Error("Description must be 2000 characters or fewer");
    }

    // For 1to1, dedup: check if existing conversation exists
    const memberIds = args.memberIds ?? [];
    if (args.kind === "1to1" && memberIds.length === 1) {
      const otherUserId = memberIds[0];
      if (otherUserId === user._id) {
        throw new Error("Cannot create a 1:1 conversation with yourself");
      }
      const existing = await findExisting1to1(ctx, user._id, otherUserId);
      if (existing) return existing;
    }

    // For public channels, check name uniqueness
    if (name && args.visibility === "public") {
      const existing = await ctx.db
        .query("conversations")
        .withIndex("by_workspace_and_name", (q) =>
          q.eq("workspaceId", args.workspaceId).eq("name", name),
        )
        .unique();
      if (existing) throw new Error("Conversation name already taken");
    }

    // Guest visibility restriction
    const visibleUserIds = await getGuestVisibleUserIds(ctx, user._id, user.role);
    if (visibleUserIds) {
      for (const memberId of memberIds) {
        if (!visibleUserIds.has(memberId)) {
          throw new Error("Guests can only message members of shared conversations");
        }
      }
    }

    const conversationId = await ctx.db.insert("conversations", {
      workspaceId: args.workspaceId,
      kind: args.kind,
      name: name ?? undefined,
      description: args.description,
      visibility: args.visibility,
      isLockedSecret: args.visibility === "secret" ? true : undefined,
      createdBy: user._id,
      isDefault: args.isDefault ?? false,
      isArchived: false,
    });

    // Track added members to prevent duplicates
    const addedUserIds = new Set<string>();

    // Add creator as member
    await ctx.db.insert("conversationMembers", {
      conversationId,
      userId: user._id,
      isAgent: false,
      lastReadAt: Date.now(),
    });
    addedUserIds.add(user._id);

    // Add agent members (with isAgent: true)
    for (const agentId of args.agentMemberIds ?? []) {
      if (addedUserIds.has(agentId)) continue;
      await ctx.db.insert("conversationMembers", {
        conversationId,
        userId: agentId,
        isAgent: true,
      });
      addedUserIds.add(agentId);
    }

    // Add other (human) members
    for (const memberId of memberIds) {
      if (addedUserIds.has(memberId)) continue;
      // Verify they are in the workspace
      const targetWs = await ctx.db
        .query("workspaceMembers")
        .withIndex("by_user_workspace", (q) =>
          q.eq("userId", memberId).eq("workspaceId", args.workspaceId),
        )
        .unique();
      if (!targetWs) continue;

      await ctx.db.insert("conversationMembers", {
        conversationId,
        userId: memberId,
        isAgent: false,
      });
      addedUserIds.add(memberId);
    }

    if (args.visibility === "public" && name) {
      await insertSystemMsg(ctx, conversationId, user._id, `${user.name} created #${name}`);
    }

    return conversationId;
  },
});

// ── Queries ──

export const list = query({
  args: {
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx, args.workspaceId);

    // Get all conversation memberships for this user
    const memberships = await ctx.db
      .query("conversationMembers")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .take(500);

    const conversations = await Promise.all(
      memberships.map(async (membership) => {
        const conversation = await ctx.db.get(membership.conversationId);
        if (!conversation || conversation.isArchived || conversation.deletedAt) return null;
        if (conversation.workspaceId !== args.workspaceId) return null;

        const { memberDetails, lastMessage, lastMsgTime } = await enrichConversation(ctx, conversation._id);

        return {
          ...conversation,
          isMember: true,
          members: memberDetails,
          unreadCount: membership.unreadCount ?? 0,
          unreadMentionCount: membership.unreadMentionCount ?? 0,
          isStarred: membership.isStarred ?? false,
          isMuted: membership.isMuted ?? false,
          folder: membership.folder ?? null,
          lastMessage,
          lastMessageAt: lastMsgTime ?? conversation._creationTime,
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
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) throw new Error("Conversation not found");

    // For non-public conversations, verify membership
    let membership = null;
    if (conversation.visibility !== "public") {
      membership = await requireConversationMember(ctx, args.conversationId, user._id);
    } else {
      membership = await ctx.db
        .query("conversationMembers")
        .withIndex("by_conversation_and_user", (q) =>
          q.eq("conversationId", args.conversationId).eq("userId", user._id),
        )
        .unique();
    }

    const allMembers = await ctx.db
      .query("conversationMembers")
      .withIndex("by_conversation", (q) =>
        q.eq("conversationId", conversation._id),
      )
      .take(50);

    // Deduplicate
    const seenIds = new Set<string>();
    const uniqueMembers = allMembers.filter((m) => {
      if (seenIds.has(m.userId)) return false;
      seenIds.add(m.userId);
      return true;
    });

    const memberDetails = await Promise.all(
      uniqueMembers.map(async (m) => {
        const memberUser = await ctx.db.get(m.userId);
        return {
          userId: m.userId,
          name: memberUser?.name ?? "Unknown",
          avatarUrl: memberUser?.avatarUrl,
          isAgent: m.isAgent ?? false,
        };
      }),
    );

    return {
      ...conversation,
      isMember: !!membership,
      isStarred: membership?.isStarred ?? false,
      members: memberDetails,
    };
  },
});

export const listMembers = query({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    const currentUser = await requireUser(ctx);

    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) throw new Error("Conversation not found");

    // For non-public, require membership
    if (conversation.visibility !== "public") {
      await requireConversationMember(ctx, args.conversationId, currentUser._id);
    }

    const memberships = await ctx.db
      .query("conversationMembers")
      .withIndex("by_conversation", (q) => q.eq("conversationId", args.conversationId))
      .take(200);

    const members = await Promise.all(
      memberships.map(async (membership) => {
        const memberUser = await ctx.db.get(membership.userId);
        if (!memberUser) return null;

        const wsMembership = await ctx.db
          .query("workspaceMembers")
          .withIndex("by_user_workspace", (q) =>
            q.eq("userId", memberUser._id).eq("workspaceId", conversation.workspaceId),
          )
          .unique();

        return {
          _id: memberUser._id,
          name: memberUser.name,
          avatarUrl: memberUser.avatarUrl,
          role: wsMembership?.role ?? "member",
          lastSeenAt: memberUser.lastSeenAt,
          presenceStatus: memberUser.presenceStatus,
          isAgent: membership.isAgent ?? false,
        };
      }),
    );

    return members.filter((m) => m !== null);
  },
});

export const memberCount = query({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    const members = await ctx.db
      .query("conversationMembers")
      .withIndex("by_conversation", (q) => q.eq("conversationId", args.conversationId))
      .take(500);
    return members.length;
  },
});

// ── Mutations ──

export const markRead = mutation({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const membership = await ctx.db
      .query("conversationMembers")
      .withIndex("by_conversation_and_user", (q) =>
        q.eq("conversationId", args.conversationId).eq("userId", user._id),
      )
      .unique();

    if (membership) {
      await ctx.db.patch(membership._id, {
        lastReadAt: Date.now(),
        unreadCount: 0,
        unreadMentionCount: 0,
      });
    }
  },
});

export const archive = mutation({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) throw new Error("Conversation not found");

    await requireConversationMember(ctx, args.conversationId, user._id);

    if (conversation.isDefault) throw new Error("Cannot archive a default conversation");

    // For public conversations, require owner/admin
    if (conversation.visibility === "public") {
      const wsUser = await requireAuth(ctx, conversation.workspaceId);
      requireOwnerOrAdmin(conversation, wsUser, "archive");
    }

    await ctx.db.patch(args.conversationId, {
      isArchived: true,
      archivedAt: Date.now(),
    });
    await insertSystemMsg(ctx, args.conversationId, user._id, `${user.name} archived this conversation`);
  },
});

export const unarchive = mutation({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) throw new Error("Conversation not found");

    await requireConversationMember(ctx, args.conversationId, user._id);

    await ctx.db.patch(args.conversationId, {
      isArchived: false,
      archivedAt: undefined,
    });
    await insertSystemMsg(ctx, args.conversationId, user._id, `${user.name} unarchived this conversation`);
  },
});

export const join = mutation({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) throw new Error("Conversation not found");
    if (conversation.visibility !== "public") {
      throw new Error("Cannot self-join a non-public conversation");
    }

    // Check if user is a guest (guests cannot self-join)
    const wsMembership = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_user_workspace", (q) =>
        q.eq("userId", user._id).eq("workspaceId", conversation.workspaceId),
      )
      .unique();
    if (wsMembership?.role === "guest") {
      throw new Error("Guests cannot self-join conversations");
    }

    const existing = await ctx.db
      .query("conversationMembers")
      .withIndex("by_conversation_and_user", (q) =>
        q.eq("conversationId", args.conversationId).eq("userId", user._id),
      )
      .unique();

    if (existing) return existing._id;

    const membershipId = await ctx.db.insert("conversationMembers", {
      conversationId: args.conversationId,
      userId: user._id,
      isAgent: false,
    });

    await insertSystemMsg(ctx, args.conversationId, user._id, `${user.name} joined the conversation`);

    return membershipId;
  },
});

export const leave = mutation({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) throw new Error("Conversation not found");
    if (conversation.isDefault) throw new Error("Cannot leave a default conversation");

    const membership = await ctx.db
      .query("conversationMembers")
      .withIndex("by_conversation_and_user", (q) =>
        q.eq("conversationId", args.conversationId).eq("userId", user._id),
      )
      .unique();

    if (!membership) throw new Error("Not a member of this conversation");

    await ctx.db.delete(membership._id);
    await insertSystemMsg(ctx, args.conversationId, user._id, `${user.name} left the conversation`);
  },
});

export const invite = mutation({
  args: {
    conversationId: v.id("conversations"),
    userIds: v.array(v.id("users")),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) throw new Error("Conversation not found");

    // Verify caller is a member
    await requireConversationMember(ctx, args.conversationId, user._id);

    // Guests cannot invite others
    const callerWsMembership = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_user_workspace", (q) =>
        q.eq("userId", user._id).eq("workspaceId", conversation.workspaceId),
      )
      .unique();
    if (callerWsMembership?.role === "guest") {
      throw new Error("Guests cannot invite others to conversations");
    }

    for (const targetUserId of args.userIds) {
      const targetUser = await ctx.db.get(targetUserId);
      if (!targetUser) continue;

      // Verify target user is in same workspace
      const targetMembership = await ctx.db
        .query("workspaceMembers")
        .withIndex("by_user_workspace", (q) =>
          q.eq("userId", targetUserId).eq("workspaceId", conversation.workspaceId),
        )
        .unique();
      if (!targetMembership) continue;

      // Skip if already a member
      const existingMembership = await ctx.db
        .query("conversationMembers")
        .withIndex("by_conversation_and_user", (q) =>
          q.eq("conversationId", args.conversationId).eq("userId", targetUserId),
        )
        .unique();
      if (existingMembership) continue;

      await ctx.db.insert("conversationMembers", {
        conversationId: args.conversationId,
        userId: targetUserId,
        isAgent: false,
      });

      await insertSystemMsg(
        ctx,
        args.conversationId,
        user._id,
        `${user.name} added ${targetUser.name} to the conversation`,
      );
    }
  },
});

export const removeMember = mutation({
  args: {
    conversationId: v.id("conversations"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) throw new Error("Conversation not found");

    // Verify caller is a member
    await requireConversationMember(ctx, args.conversationId, user._id);

    const isSelf = args.userId === user._id;

    if (!isSelf) {
      const isCreator = conversation.createdBy === user._id;
      const wsMembership = await ctx.db
        .query("workspaceMembers")
        .withIndex("by_user_workspace", (q) =>
          q.eq("userId", user._id).eq("workspaceId", conversation.workspaceId),
        )
        .unique();
      const isAdmin = wsMembership?.role === "admin";
      if (!isCreator && !isAdmin) {
        throw new Error("Only the creator or an admin can remove members");
      }
    }

    const targetMembership = await ctx.db
      .query("conversationMembers")
      .withIndex("by_conversation_and_user", (q) =>
        q.eq("conversationId", args.conversationId).eq("userId", args.userId),
      )
      .unique();
    if (!targetMembership) throw new Error("User is not a member of this conversation");

    await ctx.db.delete(targetMembership._id);

    if (isSelf) {
      await insertSystemMsg(ctx, args.conversationId, user._id, `${user.name} left the conversation`);
    } else {
      const removedUser = await ctx.db.get(args.userId);
      const removedName = removedUser?.name ?? "Unknown";
      await insertSystemMsg(ctx, args.conversationId, user._id, `${user.name} removed ${removedName} from the conversation`);
    }
  },
});

export const toggleStar = mutation({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const membership = await ctx.db
      .query("conversationMembers")
      .withIndex("by_conversation_and_user", (q) =>
        q.eq("conversationId", args.conversationId).eq("userId", user._id),
      )
      .unique();

    if (!membership) throw new Error("Not a member of this conversation");

    await ctx.db.patch(membership._id, {
      isStarred: !membership.isStarred,
    });

    return !membership.isStarred;
  },
});

export const toggleMute = mutation({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const membership = await ctx.db
      .query("conversationMembers")
      .withIndex("by_conversation_and_user", (q) =>
        q.eq("conversationId", args.conversationId).eq("userId", user._id),
      )
      .unique();
    if (!membership) throw new Error("Not a member of this conversation");
    await ctx.db.patch(membership._id, { isMuted: !membership.isMuted });
    return !membership.isMuted;
  },
});

export const setFolder = mutation({
  args: { conversationId: v.id("conversations"), folder: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const membership = await ctx.db
      .query("conversationMembers")
      .withIndex("by_conversation_and_user", (q) =>
        q.eq("conversationId", args.conversationId).eq("userId", user._id),
      )
      .unique();
    if (!membership) throw new Error("Not a member of this conversation");
    await ctx.db.patch(membership._id, { folder: args.folder });
  },
});

export const updateVisibility = mutation({
  args: {
    conversationId: v.id("conversations"),
    visibility: v.union(
      v.literal("public"),
      v.literal("secret"),
      v.literal("secret_can_be_public"),
    ),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) throw new Error("Conversation not found");

    await requireConversationMember(ctx, args.conversationId, user._id);

    // Prevent making DMs public
    if ((conversation.kind === "1to1" || conversation.kind === "group") && args.visibility === "public") {
      throw new Error("Cannot make DM conversations public");
    }

    // Must be owner or admin
    const wsUser = await requireAuth(ctx, conversation.workspaceId);
    requireOwnerOrAdmin(conversation, wsUser, "update visibility");

    // CRITICAL: If isLockedSecret, cannot change visibility
    if (conversation.isLockedSecret) {
      throw new Error("This conversation's visibility is permanently locked to secret");
    }

    const oldVis = conversation.visibility;
    const newVis = args.visibility;

    // If setting to secret, lock it permanently
    if (newVis === "secret") {
      await ctx.db.patch(args.conversationId, {
        visibility: "secret",
        isLockedSecret: true,
      });
      await insertSystemMsg(
        ctx,
        args.conversationId,
        user._id,
        `${user.name} changed visibility to secret (permanently locked)`,
      );
      return;
    }

    // public <-> secret_can_be_public: allowed freely
    if (
      (oldVis === "public" && newVis === "secret_can_be_public") ||
      (oldVis === "secret_can_be_public" && newVis === "public")
    ) {
      await ctx.db.patch(args.conversationId, { visibility: newVis });
      await insertSystemMsg(
        ctx,
        args.conversationId,
        user._id,
        `${user.name} changed visibility from ${oldVis} to ${newVis}`,
      );
      return;
    }

    // Any other transition that's not to "secret" is just a direct patch
    await ctx.db.patch(args.conversationId, { visibility: newVis });
    await insertSystemMsg(
      ctx,
      args.conversationId,
      user._id,
      `${user.name} changed visibility to ${newVis}`,
    );
  },
});

export const getOrCreate1to1 = mutation({
  args: {
    userId: v.id("users"),
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx, args.workspaceId);

    if (args.userId === user._id) {
      throw new Error("Cannot create a 1:1 conversation with yourself");
    }

    const targetUser = await ctx.db.get(args.userId);
    if (!targetUser) throw new Error("User not found");

    const targetWsMembership = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_user_workspace", (q) =>
        q.eq("userId", args.userId).eq("workspaceId", args.workspaceId),
      )
      .unique();
    if (!targetWsMembership) {
      throw new Error("User is not in the same workspace");
    }

    // Check if existing 1:1 conversation exists
    const existing = await findExisting1to1(ctx, user._id, args.userId);
    if (existing) return existing;

    // Create new 1:1 conversation
    const conversationId = await ctx.db.insert("conversations", {
      workspaceId: args.workspaceId,
      kind: "1to1",
      visibility: "secret_can_be_public",
      createdBy: user._id,
      isDefault: false,
      isArchived: false,
    });

    await ctx.db.insert("conversationMembers", {
      conversationId,
      userId: user._id,
      isAgent: false,
      lastReadAt: Date.now(),
    });

    await ctx.db.insert("conversationMembers", {
      conversationId,
      userId: args.userId,
      isAgent: false,
    });

    return conversationId;
  },
});

export const update = mutation({
  args: {
    conversationId: v.id("conversations"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) throw new Error("Conversation not found");
    const user = await requireAuth(ctx, conversation.workspaceId);
    requireOwnerOrAdmin(conversation, user, "update");

    const name = args.name !== undefined ? args.name.trim() : undefined;
    if (name !== undefined && (!name || name.length > 80)) {
      throw new Error("Conversation name must be between 1 and 80 characters");
    }

    // Check name uniqueness for public conversations
    if (name && conversation.visibility === "public") {
      const existing = await ctx.db
        .query("conversations")
        .withIndex("by_workspace_and_name", (q) =>
          q.eq("workspaceId", conversation.workspaceId).eq("name", name),
        )
        .unique();
      if (existing && existing._id !== args.conversationId) {
        throw new Error("Conversation name already taken");
      }
    }

    const patchData: Record<string, string | undefined> = {};
    if (name !== undefined) patchData.name = name;
    if (args.description !== undefined) patchData.description = args.description;
    await ctx.db.patch(args.conversationId, patchData);
  },
});

export const listActivity = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx, args.workspaceId);

    // Get user's conversation memberships
    const memberships = await ctx.db
      .query("conversationMembers")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .take(100);

    const conversationIds = memberships.map((m) => m.conversationId);
    const starredSet = new Set(
      memberships.filter((m) => m.isStarred).map((m) => m.conversationId),
    );

    // Batch fetch conversations
    const conversations = await Promise.all(
      conversationIds.map((id) => ctx.db.get(id)),
    );
    const activeConversations = conversations.filter(
      (c): c is NonNullable<typeof c> =>
        c !== null && !c.isArchived && c.workspaceId === args.workspaceId,
    );
    const conversationMap = new Map(activeConversations.map((c) => [c._id, c]));

    // Batch fetch recent messages for all conversations
    const allMessages = await Promise.all(
      activeConversations.map((conv) =>
        ctx.db
          .query("messages")
          .withIndex("by_conversation", (q) => q.eq("conversationId", conv._id))
          .order("desc")
          .take(20),
      ),
    );

    // Collect unique author IDs and batch fetch
    const authorIds = [...new Set(allMessages.flat().map((m) => m.authorId))];
    const authors = await Promise.all(authorIds.map((id) => ctx.db.get(id)));
    const authorMap = new Map(
      authors.filter((a): a is NonNullable<typeof a> => a !== null).map((a) => [a._id, a]),
    );

    const items: Array<{
      conversationId: string;
      conversationName: string;
      isStarred: boolean;
      messageId: string;
      body: string;
      authorName: string;
      authorId: string;
      createdAt: number;
      type: "thread" | "mention" | "message";
      threadReplyCount?: number;
    }> = [];

    for (let i = 0; i < activeConversations.length; i++) {
      const conversation = activeConversations[i];
      const recentMessages = allMessages[i];

      for (const msg of recentMessages) {
        if (msg.deletedAt) continue;
        const authorName = authorMap.get(msg.authorId)?.name ?? "Unknown";

        const isThread = (msg.threadReplyCount ?? 0) > 0;
        const isMention = msg.body.toLowerCase().includes(`@${user.name?.toLowerCase()}`);

        if (isThread || isMention) {
          items.push({
            conversationId: conversation._id,
            conversationName: conversation.name ?? "",
            isStarred: starredSet.has(conversation._id),
            messageId: msg._id,
            body: msg.body,
            authorName,
            authorId: msg.authorId,
            createdAt: msg._creationTime,
            type: isMention ? "mention" : "thread",
            threadReplyCount: msg.threadReplyCount,
          });
        }
      }
    }

    items.sort((a, b) => {
      if (a.isStarred && !b.isStarred) return -1;
      if (!a.isStarred && b.isStarred) return 1;
      return b.createdAt - a.createdAt;
    });

    return items.slice(0, 30);
  },
});

export const listArchived = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx, args.workspaceId);

    const memberships = await ctx.db
      .query("conversationMembers")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .take(500);

    const conversations = await Promise.all(
      memberships.map(async (membership) => {
        const conversation = await ctx.db.get(membership.conversationId);
        if (!conversation || !conversation.isArchived || conversation.deletedAt) return null;
        if (conversation.workspaceId !== args.workspaceId) return null;

        const { memberDetails, lastMessage } = await enrichConversation(ctx, conversation._id);

        return {
          ...conversation,
          members: memberDetails,
          lastMessage,
        };
      }),
    );

    return conversations.filter((c): c is NonNullable<typeof c> => c !== null);
  },
});

// ── Helpers ──

async function findExisting1to1(
  ctx: MutationCtx,
  userId: Id<"users">,
  otherUserId: Id<"users">,
): Promise<Id<"conversations"> | null> {
  const myMemberships = await ctx.db
    .query("conversationMembers")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .take(500);

  for (const m of myMemberships) {
    const conv = await ctx.db.get(m.conversationId);
    if (conv && conv.kind === "1to1" && !conv.isArchived && !conv.deletedAt) {
      const otherMembership = await ctx.db
        .query("conversationMembers")
        .withIndex("by_conversation_and_user", (q) =>
          q.eq("conversationId", m.conversationId).eq("userId", otherUserId),
        )
        .unique();
      if (otherMembership) return m.conversationId;
    }
  }
  return null;
}
