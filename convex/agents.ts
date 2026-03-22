import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAuth, requireUser } from "./auth";

export const list = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    await requireAuth(ctx, args.workspaceId);
    const agents = await ctx.db
      .query("agents")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .take(50);

    // Enrich with agent user info
    const enriched = await Promise.all(
      agents.map(async (agent) => {
        let agentUser = null;
        if (agent.agentUserId) {
          agentUser = await ctx.db.get(agent.agentUserId);
        }
        return {
          ...agent,
          agentUserName: agentUser?.name,
          agentUserEmail: agentUser?.email,
          agentUserAvatarUrl: agentUser?.avatarUrl,
        };
      }),
    );
    return enriched;
  },
});

export const get = query({
  args: { agentId: v.id("agents") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const agent = await ctx.db.get(args.agentId);
    if (!agent) return null;

    // Check access: workspace member or private owner
    if (agent.scope === "private" && agent.userId !== user._id) return null;

    let agentUser = null;
    if (agent.agentUserId) {
      agentUser = await ctx.db.get(agent.agentUserId);
    }
    return {
      ...agent,
      agentUserName: agentUser?.name,
      agentUserEmail: agentUser?.email,
      agentUserAvatarUrl: agentUser?.avatarUrl,
    };
  },
});

export const create = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    name: v.string(),
    description: v.optional(v.string()),
    systemPrompt: v.optional(v.string()),
    color: v.optional(v.string()),
    model: v.optional(v.string()),
    scope: v.union(v.literal("workspace"), v.literal("private")),
    tools: v.optional(v.array(v.string())),
    restrictions: v.optional(v.array(v.string())),
    triggers: v.optional(v.array(v.string())),
    jobs: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx, args.workspaceId);

    // Create a user record for this agent so it can participate in channels/DMs
    const agentEmail = `${args.name.toLowerCase().replace(/[^a-z0-9]/g, "-")}@agent.ping.local`;
    const agentUserId = await ctx.db.insert("users", {
      workosUserId: `agent:${crypto.randomUUID()}`,
      email: agentEmail,
      name: args.name,
      status: "active",
      onboardingStatus: "completed",
      bio: args.description,
      title: "AI Agent",
    });

    // Add agent user as workspace member
    await ctx.db.insert("workspaceMembers", {
      userId: agentUserId,
      workspaceId: args.workspaceId,
      role: "member",
      joinedAt: Date.now(),
    });

    const agentId = await ctx.db.insert("agents", {
      workspaceId: args.workspaceId,
      userId: user._id,
      name: args.name,
      description: args.description,
      systemPrompt: args.systemPrompt,
      color: args.color,
      model: args.model ?? "gpt-5.4-nano",
      scope: args.scope,
      tools: args.tools,
      restrictions: args.restrictions,
      triggers: args.triggers,
      jobs: args.jobs,
      status: "active",
      createdBy: user._id,
      agentUserId,
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
    model: v.optional(v.string()),
    scope: v.optional(v.union(v.literal("workspace"), v.literal("private"))),
    tools: v.optional(v.array(v.string())),
    restrictions: v.optional(v.array(v.string())),
    triggers: v.optional(v.array(v.string())),
    jobs: v.optional(v.array(v.string())),
    status: v.optional(
      v.union(v.literal("active"), v.literal("inactive"), v.literal("revoked")),
    ),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx, args.workspaceId);
    const agent = await ctx.db.get(args.agentId);
    if (!agent || agent.workspaceId !== args.workspaceId)
      throw new Error("Agent not found");

    const { agentId, workspaceId, ...updates } = args;
    const filtered = Object.fromEntries(
      Object.entries(updates).filter(([, v]) => v !== undefined),
    );
    await ctx.db.patch(agentId, filtered);

    // Sync name/description to the agent's user record
    if (agent.agentUserId && (updates.name || updates.description)) {
      const userPatch: Record<string, string> = {};
      if (updates.name) userPatch.name = updates.name;
      if (updates.description) userPatch.bio = updates.description;
      await ctx.db.patch(agent.agentUserId, userPatch);
    }
  },
});

export const remove = mutation({
  args: {
    agentId: v.id("agents"),
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx, args.workspaceId);
    const agent = await ctx.db.get(args.agentId);
    if (!agent || agent.workspaceId !== args.workspaceId)
      throw new Error("Agent not found");

    // Revoke all tokens
    const tokens = await ctx.db
      .query("agentApiTokens")
      .withIndex("by_agent", (q) => q.eq("agentId", args.agentId))
      .take(100);
    for (const token of tokens) {
      await ctx.db.patch(token._id, { status: "revoked" as const });
    }

    // Deactivate the agent's user record
    if (agent.agentUserId) {
      await ctx.db.patch(agent.agentUserId, { status: "deactivated" });
    }

    await ctx.db.patch(args.agentId, { status: "revoked" });
  },
});

export const generateToken = mutation({
  args: {
    agentId: v.id("agents"),
    workspaceId: v.id("workspaces"),
    label: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx, args.workspaceId);
    const agent = await ctx.db.get(args.agentId);
    if (!agent || agent.workspaceId !== args.workspaceId)
      throw new Error("Agent not found");
    const token = crypto.randomUUID();
    const encoder = new TextEncoder();
    const data = encoder.encode(token);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const tokenHash = Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    await ctx.db.insert("agentApiTokens", {
      agentId: args.agentId,
      tokenHash,
      label: args.label,
      status: "active",
      createdAt: Date.now(),
    });
    return token;
  },
});
