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

async function getWorkspaceConversations(ctx: QueryCtx, workspaceId: Id<"workspaces">) {
  return ctx.db
    .query("conversations")
    .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
    .take(100);
}

async function getRecentMessages(ctx: QueryCtx, conversationId: Id<"conversations">) {
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  return ctx.db
    .query("messages")
    .withIndex("by_conversation", (q) => q.eq("conversationId", conversationId))
    .order("desc")
    .filter((q) => q.gte(q.field("_creationTime"), thirtyDaysAgo))
    .take(200);
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

    const conversations = await getWorkspaceConversations(ctx, args.workspaceId);

    let botMessages = 0;
    let prevBotMessages = 0;
    let userMessages = 0;

    for (const conversation of conversations) {
      const msgs = await getRecentMessages(ctx, conversation._id);
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

    const inboxItems = await ctx.db
      .query("inboxItems")
      .withIndex("by_user_status", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(1000);
    const summaryCount = inboxItems.filter(
      (s) => s.type === "channel_summary" && s._creationTime >= cutoff,
    ).length;

    const alertCount = inboxItems.filter(
      (a) => a.type !== "channel_summary" && a.type !== "email_summary" && a.createdAt >= cutoff,
    ).length;

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
    const conversations = await getWorkspaceConversations(ctx, args.workspaceId);

    const authorCounts: Record<string, number> = {};

    for (const conversation of conversations) {
      const msgs = await getRecentMessages(ctx, conversation._id);
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

// ---------------------------------------------------------------------------
// Decision-centric analytics
// ---------------------------------------------------------------------------

const CATEGORY_LABELS: Record<string, string> = {
  do: "Do",
  decide: "Decide",
  delegate: "Delegate",
  skip: "Skip",
};

const DECISION_TYPE_LABELS: Record<string, string> = {
  pr_review: "PR Review",
  ticket_triage: "Ticket Triage",
  question_answer: "Q&A",
  blocked_unblock: "Unblock",
  fact_verify: "Fact Check",
  cross_team_ack: "Cross-Team",
  channel_summary: "Summary",
};

const ITEM_TYPE_LABELS: Record<string, string> = {
  pr_review: "PR Review",
  ticket_triage: "Ticket Triage",
  question_answer: "Q&A",
  blocked_unblock: "Unblock",
  fact_verify: "Fact Check",
  cross_team_ack: "Cross-Team",
  channel_summary: "Summary",
  email_summary: "Email Summary",
};

/**
 * Personal decision-centric analytics for the authenticated user.
 */
export const getUserAnalytics = query({
  args: { period: periodValidator, workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx, args.workspaceId);
    const now = Date.now();
    const periodMs = PERIOD_MS[args.period];
    const cutoff = now - periodMs;
    const prevCutoff = cutoff - periodMs;

    // --- Inbox Items ---
    const allItems = await ctx.db
      .query("inboxItems")
      .withIndex("by_user_status", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(2000);

    const itemsInPeriod = allItems.filter((d) => d.createdAt >= cutoff);
    const resolved = itemsInPeriod.filter((d) => d.status === "archived" && d.outcome);
    const pending = allItems.filter((d) => d.status === "pending");

    let totalDecisionMs = 0;
    let decidedCount = 0;
    for (const d of resolved) {
      if (d.outcome?.decidedAt) {
        totalDecisionMs += d.outcome.decidedAt - d.createdAt;
        decidedCount++;
      }
    }
    const avgDecisionTimeMinutes =
      decidedCount > 0 ? Math.round(totalDecisionMs / decidedCount / 60000) : 0;

    const categoryCounts: Record<string, number> = {};
    for (const d of itemsInPeriod) {
      categoryCounts[d.category] = (categoryCounts[d.category] ?? 0) + 1;
    }
    const decisionsByQuadrant = Object.entries(categoryCounts).map(
      ([category, count]) => ({
        quadrant: category,
        label: CATEGORY_LABELS[category] ?? category,
        count,
      }),
    );

    const typeCounts: Record<string, number> = {};
    for (const d of itemsInPeriod) {
      typeCounts[d.type] = (typeCounts[d.type] ?? 0) + 1;
    }
    const decisionsByType = Object.entries(typeCounts)
      .map(([type, count]) => ({
        type,
        label: ITEM_TYPE_LABELS[type] ?? type,
        count,
      }))
      .sort((a, b) => b.count - a.count);

    const summariesReceived = itemsInPeriod.filter(
      (s) => s.type === "channel_summary" || s.type === "email_summary",
    ).length;

    const alertItems = itemsInPeriod.filter(
      (a) => a.type !== "channel_summary" && a.type !== "email_summary",
    );
    const alertsSurfaced = alertItems.length;
    const alertsActedOn = alertItems.filter(
      (a) => a.status === "archived" && a.outcome,
    ).length;

    const alertTypeCounts: Record<string, number> = {};
    for (const a of alertItems) {
      alertTypeCounts[a.type] = (alertTypeCounts[a.type] ?? 0) + 1;
    }
    const alertsByType = Object.entries(alertTypeCounts)
      .map(([type, count]) => ({
        type,
        label: ITEM_TYPE_LABELS[type] ?? type,
        count,
      }))
      .sort((a, b) => b.count - a.count);

    // --- Cognitive load reduction ---
    const conversations = await getWorkspaceConversations(ctx, args.workspaceId);
    let botAssists = 0;
    let prevBotAssists = 0;
    for (const conversation of conversations) {
      const msgs = await getRecentMessages(ctx, conversation._id);
      for (const msg of msgs) {
        if (msg._creationTime < prevCutoff) break;
        if (msg._creationTime >= cutoff) {
          if (msg.type === "bot") botAssists++;
        } else {
          if (msg.type === "bot") prevBotAssists++;
        }
      }
    }

    const hoursSaved =
      Math.round(((botAssists * 2 + summariesReceived * 5) / 60) * 10) / 10;
    const prevHoursSaved =
      Math.round(((prevBotAssists * 2) / 60) * 10) / 10;
    const hoursDelta =
      prevHoursSaved > 0
        ? Math.round(((hoursSaved - prevHoursSaved) / prevHoursSaved) * 100)
        : hoursSaved > 0
          ? 100
          : 0;

    return {
      decisionsResolved: resolved.length,
      decisionsPending: pending.length,
      avgDecisionTimeMinutes,
      decisionsByQuadrant,
      decisionsByType,
      summariesReceived,
      alertsSurfaced,
      alertsActedOn,
      alertsByType,
      botAssists,
      hoursSaved,
      hoursDelta,
    };
  },
});

/**
 * Workspace-wide analytics — admin only.
 */
export const getWorkspaceAnalytics = query({
  args: { period: periodValidator, workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx, args.workspaceId);
    if (user.role !== "admin") {
      throw new Error("Only admins can view workspace analytics");
    }

    const now = Date.now();
    const periodMs = PERIOD_MS[args.period];
    const cutoff = now - periodMs;

    // --- Team health ---
    const members = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .take(500);
    const totalMembers = members.length;
    const newMembers = members.filter((m) => m.joinedAt >= cutoff).length;

    // Active users (lastSeenAt within period)
    let activeUsers = 0;
    for (const m of members) {
      const u = await ctx.db.get(m.userId);
      if (u?.lastSeenAt && u.lastSeenAt >= cutoff) activeUsers++;
    }

    // --- Message & conversation activity ---
    const conversations = await getWorkspaceConversations(ctx, args.workspaceId);
    let totalMessages = 0;
    let totalBotAssists = 0;

    const conversationMessageCounts: Array<{
      conversationId: Id<"conversations">;
      name: string;
      messageCount: number;
    }> = [];

    for (const conversation of conversations) {
      if (conversation.isArchived) continue;
      const msgs = await getRecentMessages(ctx, conversation._id);
      let convCount = 0;
      for (const msg of msgs) {
        if (msg._creationTime < cutoff) break;
        totalMessages++;
        convCount++;
        if (msg.type === "bot") totalBotAssists++;
      }
      conversationMessageCounts.push({
        conversationId: conversation._id,
        name: conversation.name ?? "Unnamed",
        messageCount: convCount,
      });
    }

    conversationMessageCounts.sort((a, b) => b.messageCount - a.messageCount);
    const maxConvCount = conversationMessageCounts[0]?.messageCount ?? 1;
    const channelActivity = conversationMessageCounts.slice(0, 8).map((c) => ({
      ...c,
      pct: Math.round((c.messageCount / maxConvCount) * 100),
    }));
    const deadChannels = conversationMessageCounts.filter(
      (c) => c.messageCount === 0,
    ).length;

    // --- DMs ---
    // DM conversations are already included in `conversations` above (unified table).
    // Count messages from 1:1 and group DM conversations separately.
    let totalDMs = 0;
    for (const conv of conversations) {
      if (conv.kind !== "1to1" && conv.kind !== "group" && conv.kind !== "agent_1to1" && conv.kind !== "agent_group") continue;
      const dms = await ctx.db
        .query("messages")
        .withIndex("by_conversation", (q) => q.eq("conversationId", conv._id))
        .order("desc")
        .take(500);
      for (const dm of dms) {
        if (dm._creationTime < cutoff) break;
        totalDMs++;
      }
    }

    // --- Workspace inbox items ---
    let totalDecisions = 0;
    let totalPending = 0;
    let totalDecisionMs = 0;
    let decidedCount = 0;
    const wsCategoryCounts: Record<string, number> = {};
    const userDecisionCounts: Record<string, number> = {};
    const userPendingCounts: Record<string, number> = {};

    for (const m of members) {
      const items = await ctx.db
        .query("inboxItems")
        .withIndex("by_user_status", (q) => q.eq("userId", m.userId))
        .order("desc")
        .take(500);

      for (const d of items) {
        if (d.status === "pending") {
          totalPending++;
          userPendingCounts[m.userId] =
            (userPendingCounts[m.userId] ?? 0) + 1;
        }
        if (d.createdAt < cutoff) continue;
        if (d.status === "archived" && d.outcome) {
          totalDecisions++;
          userDecisionCounts[m.userId] =
            (userDecisionCounts[m.userId] ?? 0) + 1;
          if (d.outcome?.decidedAt) {
            totalDecisionMs += d.outcome.decidedAt - d.createdAt;
            decidedCount++;
          }
        }
        wsCategoryCounts[d.category] =
          (wsCategoryCounts[d.category] ?? 0) + 1;
      }
    }

    const avgDecisionTimeMinutes =
      decidedCount > 0 ? Math.round(totalDecisionMs / decidedCount / 60000) : 0;

    const decisionsByQuadrant = Object.entries(wsCategoryCounts).map(
      ([category, count]) => ({
        quadrant: category,
        label: CATEGORY_LABELS[category] ?? category,
        count,
      }),
    );

    const sortedDeciders = Object.entries(userDecisionCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10);
    const maxDecisions = sortedDeciders[0]?.[1] ?? 1;
    const topDeciders = await Promise.all(
      sortedDeciders.map(async ([userId, count]) => {
        const u = await ctx.db.get(userId as Id<"users">);
        return {
          name: u?.name ?? "Unknown",
          count,
          pct: Math.round((count / maxDecisions) * 100),
        };
      }),
    );

    const sortedBottlenecks = Object.entries(userPendingCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5);
    const bottlenecks = await Promise.all(
      sortedBottlenecks.map(async ([userId, pending]) => {
        const u = await ctx.db.get(userId as Id<"users">);
        return { name: u?.name ?? "Unknown", pending };
      }),
    );

    // --- AI platform ---
    let totalSummaries = 0;
    let totalAlerts = 0;
    const wsAlertTypeCounts: Record<string, number> = {};

    for (const m of members) {
      const items = await ctx.db
        .query("inboxItems")
        .withIndex("by_user_status", (q) => q.eq("userId", m.userId))
        .order("desc")
        .take(200);
      for (const item of items) {
        if (item.createdAt < cutoff) continue;
        if (item.type === "channel_summary" || item.type === "email_summary") {
          totalSummaries++;
        } else {
          totalAlerts++;
          wsAlertTypeCounts[item.type] = (wsAlertTypeCounts[item.type] ?? 0) + 1;
        }
      }
    }

    const totalAlertsByType = Object.entries(wsAlertTypeCounts)
      .map(([type, count]) => ({
        type,
        label: ITEM_TYPE_LABELS[type] ?? type,
        count,
      }))
      .sort((a, b) => b.count - a.count);

    const totalHoursSaved =
      Math.round(((totalBotAssists * 2 + totalSummaries * 5) / 60) * 10) / 10;

    // --- Integrations ---
    const integrations = await ctx.db
      .query("integrationObjects")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .order("desc")
      .take(1000);
    const recentIntegrations = integrations.filter(
      (i) => i.lastSyncedAt >= cutoff,
    );
    const prsSynced = recentIntegrations.filter(
      (i) => i.type === "github_pr",
    ).length;
    const ticketsSynced = recentIntegrations.filter(
      (i) => i.type === "linear_ticket",
    ).length;

    return {
      totalDecisions,
      totalPending,
      avgDecisionTimeMinutes,
      decisionsByQuadrant,
      activeUsers,
      totalMembers,
      newMembers,
      totalMessages,
      totalDMs,
      channelActivity,
      deadChannels,
      totalBotAssists,
      totalSummaries,
      totalAlerts,
      totalAlertsByType,
      totalHoursSaved,
      topDeciders,
      bottlenecks,
      prsSynced,
      ticketsSynced,
    };
  },
});
