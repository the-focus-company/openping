import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAuth } from "./auth";
import { hashToken } from "./agentAuth";

export const list = query({
  args: {
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx, args.workspaceId);

    const agents = await ctx.db
      .query("agents")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .take(50);

    const result = await Promise.all(
      agents.map(async (agent) => {
        const agentUser = await ctx.db.get(agent.userId);
        return {
          _id: agent._id,
          _creationTime: agent._creationTime,
          name: agent.name,
          description: agent.description,
          status: agent.status,
          color: agent.color,
          systemPrompt: agent.systemPrompt,
          lastActiveAt: agent.lastActiveAt,
          createdBy: agent.createdBy,
          agentUserName: agentUser?.name,
          agentUserEmail: agentUser?.email,
        };
      }),
    );

    return result;
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
    if (!agent || agent.workspaceId !== args.workspaceId) {
      return null;
    }

    return agent;
  },
});

export const create = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    name: v.string(),
    description: v.optional(v.string()),
    systemPrompt: v.optional(v.string()),
    color: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx, args.workspaceId);
    if (user.role !== "admin") {
      throw new Error("Only admins can create agents");
    }

    const agentEmail = `${args.name.toLowerCase().replace(/[^a-z0-9]/g, "-")}@agent.ping`;
    const workosUserId = `agent_${crypto.randomUUID()}`;

    const agentUserId = await ctx.db.insert("users", {
      workosUserId,
      email: agentEmail,
      name: args.name,
      status: "active",
      lastSeenAt: Date.now(),
    });

    await ctx.db.insert("workspaceMembers", {
      userId: agentUserId,
      workspaceId: args.workspaceId,
      role: "member",
      joinedAt: Date.now(),
    });

    const agentId = await ctx.db.insert("agents", {
      workspaceId: args.workspaceId,
      name: args.name,
      description: args.description,
      status: "active",
      createdBy: user._id,
      color: args.color,
      systemPrompt: args.systemPrompt,
      userId: agentUserId,
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
    systemPrompt: v.optional(v.string()),
    color: v.optional(v.string()),
    status: v.optional(
      v.union(v.literal("active"), v.literal("inactive")),
    ),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx, args.workspaceId);
    if (user.role !== "admin") {
      throw new Error("Only admins can update agents");
    }

    const agent = await ctx.db.get(args.agentId);
    if (!agent || agent.workspaceId !== args.workspaceId) {
      throw new Error("Agent not found");
    }

    const updates: Record<string, unknown> = {};
    if (args.name !== undefined) updates.name = args.name;
    if (args.description !== undefined) updates.description = args.description;
    if (args.systemPrompt !== undefined) updates.systemPrompt = args.systemPrompt;
    if (args.color !== undefined) updates.color = args.color;
    if (args.status !== undefined) updates.status = args.status;

    await ctx.db.patch(args.agentId, updates);

    if (args.name !== undefined) {
      await ctx.db.patch(agent.userId, { name: args.name });
    }
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
    if (!agent || agent.workspaceId !== args.workspaceId) {
      throw new Error("Agent not found");
    }

    await ctx.db.patch(args.agentId, { status: "revoked" });

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
      throw new Error("Only admins can generate tokens");
    }

    const agent = await ctx.db.get(args.agentId);
    if (!agent || agent.workspaceId !== args.workspaceId) {
      throw new Error("Agent not found");
    }

    const rawToken = `ping_ag_${crypto.randomUUID()}`;
    const tokenHashValue = await hashToken(rawToken);
    const tokenPrefix = rawToken.slice(0, 14) + "...";

    await ctx.db.insert("agentApiTokens", {
      agentId: args.agentId,
      workspaceId: args.workspaceId,
      tokenHash: tokenHashValue,
      tokenPrefix,
      label: args.label,
      status: "active",
      createdBy: user._id,
    });

    return rawToken;
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
      throw new Error("Only admins can revoke tokens");
    }

    const token = await ctx.db.get(args.tokenId);
    if (!token || token.workspaceId !== args.workspaceId) {
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
    if (!agent || agent.workspaceId !== args.workspaceId) {
      return [];
    }

    const tokens = await ctx.db
      .query("agentApiTokens")
      .withIndex("by_agent", (q) => q.eq("agentId", args.agentId))
      .take(50);

    return tokens.map((t) => ({
      _id: t._id,
      _creationTime: t._creationTime,
      tokenPrefix: t.tokenPrefix,
      label: t.label,
      status: t.status,
      lastUsedAt: t.lastUsedAt,
      expiresAt: t.expiresAt,
    }));
  },
});
