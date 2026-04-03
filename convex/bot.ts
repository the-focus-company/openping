import { internalAction, internalQuery, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

export const getConversationContext = internalQuery({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) return null;
    return {
      conversationName: conversation.name ?? "Conversation",
      workspaceId: conversation.workspaceId,
      kind: conversation.kind,
    };
  },
});

export const getBotUser = internalQuery({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const adminMembership = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .filter((q) => q.eq(q.field("role"), "admin"))
      .first();

    if (!adminMembership) return null;

    return ctx.db.get(adminMembership.userId);
  },
});

export const insertBotMessage = internalMutation({
  args: {
    conversationId: v.id("conversations"),
    authorId: v.id("users"),
    body: v.string(),
    citations: v.optional(
      v.array(
        v.object({
          text: v.string(),
          sourceUrl: v.optional(v.string()),
          sourceTitle: v.optional(v.string()),
        }),
      ),
    ),
  },
  handler: async (ctx, args) => {
    const messageId = await ctx.db.insert("messages", {
      conversationId: args.conversationId,
      authorId: args.authorId,
      body: args.body,
      type: "bot",
      isEdited: false,
      citations: args.citations,
    });

    // Ingest bot message into knowledge graph
    await ctx.scheduler.runAfter(0, internal.ingest.processMessage, {
      messageId,
    });
  },
});

export const respond = internalAction({
  args: {
    conversationId: v.id("conversations"),
    query: v.string(),
    triggerMessageId: v.id("messages"),
  },
  handler: async (ctx, args) => {
    const graphitiUrl =
      process.env.GRAPHITI_API_URL ?? "http://localhost:8000";
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.error("[bot] OPENAI_API_KEY not set");
      return;
    }

    const convCtx = await ctx.runQuery(internal.bot.getConversationContext, {
      conversationId: args.conversationId,
    });
    if (!convCtx) return;

    const botUser = await ctx.runQuery(internal.bot.getBotUser, {
      workspaceId: convCtx.workspaceId,
    });
    if (!botUser) return;

    // 1. Search Graphiti for relevant facts
    const searchResponse = await fetch(`${graphitiUrl}/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        group_ids: [args.conversationId],
        query: args.query,
        max_facts: 10,
      }),
    });

    let facts: Array<{ uuid: string; name: string; fact: string; valid_at: string | null; invalid_at: string | null }> = [];
    if (searchResponse.ok) {
      const data = await searchResponse.json();
      facts = data.facts ?? [];
    } else {
      console.warn(`[bot] Graphiti search failed: ${searchResponse.status}`);
    }

    // 2. Generate cited answer via OpenAI
    const factsContext =
      facts.length > 0
        ? facts
            .map(
              (f, i) =>
                `[${i + 1}] ${f.fact}${f.valid_at ? ` (as of ${f.valid_at})` : ""}${f.invalid_at ? ` [superseded]` : ""}`,
            )
            .join("\n")
        : "No relevant facts found in the knowledge graph.";

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
            role: "system",
            content: `You are mrPING for the ${convCtx.conversationName} conversation. Answer questions using ONLY the provided facts from the knowledge graph. Cite facts using [n] notation. If no facts are relevant, say you don't have enough context.`,
          },
          {
            role: "user",
            content: `Question: ${args.query}\n\nKnowledge graph facts:\n${factsContext}`,
          },
        ],
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      console.error(`[bot] OpenAI failed: ${response.status}`);
      return;
    }

    const data = await response.json();
    const answer = data.choices[0]?.message?.content ?? "Sorry, I couldn't generate a response.";

    // 3. Build citations from referenced facts
    const citedIndices = [...answer.matchAll(/\[(\d+)\]/g)].map(
      (m: RegExpMatchArray) => parseInt(m[1], 10) - 1,
    );
    const citations = citedIndices
      .filter((i: number) => i >= 0 && i < facts.length)
      .map((i: number) => ({
        text: facts[i].fact,
        sourceTitle: facts[i].name,
      }));

    // 4. Insert bot message
    await ctx.runMutation(internal.bot.insertBotMessage, {
      conversationId: args.conversationId,
      authorId: botUser._id,
      body: answer,
      citations: citations.length > 0 ? citations : undefined,
    });
  },
});

