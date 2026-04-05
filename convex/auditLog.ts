import { internalMutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireAuth } from "./auth";

export const log = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    actorId: v.id("users"),
    action: v.string(),
    resourceType: v.string(),
    resourceId: v.optional(v.string()),
    metadata: v.optional(v.any()),
    timestamp: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("auditLogs", args);
  },
});

export const list = query({
  args: {
    workspaceId: v.id("workspaces"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx, args.workspaceId);
    if (user.role !== "admin") throw new Error("Admin access required");

    const limit = Math.min(Math.max(args.limit ?? 50, 1), 200);
    return ctx.db
      .query("auditLogs")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .order("desc")
      .take(limit);
  },
});
