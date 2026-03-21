import { query, mutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { requireUser } from "./auth";

// ─── Public queries ──────────────────────────────────────────────────────────

export const list = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);

    const pending = await ctx.db
      .query("decisions")
      .withIndex("by_user_status", (q) =>
        q.eq("userId", user._id).eq("status", "pending"),
      )
      .take(50);

    const snoozed = await ctx.db
      .query("decisions")
      .withIndex("by_user_status", (q) =>
        q.eq("userId", user._id).eq("status", "snoozed"),
      )
      .take(20);

    const all = [...pending, ...snoozed];

    const enriched = await Promise.all(
      all.map(async (decision) => {
        const channel = decision.channelId
          ? await ctx.db.get(decision.channelId)
          : null;
        return {
          ...decision,
          channelName: channel?.name ?? null,
        };
      }),
    );

    return enriched;
  },
});

export const unreadCount = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const pending = await ctx.db
      .query("decisions")
      .withIndex("by_user_status", (q) =>
        q.eq("userId", user._id).eq("status", "pending"),
      )
      .take(100);
    return pending.length;
  },
});

export const getContext = query({
  args: { decisionId: v.id("decisions") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const decision = await ctx.db.get(args.decisionId);
    if (!decision || decision.userId !== user._id) {
      throw new Error("Not found");
    }

    const [sourceAlert, sourceSummary, sourceMessage, sourceIntegrationObject] =
      await Promise.all([
        decision.sourceAlertId
          ? ctx.db.get(decision.sourceAlertId)
          : null,
        decision.sourceSummaryId
          ? ctx.db.get(decision.sourceSummaryId)
          : null,
        decision.sourceMessageId
          ? ctx.db.get(decision.sourceMessageId)
          : null,
        decision.sourceIntegrationObjectId
          ? ctx.db.get(decision.sourceIntegrationObjectId)
          : null,
      ]);

    let relatedMessages: Array<{
      body: string;
      authorName: string;
      createdAt: number;
    }> = [];
    if (decision.channelId) {
      const messages = await ctx.db
        .query("messages")
        .withIndex("by_channel", (q) =>
          q.eq("channelId", decision.channelId!),
        )
        .order("desc")
        .take(10);

      relatedMessages = await Promise.all(
        messages.map(async (msg) => {
          const author = await ctx.db.get(msg.authorId);
          return {
            body: msg.body,
            authorName: author?.name ?? "Unknown",
            createdAt: msg._creationTime,
          };
        }),
      );
    }

    const pastDecisions = await ctx.db
      .query("decisions")
      .withIndex("by_user_status", (q) =>
        q.eq("userId", user._id).eq("status", "decided"),
      )
      .order("desc")
      .take(20);

    const relatedPastDecisions = pastDecisions
      .filter((d) => d.type === decision.type && d._id !== decision._id)
      .slice(0, 5)
      .map((d) => ({
        title: d.title,
        outcome: d.outcome,
        createdAt: d.createdAt,
      }));

    return {
      decision,
      sourceAlert,
      sourceSummary,
      sourceMessage,
      sourceIntegrationObject,
      relatedMessages,
      relatedPastDecisions,
    };
  },
});

export const getStats = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const now = Date.now();
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

    const decided = await ctx.db
      .query("decisions")
      .withIndex("by_user_status", (q) =>
        q.eq("userId", user._id).eq("status", "decided"),
      )
      .take(500);

    const delegated = await ctx.db
      .query("decisions")
      .withIndex("by_user_status", (q) =>
        q.eq("userId", user._id).eq("status", "delegated"),
      )
      .take(500);

    const allResolved = [...decided, ...delegated];

    const total7d = allResolved.filter(
      (d) => d.createdAt >= sevenDaysAgo,
    ).length;
    const total30d = allResolved.filter(
      (d) => d.createdAt >= thirtyDaysAgo,
    ).length;

    const withTiming = allResolved.filter((d) => d.outcome?.decidedAt);
    const avgDecisionTimeMs =
      withTiming.length > 0
        ? withTiming.reduce(
            (sum, d) => sum + (d.outcome!.decidedAt - d.createdAt),
            0,
          ) / withTiming.length
        : 0;

    const delegationRate =
      allResolved.length > 0 ? delegated.length / allResolved.length : 0;

    const quadrants = {
      "urgent-important": 0,
      important: 0,
      urgent: 0,
      fyi: 0,
    };
    const pending = await ctx.db
      .query("decisions")
      .withIndex("by_user_status", (q) =>
        q.eq("userId", user._id).eq("status", "pending"),
      )
      .take(500);
    for (const d of pending) {
      quadrants[d.eisenhowerQuadrant]++;
    }

    return {
      total7d,
      total30d,
      avgDecisionTimeMs,
      delegationRate,
      quadrantDistribution: quadrants,
      pendingCount: pending.length,
    };
  },
});

// ─── Public mutations ────────────────────────────────────────────────────────

export const decide = mutation({
  args: {
    decisionId: v.id("decisions"),
    action: v.string(),
    comment: v.optional(v.string()),
    delegatedTo: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const decision = await ctx.db.get(args.decisionId);
    if (!decision || decision.userId !== user._id) {
      throw new Error("Not found");
    }
    if (decision.status !== "pending" && decision.status !== "snoozed") {
      throw new Error("Decision already resolved");
    }

    const now = Date.now();
    const newStatus: "decided" | "delegated" = args.delegatedTo
      ? "delegated"
      : "decided";

    await ctx.db.patch(args.decisionId, {
      status: newStatus,
      outcome: {
        action: args.action,
        comment: args.comment,
        delegatedTo: args.delegatedTo,
        decidedAt: now,
      },
      delegatedTo: args.delegatedTo,
      agentExecutionStatus: "pending",
    });

    await ctx.scheduler.runAfter(
      0,
      internal.decisionAgents.executeDecisionAction,
      { decisionId: args.decisionId },
    );
  },
});

export const snooze = mutation({
  args: {
    decisionId: v.id("decisions"),
    snoozeUntil: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const decision = await ctx.db.get(args.decisionId);
    if (!decision || decision.userId !== user._id) {
      throw new Error("Not found");
    }
    if (decision.status !== "pending") {
      throw new Error("Can only snooze pending decisions");
    }

    await ctx.db.patch(args.decisionId, {
      status: "snoozed",
      snoozedUntil: args.snoozeUntil,
      expiresAt: args.snoozeUntil,
    });
  },
});

// ─── Internal queries (used by decisionGenerator / decisionAgents) ───────────

export const getDecisionBySourceAlert = internalQuery({
  args: { sourceAlertId: v.id("proactiveAlerts") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("decisions")
      .withIndex("by_source_alert", (q) =>
        q.eq("sourceAlertId", args.sourceAlertId),
      )
      .first();
  },
});

export const getDecisionBySourceSummary = internalQuery({
  args: { sourceSummaryId: v.id("inboxSummaries") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("decisions")
      .withIndex("by_source_summary", (q) =>
        q.eq("sourceSummaryId", args.sourceSummaryId),
      )
      .first();
  },
});
