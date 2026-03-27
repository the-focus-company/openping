import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import {
  callCivicNexusTool,
  closeCivicNexusClient,
} from "./civicNexus";

// ─── Execution status updater ────────────────────────────────────────────────

export const updateExecutionStatus = internalMutation({
  args: {
    decisionId: v.id("inboxItems"),
    agentExecutionStatus: v.union(
      v.literal("pending"),
      v.literal("running"),
      v.literal("completed"),
      v.literal("failed"),
    ),
    agentExecutionResult: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.decisionId, {
      agentExecutionStatus: args.agentExecutionStatus,
      agentExecutionResult: args.agentExecutionResult,
    });
  },
});

// ─── Read decision for agent execution ───────────────────────────────────────

export const getDecision = internalQuery({
  args: { decisionId: v.id("inboxItems") },
  handler: async (ctx, args) => {
    const item = await ctx.db.get(args.decisionId);
    if (!item) return null;
    // Adapt to the DecisionDoc interface used by handlers
    return {
      ...item,
      workspaceId: item.workspaceId,
    };
  },
});

// ─── Main dispatcher ─────────────────────────────────────────────────────────

export const executeDecisionAction = internalAction({
  args: { decisionId: v.id("inboxItems") },
  handler: async (ctx, args) => {
    const decision = await ctx.runQuery(
      internal.decisionAgents.getDecision,
      { decisionId: args.decisionId },
    );
    if (!decision || !decision.outcome) {
      console.error(
        `[decisionAgents] Decision ${args.decisionId} not found or has no outcome`,
      );
      return;
    }

    await ctx.runMutation(internal.decisionAgents.updateExecutionStatus, {
      decisionId: args.decisionId,
      agentExecutionStatus: "running",
    });

    try {
      let result: string;

      // Check if the chosen action is "coordinate" — handle specially regardless of type
      const isCoordinate = decision.outcome?.action === "coordinate";

      if (isCoordinate) {
        result = await handleCoordinate(ctx, decision);
      } else {
        switch (decision.type) {
          case "pr_review":
            result = await handlePRReview(ctx, decision);
            break;
          case "ticket_triage":
          case "blocked_unblock":
            result = await handleLinearTicket(ctx, decision);
            break;
          case "question_answer":
            result = await postBotReply(ctx, decision, { alwaysPost: true });
            break;
          case "fact_verify":
          case "cross_team_ack":
          case "channel_summary":
            result = await postBotReply(ctx, decision, { alwaysPost: false });
            break;
          default:
            result = `No handler for decision type: ${decision.type}`;
        }
      }

      await ctx.runMutation(internal.decisionAgents.updateExecutionStatus, {
        decisionId: args.decisionId,
        agentExecutionStatus: "completed",
        agentExecutionResult: result,
      });
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : "Unknown error";
      console.error(
        `[decisionAgents] Failed to execute decision ${args.decisionId}:`,
        errorMsg,
      );

      await ctx.runMutation(internal.decisionAgents.updateExecutionStatus, {
        decisionId: args.decisionId,
        agentExecutionStatus: "failed",
        agentExecutionResult: errorMsg,
      });
    }
  },
});

// ─── Type-specific handlers ──────────────────────────────────────────────────

type ActionCtx = {
  runQuery: (ref: any, args: any) => Promise<any>;
  runMutation: (ref: any, args: any) => Promise<any>;
};

type DecisionDoc = {
  _id: any;
  userId: any;
  type: string;
  outcome?: {
    action: string;
    comment?: string;
    delegatedTo?: any;
    decidedAt: number;
  };
  sourceIntegrationObjectId?: any;
  sourceMessageId?: any;
  channelId?: any;
  workspaceId: any;
  title: string;
  summary: string;
  orgTrace?: Array<{
    userId?: any;
    name: string;
    role: string;
  }>;
  nextSteps?: Array<{
    actionKey: string;
    label: string;
    automated: boolean;
  }>;
};

async function handlePRReview(
  ctx: ActionCtx,
  decision: DecisionDoc,
): Promise<string> {
  if (!decision.sourceIntegrationObjectId) {
    return "No integration object linked; skipped PR action.";
  }

  const integrationObj = await ctx.runQuery(
    internal.decisionAgents.getIntegrationObject,
    { id: decision.sourceIntegrationObjectId },
  );
  if (!integrationObj) {
    return "Integration object not found.";
  }

  const meta = integrationObj.metadata as {
    repo?: string;
    owner?: string;
    number?: number;
  };
  if (!meta.owner || !meta.repo || !meta.number) {
    return "PR metadata incomplete; cannot execute GitHub action.";
  }

  const action = decision.outcome!.action;
  const comment = decision.outcome!.comment;

  try {
    if (action === "approve" || action === "request_changes") {
      // Review body carries the comment, so no separate issue comment needed
      await callCivicNexusTool("create_pull_request_review", {
        owner: meta.owner,
        repo: meta.repo,
        pull_number: meta.number,
        event: action === "approve" ? "APPROVE" : "REQUEST_CHANGES",
        body: comment ?? "",
      });
    } else if (comment) {
      await callCivicNexusTool("create_issue_comment", {
        owner: meta.owner,
        repo: meta.repo,
        issue_number: meta.number,
        body: comment,
      });
    }

    await closeCivicNexusClient();
    return `PR #${meta.number} action "${action}" executed successfully.`;
  } catch (err) {
    await closeCivicNexusClient();
    throw err;
  }
}

