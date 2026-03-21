import { query, mutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { requireAuth } from "./auth";

export const send = mutation({
  args: {
    email: v.string(),
    role: v.union(v.literal("admin"), v.literal("member")),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    if (user.role !== "admin") {
      throw new Error("Only admins can send invitations");
    }

    const existingUsers = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .collect();
    const existingMember = existingUsers.find(
      (u) => u.workspaceId === user.workspaceId && u.status !== "deactivated",
    );
    if (existingMember) {
      throw new Error("User is already a member of this workspace");
    }

    const existingInvitations = await ctx.db
      .query("invitations")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .collect();
    const duplicateInvitation = existingInvitations.find(
      (inv) => inv.workspaceId === user.workspaceId && inv.status === "pending",
    );
    if (duplicateInvitation) {
      throw new Error("An invitation has already been sent to this email");
    }

    const token = crypto.randomUUID();
    const sevenDays = 7 * 24 * 60 * 60 * 1000;

    const invitationId = await ctx.db.insert("invitations", {
      workspaceId: user.workspaceId,
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
  args: {},
  handler: async (ctx) => {
    const user = await requireAuth(ctx);

    const invitations = await ctx.db
      .query("invitations")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", user.workspaceId))
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

    await ctx.db.patch(invitation._id, { status: "accepted" });

    return invitation;
  },
});
