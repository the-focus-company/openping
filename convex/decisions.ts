import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAuth } from "./auth";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export const getStats = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx, args.workspaceId);

    const now = Date.now();
    const sevenDaysAgo = now - SEVEN_DAYS_MS;
    const thirtyDaysAgo = now - THIRTY_DAYS_MS;
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayStartMs = todayStart.getTime();

    const recentDecisions = await ctx.db
      .query("decisions")
      .withIndex("by_user_decided", (q) =>
        q.eq("userId", user._id).gte("decidedAt", thirtyDaysAgo),
      )
      .collect();

    let total7d = 0;
    let totalToday = 0;
    let delegatedCount = 0;
    let decisionTimeSumMs = 0;
    let decisionTimeCount = 0;
    const byType: Record<string, number> = {};
    const byAction: Record<string, number> = {};
    const byQuadrant: Record<string, number> = {};

    for (const d of recentDecisions) {
      if (d.decidedAt >= sevenDaysAgo) total7d++;
      if (d.decidedAt >= todayStartMs) totalToday++;
      if (d.action === "delegated") delegatedCount++;
      if (d.decisionTimeMs !== undefined) {
        decisionTimeSumMs += d.decisionTimeMs;
        decisionTimeCount++;
      }
      byType[d.type] = (byType[d.type] ?? 0) + 1;
      byAction[d.action] = (byAction[d.action] ?? 0) + 1;
      if (d.quadrant) {
        byQuadrant[d.quadrant] = (byQuadrant[d.quadrant] ?? 0) + 1;
      }
    }

    const pendingInbox = await ctx.db
      .query("inboxSummaries")
      .withIndex("by_user_read", (q) =>
        q.eq("userId", user._id).eq("isRead", false),
      )
      .take(100);
    const pendingCount = pendingInbox.filter((s) => !s.isArchived).length;

    return {
      total30d: recentDecisions.length,
      total7d,
      totalToday,
      avgDecisionTimeMs:
        decisionTimeCount > 0 ? decisionTimeSumMs / decisionTimeCount : 0,
      byType,
      byAction,
      delegationRate:
        recentDecisions.length > 0
          ? delegatedCount / recentDecisions.length
          : 0,
      byQuadrant,
      pendingCount,
    };
  },
});

export const list = query({
  args: {
    workspaceId: v.id("workspaces"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx, args.workspaceId);

    return ctx.db
      .query("decisions")
      .withIndex("by_user_decided", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(args.limit ?? 50);
  },
});

export const decide = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    type: v.union(
      v.literal("inbox_summary"),
      v.literal("proactive_alert"),
      v.literal("draft"),
      v.literal("integration"),
    ),
    sourceId: v.optional(v.string()),
    action: v.union(
      v.literal("approved"),
      v.literal("rejected"),
      v.literal("delegated"),
      v.literal("snoozed"),
      v.literal("archived"),
    ),
    delegatedTo: v.optional(v.id("users")),
    snoozedUntil: v.optional(v.number()),
    quadrant: v.optional(
      v.union(
        v.literal("urgent-important"),
        v.literal("important"),
        v.literal("urgent"),
        v.literal("fyi"),
      ),
    ),
    decisionTimeMs: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx, args.workspaceId);

    return ctx.db.insert("decisions", {
      userId: user._id,
      workspaceId: args.workspaceId,
      type: args.type,
      sourceId: args.sourceId,
      action: args.action,
      delegatedTo: args.delegatedTo,
      snoozedUntil: args.snoozedUntil,
      quadrant: args.quadrant,
      decidedAt: Date.now(),
      decisionTimeMs: args.decisionTimeMs,
    });
  },
});
