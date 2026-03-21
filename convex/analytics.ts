import { query, QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { requireAuth } from "./auth";

const PERIOD_MS: Record<string, number> = {
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
  "90d": 90 * 24 * 60 * 60 * 1000,
};

const periodValidator = v.union(
  v.literal("7d"),
  v.literal("30d"),
  v.literal("90d"),
);

async function getWorkspaceChannels(ctx: QueryCtx, workspaceId: Id<"workspaces">) {
  return ctx.db
    .query("channels")
    .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
    .take(500);
}

async function getRecentMessages(ctx: QueryCtx, channelId: Id<"channels">) {
  return ctx.db
    .query("messages")
    .withIndex("by_channel", (q) => q.eq("channelId", channelId))
    .order("desc")
    .take(2000);
}

/**
 * Combined KPI + activity breakdown query. Returns both KPI metrics and
 * per-category counts in a single pass over the data.
 */
export const getKPIs = query({
  args: { period: periodValidator, workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx, args.workspaceId);

    const now = Date.now();
    const periodMs = PERIOD_MS[args.period];
    const cutoff = now - periodMs;
    const prevCutoff = cutoff - periodMs;

    const channels = await getWorkspaceChannels(ctx, args.workspaceId);

    let botMessages = 0;
    let prevBotMessages = 0;
    let userMessages = 0;

    for (const channel of channels) {
      const msgs = await getRecentMessages(ctx, channel._id);
      for (const msg of msgs) {
        if (msg._creationTime < prevCutoff) break;
        if (msg._creationTime >= cutoff) {
          if (msg.type === "bot") botMessages++;
          else if (msg.type === "user") userMessages++;
        } else {
          if (msg.type === "bot") prevBotMessages++;
        }
      }
    }

    const summaries = await ctx.db
      .query("inboxSummaries")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(1000);
    const summaryCount = summaries.filter(
      (s) => s._creationTime >= cutoff,
    ).length;

    const alerts = await ctx.db
      .query("proactiveAlerts")
      .withIndex("by_user_status", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(1000);
    const alertCount = alerts.filter((a) => a.createdAt >= cutoff).length;

    const queryDelta =
      prevBotMessages > 0
        ? Math.round(
            ((botMessages - prevBotMessages) / prevBotMessages) * 100,
          )
        : botMessages > 0
          ? 100
          : 0;

    const hoursSaved = Math.round(((botMessages * 2) / 60) * 10) / 10;
    const prevHoursSaved = Math.round(((prevBotMessages * 2) / 60) * 10) / 10;
    const hoursDelta =
      prevHoursSaved > 0
        ? Math.round(((hoursSaved - prevHoursSaved) / prevHoursSaved) * 100)
        : hoursSaved > 0
          ? 100
          : 0;

    const totalActivity = userMessages + botMessages + summaryCount + alertCount;

    return {
      botMessages,
      totalMessages: userMessages + botMessages,
      summaryCount,
      alertCount,
      queryDelta,
      hoursSaved,
      hoursDelta,
      breakdown: [
        {
          label: "Direct Messages",
          count: userMessages,
          pct: totalActivity > 0 ? Math.round((userMessages / totalActivity) * 100) : 0,
        },
        {
          label: "Agent Queries",
          count: botMessages,
          pct: totalActivity > 0 ? Math.round((botMessages / totalActivity) * 100) : 0,
        },
        {
          label: "Inbox Summaries",
          count: summaryCount,
          pct: totalActivity > 0 ? Math.round((summaryCount / totalActivity) * 100) : 0,
        },
        {
          label: "Proactive Alerts",
          count: alertCount,
          pct: totalActivity > 0 ? Math.round((alertCount / totalActivity) * 100) : 0,
        },
      ],
    };
  },
});

/**
 * Agent (bot user) leaderboard -- counts bot messages per author
 * within the user's workspace for the given period.
 */
export const getAgentLeaderboard = query({
  args: { period: periodValidator, workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx, args.workspaceId);
    const cutoff = Date.now() - PERIOD_MS[args.period];
    const channels = await getWorkspaceChannels(ctx, args.workspaceId);

    const authorCounts: Record<string, number> = {};

    for (const channel of channels) {
      const msgs = await getRecentMessages(ctx, channel._id);
      for (const msg of msgs) {
        if (msg._creationTime < cutoff) break;
        if (msg.type === "bot") {
          authorCounts[msg.authorId] = (authorCounts[msg.authorId] ?? 0) + 1;
        }
      }
    }

    const sorted = Object.entries(authorCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10);
    const maxCount = sorted[0]?.[1] ?? 1;

    const leaderboard = await Promise.all(
      sorted.map(async ([authorId, count]) => {
        const author = await ctx.db.get(authorId as Id<"users">);
        return {
          name: author?.name ?? "Unknown Agent",
          queries: count,
          pct: Math.round((count / maxCount) * 100),
        };
      }),
    );

    return leaderboard;
  },
});