async function handleLinearTicket(
  ctx: ActionCtx,
  decision: DecisionDoc,
): Promise<string> {
  if (!decision.sourceIntegrationObjectId) {
    return "No integration object linked; skipped Linear action.";
  }

  const integrationObj = await ctx.runQuery(
    internal.decisionAgents.getIntegrationObject,
    { id: decision.sourceIntegrationObjectId },
  );
  if (!integrationObj) {
    return "Integration object not found.";
  }

  const action = decision.outcome!.action;
  const comment = decision.outcome!.comment;
  const issueId = integrationObj.externalId.replace("linear_", "");

  try {
    if (comment) {
      await callCivicNexusTool("create_comment", {
        issue_id: issueId,
        body: comment,
      });
    }

    if (action === "close" || action === "cancel") {
      await callCivicNexusTool("update_issue", {
        issue_id: issueId,
        state_name: action === "close" ? "Done" : "Cancelled",
      });
    }

    await closeCivicNexusClient();
    return `Linear issue ${issueId} action "${action}" executed successfully.`;
  } catch (err) {
    await closeCivicNexusClient();
    throw err;
  }
}

/**
 * Posts a bot message in the decision's channel. Used by question_answer,
 * fact_verify, cross_team_ack, and channel_summary decision types.
 *
 * For question_answer, always posts (falls back to action text).
 * For other types, only posts when the user provided a comment.
 */
async function postBotReply(
  ctx: ActionCtx,
  decision: DecisionDoc,
  options: { alwaysPost: boolean },
): Promise<string> {
  if (!decision.channelId) {
    return "No channel linked; skipped message post.";
  }

  const botUser = await ctx.runQuery(internal.bot.getBotUser, {
    workspaceId: decision.workspaceId,
  });
  if (!botUser) {
    return "No bot user found for workspace.";
  }

  const action = decision.outcome!.action;
  const comment = decision.outcome!.comment;
  const body = comment ?? (options.alwaysPost ? action : null);

  if (body) {
    await ctx.runMutation(internal.bot.insertBotMessage, {
      channelId: decision.channelId,
      authorId: botUser._id,
      body,
    });
    return `Posted "${action}" response in channel.`;
  }

  return `Decision "${action}" recorded (no channel message needed).`;
}

// ─── Coordinate handler: ticket + group conversation ────────────────────────

