import { query, mutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { requireAuth, requireUser } from "./auth";
import { cleanupEmptyPersonalWorkspaces } from "./invitations";
import { roleValidator } from "./schema";

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
      .take(50);

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

    const filtered = workspaces.filter((w): w is NonNullable<typeof w> => w !== null);

    // Deduplicate: if a user has multiple memberships for the same workspace,
    // prefer the one with the highest role (admin > member)
    const byWorkspace = new Map<string, (typeof filtered)[number]>();
    for (const w of filtered) {
      const existing = byWorkspace.get(w.workspaceId);
      if (!existing || (w.role === "admin" && existing.role !== "admin")) {
        byWorkspace.set(w.workspaceId, w);
      }
    }
    return Array.from(byWorkspace.values());
  },
});

export const listMembers = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    await requireAuth(ctx, args.workspaceId);

    const memberships = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .take(1000);

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
    role: roleValidator,
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

    const oldRole = targetMembership.role;
    await ctx.db.patch(targetMembership._id, { role: args.role });

    await ctx.runMutation(internal.auditLog.log, {
      workspaceId: args.workspaceId,
      actorId: currentUser._id,
      action: "role.changed",
      resourceType: "user",
      resourceId: args.userId as string,
      metadata: { oldRole, newRole: args.role },
      timestamp: Date.now(),
    });
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

    // Cascade cleanup: revoke agent scopes granted by this user
    const agentScopes = await ctx.db
      .query("agentConversationScopes")
      .filter((q) => q.eq(q.field("grantedBy"), args.userId))
      .take(200);
    await Promise.all(agentScopes.map((s) => ctx.db.delete(s._id)));

    // Revoke personal agents owned by this user in this workspace
    const agents = await ctx.db
      .query("agents")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .take(200);
    const personalAgents = agents.filter(
      (a) => a.scope === "private" && a.userId === args.userId,
    );
    await Promise.all(
      personalAgents.map((a) => ctx.db.patch(a._id, { status: "revoked" })),
    );

    await ctx.runMutation(internal.auditLog.log, {
      workspaceId: args.workspaceId,
      actorId: currentUser._id,
      action: "member.removed",
      resourceType: "user",
      resourceId: args.userId as string,
      timestamp: Date.now(),
    });
  },
});

export const inviteByEmail = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    email: v.string(),
    role: roleValidator,
  },
  handler: async (ctx, args) => {
    const email = args.email.trim().toLowerCase();
    if (!email || email.length > 255 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error("Invalid email address");
    }

    const currentUser = await requireAuth(ctx, args.workspaceId);
    if (currentUser.role !== "admin") {
      throw new Error("Only admins can invite members");
    }

    // Check member quota
    const workspace = await ctx.db.get(args.workspaceId);
    if (workspace?.maxMembers) {
      const memberCount = await ctx.db
        .query("workspaceMembers")
        .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
        .take(workspace.maxMembers + 1);
      if (memberCount.length >= workspace.maxMembers) {
        throw new Error("Workspace member limit reached");
      }
    }

    // Check if already a member
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
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
      email,
      role: args.role,
      invitedBy: currentUser._id,
      token,
      status: "pending",
      expiresAt,
    });

    const inviteWorkspace = await ctx.db.get(args.workspaceId);
    const inviterName = currentUser.name ?? currentUser.email ?? "Someone";
    const workspaceName = inviteWorkspace?.name ?? "a workspace";

    await ctx.scheduler.runAfter(0, internal.emailTransactional.sendInvitationEmail, {
      to: email,
      inviterName,
      workspaceName,
      inviteToken: token,
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
    if (invite.status !== "pending") {
      if (invite.status === "accepted") {
        const workspace = await ctx.db.get(invite.workspaceId);
        return { workspaceId: invite.workspaceId, slug: workspace?.slug ?? "" };
      }
      throw new Error("Invite already used");
    }
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

    // Only clean up personal workspaces for non-guest roles
    if (invite.role !== "guest") {
      await cleanupEmptyPersonalWorkspaces(ctx, user._id, invite.workspaceId);
    }

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
      .take(500);

    return invites.filter((i) => i.status === "pending" && i.expiresAt > Date.now());
  },
});

export const listByWorkspace = internalQuery({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const memberships = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .take(1000);

    const members = await Promise.all(
      memberships.map(async (m) => {
        const user = await ctx.db.get(m.userId);
        return user ? { ...user, role: m.role } : null;
      }),
    );

    return members.filter((m): m is NonNullable<typeof m> => m !== null);
  },
});

/**
 * Promote the workspace creator (or sole admin-less workspace) to admin.
 * Also cleans up duplicate memberships for the same user+workspace.
 */
export const promoteToAdmin = mutation({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    // Find all memberships for this user+workspace (may have duplicates)
    const memberships = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_user_workspace", (q) =>
        q.eq("userId", user._id).eq("workspaceId", args.workspaceId),
      )
      .take(10);

    if (memberships.length === 0) throw new Error("Not a member of this workspace");

    // Allow if user is the workspace creator OR if there are no other admins
    const workspace = await ctx.db.get(args.workspaceId);
    const isCreator = workspace?.createdBy === user._id;

    if (!isCreator) {
      const allMembers = await ctx.db
        .query("workspaceMembers")
        .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
        .take(1000);
      const hasAdmin = allMembers.some(
        (m) => m.role === "admin" && m.userId !== user._id,
      );
      if (hasAdmin) throw new Error("Workspace already has an admin");
    }

    // Keep the first membership, promote it, delete duplicates
    const [keep, ...duplicates] = memberships;
    await ctx.db.patch(keep._id, { role: "admin" });
    for (const dup of duplicates) {
      await ctx.db.delete(dup._id);
    }

    return { promoted: true, duplicatesRemoved: duplicates.length };
  },
});
