import { query } from "./_generated/server";
import { v } from "convex/values";
import { requireAuth } from "./auth";

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
