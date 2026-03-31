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

export const generateToken = internalMutation({
  args: {
    userId: v.id("users"),
    workspaceId: v.id("workspaces"),
    tokenHash: v.string(),
    tokenPrefix: v.string(),
    label: v.optional(v.string()),
  },
  handler: async (ctx, { userId, workspaceId, tokenHash, tokenPrefix, label }) => {
    const tokenId = await ctx.db.insert("userApiTokens", {
      userId,
      workspaceId,
      tokenHash,
      tokenPrefix,
      label,
      status: "active",
      createdAt: Date.now(),
    });
    return { tokenId };
  },
});

export const listTokens = internalQuery({
  args: {
    userId: v.id("users"),
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, { userId, workspaceId }) => {
    const tokens = await ctx.db
      .query("userApiTokens")
      .withIndex("by_user_workspace", (q) =>
        q.eq("userId", userId).eq("workspaceId", workspaceId),
      )
      .collect();

    return tokens
      .filter((t) => t.status === "active")
      .map((t) => ({
        _id: t._id,
        tokenPrefix: t.tokenPrefix,
        label: t.label,
        createdAt: t.createdAt,
        lastUsedAt: t.lastUsedAt,
        expiresAt: t.expiresAt,
      }));
  },
});

export const revokeToken = internalMutation({
  args: {
    tokenId: v.id("userApiTokens"),
    userId: v.id("users"),
  },
  handler: async (ctx, { tokenId, userId }) => {
    const token = await ctx.db.get(tokenId);
    if (!token || token.userId !== userId) {
      return { success: false, error: "Token not found or not owned by user" };
    }
    if (token.status === "revoked") {
      return { success: false, error: "Token already revoked" };
    }
    await ctx.db.patch(tokenId, { status: "revoked" });
    return { success: true };
  },
});