// ── DM bot support ─────────────────────────────────────────────────

export const respondDM = internalAction({
  args: {
    conversationId: v.id("conversations"),
    query: v.string(),
    triggerMessageId: v.id("messages"),
    triggerUserId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const graphitiUrl =
      process.env.GRAPHITI_API_URL ?? "http://localhost:8000";
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.error("[bot] OPENAI_API_KEY not set");
      return;
    }

    const convCtx = await ctx.runQuery(
      internal.bot.getConversationContext,
      { conversationId: args.conversationId },
    );
    if (!convCtx) return;

    const botUser = await ctx.runQuery(internal.bot.getBotUser, {
      workspaceId: convCtx.workspaceId,
    });
    if (!botUser) return;

    // Build group_ids — DM-scoped by default
    const groupIds: string[] = [`dm-${args.conversationId}`];

    // For agent conversations, expand search to user's conversation memberships
    if (convCtx.kind === "agent_1to1" || convCtx.kind === "agent_group") {
      const conversationIds = await ctx.runQuery(
        internal.bot.getUserConversationIds,
        { userId: args.triggerUserId },
      );
      groupIds.push(...conversationIds);
    }

    // 1. Search Graphiti for relevant facts
    const searchResponse = await fetch(`${graphitiUrl}/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        group_ids: groupIds,
        query: args.query,
        max_facts: 10,
      }),
    });

    let facts: Array<{
      uuid: string;
      name: string;
      fact: string;
      valid_at: string | null;
      invalid_at: string | null;
    }> = [];
    if (searchResponse.ok) {
      const data = await searchResponse.json();
      facts = data.facts ?? [];
    } else {
      console.warn(`[bot] Graphiti search failed: ${searchResponse.status}`);
    }

    // 2. Generate cited answer via OpenAI
    const factsContext =
      facts.length > 0
        ? facts
            .map(
              (f, i) =>
                `[${i + 1}] ${f.fact}${f.valid_at ? ` (as of ${f.valid_at})` : ""}${f.invalid_at ? ` [superseded]` : ""}`,
            )
            .join("\n")
        : "No relevant facts found in the knowledge graph.";

    const response = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-5.4-nano",
          messages: [
            {
              role: "system",
              content: `You are mrPING in a direct message conversation. Answer questions using ONLY the provided facts from the knowledge graph. Cite facts using [n] notation. If no facts are relevant, say you don't have enough context.`,
            },
            {
              role: "user",
              content: `Question: ${args.query}\n\nKnowledge graph facts:\n${factsContext}`,
            },
          ],
          temperature: 0.2,
        }),
      },
    );

    if (!response.ok) {
      console.error(`[bot] OpenAI failed: ${response.status}`);
      return;
    }

    const data = await response.json();
    const answer =
      data.choices[0]?.message?.content ??
      "Sorry, I couldn't generate a response.";

    // 3. Build citations from referenced facts
    const citedIndices = [...answer.matchAll(/\[(\d+)\]/g)].map(
      (m: RegExpMatchArray) => parseInt(m[1], 10) - 1,
    );
    const citations = citedIndices
      .filter((i: number) => i >= 0 && i < facts.length)
      .map((i: number) => ({
        text: facts[i].fact,
        sourceTitle: facts[i].name,
      }));

    // 4. Insert bot message
    await ctx.runMutation(internal.bot.insertBotMessage, {
      conversationId: args.conversationId,
      authorId: botUser._id,
      body: answer,
      citations: citations.length > 0 ? citations : undefined,
    });
  },
});

export const getUserConversationIds = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const memberships = await ctx.db
      .query("conversationMembers")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    return memberships.map((m) => m.conversationId as string);
  },
});
