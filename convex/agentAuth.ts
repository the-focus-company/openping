import { internalQuery } from "./_generated/server";
import { v } from "convex/values";

export async function hashToken(raw: string): Promise<string> {
  const encoded = new TextEncoder().encode(raw);
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export const validateToken = internalQuery({
  args: { tokenHash: v.string() },
  handler: async (ctx, args) => {
    const token = await ctx.db
      .query("agentApiTokens")
      .withIndex("by_token_hash", (q) => q.eq("tokenHash", args.tokenHash))
      .unique();

    if (!token || token.status !== "active") return null;
    if (token.expiresAt && token.expiresAt < Date.now()) return null;

    const agent = await ctx.db.get(token.agentId);
    if (!agent || agent.status !== "active") return null;

    const agentUser = await ctx.db.get(agent.userId);
    if (!agentUser) return null;

    return { agent, agentUser, token };
  },
});
