import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";

type OrgTracePerson = {
  userId?: Id<"users">;
  name: string;
  role: "author" | "assignee" | "mentioned";
  avatarUrl?: string;
};

// ─── Alert type → Decision type mapping ──────────────────────────────────────

const ALERT_TO_DECISION_TYPE: Record<string, string> = {
  pr_review_nudge: "pr_review",
  blocked_task: "blocked_unblock",
  unanswered_question: "question_answer",
  fact_check: "fact_verify",
  cross_team_sync: "cross_team_ack",
  incident_route: "ticket_triage",
};

// ─── Alert priority → Eisenhower quadrant mapping ────────────────────────────

function alertToQuadrant(
  alertType: string,
  priority: string,
): "urgent-important" | "important" | "urgent" | "fyi" {
  if (priority === "high") return "urgent-important";
  if (alertType === "cross_team_sync" || alertType === "fact_check")
    return "fyi";
  if (priority === "medium") return "important";
  return "fyi";
}

// ─── Internal mutation to insert a decision ──────────────────────────────────

export const insertDecision = internalMutation({
  args: {
    userId: v.id("users"),
    workspaceId: v.id("workspaces"),
    type: v.union(
      v.literal("pr_review"),
      v.literal("ticket_triage"),
      v.literal("question_answer"),
      v.literal("blocked_unblock"),
      v.literal("fact_verify"),
      v.literal("cross_team_ack"),
      v.literal("channel_summary"),
    ),
    title: v.string(),
    summary: v.string(),
    eisenhowerQuadrant: v.union(
      v.literal("urgent-important"),
      v.literal("important"),
      v.literal("urgent"),
      v.literal("fyi"),
    ),
    sourceAlertId: v.optional(v.id("proactiveAlerts")),
    sourceSummaryId: v.optional(v.id("inboxSummaries")),
    sourceIntegrationObjectId: v.optional(v.id("integrationObjects")),
    sourceMessageId: v.optional(v.id("messages")),
    channelId: v.optional(v.id("channels")),
    orgTrace: v.optional(
      v.array(
        v.object({
          userId: v.optional(v.id("users")),
          name: v.string(),
          role: v.union(
            v.literal("author"),
            v.literal("assignee"),
            v.literal("mentioned"),
            v.literal("to_consult"),
          ),
          avatarUrl: v.optional(v.string()),
        }),
      ),
    ),
    nextSteps: v.optional(
      v.array(
        v.object({
          actionKey: v.string(),
          label: v.string(),
          automated: v.boolean(),
        }),
      ),
    ),
    links: v.optional(
      v.array(
        v.object({
          title: v.string(),
          url: v.string(),
          type: v.union(
            v.literal("doc"),
            v.literal("sheet"),
            v.literal("video"),
            v.literal("pr"),
            v.literal("other"),
          ),
        }),
      ),
    ),
    relatedDecisionIds: v.optional(v.array(v.id("decisions"))),
    recommendedActions: v.optional(
      v.array(
        v.object({
          label: v.string(),
          actionKey: v.string(),
          primary: v.optional(v.boolean()),
          needsComment: v.optional(v.boolean()),
        }),
      ),
    ),
  },
  handler: async (ctx, args) => {
    const decisionId = await ctx.db.insert("decisions", {
      ...args,
      status: "pending",
      createdAt: Date.now(),
    });

    // Ingest decision into knowledge graph
    await ctx.scheduler.runAfter(0, internal.ingest.processDecision, {
      decisionId,
    });

    return decisionId;
  },
});

// ─── Generate decisions from pending proactive alerts ────────────────────────

export const generateFromAlerts = internalAction({
  args: {},
  handler: async (ctx) => {
    const pendingAlerts = await ctx.runQuery(
      internal.decisionGenerator.listPendingAlerts,
    );

    let created = 0;

    for (const alert of pendingAlerts) {
      const existing = await ctx.runQuery(
        internal.decisions.getDecisionBySourceAlert,
        { sourceAlertId: alert._id },
      );
      if (existing) continue;

      const decisionType = ALERT_TO_DECISION_TYPE[alert.type];
      if (!decisionType) continue;

      const quadrant = alertToQuadrant(alert.type, alert.priority);

      // Build org trace from source message author and integration object assignee
      const traceMap = new Map<string, OrgTracePerson>();

      if (alert.sourceMessageId) {
        const msg = await ctx.runQuery(internal.decisionGenerator.getMessage, {
          messageId: alert.sourceMessageId,
        });
        if (msg) {
          const author = await ctx.runQuery(internal.decisionGenerator.getUser, {
            userId: msg.authorId,
          });
          if (author) {
            traceMap.set(String(author._id), {
              userId: author._id,
              name: author.name,
              role: "author",
              avatarUrl: author.avatarUrl,
            });
          }
        }
      }

      if (alert.sourceIntegrationObjectId) {
        const obj = await ctx.runQuery(
          internal.decisionGenerator.getIntegrationObject,
          { id: alert.sourceIntegrationObjectId },
        );
        if (obj && obj.author && obj.author !== "Unassigned") {
          const key = `ext_${obj.author}`;
          if (!traceMap.has(key)) {
            traceMap.set(key, { name: obj.author, role: "assignee" });
          }
        }
      }

      const orgTrace = Array.from(traceMap.values());

      await ctx.runMutation(internal.decisionGenerator.insertDecision, {
        userId: alert.userId,
        workspaceId: alert.workspaceId,
        type: decisionType as
          | "pr_review"
          | "ticket_triage"
          | "question_answer"
          | "blocked_unblock"
          | "fact_verify"
          | "cross_team_ack",
        title: alert.title,
        summary: alert.body,
        eisenhowerQuadrant: quadrant,
        sourceAlertId: alert._id,
        sourceIntegrationObjectId: alert.sourceIntegrationObjectId,
        sourceMessageId: alert.sourceMessageId,
        channelId: alert.channelId,
        orgTrace: orgTrace.length > 0 ? orgTrace : undefined,
      });

      created++;
    }

    if (created > 0) {
      console.log(
        `[decisionGenerator.generateFromAlerts] Created ${created} decisions from alerts`,
      );
    }
  },
});

