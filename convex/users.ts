import { query, mutation, internalQuery } from "./_generated/server";
import { MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { requireAuth } from "./auth";

export async function createOrUpdateUserHandler(
  ctx: MutationCtx,
  args: {
    workosUserId: string;
    email: string;
    name: string;
    avatarUrl?: string;
  },
): Promise<Id<"users">> {
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

  // For new users, find or create default workspace
  let workspace = await ctx.db
    .query("workspaces")
    .withIndex("by_slug", (q) => q.eq("slug", "default"))
    .unique();

  if (!workspace) {
    const workspaceId = await ctx.db.insert("workspaces", {
      name: "Default Workspace",
      slug: "default",
      createdBy: "" as any, // Will be updated
      integrations: {},
    });
    workspace = await ctx.db.get(workspaceId);
  }

  const userId = await ctx.db.insert("users", {
    workosUserId: args.workosUserId,
    email: args.email,
    name: args.name,
    avatarUrl: args.avatarUrl,
    role: "member",
    workspaceId: workspace!._id,
    status: "active",
    lastSeenAt: Date.now(),
  });

  // Auto-join default channels
  const defaultChannels = await ctx.db
    .query("channels")
    .withIndex("by_workspace", (q) => q.eq("workspaceId", workspace!._id))
    .collect();

  for (const channel of defaultChannels) {
    if (channel.isDefault) {
      await ctx.db.insert("channelMembers", {
        channelId: channel._id,
        userId,
      });
    }
  }

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

export const listByWorkspace = internalQuery({
  args: {
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();
  },
});

export const listAll = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireAuth(ctx);
    return await ctx.db
      .query("users")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", user.workspaceId))
      .collect();
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
    return await createOrUpdateUserHandler(ctx, args);
  },
});
