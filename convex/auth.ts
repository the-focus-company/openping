import { QueryCtx, MutationCtx } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";

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
