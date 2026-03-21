import {
  query,
  mutation,
  internalMutation,
  internalAction,
} from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { requireUser } from "./auth";
import {
  callCivicNexusTool,
  closeCivicNexusClient,
} from "./civicNexus";

export const getAlerts = query({
  args: {
    status: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("acted"),
        v.literal("dismissed"),
        v.literal("expired"),
      ),
    ),
    type: v.optional(
      v.union(
        v.literal("unanswered_question"),
        v.literal("pr_review_nudge"),
        v.literal("incident_route"),
        v.literal("blocked_task"),
      ),
    ),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    if (args.status) {
      return await ctx.db
        .query("proactiveAlerts")
        .withIndex("by_user_status", (q) =>
          q.eq("userId", user._id).eq("status", args.status!),
        )
        .collect();
    }

    if (args.type) {
      return await ctx.db
        .query("proactiveAlerts")
        .withIndex("by_user_type", (q) =>
          q.eq("userId", user._id).eq("type", args.type!),
        )
        .collect();
    }

    return await ctx.db
      .query("proactiveAlerts")
      .withIndex("by_user_status", (q) =>
        q.eq("userId", user._id).eq("status", "pending"),
      )
      .collect();
  },
});

export const createAlert = internalMutation({
  args: {
    userId: v.id("users"),
    workspaceId: v.id("workspaces"),
    type: v.union(
      v.literal("unanswered_question"),
      v.literal("pr_review_nudge"),
      v.literal("incident_route"),
      v.literal("blocked_task"),
    ),
    channelId: v.id("channels"),
    title: v.string(),
    body: v.string(),
    sourceMessageId: v.optional(v.id("messages")),
    sourceIntegrationObjectId: v.optional(v.id("integrationObjects")),
    suggestedAction: v.string(),
    priority: v.union(
      v.literal("high"),
      v.literal("medium"),
      v.literal("low"),
    ),
    expiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("proactiveAlerts", {
      ...args,
      status: "pending",
      createdAt: Date.now(),
    });
  },
});

export const actOnAlert = mutation({
  args: {
    alertId: v.id("proactiveAlerts"),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const alert = await ctx.db.get(args.alertId);
    if (!alert) throw new Error("Alert not found");
    if (alert.userId !== user._id) throw new Error("Not authorized");

    await ctx.db.patch(args.alertId, { status: "acted" });
  },
});

export const dismissAlert = mutation({
  args: {
    alertId: v.id("proactiveAlerts"),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const alert = await ctx.db.get(args.alertId);
    if (!alert) throw new Error("Alert not found");
    if (alert.userId !== user._id) throw new Error("Not authorized");

    await ctx.db.patch(args.alertId, { status: "dismissed" });
  },
});

export const expireStaleAlerts = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const allAlerts = await ctx.db.query("proactiveAlerts").collect();
    let expiredCount = 0;

    for (const alert of allAlerts) {
      if (alert.status === "pending" && alert.expiresAt < now) {
        await ctx.db.patch(alert._id, { status: "expired" });
        expiredCount++;
      }
    }

    console.log(`[proactive.expireStaleAlerts] Expired ${expiredCount} alerts`);
  },
});

export const scanUnansweredQuestions = internalAction({
  args: {},
  handler: async () => {
    // TODO: Implement with Civic Nexus + AI classification
    console.log(
      "[proactive.scanUnansweredQuestions stub] Would scan for unanswered questions",
    );
  },
});

const PR_STALE_THRESHOLD_MS = 4 * 60 * 60 * 1000; // 4 hours

