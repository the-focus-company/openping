import {
  internalAction,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

// ─── Shared types ─────────────────────────────────────────────────────────────

type ActionCtx = {
  runQuery: (typeof internalAction.prototype)["runQuery"];
  runMutation: (typeof internalAction.prototype)["runMutation"];
};

interface DecisionBase {
  _id: Id<"decisions">;
  workspaceId: Id<"workspaces">;
  sourceChannelId?: Id<"channels">;
  sourceMessageId?: Id<"messages">;
  sourceIntegrationObjectId?: Id<"integrationObjects">;
  outcome: {
    action: string;
    comment?: string;
    delegateTo?: Id<"users">;
    metadata?: Record<string, unknown>;
  };
}

// ─── Status management ───────────────────────────────────────────────────────

export const updateExecutionStatus = internalMutation({
  args: {
    decisionId: v.id("decisions"),
    status: v.union(
      v.literal("pending"),
      v.literal("running"),
      v.literal("completed"),
      v.literal("failed"),
    ),
    result: v.optional(
      v.object({
        message: v.string(),
        error: v.optional(v.string()),
        completedAt: v.optional(v.number()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.decisionId, {
      agentExecutionStatus: args.status,
      agentExecutionResult: args.result,
    });
  },
});

// ─── Internal helpers ─────────────────────────────────────────────────────────

export const getDecision = internalQuery({
  args: { decisionId: v.id("decisions") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.decisionId);
  },
});

export const getIntegrationObject = internalQuery({
  args: { id: v.id("integrationObjects") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const getUser = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.userId);
  },
});

// ─── Linear API helper ────────────────────────────────────────────────────────

async function linearGraphQL(
  apiKey: string,
  query: string,
): Promise<void> {
  const response = await fetch("https://api.linear.app/graphql", {
    method: "POST",
    headers: {
      Authorization: apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Linear API returned ${response.status}: ${errorText}`);
  }
}

// ─── Delegation helper ────────────────────────────────────────────────────────

async function delegateToUser(
  ctx: ActionCtx,
  decision: DecisionBase,
  alertType: string,
  title: string,
  body: string,
  suggestedAction: string,
): Promise<string> {
  if (!decision.outcome.delegateTo) {
    throw new Error("Delegation requires a delegateTo user");
  }
  if (!decision.sourceChannelId) {
    throw new Error("No source channel for delegation alert");
  }

  const delegatee = await ctx.runQuery(internal.decisionAgents.getUser, {
    userId: decision.outcome.delegateTo,
  });
  if (!delegatee) throw new Error("Delegate user not found");

  await ctx.runMutation(internal.proactiveAlerts.createAlert, {
    userId: decision.outcome.delegateTo,
    workspaceId: decision.workspaceId,
    type: alertType as any,
    channelId: decision.sourceChannelId,
    title,
    body: decision.outcome.comment ?? body,
    sourceMessageId: decision.sourceMessageId,
    suggestedAction,
  });

  return delegatee.name;
}

// ─── PR Review handler (8LI-229) ──────────────────────────────────────────────

async function handlePRReview(
  ctx: ActionCtx,
  decision: DecisionBase,
): Promise<string> {
  const action = decision.outcome.action;

  if (action === "approve" || action === "request_changes") {
    if (!decision.sourceIntegrationObjectId) {
      throw new Error("No integration object linked to this decision");
    }

    const pr = await ctx.runQuery(internal.decisionAgents.getIntegrationObject, {
      id: decision.sourceIntegrationObjectId,
    });
    if (!pr) throw new Error("PR integration object not found");

    const meta = pr.metadata as {
      owner?: string;
      repo?: string;
      number?: number;
    };
    if (!meta.owner || !meta.repo || !meta.number) {
      throw new Error("PR metadata missing owner/repo/number");
    }

    const githubToken = process.env.GITHUB_TOKEN;
    if (!githubToken) {
      throw new Error("GITHUB_TOKEN environment variable is not set");
    }

    const reviewEvent = action === "approve" ? "APPROVE" : "REQUEST_CHANGES";
    const reviewBody =
      decision.outcome.comment ?? (action === "approve" ? "Looks good!" : "");

    const response = await fetch(
      `https://api.github.com/repos/${meta.owner}/${meta.repo}/pulls/${meta.number}/reviews`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${githubToken}`,
          Accept: "application/vnd.github.v3+json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          event: reviewEvent,
          body: reviewBody,
        }),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `GitHub API returned ${response.status}: ${errorText}`,
      );
    }

    return `PR #${meta.number} ${action === "approve" ? "approved" : "changes requested"} successfully`;
  }

  if (action === "delegate") {
    const name = await delegateToUser(
      ctx,
      decision,
      "pr_review_nudge",
      "PR review delegated to you",
      "A PR review has been delegated to you. Please take a look.",
      "Review the PR",
    );
    return `PR review delegated to ${name}`;
  }

  throw new Error(`Unknown PR review action: ${action}`);
}

