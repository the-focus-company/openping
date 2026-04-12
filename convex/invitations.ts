import { query, mutation, internalQuery, internalMutation, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { requireAuth, requireUser } from "./auth";
import { roleValidator } from "./schema";
import { internal } from "./_generated/api";

export const send = mutation({
  args: {
    email: v.string(),
    role: roleValidator,
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    // Validate email format
    if (args.email.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(args.email)) {
      throw new Error("Invalid email address");
    }

    const user = await requireAuth(ctx, args.workspaceId);
    if (user.role !== "admin") {
      throw new Error("Only admins can send invitations");
    }

    const existingUsers = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .take(10);
    const existingMember = await Promise.all(
      existingUsers.map(async (u) => {
        if (u.status === "deactivated") return null;
        const membership = await ctx.db
          .query("workspaceMembers")
          .withIndex("by_user_workspace", (q) =>
            q.eq("userId", u._id).eq("workspaceId", args.workspaceId),
          )
          .unique();
        return membership ? u : null;
      }),
    );
    if (existingMember.some((m) => m !== null)) {
      throw new Error("User is already a member of this workspace");
    }

    const existingInvitations = await ctx.db
      .query("invitations")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .take(100);
    const duplicateInvitation = existingInvitations.find(
      (inv) => inv.workspaceId === args.workspaceId && inv.status === "pending",
    );
    if (duplicateInvitation) {
      throw new Error("An invitation has already been sent to this email");
    }

    const token = crypto.randomUUID();
    const sevenDays = 7 * 24 * 60 * 60 * 1000;

    const invitationId = await ctx.db.insert("invitations", {
      workspaceId: args.workspaceId,
      email: args.email,
      invitedBy: user._id,
      role: args.role,
      status: "pending",
      token,
      expiresAt: Date.now() + sevenDays,
    });

    const workspace = await ctx.db.get(args.workspaceId);
    const inviterName = user.name ?? user.email ?? "Someone";
    const workspaceName = workspace?.name ?? "a workspace";

    await ctx.scheduler.runAfter(0, internal.emailTransactional.sendInvitationEmail, {
      to: args.email,
      inviterName,
      workspaceName,
      inviteToken: token,
    });

    return invitationId;
  },
});

export const resend = mutation({
  args: {
    invitationId: v.id("invitations"),
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx, args.workspaceId);
    if (user.role !== "admin") {
      throw new Error("Only admins can resend invitations");
    }

    const invitation = await ctx.db.get(args.invitationId);
    if (!invitation || invitation.workspaceId !== args.workspaceId) {
      throw new Error("Invitation not found");
    }
    if (invitation.status !== "pending") {
      throw new Error("Invitation is no longer pending");
    }

    // Extend expiry by 7 days from now
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    await ctx.db.patch(args.invitationId, { expiresAt: Date.now() + sevenDays });

    const workspace = await ctx.db.get(args.workspaceId);
    const inviterName = user.name ?? user.email ?? "Someone";
    const workspaceName = workspace?.name ?? "a workspace";

    await ctx.scheduler.runAfter(0, internal.emailTransactional.sendInvitationEmail, {
      to: invitation.email,
      inviterName,
      workspaceName,
      inviteToken: invitation.token,
    });
  },
});

export const list = query({
  args: {
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx, args.workspaceId);

    const invitations = await ctx.db
      .query("invitations")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .take(500);

    return invitations.filter((inv) => inv.status === "pending");
  },
});

export const findPendingByEmail = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const invitations = await ctx.db
      .query("invitations")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .take(100);

    const now = Date.now();
    return invitations.find(
      (inv) => inv.status === "pending" && inv.expiresAt > now,
    ) ?? null;
  },
});

/**
 * Remove empty auto-created personal workspaces for a user, keeping the
 * workspace they were just invited to. Only deletes workspaces where the user
 * is the sole member, the creator, and no messages have been sent.
 */
