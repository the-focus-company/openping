import { query, mutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { requireAuth, requireUser } from "./auth";

export const listMyWorkspaces = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const user = await ctx.db
      .query("users")
      .withIndex("by_workos_id", (q) => q.eq("workosUserId", identity.subject))
      .unique();
    if (!user) return null;

    const memberships = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    const workspaces = await Promise.all(
      memberships.map(async (m) => {
        const workspace = await ctx.db.get(m.workspaceId);
        if (!workspace) return null;
        return {
          workspaceId: workspace._id,
          slug: workspace.slug,
          name: workspace.name,
          role: m.role,
        };
      }),
    );

    return workspaces.filter((w): w is NonNullable<typeof w> => w !== null);
  },
});

export const listMembers = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    await requireAuth(ctx, args.workspaceId);

    const memberships = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();

    const members = await Promise.all(
      memberships.map(async (m) => {
        const user = await ctx.db.get(m.userId);
        if (!user) return null;
        return {
          userId: user._id,
          name: user.name,
          email: user.email,
          avatarUrl: user.avatarUrl,
          role: m.role,
          status: user.status,
          joinedAt: m.joinedAt,
          lastSeenAt: user.lastSeenAt,
          presenceStatus: user.presenceStatus,
        };
      }),
    );

    return members.filter((m): m is NonNullable<typeof m> => m !== null);
  },
});

export const updateRole = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    userId: v.id("users"),
    role: v.union(v.literal("admin"), v.literal("member")),
  },
  handler: async (ctx, args) => {
    const currentUser = await requireAuth(ctx, args.workspaceId);
    if (currentUser.role !== "admin") {
      throw new Error("Only admins can change roles");
    }

    const targetMembership = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_user_workspace", (q) =>
        q.eq("userId", args.userId).eq("workspaceId", args.workspaceId),
      )
      .unique();
    if (!targetMembership) throw new Error("User is not a member of this workspace");

    await ctx.db.patch(targetMembership._id, { role: args.role });
  },
});

export const removeMember = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const currentUser = await requireAuth(ctx, args.workspaceId);
    if (currentUser.role !== "admin") {
      throw new Error("Only admins can remove members");
    }
    if (args.userId === currentUser._id) {
      throw new Error("Cannot remove yourself");
    }

    const targetMembership = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_user_workspace", (q) =>
        q.eq("userId", args.userId).eq("workspaceId", args.workspaceId),
      )
      .unique();
    if (!targetMembership) throw new Error("User is not a member of this workspace");

    await ctx.db.delete(targetMembership._id);
  },
});

export const inviteByEmail = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    email: v.string(),
    role: v.union(v.literal("admin"), v.literal("member")),
  },
  handler: async (ctx, args) => {
    const currentUser = await requireAuth(ctx, args.workspaceId);
    if (currentUser.role !== "admin") {
      throw new Error("Only admins can invite members");
    }

    // Check if already a member
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .unique();

    if (existingUser) {
      const existingMembership = await ctx.db
        .query("workspaceMembers")
        .withIndex("by_user_workspace", (q) =>
          q.eq("userId", existingUser._id).eq("workspaceId", args.workspaceId),
        )
        .unique();
      if (existingMembership) throw new Error("User is already a member");
    }

    const token = crypto.randomUUID();
    const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days

    await ctx.db.insert("invitations", {
      workspaceId: args.workspaceId,
      email: args.email,
      role: args.role,
      invitedBy: currentUser._id,
      token,
      status: "pending",
      expiresAt,
    });

    return { token };
  },
});

export const acceptInvite = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const invite = await ctx.db
      .query("invitations")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .unique();

    if (!invite) throw new Error("Invite not found");
    if (invite.status !== "pending") throw new Error("Invite already used");
    if (invite.expiresAt < Date.now()) {
      await ctx.db.patch(invite._id, { status: "expired" });
      throw new Error("Invite has expired");
    }

    // Check if already a member
    const existingMembership = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_user_workspace", (q) =>
        q.eq("userId", user._id).eq("workspaceId", invite.workspaceId),
      )
      .unique();

    if (!existingMembership) {
      await ctx.db.insert("workspaceMembers", {
        userId: user._id,
        workspaceId: invite.workspaceId,
        role: invite.role,
        joinedAt: Date.now(),
      });
    }

    await ctx.db.patch(invite._id, { status: "accepted" });

    const workspace = await ctx.db.get(invite.workspaceId);
    return { workspaceId: invite.workspaceId, slug: workspace?.slug ?? "" };
  },
});

export const listInvites = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    await requireAuth(ctx, args.workspaceId);

    const invites = await ctx.db
      .query("invitations")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();

    return invites.filter((i) => i.status === "pending" && i.expiresAt > Date.now());
  },
});

export const listByWorkspace = internalQuery({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const memberships = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();

    const members = await Promise.all(
      memberships.map(async (m) => {
        const user = await ctx.db.get(m.userId);
        return user ? { ...user, role: m.role } : null;
      }),
    );

    return members.filter((m): m is NonNullable<typeof m> => m !== null);
  },
});