async function handleCoordinate(
  ctx: ActionCtx,
  decision: DecisionDoc,
): Promise<string> {
  const results: string[] = [];

  // 0. Get mrPING agent user — needed for both ticket and conversation
  const botUser = await ctx.runQuery(internal.decisionAgents.getMrPingUser, {
    workspaceId: decision.workspaceId,
  });

  // 1. Create a Linear ticket for tracking
  let ticketUrl: string | null = null;
  let ticketIdentifier: string | null = null;
  try {
    const ticketResult = await callCivicNexusTool("create_issue", {
      title: decision.title,
      description: [
        `**Decision:** ${decision.title}`,
        "",
        decision.summary,
        "",
        decision.outcome?.comment ? `> ${decision.outcome.comment}` : "",
        "",
        "**Stakeholders:**",
        ...(decision.orgTrace ?? []).map((p) => `- ${p.name} (${p.role})`),
        "",
        "*Created by mrPING from inbox decision.*",
      ]
        .filter(Boolean)
        .join("\n"),
      priority: decision.type === "blocked_unblock" ? 1 : 2,
    });

    // Parse ticket result for URL/identifier
    try {
      const parsed = JSON.parse(ticketResult);
      ticketUrl = parsed.url ?? null;
      ticketIdentifier = parsed.identifier ?? parsed.id ?? null;
    } catch {
      // Try to extract URL from plain text
      const urlMatch = ticketResult.match(/https:\/\/linear\.app\/[^\s]+/);
      if (urlMatch) ticketUrl = urlMatch[0];
      const idMatch = ticketResult.match(/[A-Z]+-\d+/);
      if (idMatch) ticketIdentifier = idMatch[0];
    }

    results.push(`Linear ticket created: ${ticketIdentifier ?? ticketResult}`);
    await closeCivicNexusClient();

    // Attach ticket link to the decision item
    if (ticketUrl) {
      await ctx.runMutation(internal.decisionAgents.addDecisionLink, {
        decisionId: decision._id,
        title: ticketIdentifier ? `${ticketIdentifier} — Linear` : "Linear ticket",
        url: ticketUrl,
        type: "other",
      });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    results.push(`Linear ticket creation failed: ${msg}`);
    try { await closeCivicNexusClient(); } catch { /* ignore */ }
  }

  // 2. Collect participant userIds from orgTrace with risk descriptions
  const participantIds: string[] = [];
  const riskMap: Array<{ name: string; risk: string }> = [];

  for (const person of decision.orgTrace ?? []) {
    if (person.userId) {
      participantIds.push(person.userId);
      const risk =
        person.role === "author"
          ? "owns the context"
          : person.role === "assignee"
            ? "delivery risk"
            : person.role === "mentioned"
              ? "may be impacted"
              : "consult for risk assessment";
      riskMap.push({ name: person.name, risk });
    }
  }

  // Add decision owner if not already included
  const ownerUser = await ctx.runQuery(internal.decisionAgents.getUser, {
    userId: decision.userId,
  });
  const ownerIncluded = participantIds.includes(decision.userId as string);
  if (!ownerIncluded) {
    participantIds.push(decision.userId as string);
    if (ownerUser) {
      riskMap.push({ name: ownerUser.name, risk: "decision owner — tracking" });
    }
  }

  if (participantIds.length === 0) {
    results.push("No participants with user IDs found; skipped conversation creation.");
    return results.join("\n");
  }

  // 3. Create group AI-aided conversation with mrPING
  const agentMemberIds = botUser ? [botUser._id] : [];

  const conversationId = await ctx.runMutation(
    internal.decisionAgents.createGroupConversation,
    {
      workspaceId: decision.workspaceId,
      createdBy: botUser?._id ?? decision.userId,
      name: decision.title,
      memberIds: participantIds,
      agentMemberIds,
    },
  );

  // 4. Post intro message as mrPING with @mentions and proper formatting
  const ticketLine = ticketUrl
    ? `**Tracking:** [${ticketIdentifier ?? "Linear ticket"}](${ticketUrl})`
    : ticketIdentifier
      ? `**Tracking:** ${ticketIdentifier}`
      : null;

  const stakeholderLines = riskMap
    .map((p) => `- @${p.name} — ${p.risk}`)
    .join("\n");

  const introMessage = [
    `**${decision.title}**`,
    "",
    decision.summary,
    "",
    ticketLine,
    "",
    "**Stakeholders & risk areas:**",
    stakeholderLines,
    "",
    `What should we tackle first?`,
  ]
    .filter((line) => line !== null)
    .join("\n");

  if (botUser) {
    await ctx.runMutation(internal.decisionAgents.sendGroupMessage, {
      conversationId,
      authorId: botUser._id,
      body: introMessage,
    });
  }

  results.push(`Group conversation created with ${participantIds.length} stakeholders.`);
  return results.join("\n");
}

// ─── Internal mutations for coordinate handler ──────────────────────────────

export const createGroupConversation = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    createdBy: v.id("users"),
    name: v.string(),
    memberIds: v.array(v.string()),
    agentMemberIds: v.array(v.id("users")),
  },
  handler: async (ctx, args) => {
    const conversationId = await ctx.db.insert("directConversations", {
      workspaceId: args.workspaceId,
      kind: "agent_group",
      name: args.name,
      createdBy: args.createdBy,
      isArchived: false,
    });

    const addedUserIds = new Set<string>();

    // Add agent members
    for (const agentId of args.agentMemberIds) {
      if (addedUserIds.has(agentId)) continue;
      await ctx.db.insert("directConversationMembers", {
        conversationId,
        userId: agentId,
        isAgent: true,
      });
      addedUserIds.add(agentId);
    }

    // Add human members
    for (const memberId of args.memberIds) {
      if (addedUserIds.has(memberId)) continue;
      await ctx.db.insert("directConversationMembers", {
        conversationId,
        userId: memberId as any,
        isAgent: false,
      });
      addedUserIds.add(memberId);
    }

    return conversationId;
  },
});

export const sendGroupMessage = internalMutation({
  args: {
    conversationId: v.id("directConversations"),
    authorId: v.id("users"),
    body: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("directMessages", {
      conversationId: args.conversationId,
      authorId: args.authorId,
      body: args.body,
      type: "bot",
      isEdited: false,
    });
  },
});

export const addDecisionLink = internalMutation({
  args: {
    decisionId: v.id("inboxItems"),
    title: v.string(),
    url: v.string(),
    type: v.union(v.literal("doc"), v.literal("sheet"), v.literal("video"), v.literal("pr"), v.literal("other")),
  },
  handler: async (ctx, args) => {
    const item = await ctx.db.get(args.decisionId);
    if (!item) return;
    const existingLinks = item.links ?? [];
    await ctx.db.patch(args.decisionId, {
      links: [...existingLinks, { title: args.title, url: args.url, type: args.type }],
    });
  },
});

export const getMrPingUser = internalQuery({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const agent = await ctx.db
      .query("agents")
      .withIndex("by_managed_slug", (q) => q.eq("managedSlug", "mr-ping"))
      .filter((q) => q.eq(q.field("workspaceId"), args.workspaceId))
      .first();
    if (!agent?.agentUserId) return null;
    return await ctx.db.get(agent.agentUserId);
  },
});

export const getUser = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.userId);
  },
});

// ─── Internal queries for agent use ──────────────────────────────────────────

export const getIntegrationObject = internalQuery({
  args: { id: v.id("integrationObjects") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});
