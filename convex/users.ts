import { query, mutation } from "./_generated/server";
import { MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

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
