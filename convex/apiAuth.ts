import { v } from "convex/values";
import { internalQuery, internalMutation } from "./_generated/server";

export const getUserByTokenHash = internalQuery({
  args: { tokenHash: v.string() },
  handler: async (ctx, args) => {
    const token = await ctx.db
      .query("userApiTokens")
      .withIndex("by_token_hash", (q) => q.eq("tokenHash", args.tokenHash))
      .unique();

    if (!token || token.status !== "active") return null;
    if (token.expiresAt && token.expiresAt < Date.now()) return null;

    const user = await ctx.db.get(token.userId);
    if (!user || user.status !== "active") return null;

    return {
      user,
      workspaceId: token.workspaceId,
      tokenId: token._id,
    };
  },
});

export const touchUserToken = internalMutation({
  args: { tokenId: v.id("userApiTokens") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.tokenId, { lastUsedAt: Date.now() });
  },
});