// ─── Linear ticket handler (8LI-230) ──────────────────────────────────────────

async function handleTicketTriage(
  ctx: ActionCtx,
  decision: DecisionBase,
): Promise<string> {
  const action = decision.outcome.action;

  if (!decision.sourceIntegrationObjectId) {
    throw new Error("No integration object linked to this decision");
  }

  const ticket = await ctx.runQuery(
    internal.decisionAgents.getIntegrationObject,
    { id: decision.sourceIntegrationObjectId },
  );
  if (!ticket) throw new Error("Ticket integration object not found");

  const linearApiKey = process.env.LINEAR_API_KEY;
  const ticketExternalId = ticket.externalId.replace("linear_", "");

  if (action === "accept") {
    if (!linearApiKey) {
      console.log(`[decisionAgents] Would accept Linear ticket ${ticketExternalId}`);
      return `Ticket "${ticket.title}" accepted (LINEAR_API_KEY not set, skipped API call)`;
    }

    const meta = decision.outcome.metadata as { status?: string } | undefined;
    await linearGraphQL(
      linearApiKey,
      `mutation { issueUpdate(id: "${ticketExternalId}", input: { stateId: "${meta?.status ?? ""}" }) { success } }`,
    );

    return `Ticket "${ticket.title}" accepted`;
  }

  if (action === "reject") {
    if (!linearApiKey) {
      console.log(`[decisionAgents] Would reject Linear ticket ${ticketExternalId}`);
      return `Ticket "${ticket.title}" rejected (LINEAR_API_KEY not set, skipped API call)`;
    }

    const comment = decision.outcome.comment ?? "Rejected via PING Decision Hub";
    await linearGraphQL(
      linearApiKey,
      `mutation { commentCreate(input: { issueId: "${ticketExternalId}", body: "${comment.replace(/"/g, '\\"')}" }) { success } }`,
    );

    return `Ticket "${ticket.title}" rejected with comment`;
  }

  if (action === "reassign") {
    const name = await delegateToUser(
      ctx,
      decision,
      "blocked_task",
      `Ticket reassigned to you: ${ticket.title}`,
      `"${ticket.title}" has been reassigned to you.`,
      `Review ticket at ${ticket.url}`,
    );
    return `Ticket "${ticket.title}" reassigned to ${name}`;
  }

  throw new Error(`Unknown ticket triage action: ${action}`);
}

// ─── Blocked/unblock handler (8LI-230) ────────────────────────────────────────

async function handleBlockedUnblock(
  ctx: ActionCtx,
  decision: DecisionBase,
): Promise<string> {
  const action = decision.outcome.action;

  if (!decision.sourceIntegrationObjectId) {
    throw new Error("No integration object linked to this decision");
  }

  const ticket = await ctx.runQuery(
    internal.decisionAgents.getIntegrationObject,
    { id: decision.sourceIntegrationObjectId },
  );
  if (!ticket) throw new Error("Ticket integration object not found");

  if (action === "unblock") {
    const linearApiKey = process.env.LINEAR_API_KEY;
    const ticketExternalId = ticket.externalId.replace("linear_", "");

    if (linearApiKey) {
      const comment =
        decision.outcome.comment ?? "Unblocked via PING Decision Hub";
      await linearGraphQL(
        linearApiKey,
        `mutation { commentCreate(input: { issueId: "${ticketExternalId}", body: "${comment.replace(/"/g, '\\"')}" }) { success } }`,
      );
    } else {
      console.log(`[decisionAgents] Would unblock Linear ticket ${ticketExternalId}`);
    }

    return `Ticket "${ticket.title}" marked as unblocked`;
  }

  if (action === "escalate") {
    const name = await delegateToUser(
      ctx,
      decision,
      "blocked_task",
      `Blocked task escalated: ${ticket.title}`,
      `"${ticket.title}" is blocked and has been escalated to you.`,
      `Investigate blocker for ${ticket.title}`,
    );
    return `Blocked task "${ticket.title}" escalated to ${name}`;
  }

  throw new Error(`Unknown blocked/unblock action: ${action}`);
}

