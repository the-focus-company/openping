import { v } from "convex/values";
import { internalQuery, internalMutation } from "./_generated/server";

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
