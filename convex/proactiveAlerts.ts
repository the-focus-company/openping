import { internalAction, internalQuery, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

// ─── Alert type → inbox item type mapping ────────────────────────────────────

const ALERT_TYPE_TO_ITEM_TYPE: Record<string, string> = {
  fact_check: "fact_verify",
  cross_team_sync: "cross_team_ack",
  unanswered_question: "question_answer",
  pr_review_nudge: "pr_review",
  blocked_task: "blocked_unblock",
  incident_route: "ticket_triage",
};

function alertToCategory(alertType: string, priority: string): "do" | "decide" | "delegate" | "skip" {
  if (priority === "high") return "do";
  if (alertType === "cross_team_sync" || alertType === "fact_check") return "skip";
  if (priority === "medium") return "decide";
  return "skip";
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

export const getRecentConversationMessages = internalQuery({
  args: {
    since: v.number(),
    limit: v.number(),
  },
  handler: async (ctx, args) => {
    const channels = await ctx.db
      .query("conversations")
      .filter((q) => q.eq(q.field("isArchived"), false))
      .take(50);

    const result: Array<{
      messageId: Id<"messages">;
      conversationId: Id<"conversations">;
      conversationName: string;
      workspaceId: Id<"workspaces">;
      body: string;
      authorId: Id<"users">;
      authorName: string;
      createdAt: number;
    }> = [];

    for (const channel of channels) {
      const messages = await ctx.db
        .query("messages")
        .withIndex("by_conversation", (q) => q.eq("conversationId", channel._id))
        .filter((q) =>
          q.and(
            q.gte(q.field("_creationTime"), args.since),
            q.eq(q.field("type"), "user"),
          ),
        )
        .take(args.limit);

      for (const msg of messages) {
        const author = await ctx.db.get(msg.authorId);
        result.push({
          messageId: msg._id,
          conversationId: channel._id,
          conversationName: channel.name ?? "Conversation",
          workspaceId: channel.workspaceId,
          body: msg.body,
          authorId: msg.authorId,
          authorName: author?.name ?? "Unknown",
          createdAt: msg._creationTime,
        });
      }
    }

    return result;
  },
});

export const getConversationMembers = internalQuery({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("conversationMembers")
      .withIndex("by_conversation", (q) => q.eq("conversationId", args.conversationId))
      .take(1000);

    return Promise.all(
      rows.map(async (r) => {
        const user = await ctx.db.get(r.userId);
        return user
          ? { _id: user._id, name: user.name }
          : null;
      }),
    ).then((users) => users.filter(Boolean) as Array<{ _id: Id<"users">; name: string }>);
  },
});

export const countRecentItems = internalQuery({
  args: {
    conversationId: v.id("conversations"),
    type: v.string(),
    since: v.number(),
  },
  handler: async (ctx, args) => {
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) return 0;

    const items = await ctx.db
      .query("inboxItems")
      .withIndex("by_workspace_type", (q) =>
        q.eq("workspaceId", conversation.workspaceId).eq("type", args.type as any),
      )
      .filter((q) =>
        q.and(
          q.eq(q.field("conversationId"), args.conversationId),
          q.gte(q.field("createdAt"), args.since),
        ),
      )
      .take(100);
    return items.length;
  },
});

export const insertBotMessage = internalMutation({
  args: {
    conversationId: v.id("conversations"),
    authorId: v.id("users"),
    body: v.string(),
  },
  handler: async (ctx, args) => {
    const messageId = await ctx.db.insert("messages", {
      conversationId: args.conversationId,
      authorId: args.authorId,
      body: args.body,
      type: "bot",
      isEdited: false,
    });

    await ctx.scheduler.runAfter(0, internal.ingest.processMessage, {
      messageId,
    });
  },
});

export const getWorkspaceBotUser = internalQuery({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const membership = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .filter((q) => q.eq(q.field("role"), "admin"))
      .first();
    if (!membership) return null;
    return await ctx.db.get(membership.userId);
  },
});

// ─── Fact-checking agent ────────────────────────────────────────────

async function detectFactualClaims(
  messages: Array<{ body: string; authorName: string; messageId: string }>,
): Promise<Array<{ messageIndex: number; claim: string }>> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return [];

  const messageText = messages
    .map((m, i) => `[${i}] ${m.authorName}: ${m.body}`)
    .join("\n");

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-5.4-nano",
      messages: [
        {
          role: "user",
          content: `Identify messages that make factual claims about past decisions, technical choices, or historical events (e.g. "We never tried X", "This was decided last month", "We always do Y").

Messages:
${messageText}

Respond with JSON only:
{"claims": [{"messageIndex": 0, "claim": "extracted claim text"}]}

Only include messages with clear factual claims, not opinions or questions. Return empty array if none found.`,
        },
      ],
      temperature: 0.1,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) return [];
  const data = await response.json();
  const raw = JSON.parse(data.choices[0].message.content);
  return raw.claims ?? [];
}

