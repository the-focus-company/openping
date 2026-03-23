import { v } from "convex/values";
import { internalQuery, internalMutation } from "./_generated/server";

export const getUserByTokenHash = internalQuery({
  args: { tokenHash: v.string() },
  handler: async (ctx, { tokenHash }) => {
    const token = await ctx.db
      .query("userApiTokens")
      .withIndex("by_token_hash", (q) => q.eq("tokenHash", tokenHash))
      .unique();
    if (!token || token.status !== "active") return null;
    if (token.expiresAt && token.expiresAt < Date.now()) return null;
    const user = await ctx.db.get(token.userId);
    if (!user || user.status !== "active") return null;
    return {
      user: { _id: user._id, name: user.name, email: user.email },
      workspaceId: token.workspaceId,
      tokenId: token._id,
    };
  },
});

export const touchUserToken = internalMutation({
  args: { tokenId: v.id("userApiTokens") },
  handler: async (ctx, { tokenId }) => {
    await ctx.db.patch(tokenId, { lastUsedAt: Date.now() });
  },
});
