import { query, mutation, internalQuery, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { requireAuth, requireUser } from "./auth";

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
  const slug = args.email.split("@")[0].replace(/[^a-z0-9]/g, "-") + "-" + Date.now();

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
    status: "active",
    lastSeenAt: Date.now(),
    onboardingStatus: "pending",
  });

  await ctx.db.patch(workspaceId, { createdBy: userId });

  await ctx.db.insert("workspaceMembers", {
    userId,
    workspaceId,
    role: "admin",
    joinedAt: Date.now(),
  });

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
    status: "active",
    lastSeenAt: Date.now(),
    onboardingStatus: "pending",
  });

  await ctx.db.insert("workspaceMembers", {
    userId,
    workspaceId: invitation.workspaceId,
    role: invitation.role,
    joinedAt: Date.now(),
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
  args: {
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx, args.workspaceId);

    const wsMembers = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .take(200);

    const users = await Promise.all(
      wsMembers.map(async (m) => {
        const u = await ctx.db.get(m.userId);
        if (!u) return null;
        return {
          _id: u._id,
          name: u.name,
          email: u.email,
          avatarUrl: u.avatarUrl,
          role: m.role,
          status: u.status,
        };
      }),
    );

    return users.filter((u): u is NonNullable<typeof u> => u !== null);
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
    const user = await requireUser(ctx);

    const updates: Record<string, unknown> = { lastSeenAt: Date.now() };
    if (args.name !== undefined) updates.name = args.name;
    if (args.notificationPrefs !== undefined) updates.notificationPrefs = args.notificationPrefs;

    await ctx.db.patch(user._id, updates);
    return user._id;
  },
});

async function requireAdminAndTarget(
  ctx: MutationCtx,
  targetUserId: Id<"users">,
  workspaceId: Id<"workspaces">,
) {
  const currentUser = await requireAuth(ctx, workspaceId);
  if (currentUser.role !== "admin") {
    throw new Error("Only admins can perform this action");
  }
  const target = await ctx.db.get(targetUserId);
  if (!target) throw new Error("User not found");

  const targetMembership = await ctx.db
    .query("workspaceMembers")
    .withIndex("by_user_workspace", (q) =>
      q.eq("userId", targetUserId).eq("workspaceId", workspaceId),
    )
    .unique();
  if (!targetMembership) {
    throw new Error("User not in your workspace");
  }

  return { currentUser, target, targetMembership };
}

export const updateRole = mutation({
  args: {
    userId: v.id("users"),
    role: v.union(v.literal("admin"), v.literal("member")),
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    const { targetMembership } = await requireAdminAndTarget(ctx, args.userId, args.workspaceId);
    await ctx.db.patch(targetMembership._id, { role: args.role });
  },
});

export const deactivate = mutation({
  args: {
    userId: v.id("users"),
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    const { currentUser, targetMembership } = await requireAdminAndTarget(ctx, args.userId, args.workspaceId);
    if (args.userId === currentUser._id) {
      throw new Error("Cannot deactivate yourself");
    }
    // Remove from workspace
    await ctx.db.delete(targetMembership._id);
    // Check if user has any other workspace memberships
    const otherMemberships = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();
    if (!otherMemberships) {
      await ctx.db.patch(args.userId, { status: "deactivated" });
    }
  },
});

export const listByWorkspace = internalQuery({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const wsMembers = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();

    const users = await Promise.all(
      wsMembers.map(async (m) => {
        const u = await ctx.db.get(m.userId);
        return u;
      }),
    );

    return users.filter((u): u is NonNullable<typeof u> => u !== null);
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
