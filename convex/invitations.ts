import { query, mutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { requireAuth, requireUser } from "./auth";

export const send = mutation({
  args: {
    email: v.string(),
    role: v.union(v.literal("admin"), v.literal("member")),
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx, args.workspaceId);
    if (user.role !== "admin") {
      throw new Error("Only admins can send invitations");
    }

    const existingUsers = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .collect();
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
      .collect();
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

    return invitationId;
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
      .collect();

    return invitations.filter((inv) => inv.status === "pending");
  },
});

export const findPendingByEmail = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const invitations = await ctx.db
      .query("invitations")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .collect();

    const now = Date.now();
    return invitations.find(
      (inv) => inv.status === "pending" && inv.expiresAt > now,
    ) ?? null;
  },
});

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

      // Auto-join #general channel
      const generalChannel = await ctx.db
        .query("channels")
        .withIndex("by_workspace_name", (q) =>
          q.eq("workspaceId", invitation.workspaceId).eq("name", "general"),
        )
        .unique();

      if (generalChannel) {
        await ctx.db.insert("channelMembers", {
          channelId: generalChannel._id,
          userId: user._id,
        });
      }
    }

    await ctx.db.patch(invitation._id, { status: "accepted" });

    const workspace = await ctx.db.get(invitation.workspaceId);
    return { workspaceId: invitation.workspaceId, slug: workspace?.slug ?? "" };
  },
});
