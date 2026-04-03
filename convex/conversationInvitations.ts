import { query, mutation, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { requireUser, requireConversationMember } from "./auth";
import { insertSystemMsg } from "./conversations";
import { cleanupEmptyPersonalWorkspaces } from "./invitations";

const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;

async function requireNonGuestConversationMember(
  ctx: MutationCtx,
  conversationId: Id<"conversations">,
  userId: Id<"users">,
  workspaceId: Id<"workspaces">,
) {
  await requireConversationMember(ctx, conversationId, userId);
  const membership = await ctx.db
    .query("workspaceMembers")
    .withIndex("by_user_workspace", (q) =>
      q.eq("userId", userId).eq("workspaceId", workspaceId),
    )
    .unique();
  if (!membership) throw new Error("Not a workspace member");
  if (membership.role === "guest") {
    throw new Error("Guests cannot create invite links");
  }
  return membership;
}

/**
 * Send a targeted conversation invitation to a specific email address.
 * The recipient will be added as a guest if they are not already in the workspace.
 */
export const send = mutation({
  args: {
    conversationId: v.id("conversations"),
    email: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) throw new Error("Conversation not found");

    await requireNonGuestConversationMember(
      ctx,
      args.conversationId,
      user._id,
      conversation.workspaceId,
    );

    // Check for duplicate active invite
    const existing = await ctx.db
      .query("conversationInvitations")
      .withIndex("by_conversation_and_email", (q) =>
        q.eq("conversationId", args.conversationId).eq("email", args.email),
      )
      .collect();
    const duplicate = existing.find(
      (inv) => inv.status === "active" && inv.expiresAt > Date.now(),
    );
    if (duplicate) {
      throw new Error("An invitation has already been sent to this email");
    }

    const token = crypto.randomUUID();
    await ctx.db.insert("conversationInvitations", {
      conversationId: args.conversationId,
      workspaceId: conversation.workspaceId,
      createdBy: user._id,
      email: args.email,
      token,
      expiresAt: Date.now() + SEVEN_DAYS,
      status: "active",
    });

    return { token };
  },
});

/**
 * Generate (or return existing) shareable invite link for a conversation.
 * Only one active link per conversation at a time.
 */
export const generateLink = mutation({
  args: {
    conversationId: v.id("conversations"),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) throw new Error("Conversation not found");

    await requireNonGuestConversationMember(
      ctx,
      args.conversationId,
      user._id,
      conversation.workspaceId,
    );

    // Return existing active link if one exists
    const existing = await ctx.db
      .query("conversationInvitations")
      .withIndex("by_conversation", (q) =>
        q.eq("conversationId", args.conversationId),
      )
      .collect();
    const activeLink = existing.find(
      (inv) =>
        inv.email === undefined &&
        inv.status === "active" &&
        inv.expiresAt > Date.now(),
    );
    if (activeLink) {
      return { token: activeLink.token };
    }

    const token = crypto.randomUUID();
    await ctx.db.insert("conversationInvitations", {
      conversationId: args.conversationId,
      workspaceId: conversation.workspaceId,
      createdBy: user._id,
      token,
      expiresAt: Date.now() + SEVEN_DAYS,
      status: "active",
    });

    return { token };
  },
});

/** Revoke the active shareable link for a conversation. */
export const revokeLink = mutation({
  args: {
    conversationId: v.id("conversations"),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) throw new Error("Conversation not found");

    await requireNonGuestConversationMember(
      ctx,
      args.conversationId,
      user._id,
      conversation.workspaceId,
    );

    const invitations = await ctx.db
      .query("conversationInvitations")
      .withIndex("by_conversation", (q) =>
        q.eq("conversationId", args.conversationId),
      )
      .collect();

    for (const inv of invitations) {
      if (inv.email === undefined && inv.status === "active") {
        await ctx.db.patch(inv._id, { status: "revoked" });
      }
    }
  },
});

/** Get the active shareable link for a conversation (if any). */
export const getLink = query({
  args: {
    conversationId: v.id("conversations"),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) return null;

    // Verify caller is a conversation member
    const membership = await ctx.db
      .query("conversationMembers")
      .withIndex("by_conversation_and_user", (q) =>
        q.eq("conversationId", args.conversationId).eq("userId", user._id),
      )
      .unique();
    if (!membership) return null;

    // Check workspace role — guests cannot see invite links
    const wsMembership = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_user_workspace", (q) =>
        q.eq("userId", user._id).eq("workspaceId", conversation.workspaceId),
      )
      .unique();
    if (!wsMembership || wsMembership.role === "guest") return null;

    const invitations = await ctx.db
      .query("conversationInvitations")
      .withIndex("by_conversation", (q) =>
        q.eq("conversationId", args.conversationId),
      )
      .collect();

    const activeLink = invitations.find(
      (inv) =>
        inv.email === undefined &&
        inv.status === "active" &&
        inv.expiresAt > Date.now(),
    );

    return activeLink ? { token: activeLink.token, expiresAt: activeLink.expiresAt } : null;
  },
});

/**
 * Accept a conversation invitation (targeted or shareable link).
 * If the user is not in the workspace, they are added as a guest.
 */
export const accept = mutation({
  args: {
    token: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const invitation = await ctx.db
      .query("conversationInvitations")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .unique();

    if (!invitation) throw new Error("Invitation not found");
    if (invitation.status === "revoked") throw new Error("This invitation has been revoked");
    if (invitation.expiresAt < Date.now()) throw new Error("This invitation has expired");

    // For email-targeted invites, verify email matches
    if (invitation.email && user.email !== invitation.email) {
      throw new Error("This invitation was sent to a different email address");
    }

    const conversation = await ctx.db.get(invitation.conversationId);
    if (!conversation) throw new Error("Conversation no longer exists");

    // Ensure user is a workspace member (add as guest if not)
    let existingWsMembership = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_user_workspace", (q) =>
        q.eq("userId", user._id).eq("workspaceId", invitation.workspaceId),
      )
      .unique();

    if (!existingWsMembership) {
      await ctx.db.insert("workspaceMembers", {
        userId: user._id,
        workspaceId: invitation.workspaceId,
        role: "guest",
        joinedAt: Date.now(),
      });
    }

    // Add to conversation if not already a member
    const existingConvMembership = await ctx.db
      .query("conversationMembers")
      .withIndex("by_conversation_and_user", (q) =>
        q.eq("conversationId", invitation.conversationId).eq("userId", user._id),
      )
      .unique();

    if (!existingConvMembership) {
      await ctx.db.insert("conversationMembers", {
        conversationId: invitation.conversationId,
        userId: user._id,
        isAgent: false,
      });

      await insertSystemMsg(
        ctx,
        invitation.conversationId,
        user._id,
        `${user.name} joined via invite link`,
      );
    }

    // Email-targeted invites are single-use
    if (invitation.email) {
      await ctx.db.patch(invitation._id, { status: "revoked" });
    }

    await cleanupEmptyPersonalWorkspaces(ctx, user._id, invitation.workspaceId);

    const workspace = await ctx.db.get(invitation.workspaceId);
    return {
      workspaceId: invitation.workspaceId,
      conversationId: invitation.conversationId,
      slug: workspace?.slug ?? "",
    };
  },
});
