import { query, mutation, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { requireAuth } from "./auth";

async function provisionNewUser(
  ctx: MutationCtx,
  args: {
    workosUserId: string;
    email: string;
    name: string;
    avatarUrl?: string;
  },
) {
  const slug = args.email.split("@")[0] + "-" + Date.now();

  const workspaceId = await ctx.db.insert("workspaces", {
    name: `${args.name}'s Workspace`,
    slug,
    integrations: {},
  });

  const userId = await ctx.db.insert("users", {
    workosUserId: args.workosUserId,
    email: args.email,
    name: args.name,
    avatarUrl: args.avatarUrl,
    role: "admin",
    workspaceId,
    status: "active",
    lastSeenAt: Date.now(),
  });

  await ctx.db.patch(workspaceId, { createdBy: userId });

  // Create a default #general channel
  const channelId = await ctx.db.insert("channels", {
    name: "general",
    description: "General discussion",
    workspaceId,
    createdBy: userId,
    isDefault: true,
    isArchived: false,
  });

  await ctx.db.insert("channelMembers", {
    channelId,
    userId,
  });

  return userId;
}

export const getMe = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    return await ctx.db
      .query("users")
      .withIndex("by_workos_id", (q) =>
        q.eq("workosUserId", identity.subject),
      )
      .unique();
  },
});

export const listAll = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireAuth(ctx);
    const users = await ctx.db
      .query("users")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", user.workspaceId))
      .take(200);
    return users.map((u) => ({
        _id: u._id,
        name: u.name,
        email: u.email,
        avatarUrl: u.avatarUrl,
        role: u.role,
        status: u.status,
      }));
  },
});

export const getByWorkosId = query({
  args: { workosUserId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_workos_id", (q) =>
        q.eq("workosUserId", args.workosUserId),
      )
      .unique();
  },
});

export const updateProfile = mutation({
  args: {
    name: v.optional(v.string()),
    notificationPrefs: v.optional(
      v.object({
        inboxNotifications: v.boolean(),
        proactiveAlerts: v.boolean(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_workos_id", (q) =>
        q.eq("workosUserId", identity.subject),
      )
      .unique();

    if (!user) throw new Error("User not found");

    const updates: Record<string, unknown> = { lastSeenAt: Date.now() };
    if (args.name !== undefined) updates.name = args.name;
    if (args.notificationPrefs !== undefined) updates.notificationPrefs = args.notificationPrefs;

    await ctx.db.patch(user._id, updates);
    return user._id;
  },
});

async function requireAdminAndTarget(ctx: MutationCtx, targetUserId: Id<"users">) {
  const currentUser = await requireAuth(ctx);
  if (currentUser.role !== "admin") {
    throw new Error("Only admins can perform this action");
  }
  const target = await ctx.db.get(targetUserId);
  if (!target) throw new Error("User not found");
  if (target.workspaceId !== currentUser.workspaceId) {
    throw new Error("User not in your workspace");
  }
  return { currentUser, target };
}

export const updateRole = mutation({
  args: {
    userId: v.id("users"),
    role: v.union(v.literal("admin"), v.literal("member")),
  },
  handler: async (ctx, args) => {
    await requireAdminAndTarget(ctx, args.userId);
    await ctx.db.patch(args.userId, { role: args.role });
  },
});

export const deactivate = mutation({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const { currentUser } = await requireAdminAndTarget(ctx, args.userId);
    if (args.userId === currentUser._id) {
      throw new Error("Cannot deactivate yourself");
    }
    await ctx.db.patch(args.userId, { status: "deactivated" });
  },
});

export const createOrUpdate = mutation({
  args: {
    workosUserId: v.string(),
    email: v.string(),
    name: v.string(),
    avatarUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_workos_id", (q) =>
        q.eq("workosUserId", args.workosUserId),
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        email: args.email,
        name: args.name,
        avatarUrl: args.avatarUrl,
        lastSeenAt: Date.now(),
      });
      return existing._id;
    }

    return await provisionNewUser(ctx, args);
  },
});
