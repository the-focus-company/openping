import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAuth } from "./auth";

export const getOrCreateDM = mutation({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    if (args.userId === user._id) {
      throw new Error("Cannot create a DM with yourself");
    }

    const targetUser = await ctx.db.get(args.userId);
    if (!targetUser) throw new Error("User not found");
    if (targetUser.workspaceId !== user.workspaceId) {
      throw new Error("User is not in the same workspace");
    }

    const myMemberships = await ctx.db
      .query("channelMembers")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    for (const membership of myMemberships) {
      const channel = await ctx.db.get(membership.channelId);
      if (!channel || channel.type !== "dm") continue;

      const targetMembership = await ctx.db
        .query("channelMembers")
        .withIndex("by_channel_user", (q) =>
          q.eq("channelId", channel._id).eq("userId", args.userId),
        )
        .unique();

      if (targetMembership) {
        return channel._id;
      }
    }

    const channelId = await ctx.db.insert("channels", {
      name: "",
      workspaceId: user.workspaceId,
      createdBy: user._id,
      isDefault: false,
      isArchived: false,
      type: "dm",
    });

    await ctx.db.insert("channelMembers", {
      channelId,
      userId: user._id,
    });

    await ctx.db.insert("channelMembers", {
      channelId,
      userId: args.userId,
    });

    return channelId;
  },
});

export const createGroup = mutation({
  args: {
    name: v.string(),
    memberIds: v.array(v.id("users")),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    const name = args.name.trim();
    if (!name) throw new Error("Group name cannot be empty");
    if (args.memberIds.length === 0) {
      throw new Error("At least one member is required");
    }

    const uniqueMemberIds = [...new Set(args.memberIds)].filter(
      (id) => id !== user._id,
    );

    await Promise.all(
      uniqueMemberIds.map(async (memberId) => {
        const member = await ctx.db.get(memberId);
        if (!member) throw new Error(`User ${memberId} not found`);
        if (member.workspaceId !== user.workspaceId) {
          throw new Error(`User ${memberId} is not in the same workspace`);
        }
      }),
    );

    const channelId = await ctx.db.insert("channels", {
      name,
      workspaceId: user.workspaceId,
      createdBy: user._id,
      isDefault: false,
      isArchived: false,
      type: "group",
    });

    await ctx.db.insert("channelMembers", {
      channelId,
      userId: user._id,
    });

    await Promise.all(
      uniqueMemberIds.map((memberId) =>
        ctx.db.insert("channelMembers", {
          channelId,
          userId: memberId,
        }),
      ),
    );

    return channelId;
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireAuth(ctx);

    const myMemberships = await ctx.db
      .query("channelMembers")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    const conversations = await Promise.all(
      myMemberships.map(async (membership) => {
        const channel = await ctx.db.get(membership.channelId);
        if (!channel) return null;
        if (channel.type !== "dm" && channel.type !== "group") return null;
        if (channel.isArchived) return null;

        const allMembers = await ctx.db
          .query("channelMembers")
          .withIndex("by_channel", (q) => q.eq("channelId", channel._id))
          .collect();

        const participants = (
          await Promise.all(
            allMembers
              .filter((m) => m.userId !== user._id)
              .map(async (m) => {
                const u = await ctx.db.get(m.userId);
                if (!u) return null;
                return {
                  _id: u._id,
                  name: u.name,
                  avatarUrl: u.avatarUrl,
                };
              }),
          )
        ).filter((p): p is NonNullable<typeof p> => p !== null);

        const lastMessageResult = await ctx.db
          .query("messages")
          .withIndex("by_channel", (q) => q.eq("channelId", channel._id))
          .order("desc")
          .first();

        const lastMessage = lastMessageResult
          ? {
              body: lastMessageResult.body,
              authorId: lastMessageResult.authorId,
              _creationTime: lastMessageResult._creationTime,
            }
          : null;

        const lastReadAt = membership.lastReadAt ?? 0;
        const unreadMessages = await ctx.db
          .query("messages")
          .withIndex("by_channel", (q) =>
            q
              .eq("channelId", channel._id)
              .gt("_creationTime", lastReadAt),
          )
          .collect();

        const sortTime = lastMessage
          ? lastMessage._creationTime
          : channel._creationTime;

        return {
          _id: channel._id,
          name: channel.name,
          type: channel.type,
          participants,
          lastMessage,
          unreadCount: unreadMessages.length,
          _sortTime: sortTime,
        };
      }),
    );

    return conversations
      .filter((c): c is NonNullable<typeof c> => c !== null)
      .sort((a, b) => b._sortTime - a._sortTime);
  },
});