// ─── Message reply handler (8LI-231) ──────────────────────────────────────────

async function handleQuestionAnswer(
  ctx: ActionCtx,
  decision: DecisionBase,
): Promise<string> {
  const action = decision.outcome.action;

  if (action === "reply") {
    if (!decision.sourceChannelId) {
      throw new Error("No source channel for reply");
    }

    const replyBody = decision.outcome.comment;
    if (!replyBody) {
      throw new Error("Reply action requires a comment with the reply text");
    }

    const botUser = await ctx.runQuery(
      internal.proactiveAlerts.getWorkspaceBotUser,
      { workspaceId: decision.workspaceId },
    );
    if (!botUser) throw new Error("No bot user found for workspace");

    await ctx.runMutation(internal.proactiveAlerts.insertBotMessage, {
      channelId: decision.sourceChannelId,
      authorId: botUser._id,
      body: replyBody,
    });

    return "Reply posted successfully";
  }

  if (action === "delegate") {
    const name = await delegateToUser(
      ctx,
      decision,
      "unanswered_question",
      "Question delegated to you",
      "A question has been delegated to you for answering.",
      "Answer the question in the channel",
    );

    // Post delegation notice in channel
    if (decision.sourceChannelId) {
      const botUser = await ctx.runQuery(
        internal.proactiveAlerts.getWorkspaceBotUser,
        { workspaceId: decision.workspaceId },
      );
      if (botUser) {
        await ctx.runMutation(internal.proactiveAlerts.insertBotMessage, {
          channelId: decision.sourceChannelId,
          authorId: botUser._id,
          body: `This question has been routed to ${name} for a response.`,
        });
      }
    }

    return `Question delegated to ${name}`;
  }

  throw new Error(`Unknown question_answer action: ${action}`);
}

// ─── Main execution dispatcher (8LI-228) ─────────────────────────────────────

export const executeDecisionAction = internalAction({
  args: {
    decisionId: v.id("decisions"),
  },
  handler: async (ctx, args) => {
    await ctx.runMutation(internal.decisionAgents.updateExecutionStatus, {
      decisionId: args.decisionId,
      status: "running",
    });

    const decision = await ctx.runQuery(internal.decisionAgents.getDecision, {
      decisionId: args.decisionId,
    });

    if (!decision) {
      await ctx.runMutation(internal.decisionAgents.updateExecutionStatus, {
        decisionId: args.decisionId,
        status: "failed",
        result: {
          message: "Decision not found",
          error: "Decision not found",
          completedAt: Date.now(),
        },
      });
      return;
    }

    try {
      let resultMessage: string;

      switch (decision.type) {
        case "pr_review":
          resultMessage = await handlePRReview(ctx, decision);
          break;
        case "ticket_triage":
          resultMessage = await handleTicketTriage(ctx, decision);
          break;
        case "blocked_unblock":
          resultMessage = await handleBlockedUnblock(ctx, decision);
          break;
        case "question_answer":
          resultMessage = await handleQuestionAnswer(ctx, decision);
          break;
        default:
          throw new Error(`Unknown decision type: ${decision.type}`);
      }

      await ctx.runMutation(internal.decisionAgents.updateExecutionStatus, {
        decisionId: args.decisionId,
        status: "completed",
        result: {
          message: resultMessage,
          completedAt: Date.now(),
        },
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(
        `[decisionAgents] Execution failed for decision ${args.decisionId}:`,
        errorMessage,
      );

      await ctx.runMutation(internal.decisionAgents.updateExecutionStatus, {
        decisionId: args.decisionId,
        status: "failed",
        result: {
          message: "Execution failed",
          error: errorMessage,
          completedAt: Date.now(),
        },
      });
    }
  },
});
