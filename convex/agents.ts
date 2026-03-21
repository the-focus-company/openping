import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAuth } from "./auth";
import { hashToken } from "./agentAuth";

export const list = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    await requireAuth(ctx, args.workspaceId);

    return await ctx.db
      .query("agents")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .take(50);
  },
});

export const get = query({
  args: {
    agentId: v.id("agents"),
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx, args.workspaceId);

    const agent = await ctx.db.get(args.agentId);
    if (!agent) throw new Error("Agent not found");
    if (agent.workspaceId !== args.workspaceId) {
      throw new Error("Agent not found");
    }
    return agent;
  },
});

export const create = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    name: v.string(),
    description: v.optional(v.string()),
    color: v.optional(v.string()),
    systemPrompt: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx, args.workspaceId);
    if (user.role !== "admin") {
      throw new Error("Only admins can create agents");
    }

    // Create a synthetic user row for the agent
    const syntheticUserId = await ctx.db.insert("users", {
      workosUserId: `agent_${crypto.randomUUID()}`,
      email: `${args.name.toLowerCase().replace(/\s+/g, "-")}@agent.ping`,
      name: args.name,
      status: "active",
    });

    const agentId = await ctx.db.insert("agents", {
      workspaceId: args.workspaceId,
      name: args.name,
      description: args.description,
      status: "active",
      createdBy: user._id,
      color: args.color,
      systemPrompt: args.systemPrompt,
      userId: syntheticUserId,
    });

    return agentId;
  },
});

export const update = mutation({
  args: {
    agentId: v.id("agents"),
    workspaceId: v.id("workspaces"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    status: v.optional(
      v.union(
        v.literal("active"),
        v.literal("inactive"),
        v.literal("revoked"),
      ),
    ),
    color: v.optional(v.string()),
    systemPrompt: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx, args.workspaceId);
    if (user.role !== "admin") {
      throw new Error("Only admins can update agents");
    }

    const agent = await ctx.db.get(args.agentId);
    if (!agent) throw new Error("Agent not found");
    if (agent.workspaceId !== args.workspaceId) {
      throw new Error("Agent not found");
    }

    const { agentId: _, workspaceId: __, ...updates } = args;
    await ctx.db.patch(args.agentId, updates);
  },
});

export const remove = mutation({
  args: {
    agentId: v.id("agents"),
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx, args.workspaceId);
    if (user.role !== "admin") {
      throw new Error("Only admins can remove agents");
    }

    const agent = await ctx.db.get(args.agentId);
    if (!agent) throw new Error("Agent not found");
    if (agent.workspaceId !== args.workspaceId) {
      throw new Error("Agent not found");
    }

    await ctx.db.patch(args.agentId, { status: "revoked" });

    // Revoke all tokens for this agent
    const tokens = await ctx.db
      .query("agentApiTokens")
      .withIndex("by_agent", (q) => q.eq("agentId", args.agentId))
      .take(100);

    for (const token of tokens) {
      if (token.status === "active") {
        await ctx.db.patch(token._id, { status: "revoked" });
      }
    }
  },
});

export const generateToken = mutation({
  args: {
    agentId: v.id("agents"),
    workspaceId: v.id("workspaces"),
    label: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx, args.workspaceId);
    if (user.role !== "admin") {
      throw new Error("Only admins can generate agent tokens");
    }

    const agent = await ctx.db.get(args.agentId);
    if (!agent) throw new Error("Agent not found");
    if (agent.workspaceId !== args.workspaceId) {
      throw new Error("Agent not found");
    }

    const raw = `ping_ag_${crypto.randomUUID()}`;
    const tokenHash = await hashToken(raw);

    const tokenPrefix = raw.slice(0, 16);

    await ctx.db.insert("agentApiTokens", {
      agentId: args.agentId,
      workspaceId: args.workspaceId,
      tokenHash,
      tokenPrefix,
      label: args.label,
      status: "active",
      createdBy: user._id,
    });

    return { token: raw, prefix: tokenPrefix };
  },
});

export const revokeToken = mutation({
  args: {
    tokenId: v.id("agentApiTokens"),
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx, args.workspaceId);
    if (user.role !== "admin") {
      throw new Error("Only admins can revoke agent tokens");
    }

    const token = await ctx.db.get(args.tokenId);
    if (!token) throw new Error("Token not found");
    if (token.workspaceId !== args.workspaceId) {
      throw new Error("Token not found");
    }

    await ctx.db.patch(args.tokenId, { status: "revoked" });
  },
});

export const listTokens = query({
  args: {
    agentId: v.id("agents"),
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx, args.workspaceId);

    const agent = await ctx.db.get(args.agentId);
    if (!agent) throw new Error("Agent not found");
    if (agent.workspaceId !== args.workspaceId) {
      throw new Error("Agent not found");
    }

    const tokens = await ctx.db
      .query("agentApiTokens")
      .withIndex("by_agent", (q) => q.eq("agentId", args.agentId))
      .take(50);

    // Return prefix + metadata, never the hash
    return tokens.map((t) => ({
      _id: t._id,
      _creationTime: t._creationTime,
      tokenPrefix: t.tokenPrefix,
      label: t.label,
      status: t.status,
      createdBy: t.createdBy,
      lastUsedAt: t.lastUsedAt,
      expiresAt: t.expiresAt,
    }));
  },
});
