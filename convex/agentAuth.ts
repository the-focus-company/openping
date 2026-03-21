import { QueryCtx, MutationCtx } from "./_generated/server";
import { Doc } from "./_generated/dataModel";

/**
 * Validate an agent API token from an Authorization header.
 * Returns the agent and associated user if valid.
 */
export async function requireAgentAuth(
  ctx: QueryCtx | MutationCtx,
  tokenHash: string,
): Promise<{
  agent: Doc<"agents">;
  user: Doc<"users">;
  token: Doc<"agentApiTokens">;
}> {
  const tokenRecord = await ctx.db
    .query("agentApiTokens")
    .withIndex("by_token_hash", (q) => q.eq("tokenHash", tokenHash))
    .unique();

  if (!tokenRecord) {
    throw new Error("Invalid API token");
  }

  if (tokenRecord.status !== "active") {
    throw new Error("API token has been revoked");
  }

  if (tokenRecord.expiresAt && tokenRecord.expiresAt < Date.now()) {
    throw new Error("API token has expired");
  }

  const agent = await ctx.db.get(tokenRecord.agentId);
  if (!agent || agent.status !== "active") {
    throw new Error("Agent is not active");
  }

  const user = await ctx.db.get(agent.userId);
  if (!user) {
    throw new Error("Agent user not found");
  }

  return { agent, user, token: tokenRecord };
}

/**
 * Hash an API token for storage and lookup.
 * Uses a simple SHA-256 hash via Web Crypto API.
 */
export async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}
