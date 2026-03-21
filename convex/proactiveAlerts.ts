import { query, mutation, internalAction, internalQuery, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { requireUser } from "./auth";

// ─── Public queries / mutations ───────────────────────────────────────────────

export const listPending = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);

    const alerts = await ctx.db
      .query("proactiveAlerts")
      .withIndex("by_user_status", (q) =>
        q.eq("userId", user._id).eq("status", "pending"),
      )
      .take(10);

    return alerts.filter((alert) => alert.expiresAt > Date.now());
  },
});

export const dismiss = mutation({
  args: { alertId: v.id("proactiveAlerts") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const alert = await ctx.db.get(args.alertId);
    if (!alert || alert.userId !== user._id) {
      throw new Error("Not found");
    }
    await ctx.db.patch(args.alertId, { status: "dismissed" });
  },
});

// ─── Internal helpers ─────────────────────────────────────────────────────────

export const getRecentChannelMessages = internalQuery({
  args: {
    since: v.number(),
    limit: v.number(),
  },
  handler: async (ctx, args) => {
    const channels = await ctx.db
      .query("channels")
      .filter((q) => q.eq(q.field("isArchived"), false))
      .take(50);

    const result: Array<{
      messageId: Id<"messages">;
      channelId: Id<"channels">;
      channelName: string;
      workspaceId: Id<"workspaces">;
      body: string;
      authorId: Id<"users">;
      authorName: string;
      createdAt: number;
    }> = [];

    for (const channel of channels) {
      const messages = await ctx.db
        .query("messages")
        .withIndex("by_channel", (q) => q.eq("channelId", channel._id))
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
          channelId: channel._id,
          channelName: channel.name,
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

export const getChannelMembers = internalQuery({
  args: { channelId: v.id("channels") },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("channelMembers")
      .withIndex("by_channel", (q) => q.eq("channelId", args.channelId))
      .collect();

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

export const countRecentAlerts = internalQuery({
  args: {
    channelId: v.id("channels"),
    type: v.string(),
    since: v.number(),
  },
  handler: async (ctx, args) => {
    const channel = await ctx.db.get(args.channelId);
    if (!channel) return 0;

    const alerts = await ctx.db
      .query("proactiveAlerts")
      .withIndex("by_workspace_type", (q) =>
        q.eq("workspaceId", channel.workspaceId).eq("type", args.type as any),
      )
      .filter((q) =>
        q.and(
          q.eq(q.field("channelId"), args.channelId),
          q.gte(q.field("createdAt"), args.since),
        ),
      )
      .take(100);
    return alerts.length;
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
      v.literal("fact_check"),
      v.literal("cross_team_sync"),
    ),
    channelId: v.id("channels"),
    sourceChannelId: v.optional(v.id("channels")),
    title: v.string(),
    body: v.string(),
    sourceMessageId: v.optional(v.id("messages")),
    suggestedAction: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    await ctx.db.insert("proactiveAlerts", {
      userId: args.userId,
      workspaceId: args.workspaceId,
      type: args.type,
      channelId: args.channelId,
      sourceChannelId: args.sourceChannelId,
      title: args.title,
      body: args.body,
      sourceMessageId: args.sourceMessageId,
      suggestedAction: args.suggestedAction,
      priority: "high",
      status: "pending",
      expiresAt: now + 24 * 60 * 60 * 1000,
      createdAt: now,
    });
  },
});

export const insertBotMessage = internalMutation({
  args: {
    channelId: v.id("channels"),
    authorId: v.id("users"),
    body: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("messages", {
      channelId: args.channelId,
      authorId: args.authorId,
      body: args.body,
      type: "bot",
      isEdited: false,
    });
  },
});

export const getWorkspaceBotUser = internalQuery({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    // Find the first admin user as the bot author fallback
    const membership = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .filter((q) => q.eq(q.field("role"), "admin"))
      .first();
    if (!membership) return null;
    return await ctx.db.get(membership.userId);
  },
});

// ─── Fact-checking agent (8LI-94) ────────────────────────────────────────────

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

  // Search the Graphiti knowledge graph for facts related to this claim
  const searchResponse = await fetch(`${graphitiUrl}/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: claim, max_facts: 5 }),
  });

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

  // Ask GPT whether any retrieved fact contradicts the claim
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
    const since = Date.now() - 10 * 60 * 1000; // last 10 min
    const hourAgo = Date.now() - 60 * 60 * 1000;
    const MAX_PER_CHANNEL_PER_HOUR = 2;

    const messages = await ctx.runQuery(internal.proactiveAlerts.getRecentChannelMessages, {
      since,
      limit: 20,
    });

    // Group by channel
    const byChannel = new Map<
      string,
      Array<{ body: string; authorName: string; messageId: string; channelId: Id<"channels">; channelName: string; workspaceId: Id<"workspaces"> }>
    >();

    for (const msg of messages) {
      const key = msg.channelId as string;
      if (!byChannel.has(key)) byChannel.set(key, []);
      byChannel.get(key)!.push({
        body: msg.body,
        authorName: msg.authorName,
        messageId: msg.messageId as string,
        channelId: msg.channelId,
        channelName: msg.channelName,
        workspaceId: msg.workspaceId,
      });
    }

    for (const [, channelMessages] of byChannel) {
      const { channelId, workspaceId } = channelMessages[0];

      // Guard: max 2 fact-checks per channel per hour
      const recentCount = await ctx.runQuery(internal.proactiveAlerts.countRecentAlerts, {
        channelId,
        type: "fact_check",
        since: hourAgo,
      });
      if (recentCount >= MAX_PER_CHANNEL_PER_HOUR) continue;

      const claims = await detectFactualClaims(channelMessages);

      for (const { messageIndex, claim } of claims) {
        const { contradiction, confidence } = await checkClaimAgainstKnowledge(claim);
        if (!contradiction || confidence < 0.85) continue;

        const members = await ctx.runQuery(internal.proactiveAlerts.getChannelMembers, {
          channelId,
        });
        if (members.length === 0) continue;

        const botUser = await ctx.runQuery(internal.proactiveAlerts.getWorkspaceBotUser, {
          workspaceId,
        });
        if (!botUser) continue;

        // Post bot message in channel
        await ctx.runMutation(internal.proactiveAlerts.insertBotMessage, {
          channelId,
          authorId: botUser._id,
          body: `Worth noting: ${contradiction}`,
        });

        // Create alert for each channel member
        for (const member of members) {
          await ctx.runMutation(internal.proactiveAlerts.createAlert, {
            userId: member._id,
            workspaceId,
            type: "fact_check",
            channelId,
            title: "Fact check",
            body: `A claim was made that may contradict known information: "${claim}"`,
            sourceMessageId: channelMessages[messageIndex]?.messageId as Id<"messages"> | undefined,
            suggestedAction: "Review the context in this channel",
          });
        }

        break; // one fact-check per channel per scan to stay within rate limit
      }
    }
  },
});

// ─── Cross-team context syncing agent (8LI-95) ───────────────────────────────

interface CrossTeamMatch {
  summary: string;
  sourceChannelIndex: number;
  targetChannelIndices: number[];
}

async function detectCrossTeamRelevance(
  channelSummaries: Array<{ channelName: string; messages: string[] }>,
): Promise<CrossTeamMatch[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return [];

  const input = channelSummaries
    .map((c, i) => `[Channel ${i} #${c.channelName}]:\n${c.messages.slice(-5).join("\n")}`)
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
{"matches": [{"summary": "brief description of what's relevant", "sourceChannelIndex": 0, "targetChannelIndices": [1, 2]}]}

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
    const since = Date.now() - 15 * 60 * 1000; // last 15 min
    const hourAgo = Date.now() - 60 * 60 * 1000;
    const MAX_PER_CHANNEL_PER_HOUR = 3;

    const messages = await ctx.runQuery(internal.proactiveAlerts.getRecentChannelMessages, {
      since,
      limit: 20,
    });

    if (messages.length === 0) return;

    // Build per-channel message lists
    const channelMap = new Map<
      string,
      { channelId: Id<"channels">; channelName: string; workspaceId: Id<"workspaces">; messages: string[] }
    >();

    for (const msg of messages) {
      const key = msg.channelId as string;
      if (!channelMap.has(key)) {
        channelMap.set(key, {
          channelId: msg.channelId,
          channelName: msg.channelName,
          workspaceId: msg.workspaceId,
          messages: [],
        });
      }
      channelMap.get(key)!.messages.push(`[${msg.authorName}]: ${msg.body}`);
    }

    const channels = Array.from(channelMap.values());
    if (channels.length < 2) return;

    const channelSummaries = channels.map((c) => ({
      channelName: c.channelName,
      messages: c.messages,
    }));

    const matches = await detectCrossTeamRelevance(channelSummaries);

    for (const match of matches) {
      const sourceChannel = channels[match.sourceChannelIndex];
      if (!sourceChannel) continue;

      for (const targetIdx of match.targetChannelIndices) {
        const targetChannel = channels[targetIdx];
        if (!targetChannel) continue;

        // Guard: max 3 cross-team syncs per target channel per hour
        const recentCount = await ctx.runQuery(internal.proactiveAlerts.countRecentAlerts, {
          channelId: targetChannel.channelId,
          type: "cross_team_sync",
          since: hourAgo,
        });
        if (recentCount >= MAX_PER_CHANNEL_PER_HOUR) continue;

        const members = await ctx.runQuery(internal.proactiveAlerts.getChannelMembers, {
          channelId: targetChannel.channelId,
        });
        if (members.length === 0) continue;

        const botUser = await ctx.runQuery(internal.proactiveAlerts.getWorkspaceBotUser, {
          workspaceId: targetChannel.workspaceId,
        });
        if (!botUser) continue;

        // Post system message in target channel
        await ctx.runMutation(internal.proactiveAlerts.insertBotMessage, {
          channelId: targetChannel.channelId,
          authorId: botUser._id,
          body: `FYI from #${sourceChannel.channelName}: ${match.summary}`,
        });

        // Create alert for each target channel member
        for (const member of members) {
          await ctx.runMutation(internal.proactiveAlerts.createAlert, {
            userId: member._id,
            workspaceId: targetChannel.workspaceId,
            type: "cross_team_sync",
            channelId: targetChannel.channelId,
            sourceChannelId: sourceChannel.channelId,
            title: `Update from #${sourceChannel.channelName}`,
            body: match.summary,
            suggestedAction: `Check #${sourceChannel.channelName} for details`,
          });
        }
      }
    }
  },
});