export async function cleanupEmptyPersonalWorkspaces(
  ctx: MutationCtx,
  userId: Id<"users">,
  keepWorkspaceId: Id<"workspaces">,
) {
  const allMemberships = await ctx.db
    .query("workspaceMembers")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();

  for (const membership of allMemberships) {
    if (membership.workspaceId === keepWorkspaceId) continue;

    const ws = await ctx.db.get(membership.workspaceId);
    if (!ws || ws.createdBy !== userId) continue;

    const members = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", ws._id))
      .collect();
    if (members.length > 1) continue;

    const conversations = await ctx.db
      .query("conversations")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", ws._id))
      .collect();

    let hasMessages = false;
    for (const conv of conversations) {
      const msg = await ctx.db
        .query("messages")
        .withIndex("by_conversation", (q) => q.eq("conversationId", conv._id))
        .first();
      if (msg) {
        hasMessages = true;
        break;
      }
    }
    if (hasMessages) continue;

    for (const conv of conversations) {
      const cms = await ctx.db
        .query("conversationMembers")
        .withIndex("by_conversation", (q) => q.eq("conversationId", conv._id))
        .collect();
      for (const cm of cms) await ctx.db.delete(cm._id);
      await ctx.db.delete(conv._id);
    }
    await ctx.db.delete(membership._id);
    await ctx.db.delete(ws._id);
  }
}

export const accept = mutation({
  args: {
    token: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const invitation = await ctx.db
      .query("invitations")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .unique();

    if (!invitation) {
      throw new Error("Invitation not found");
    }

    if (invitation.status !== "pending") {
      if (invitation.status === "accepted") {
        const workspace = await ctx.db.get(invitation.workspaceId);
        return { workspaceId: invitation.workspaceId, slug: workspace?.slug ?? "" };
      }
      throw new Error("Invitation is no longer valid");
    }

    if (invitation.expiresAt < Date.now()) {
      await ctx.db.patch(invitation._id, { status: "expired" });
      throw new Error("Invitation has expired");
    }

    // Add user to workspace if not already a member
    const existingMembership = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_user_workspace", (q) =>
        q.eq("userId", user._id).eq("workspaceId", invitation.workspaceId),
      )
      .unique();

    if (!existingMembership) {
      await ctx.db.insert("workspaceMembers", {
        userId: user._id,
        workspaceId: invitation.workspaceId,
        role: invitation.role,
        joinedAt: Date.now(),
      });

      // Auto-join #general conversation (guests must be explicitly added)
      if (invitation.role !== "guest") {
        const generalConversation = await ctx.db
          .query("conversations")
          .withIndex("by_workspace_and_name", (q) =>
            q.eq("workspaceId", invitation.workspaceId).eq("name", "general"),
          )
          .unique();

        if (generalConversation) {
          await ctx.db.insert("conversationMembers", {
            conversationId: generalConversation._id,
            userId: user._id,
          });
        }
      }
    }

    await ctx.db.patch(invitation._id, { status: "accepted" });

    await cleanupEmptyPersonalWorkspaces(ctx, user._id, invitation.workspaceId);

    const workspace = await ctx.db.get(invitation.workspaceId);
    return { workspaceId: invitation.workspaceId, slug: workspace?.slug ?? "" };
  },
});

export const cleanupExpired = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const expiredInvitations = await ctx.db
      .query("invitations")
      .filter((q) =>
        q.and(
          q.eq(q.field("status"), "pending"),
          q.lt(q.field("expiresAt"), now),
        ),
      )
      .take(500);
    await Promise.all(expiredInvitations.map((i) => ctx.db.delete(i._id)));

    const expiredConvInvitations = await ctx.db
      .query("conversationInvitations")
      .filter((q) => q.lt(q.field("expiresAt"), now))
      .take(500);
    await Promise.all(expiredConvInvitations.map((i) => ctx.db.delete(i._id)));
  },
});
