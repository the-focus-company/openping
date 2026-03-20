import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { Doc } from "./_generated/dataModel";
import { requireAuth } from "./auth";

function requireChannelOwnerOrAdmin(
  channel: Doc<"channels">,
  user: { _id: Doc<"users">["_id"]; role: string },
  action: string,
) {
  if (channel.createdBy !== user._id && user.role !== "admin") {
    throw new Error(`Only the creator or an admin can ${action} this channel`);
  }
}

export const create = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    const existing = await ctx.db
      .query("channels")
      .withIndex("by_workspace_name", (q) =>
        q.eq("workspaceId", user.workspaceId).eq("name", args.name),
      )
      .unique();
    if (existing) throw new Error("Channel name already taken");

    const channelId = await ctx.db.insert("channels", {
      name: args.name,
      description: args.description,
      workspaceId: user.workspaceId,
      createdBy: user._id,
      isDefault: false,
      isArchived: false,
      type: "public",
    });

    // Creator auto-joins
    await ctx.db.insert("channelMembers", {
      channelId,
      userId: user._id,
    });

    return channelId;
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireAuth(ctx);

    const channels = await ctx.db
      .query("channels")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", user.workspaceId))
      .collect();

    // Get unread counts for each channel
    const channelsWithUnread = await Promise.all(
      channels
        .filter((c) => !c.isArchived && (!c.type || c.type === "public"))
        .map(async (channel) => {
          const membership = await ctx.db
            .query("channelMembers")
            .withIndex("by_channel_user", (q) =>
              q.eq("channelId", channel._id).eq("userId", user._id),
            )
            .unique();

          let unreadCount = 0;
          if (membership) {
            const lastReadAt = membership.lastReadAt ?? 0;
            const unreadMessages = await ctx.db
              .query("messages")
              .withIndex("by_channel", (q) =>
                q
                  .eq("channelId", channel._id)
                  .gt("_creationTime", lastReadAt),
              )
              .collect();
            unreadCount = unreadMessages.length;
          }

          return {
            ...channel,
            isMember: !!membership,
            unreadCount,
          };
        }),
    );

    return channelsWithUnread;
  },
});

export const get = query({
  args: { channelId: v.id("channels") },
  handler: async (ctx, args) => {
    await requireAuth(ctx);
    return await ctx.db.get(args.channelId);
  },
});

export const join = mutation({
  args: { channelId: v.id("channels") },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    const existing = await ctx.db
      .query("channelMembers")
      .withIndex("by_channel_user", (q) =>
        q.eq("channelId", args.channelId).eq("userId", user._id),
      )
      .unique();

    if (existing) return existing._id;

    return await ctx.db.insert("channelMembers", {
      channelId: args.channelId,
      userId: user._id,
    });
  },
});

export const leave = mutation({
  args: { channelId: v.id("channels") },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    const channel = await ctx.db.get(args.channelId);
    if (!channel) throw new Error("Channel not found");
    if (channel.isDefault) throw new Error("Cannot leave a default channel");

    const membership = await ctx.db
      .query("channelMembers")
      .withIndex("by_channel_user", (q) =>
        q.eq("channelId", args.channelId).eq("userId", user._id),
      )
      .unique();

    if (!membership) throw new Error("Not a member of this channel");

    await ctx.db.delete(membership._id);
  },
});

export const archive = mutation({
  args: { channelId: v.id("channels") },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    const channel = await ctx.db.get(args.channelId);
    if (!channel) throw new Error("Channel not found");
    if (channel.isDefault) throw new Error("Cannot archive a default channel");
    requireChannelOwnerOrAdmin(channel, user, "archive");

    await ctx.db.patch(args.channelId, { isArchived: true });
  },
});

export const unarchive = mutation({
  args: { channelId: v.id("channels") },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    const channel = await ctx.db.get(args.channelId);
    if (!channel) throw new Error("Channel not found");
    requireChannelOwnerOrAdmin(channel, user, "unarchive");

    await ctx.db.patch(args.channelId, { isArchived: false });
  },
});

export const invite = mutation({
  args: {
    channelId: v.id("channels"),
    userIds: v.array(v.id("users")),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    const channel = await ctx.db.get(args.channelId);
    if (!channel) throw new Error("Channel not found");

    // Verify caller is a member
    const callerMembership = await ctx.db
      .query("channelMembers")
      .withIndex("by_channel_user", (q) =>
        q.eq("channelId", args.channelId).eq("userId", user._id),
      )
      .unique();
    if (!callerMembership) throw new Error("You must be a member to invite others");

    for (const targetUserId of args.userIds) {
      // Verify target user exists and is in same workspace
      const targetUser = await ctx.db.get(targetUserId);
      if (!targetUser || targetUser.workspaceId !== channel.workspaceId) continue;

      // Skip if already a member
      const existingMembership = await ctx.db
        .query("channelMembers")
        .withIndex("by_channel_user", (q) =>
          q.eq("channelId", args.channelId).eq("userId", targetUserId),
        )
        .unique();
      if (existingMembership) continue;

      await ctx.db.insert("channelMembers", {
        channelId: args.channelId,
        userId: targetUserId,
      });
    }
  },
});

export const listMembers = query({
  args: { channelId: v.id("channels") },
  handler: async (ctx, args) => {
    await requireAuth(ctx);

    const memberships = await ctx.db
      .query("channelMembers")
      .withIndex("by_channel", (q) => q.eq("channelId", args.channelId))
      .collect();

    const members = await Promise.all(
      memberships.map(async (membership) => {
        const user = await ctx.db.get(membership.userId);
        if (!user) return null;
        return {
          _id: user._id,
          name: user.name,
          avatarUrl: user.avatarUrl,
          role: user.role,
          lastSeenAt: user.lastSeenAt,
          presenceStatus: user.presenceStatus,
        };
      }),
    );

    return members.filter((m) => m !== null);
  },
});

export const update = mutation({
  args: {
    channelId: v.id("channels"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    const channel = await ctx.db.get(args.channelId);
    if (!channel) throw new Error("Channel not found");
    requireChannelOwnerOrAdmin(channel, user, "update");

    // Check name uniqueness for public channels only
    if (args.name && (!channel.type || channel.type === "public")) {
      const existing = await ctx.db
        .query("channels")
        .withIndex("by_workspace_name", (q) =>
          q.eq("workspaceId", channel.workspaceId).eq("name", args.name!),
        )
        .unique();
      if (existing && existing._id !== args.channelId) {
        throw new Error("Channel name already taken");
      }
    }

    const { channelId: _, ...updates } = args;
    await ctx.db.patch(args.channelId, updates);
  },
});