async function checkClaimAgainstKnowledge(
  claim: string,
): Promise<{ contradiction: string | null; confidence: number }> {
  const graphitiUrl = process.env.GRAPHITI_API_URL ?? "http://localhost:8000";
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return { contradiction: null, confidence: 0 };

  const searchController = new AbortController();
  const searchTimeoutId = setTimeout(() => searchController.abort(), 10000);
  let searchResponse: Response;
  try {
    searchResponse = await fetch(`${graphitiUrl}/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: claim, max_facts: 5 }),
      signal: searchController.signal,
    });
  } catch {
    clearTimeout(searchTimeoutId);
    return { contradiction: null, confidence: 0 };
  }
  clearTimeout(searchTimeoutId);

  if (!searchResponse.ok) {
    console.error(`[fact-check] Graphiti search failed: ${searchResponse.status}`);
    return { contradiction: null, confidence: 0 };
  }

  const searchData = await searchResponse.json();
  const facts: Array<{ uuid: string; name: string; fact: string; valid_at: string | null; invalid_at: string | null }> =
    searchData?.facts ?? [];
  if (facts.length === 0) return { contradiction: null, confidence: 0 };

  const factsText = facts
    .map((f, i) => `[${i}] ${f.fact}${f.invalid_at ? " [superseded]" : ""}`)
    .join("\n");

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-5.4-nano",
      messages: [
        {
          role: "user",
          content: `You are a fact-checker. Given a claim and a set of known facts from a knowledge graph, determine if any fact directly contradicts the claim.

Claim: "${claim}"

Known facts:
${factsText}

Respond with JSON only:
{"contradiction": "one sentence describing the contradiction, or null if no contradiction", "confidence": 0.0}

confidence should be 0.0–1.0 reflecting how clearly the facts contradict the claim. Return null contradiction if there is no clear contradiction.`,
        },
      ],
      temperature: 0.1,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) return { contradiction: null, confidence: 0 };

  const data = await response.json();
  const raw = JSON.parse(data.choices[0].message.content);
  return {
    contradiction: raw.contradiction ?? null,
    confidence: typeof raw.confidence === "number" ? raw.confidence : 0,
  };
}

export const scanForFactChecks = internalAction({
  args: {},
  handler: async (ctx) => {
    const since = Date.now() - 10 * 60 * 1000;
    const hourAgo = Date.now() - 60 * 60 * 1000;
    const MAX_PER_CHANNEL_PER_HOUR = 2;

    const messages = await ctx.runQuery(internal.proactiveAlerts.getRecentConversationMessages, {
      since,
      limit: 20,
    });

    const byConversation = new Map<
      string,
      Array<{ body: string; authorName: string; messageId: string; conversationId: Id<"conversations">; conversationName: string; workspaceId: Id<"workspaces"> }>
    >();

    for (const msg of messages) {
      const key = msg.conversationId as string;
      if (!byConversation.has(key)) byConversation.set(key, []);
      byConversation.get(key)!.push({
        body: msg.body,
        authorName: msg.authorName,
        messageId: msg.messageId as string,
        conversationId: msg.conversationId,
        conversationName: msg.conversationName,
        workspaceId: msg.workspaceId,
      });
    }

    for (const [, conversationMessages] of byConversation) {
      const { conversationId, workspaceId } = conversationMessages[0];

      const recentCount = await ctx.runQuery(internal.proactiveAlerts.countRecentItems, {
        conversationId,
        type: "fact_verify",
        since: hourAgo,
      });
      if (recentCount >= MAX_PER_CHANNEL_PER_HOUR) continue;

      const claims = await detectFactualClaims(conversationMessages);

      for (const { messageIndex, claim } of claims) {
        const { contradiction, confidence } = await checkClaimAgainstKnowledge(claim);
        if (!contradiction || confidence < 0.85) continue;

        const members = await ctx.runQuery(internal.proactiveAlerts.getConversationMembers, {
          conversationId,
        });
        if (members.length === 0) continue;

        const botUser = await ctx.runQuery(internal.proactiveAlerts.getWorkspaceBotUser, {
          workspaceId,
        });
        if (!botUser) continue;

        await ctx.runMutation(internal.proactiveAlerts.insertBotMessage, {
          conversationId,
          authorId: botUser._id,
          body: `Worth noting: ${contradiction}`,
        });

        for (const member of members) {
          await ctx.runMutation(internal.inboxItems.insertItem, {
            userId: member._id,
            workspaceId,
            type: "fact_verify",
            category: "skip",
            title: "Fact check",
            summary: `A claim was made that may contradict known information: "${claim}"`,
            pingWillDo: "Review the context in this channel",
            sourceMessageId: conversationMessages[messageIndex]?.messageId as Id<"messages"> | undefined,
            conversationId,
          });
        }

        break;
      }
    }
  },
});

// ─── Cross-team context syncing agent ───────────────────────────────

interface CrossTeamMatch {
  summary: string;
  sourceConversationIndex: number;
  targetConversationIndices: number[];
}

async function detectCrossTeamRelevance(
  conversationSummaries: Array<{ conversationName: string; messages: string[] }>,
): Promise<CrossTeamMatch[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return [];

  const input = conversationSummaries
    .map((c, i) => `[Channel ${i} #${c.conversationName}]:\n${c.messages.slice(-5).join("\n")}`)
    .join("\n\n");

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-5.4-nano",
      messages: [
        {
          role: "user",
          content: `You are analyzing messages across multiple channels to find cross-team relevance.

${input}

Identify decisions, announcements, or status changes in one channel that other channels should know about.
Examples: API changes relevant to frontend, deadline changes relevant to engineering, deployment notices relevant to dev channels.

Respond with JSON only:
{"matches": [{"summary": "brief description of what's relevant", "sourceConversationIndex": 0, "targetConversationIndices": [1, 2]}]}

Return empty array if nothing is cross-team relevant.`,
        },
      ],
      temperature: 0.2,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) return [];
  const data = await response.json();
  const raw = JSON.parse(data.choices[0].message.content);
  return raw.matches ?? [];
}

export const scanCrossTeamSync = internalAction({
  args: {},
  handler: async (ctx) => {
    const since = Date.now() - 15 * 60 * 1000;
    const hourAgo = Date.now() - 60 * 60 * 1000;
    const MAX_PER_CHANNEL_PER_HOUR = 3;

    const messages = await ctx.runQuery(internal.proactiveAlerts.getRecentConversationMessages, {
      since,
      limit: 20,
    });

    if (messages.length === 0) return;

    const conversationMap = new Map<
      string,
      { conversationId: Id<"conversations">; conversationName: string; workspaceId: Id<"workspaces">; messages: string[] }
    >();

    for (const msg of messages) {
      const key = msg.conversationId as string;
      if (!conversationMap.has(key)) {
        conversationMap.set(key, {
          conversationId: msg.conversationId,
          conversationName: msg.conversationName,
          workspaceId: msg.workspaceId,
          messages: [],
        });
      }
      conversationMap.get(key)!.messages.push(`[${msg.authorName}]: ${msg.body}`);
    }

    const channels = Array.from(conversationMap.values());
    if (channels.length < 2) return;

    const conversationSummaries = channels.map((c) => ({
      conversationName: c.conversationName,
      messages: c.messages,
    }));

    const matches = await detectCrossTeamRelevance(conversationSummaries);

    for (const match of matches) {
      const sourceConversation = channels[match.sourceConversationIndex];
      if (!sourceConversation) continue;

      for (const targetIdx of match.targetConversationIndices) {
        const targetConversation = channels[targetIdx];
        if (!targetConversation) continue;

        const recentCount = await ctx.runQuery(internal.proactiveAlerts.countRecentItems, {
          conversationId: targetConversation.conversationId,
          type: "cross_team_ack",
          since: hourAgo,
        });
        if (recentCount >= MAX_PER_CHANNEL_PER_HOUR) continue;

        const members = await ctx.runQuery(internal.proactiveAlerts.getConversationMembers, {
          conversationId: targetConversation.conversationId,
        });
        if (members.length === 0) continue;

        const botUser = await ctx.runQuery(internal.proactiveAlerts.getWorkspaceBotUser, {
          workspaceId: targetConversation.workspaceId,
        });
        if (!botUser) continue;

        await ctx.runMutation(internal.proactiveAlerts.insertBotMessage, {
          conversationId: targetConversation.conversationId,
          authorId: botUser._id,
          body: `FYI from #${sourceConversation.conversationName}: ${match.summary}`,
        });

        for (const member of members) {
          await ctx.runMutation(internal.inboxItems.insertItem, {
            userId: member._id,
            workspaceId: targetConversation.workspaceId,
            type: "cross_team_ack",
            category: "skip",
            title: `Update from #${sourceConversation.conversationName}`,
            summary: match.summary,
            pingWillDo: `Check #${sourceConversation.conversationName} for details`,
            conversationId: targetConversation.conversationId,
          });
        }
      }
    }
  },
});
