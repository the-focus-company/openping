import { query, mutation, internalQuery, MutationCtx } from "./_generated/server";
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
) {
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
    return { userId: existing._id, isNew: false as const };
  }

  const pendingInvitation = await ctx.db
    .query("invitations")
    .withIndex("by_email", (q) => q.eq("email", args.email))
    .collect();
  const invitation = pendingInvitation.find(
    (inv) => inv.status === "pending" && inv.expiresAt > Date.now(),
  );

  if (invitation) {
    const result = await provisionInvitedUser(ctx, args, invitation);
    return {
      userId: result.userId,
      isNew: true as const,
      workspaceId: result.workspaceId,
      workspaceName: result.workspaceName,
    };
  }

  const result = await provisionNewUser(ctx, args);
  return {
    userId: result.userId,
    isNew: true as const,
    workspaceId: result.workspaceId,
    workspaceName: result.workspaceName,
  };
}

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
    onboardingStatus: "pending",
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

  return { userId, workspaceId, workspaceName: `${args.name}'s Workspace` };
}

async function provisionInvitedUser(
  ctx: MutationCtx,
  args: {
    workosUserId: string;
    email: string;
    name: string;
    avatarUrl?: string;
  },
  invitation: {
    _id: Id<"invitations">;
    workspaceId: Id<"workspaces">;
    role: "admin" | "member";
  },
) {
  const workspace = await ctx.db.get(invitation.workspaceId);
  if (!workspace) throw new Error("Invitation workspace not found");

  const userId = await ctx.db.insert("users", {
    workosUserId: args.workosUserId,
    email: args.email,
    name: args.name,
    avatarUrl: args.avatarUrl,
    role: invitation.role,
    workspaceId: invitation.workspaceId,
    status: "active",
    lastSeenAt: Date.now(),
    onboardingStatus: "pending",
  });

  await ctx.db.patch(invitation._id, { status: "accepted" });

  const generalChannel = await ctx.db
    .query("channels")
    .withIndex("by_workspace_name", (q) =>
      q.eq("workspaceId", invitation.workspaceId).eq("name", "general"),
    )
    .unique();

  if (generalChannel) {
    await ctx.db.insert("channelMembers", {
      channelId: generalChannel._id,
      userId,
    });
  }

  return { userId, workspaceId: invitation.workspaceId, workspaceName: workspace.name };
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

export const listByWorkspace = internalQuery({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();
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