// ─── Generate decisions from inbox summaries ─────────────────────────────────

export const generateFromSummaries = internalAction({
  args: {},
  handler: async (ctx) => {
    const summaries = await ctx.runQuery(
      internal.decisionGenerator.listActionableSummaries,
    );

    let created = 0;

    for (const summary of summaries) {
      const existing = await ctx.runQuery(
        internal.decisions.getDecisionBySourceSummary,
        { sourceSummaryId: summary._id },
      );
      if (existing) continue;

      if (!summary.actionItems || summary.actionItems.length === 0) continue;

      const channel = await ctx.runQuery(
        internal.decisionGenerator.getChannel,
        { channelId: summary.channelId },
      );
      if (!channel) continue;

      const actionText = summary.actionItems
        .map((ai: { text: string }) => ai.text)
        .join("; ");

      // Build org trace from recent channel message authors
      const recentMessages = await ctx.runQuery(
        internal.decisionGenerator.getRecentChannelMessages,
        { channelId: summary.channelId },
      );
      const traceMap = new Map<string, OrgTracePerson>();
      for (const msg of recentMessages.slice(0, 5)) {
        const key = String(msg.authorId);
        if (!traceMap.has(key)) {
          const author = await ctx.runQuery(internal.decisionGenerator.getUser, {
            userId: msg.authorId,
          });
          if (author) {
            traceMap.set(key, {
              userId: msg.authorId,
              name: author.name,
              role: "author",
              avatarUrl: author.avatarUrl,
            });
          }
        }
      }
      const orgTrace = Array.from(traceMap.values());

      await ctx.runMutation(internal.decisionGenerator.insertDecision, {
        userId: summary.userId,
        workspaceId: channel.workspaceId,
        type: "channel_summary",
        title: `Action needed in #${channel.name}`,
        summary: actionText,
        eisenhowerQuadrant: summary.eisenhowerQuadrant,
        sourceSummaryId: summary._id,
        channelId: summary.channelId,
        orgTrace: orgTrace.length > 0 ? orgTrace : undefined,
      });

      created++;
    }

    if (created > 0) {
      console.log(
        `[decisionGenerator.generateFromSummaries] Created ${created} decisions from summaries`,
      );
    }
  },
});

// ─── Internal queries used by the generators ─────────────────────────────────

export const listPendingAlerts = internalQuery({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const alerts = await ctx.db
      .query("proactiveAlerts")
      .filter((q) => q.eq(q.field("status"), "pending"))
      .take(100);

    return alerts.filter((a) => a.expiresAt > now);
  },
});

export const listActionableSummaries = internalQuery({
  args: {},
  handler: async (ctx) => {
    const urgentImportant = await ctx.db
      .query("inboxSummaries")
      .filter((q) =>
        q.and(
          q.eq(q.field("isRead"), false),
          q.eq(q.field("isArchived"), false),
          q.or(
            q.eq(q.field("eisenhowerQuadrant"), "urgent-important"),
            q.eq(q.field("eisenhowerQuadrant"), "important"),
          ),
        ),
      )
      .take(50);

    return urgentImportant.filter(
      (s) => s.actionItems && s.actionItems.length > 0,
    );
  },
});

export const getChannel = internalQuery({
  args: { channelId: v.id("channels") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.channelId);
  },
});

export const getMessage = internalQuery({
  args: { messageId: v.id("messages") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.messageId);
  },
});

export const getUser = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.userId);
  },
});

export const getIntegrationObject = internalQuery({
  args: { id: v.id("integrationObjects") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const getRecentChannelMessages = internalQuery({
  args: { channelId: v.id("channels") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("messages")
      .withIndex("by_channel", (q) => q.eq("channelId", args.channelId))
      .order("desc")
      .take(10);
  },
});
