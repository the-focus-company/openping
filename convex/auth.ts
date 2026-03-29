import { QueryCtx, MutationCtx } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";

export async function requireDMmember(
  ctx: QueryCtx | MutationCtx,
  conversationId: Id<"directConversations">,
  userId: Id<"users">,
) {
  const membership = await ctx.db
    .query("directConversationMembers")
    .withIndex("by_conversation_user", (q) =>
      q.eq("conversationId", conversationId).eq("userId", userId),
    )
    .first();
  if (!membership) throw new Error("Not a member of this conversation");
  return membership;
}

export async function requireUser(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Not authenticated");

  const user = await ctx.db
    .query("users")
    .withIndex("by_workos_id", (q) => q.eq("workosUserId", identity.subject))
    .unique();

  if (!user) throw new Error("User not found");
  return user;
}

export async function requireAuth(
  ctx: QueryCtx | MutationCtx,
  workspaceId: Id<"workspaces">,
) {
  const user = await requireUser(ctx);

  const membership = await ctx.db
    .query("workspaceMembers")
    .withIndex("by_user_workspace", (q) =>
      q.eq("userId", user._id).eq("workspaceId", workspaceId),
    )
    .unique();
  if (!membership) throw new Error("Not a member of this workspace");

  return {
    ...user,
    workspaceId: membership.workspaceId,
    role: membership.role,
    membershipId: membership._id,
  };
}

export async function requireChannelMember(
  ctx: QueryCtx | MutationCtx,
  channelId: Id<"channels">,
  userId: Id<"users">,
): Promise<Doc<"channelMembers">> {
  const membership = await ctx.db
    .query("channelMembers")
    .withIndex("by_channel_user", (q) =>
      q.eq("channelId", channelId).eq("userId", userId),
    )
    .unique();

  if (!membership) throw new Error("Not a member of this channel");
  return membership;
}

/**
 * For read-only operations: allows access to public channels without membership.
 * For DM/group channels, enforces membership (throws if not a member).
 */
export async function requirePublicChannelOrMember(
  ctx: QueryCtx | MutationCtx,
  channelId: Id<"channels">,
  userId: Id<"users">,
): Promise<{ channel: Doc<"channels">; membership: Doc<"channelMembers"> | null }> {
  const channel = await ctx.db.get(channelId);
  if (!channel) throw new Error("Channel not found");

  const membership = await ctx.db
    .query("channelMembers")
    .withIndex("by_channel_user", (q) =>
      q.eq("channelId", channelId).eq("userId", userId),
    )
    .unique();

  if (channel.type === "dm" || channel.type === "group") {
    if (!membership) throw new Error("Not a member of this channel");
  }

  return { channel, membership };
}

/**
 * For a guest user, compute the set of user IDs visible to them
 * (members of channels they share). Returns null for non-guest users.
 */
export async function getGuestVisibleUserIds(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
  role: string,
): Promise<Set<string> | null> {
  if (role !== "guest") return null;

  const myMemberships = await ctx.db
    .query("channelMembers")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();

  const visibleIds = new Set<string>();
  visibleIds.add(userId);
  for (const m of myMemberships) {
    const channelMembers = await ctx.db
      .query("channelMembers")
      .withIndex("by_channel", (q) => q.eq("channelId", m.channelId))
      .collect();
    for (const cm of channelMembers) {
      visibleIds.add(cm.userId);
    }
  }
  return visibleIds;
}

export function isGuest(role: string): boolean {
  return role === "guest";
}

export function requireNonGuest(role: string, action: string): void {
  if (role === "guest") {
    throw new Error(`Guests cannot ${action}`);
  }
}