export const scanPRReviewNudges = internalAction({
  args: {},
  handler: async (ctx) => {
    const workspace = await ctx.runQuery(
      internal.webhooks.getDefaultWorkspace,
    );
    if (!workspace) {
      console.log("[scanPRReviewNudges] No default workspace found");
      return;
    }

    const openPRs = await ctx.runQuery(internal.integrations.listOpenPRs, {
      workspaceId: workspace._id,
    });

    if (openPRs.length === 0) {
      console.log("[scanPRReviewNudges] No open PRs found");
      return;
    }

    const now = Date.now();
    const stalePRs = openPRs.filter(
      (pr) => now - pr.lastSyncedAt > PR_STALE_THRESHOLD_MS,
    );

    if (stalePRs.length === 0) {
      console.log("[scanPRReviewNudges] No stale PRs found");
      return;
    }

    // Find #engineering channel for alerts
    const channels = await ctx.runQuery(internal.channels.getByWorkspaceName, {
      workspaceId: workspace._id,
      name: "engineering",
    });
    if (!channels) {
      console.log("[scanPRReviewNudges] No #engineering channel found");
      return;
    }

    const allUsers = await ctx.runQuery(internal.users.listByWorkspace, {
      workspaceId: workspace._id,
    });

    let nudgeCount = 0;

    for (const pr of stalePRs) {
      const meta = pr.metadata as {
        repo?: string;
        owner?: string;
        number?: number;
      };

      // Use Civic Nexus → GitHub to check review status.
      // Tool names match Civic Nexus GitHub server registration.
      // Run listCivicNexusTools() to discover exact names for your setup.
      let reviewInfo = "";
      let requestedReviewers: string[] = [];
      try {
        if (meta.owner && meta.repo && meta.number) {
          const reviewData = await callCivicNexusTool("list_pull_request_reviews", {
            owner: meta.owner,
            repo: meta.repo,
            pull_number: meta.number,
          });
          reviewInfo = reviewData;

          // Also get requested reviewers
          const prData = await callCivicNexusTool("get_pull_request", {
            owner: meta.owner,
            repo: meta.repo,
            pull_number: meta.number,
          });

          try {
            const parsed = JSON.parse(prData);
            requestedReviewers =
              parsed.requested_reviewers?.map(
                (r: { login: string }) => r.login,
              ) ?? [];
          } catch {
            // prData might not be JSON
          }
        }
      } catch (err) {
        console.warn(
          `[scanPRReviewNudges] Civic Nexus call failed for PR #${meta.number}:`,
          err,
        );
        // Fall through — still create a nudge based on time threshold
      }

      // Check if PR already has approvals
      let hasApproval = false;
      try {
        const parsed = JSON.parse(reviewInfo);
        if (Array.isArray(parsed)) {
          hasApproval = parsed.some(
            (r: { state: string }) => r.state === "APPROVED",
          );
        }
      } catch {
        // reviewInfo might not be JSON
      }

      if (hasApproval) continue;

      const hoursOpen = Math.round(
        (now - pr.lastSyncedAt) / (60 * 60 * 1000),
      );

      // Create an alert for each active user in the workspace
      // (in production, target only requested reviewers or domain experts)
      const targetUsers =
        requestedReviewers.length > 0
          ? allUsers.filter((u) =>
              requestedReviewers.some(
                (reviewer) =>
                  u.name.toLowerCase().includes(reviewer.toLowerCase()) ||
                  u.email.toLowerCase().includes(reviewer.toLowerCase()),
              ),
            )
          : allUsers.filter(
              (u) => u.status === "active" && u.name !== pr.author,
            );

      for (const user of targetUsers) {
        // Only alert users who are members of the target channel
        const isMember = await ctx.runQuery(internal.channels.isMember, {
          channelId: channels._id,
          userId: user._id,
        });
        if (!isMember) continue;

        await ctx.runMutation(internal.proactive.createAlert, {
          userId: user._id,
          workspaceId: workspace._id,
          type: "pr_review_nudge",
          channelId: channels._id,
          title: `PR #${meta.number ?? "?"} waiting for review`,
          body: `"${pr.title}" by ${pr.author} has been open for ${hoursOpen}h without approval.`,
          sourceIntegrationObjectId: pr._id,
          suggestedAction: `Review PR at ${pr.url}`,
          priority: hoursOpen > 24 ? "high" : "medium",
          expiresAt: now + 24 * 60 * 60 * 1000,
        });
        nudgeCount++;
      }
    }

    await closeCivicNexusClient();
    console.log(
      `[scanPRReviewNudges] Created ${nudgeCount} nudges for ${stalePRs.length} stale PRs`,
    );
  },
});

