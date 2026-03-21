import { query, mutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { requireAuth } from "./auth";

export const grantAccess = mutation({
  args: {
    agentId: v.id("agents"),
    channelId: v.id("channels"),
    permissions: v.union(v.literal("read"), v.literal("read_write")),
  },
  handler: async (ctx, args) => {
    const agent = await ctx.db.get(args.agentId);
    if (!agent) throw new Error("Agent not found");

    const user = await requireAuth(ctx, agent.workspaceId);
    if (user.role !== "admin")
      throw new Error("Only admins can manage agent scopes");

    const channel = await ctx.db.get(args.channelId);
    if (!channel || channel.workspaceId !== agent.workspaceId)
      throw new Error("Channel not found");

    const existing = await ctx.db
      .query("agentChannelScopes")
      .withIndex("by_agent_channel", (q) =>
        q.eq("agentId", args.agentId).eq("channelId", args.channelId),
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, { permissions: args.permissions });
      return existing._id;
    }

    return await ctx.db.insert("agentChannelScopes", {
      agentId: args.agentId,
      channelId: args.channelId,
      permissions: args.permissions,
      grantedBy: user._id,
      grantedAt: Date.now(),
    });
  },
});

export const revokeAccess = mutation({
  args: {
    agentId: v.id("agents"),
    channelId: v.id("channels"),
  },
  handler: async (ctx, args) => {
    const agent = await ctx.db.get(args.agentId);
    if (!agent) throw new Error("Agent not found");

    const user = await requireAuth(ctx, agent.workspaceId);
    if (user.role !== "admin")
      throw new Error("Only admins can manage agent scopes");

    const scope = await ctx.db
      .query("agentChannelScopes")
      .withIndex("by_agent_channel", (q) =>
        q.eq("agentId", args.agentId).eq("channelId", args.channelId),
      )
      .unique();

    if (scope) {
      await ctx.db.delete(scope._id);
    }
  },
});

export const updatePermission = mutation({
  args: {
    scopeId: v.id("agentChannelScopes"),
    permissions: v.union(v.literal("read"), v.literal("read_write")),
  },
  handler: async (ctx, args) => {
    const scope = await ctx.db.get(args.scopeId);
    if (!scope) throw new Error("Scope not found");

    const agent = await ctx.db.get(scope.agentId);
    if (!agent) throw new Error("Agent not found");

    const user = await requireAuth(ctx, agent.workspaceId);
    if (user.role !== "admin")
      throw new Error("Only admins can manage agent scopes");

    await ctx.db.patch(args.scopeId, { permissions: args.permissions });
  },
});

export const listByAgent = query({
  args: { agentId: v.id("agents") },
  handler: async (ctx, args) => {
    const agent = await ctx.db.get(args.agentId);
    if (!agent) throw new Error("Agent not found");

    await requireAuth(ctx, agent.workspaceId);

    const scopes = await ctx.db
      .query("agentChannelScopes")
      .withIndex("by_agent", (q) => q.eq("agentId", args.agentId))
      .take(100);

    const result = [];
    for (const scope of scopes) {
      const channel = await ctx.db.get(scope.channelId);
      if (channel) {
        result.push({
          _id: scope._id,
          channelId: scope.channelId,
          channelName: channel.name,
          permissions: scope.permissions,
          grantedAt: scope.grantedAt,
        });
      }
    }
    return result;
  },
});

export const listByChannel = query({
  args: { channelId: v.id("channels") },
  handler: async (ctx, args) => {
    const channel = await ctx.db.get(args.channelId);
    if (!channel) throw new Error("Channel not found");

    await requireAuth(ctx, channel.workspaceId);

    const scopes = await ctx.db
      .query("agentChannelScopes")
      .withIndex("by_channel", (q) => q.eq("channelId", args.channelId))
      .take(50);

    const result = [];
    for (const scope of scopes) {
      const agent = await ctx.db.get(scope.agentId);
      if (agent) {
        result.push({
          _id: scope._id,
          agentId: scope.agentId,
          agentName: agent.name,
          permissions: scope.permissions,
        });
      }
    }
    return result;
  },
});

export const checkAccess = internalQuery({
  args: {
    agentId: v.id("agents"),
    channelId: v.id("channels"),
    requiredPermission: v.union(v.literal("read"), v.literal("read_write")),
  },
  handler: async (ctx, args) => {
    const scope = await ctx.db
      .query("agentChannelScopes")
      .withIndex("by_agent_channel", (q) =>
        q.eq("agentId", args.agentId).eq("channelId", args.channelId),
      )
      .unique();

    if (!scope) return false;
    // read or read_write both satisfy a "read" requirement
    if (args.requiredPermission === "read") return true;
    return scope.permissions === "read_write";
  },
});
