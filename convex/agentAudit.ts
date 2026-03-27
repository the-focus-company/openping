import { query, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAuth } from "./auth";

export const log = internalMutation({
  args: {
    agentId: v.id("agents"),
    workspaceId: v.id("workspaces"),
    action: v.string(),
    resourceType: v.optional(v.string()),
    resourceId: v.optional(v.string()),
    metadata: v.optional(v.record(v.string(), v.any())),
    tokenPrefix: v.string(),
    durationMs: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("agentAuditLogs", {
      ...args,
      timestamp: Date.now(),
    });
  },
});

export const list = query({
  args: {
    workspaceId: v.id("workspaces"),
    limit: v.optional(v.number()),
    agentId: v.optional(v.id("agents")),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx, args.workspaceId);
    if (user.role !== "admin") throw new Error("Only admins can view audit logs");

    const limit = args.limit ?? 50;

    const logs = args.agentId
      ? await ctx.db
          .query("agentAuditLogs")
          .withIndex("by_agent", (q) => q.eq("agentId", args.agentId!))
          .order("desc")
          .take(limit)
      : await ctx.db
          .query("agentAuditLogs")
          .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
          .order("desc")
          .take(limit);

    // Batch-resolve agent names by deduplicating IDs
    const uniqueAgentIds = [...new Set(logs.map((l) => l.agentId))];
    const agentMap = new Map<string, string>();
    for (const id of uniqueAgentIds) {
      const agent = await ctx.db.get(id);
      agentMap.set(id as string, agent?.name ?? "Unknown");
    }

    return logs.map((log) => ({
      ...log,
      agentName: agentMap.get(log.agentId as string) ?? "Unknown",
    }));
  },
});

export const getStats = query({
  args: {
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx, args.workspaceId);
    if (user.role !== "admin") throw new Error("Only admins can view audit stats");

    const recentLogs = await ctx.db
      .query("agentAuditLogs")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .order("desc")
      .take(200);

    const totalCalls = recentLogs.length;
    const agentCounts: Record<string, number> = {};
    const actionCounts: Record<string, number> = {};

    for (const log of recentLogs) {
      const agentId = log.agentId as string;
      agentCounts[agentId] = (agentCounts[agentId] ?? 0) + 1;
      actionCounts[log.action] = (actionCounts[log.action] ?? 0) + 1;
    }

    return { totalCalls, agentCounts, actionCounts };
  },
});