const BLOCKED_TASK_THRESHOLD_MS = 2 * 24 * 60 * 60 * 1000; // 2 days

export const scanBlockedTasks = internalAction({
  args: {},
  handler: async (ctx) => {
    const workspace = await ctx.runQuery(
      internal.webhooks.getDefaultWorkspace,
    );
    if (!workspace) {
      console.log("[scanBlockedTasks] No default workspace found");
      return;
    }

    const inProgressTickets = await ctx.runQuery(
      internal.integrations.listInProgressTickets,
      { workspaceId: workspace._id },
    );

    if (inProgressTickets.length === 0) {
      console.log("[scanBlockedTasks] No in-progress tickets found");
      return;
    }

    const now = Date.now();
    const staleTickets = inProgressTickets.filter(
      (t) => now - t.lastSyncedAt > BLOCKED_TASK_THRESHOLD_MS,
    );

    if (staleTickets.length === 0) {
      console.log("[scanBlockedTasks] No stale in-progress tickets found");
      return;
    }

    const channels = await ctx.runQuery(internal.channels.getByWorkspaceName, {
      workspaceId: workspace._id,
      name: "engineering",
    });
    if (!channels) return;

    const allUsers = await ctx.runQuery(internal.users.listByWorkspace, {
      workspaceId: workspace._id,
    });

    let alertCount = 0;

    for (const ticket of staleTickets) {
      const meta = ticket.metadata as {
        identifier?: string;
        priority?: number;
      };

      // Use Civic Nexus → Linear to check for blocker signals.
      // Tool names match Civic Nexus Linear server registration.
      let ticketDetails = "";
      try {
        ticketDetails = await callCivicNexusTool("get_issue", {
          issue_id: ticket.externalId.replace("linear_", ""),
        });
      } catch (err) {
        console.warn(
          `[scanBlockedTasks] Civic Nexus call failed for ${meta.identifier}:`,
          err,
        );
      }

      const daysStuck = Math.round(
        (now - ticket.lastSyncedAt) / (24 * 60 * 60 * 1000),
      );

      // Try to find the assignee among workspace users
      const assigneeUser = allUsers.find(
        (u) =>
          u.status === "active" &&
          (u.name.toLowerCase().includes(ticket.author.toLowerCase()) ||
            u.email.toLowerCase().includes(ticket.author.toLowerCase())),
      );

      const targetUser = assigneeUser ?? allUsers.find((u) => u.status === "active");
      if (!targetUser) continue;

      // Only alert users who are members of the target channel
      const isMember = await ctx.runQuery(internal.channels.isMember, {
        channelId: channels._id,
        userId: targetUser._id,
      });
      if (!isMember) continue;

      let suggestedAction = `Check on ${meta.identifier ?? ticket.title} — in progress for ${daysStuck} days.`;

      // Parse Linear response for additional context
      try {
        const parsed = JSON.parse(ticketDetails);
        if (parsed.comments?.length > 0) {
          const lastComment = parsed.comments[parsed.comments.length - 1];
          suggestedAction += ` Last comment: "${lastComment.body?.slice(0, 100)}"`;
        }
      } catch {
        // ticketDetails might not be JSON
      }

      await ctx.runMutation(internal.proactive.createAlert, {
        userId: targetUser._id,
        workspaceId: workspace._id,
        type: "blocked_task",
        channelId: channels._id,
        title: `${meta.identifier ?? "Ticket"} may be blocked`,
        body: `"${ticket.title}" has been in progress for ${daysStuck} days without updates.`,
        sourceIntegrationObjectId: ticket._id,
        suggestedAction,
        priority: daysStuck > 5 ? "high" : "medium",
        expiresAt: now + 24 * 60 * 60 * 1000,
      });
      alertCount++;
    }

    await closeCivicNexusClient();
    console.log(
      `[scanBlockedTasks] Created ${alertCount} alerts for ${staleTickets.length} stale tickets`,
    );
  },
});