export const addMembers = mutation({
  args: {
    channelId: v.id("channels"),
    userIds: v.array(v.id("users")),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    const channel = await ctx.db.get(args.channelId);
    if (!channel) throw new Error("Channel not found");
    if (channel.type !== "group") {
      throw new Error("Can only add members to group conversations");
    }

    const callerMembership = await ctx.db
      .query("channelMembers")
      .withIndex("by_channel_user", (q) =>
        q.eq("channelId", args.channelId).eq("userId", user._id),
      )
      .unique();
    if (!callerMembership) throw new Error("Not a member of this group");

    const addedNames: string[] = [];

    for (const userId of args.userIds) {
      const targetUser = await ctx.db.get(userId);
      if (!targetUser) throw new Error(`User ${userId} not found`);
      if (targetUser.workspaceId !== user.workspaceId) {
        throw new Error(`User ${userId} is not in the same workspace`);
      }

      const existing = await ctx.db
        .query("channelMembers")
        .withIndex("by_channel_user", (q) =>
          q.eq("channelId", args.channelId).eq("userId", userId),
        )
        .unique();

      if (!existing) {
        await ctx.db.insert("channelMembers", {
          channelId: args.channelId,
          userId,
        });
        addedNames.push(targetUser.name);
      }
    }

    if (addedNames.length > 0) {
      await ctx.db.insert("messages", {
        channelId: args.channelId,
        authorId: user._id,
        body: `${user.name} added ${addedNames.join(", ")} to the group`,
        type: "system",
        isEdited: false,
      });
    }
  },
});

export const removeMember = mutation({
  args: {
    channelId: v.id("channels"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    const channel = await ctx.db.get(args.channelId);
    if (!channel) throw new Error("Channel not found");
    if (channel.type !== "group") {
      throw new Error("Can only remove members from group conversations");
    }

    const callerMembership = await ctx.db
      .query("channelMembers")
      .withIndex("by_channel_user", (q) =>
        q.eq("channelId", args.channelId).eq("userId", user._id),
      )
      .unique();
    if (!callerMembership) throw new Error("Not a member of this group");

    const isSelf = args.userId === user._id;

    if (!isSelf) {
      const isCreator = channel.createdBy === user._id;
      const isAdmin = user.role === "admin";
      if (!isCreator && !isAdmin) {
        throw new Error("Only the group creator or an admin can remove members");
      }
    }

    const targetMembership = await ctx.db
      .query("channelMembers")
      .withIndex("by_channel_user", (q) =>
        q.eq("channelId", args.channelId).eq("userId", args.userId),
      )
      .unique();
    if (!targetMembership) throw new Error("User is not a member of this group");

    await ctx.db.delete(targetMembership._id);

    if (isSelf) {
      await ctx.db.insert("messages", {
        channelId: args.channelId,
        authorId: user._id,
        body: `${user.name} left the group`,
        type: "system",
        isEdited: false,
      });
    } else {
      const removedUser = await ctx.db.get(args.userId);
      const removedName = removedUser?.name ?? "Unknown";
      await ctx.db.insert("messages", {
        channelId: args.channelId,
        authorId: user._id,
        body: `${user.name} removed ${removedName} from the group`,
        type: "system",
        isEdited: false,
      });
    }
  },
});

export const getParticipants = query({
  args: {
    channelId: v.id("channels"),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx);

    const members = await ctx.db
      .query("channelMembers")
      .withIndex("by_channel", (q) => q.eq("channelId", args.channelId))
      .collect();

    const participants = await Promise.all(
      members.map(async (member) => {
        const u = await ctx.db.get(member.userId);
        if (!u) return null;
        return {
          _id: u._id,
          name: u.name,
          avatarUrl: u.avatarUrl,
          role: u.role,
          lastSeenAt: u.lastSeenAt,
        };
      }),
    );

    return participants.filter(
      (p): p is NonNullable<typeof p> => p !== null,
    );
  },
});
