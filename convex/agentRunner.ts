import { internalAction, internalQuery, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

// ── Helpers ─────────────────────────────────────────────────────────

export const getAgentWithContext = internalQuery({
  args: { agentId: v.id("agents") },
  handler: async (ctx, args) => {
    const agent = await ctx.db.get(args.agentId);
    if (!agent) return null;
    const workspace = await ctx.db.get(agent.workspaceId);
    return {
      agent,
      workspaceName: workspace?.name ?? "workspace",
    };
  },
});

export const getRecentChannelMessages = internalQuery({
  args: {
    channelId: v.id("conversations"),
    limit: v.number(),
  },
  handler: async (ctx, args) => {
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) => q.eq("conversationId", args.channelId))
      .order("desc")
      .take(args.limit);

    const enriched = await Promise.all(
      messages.map(async (msg) => {
        const author = await ctx.db.get(msg.authorId);
        return {
          role: msg.type === "bot" ? ("assistant" as const) : ("user" as const),
          content: `${author?.name ?? "Unknown"}: ${msg.body}`,
        };
      }),
    );

    return enriched.reverse();
  },
});

export const getRecentDMMessages = internalQuery({
  args: {
    conversationId: v.id("conversations"),
    limit: v.number(),
  },
  handler: async (ctx, args) => {
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) =>
        q.eq("conversationId", args.conversationId),
      )
      .order("desc")
      .take(args.limit);

    const enriched = await Promise.all(
      messages.map(async (msg) => {
        const author = await ctx.db.get(msg.authorId);
        return {
          role: msg.type === "bot" ? ("assistant" as const) : ("user" as const),
          content: `${author?.name ?? "Unknown"}: ${msg.body}`,
        };
      }),
    );

    return enriched.reverse();
  },
});

export const updateLastActive = internalMutation({
  args: { agentId: v.id("agents") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.agentId, { lastActiveAt: Date.now() });
  },
});

export const getWorkspaceIntegrations = internalQuery({
  args: {
    workspaceId: v.id("workspaces"),
    query: v.string(),
    limit: v.number(),
  },
  handler: async (ctx, args) => {
    const allObjects = await ctx.db
      .query("integrationObjects")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .order("desc")
      .take(200);

    if (allObjects.length === 0) return [];

    // Extract identifiers and keywords from the query
    const queryLower = args.query.toLowerCase();
    // Match ticket IDs like "8LI-270", "PROJ-123", PR "#847"
    const idPatterns = args.query.match(/[A-Z]+-\d+|#\d+/gi) ?? [];
    // Extract meaningful words (3+ chars, skip stop words)
    const stopWords = new Set(["the", "what", "are", "how", "can", "has", "was", "for", "and", "that", "this", "with", "from", "about", "other", "same", "project", "tickets", "ticket"]);
    const keywords = args.query
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .split(/\s+/)
      .filter((w) => w.length >= 3 && !stopWords.has(w));

    // Score each integration object by relevance
    const scored = allObjects.map((o) => {
      let score = 0;
      const extLower = o.externalId.toLowerCase();
      const titleLower = o.title.toLowerCase();
      const meta = o.metadata as Record<string, unknown> | null;
      const projectName = (typeof meta?.projectName === "string" ? meta.projectName : "").toLowerCase();

      // Direct ID match (highest signal)
      for (const id of idPatterns) {
        if (extLower === id.toLowerCase()) score += 100;
        if (extLower.includes(id.toLowerCase())) score += 50;
      }

      // Same project as a matched ticket
      if (projectName && idPatterns.length > 0) {
        const matchedProject = allObjects.find((other) =>
          idPatterns.some((id) => other.externalId.toLowerCase().includes(id.toLowerCase())),
        );
        const matchedMeta = matchedProject?.metadata as Record<string, unknown> | null;
        const matchedProjectName = typeof matchedMeta?.projectName === "string" ? matchedMeta.projectName.toLowerCase() : "";
        if (matchedProjectName && projectName === matchedProjectName) score += 30;
      }

      // Keyword matches in title
      for (const kw of keywords) {
        if (titleLower.includes(kw)) score += 10;
      }

      // Keyword in query matching externalId prefix (e.g., user says "8LI" tickets)
      if (queryLower.includes(extLower.split("-")[0])) score += 5;

      return { obj: o, score };
    });

    // Return scored items (relevant first), then pad with recent if needed
    scored.sort((a, b) => b.score - a.score);
    const relevant = scored.filter((s) => s.score > 0).slice(0, args.limit);
    const remaining = args.limit - relevant.length;
    const recent = remaining > 0
      ? scored.filter((s) => s.score === 0).slice(0, remaining)
      : [];

    return [...relevant, ...recent].map((s) => ({
      type: s.obj.type,
      externalId: s.obj.externalId,
      title: s.obj.title,
      status: s.obj.status,
      author: s.obj.author,
      url: s.obj.url,
    }));
  },
});

// ── Channel response ────────────────────────────────────────────────

export const respondInChannel = internalAction({
  args: {
    agentId: v.id("agents"),
    channelId: v.id("conversations"),
    query: v.string(),
    triggerMessageId: v.id("messages"),
  },
  handler: async (ctx, args) => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.error("[agentRunner] OPENAI_API_KEY not set");
      return;
    }

    const data = await ctx.runQuery(internal.agentRunner.getAgentWithContext, {
      agentId: args.agentId,
    });
    if (!data) return;
    const { agent } = data;
    if (!agent.agentUserId) return;

    console.log(`[agentRunner] respondInChannel: agent=${agent.name} channel=${args.channelId}`);

    // Show typing indicator
    await ctx.runMutation(internal.typing.setAgentTypingChannel, {
      channelId: args.channelId,
      agentUserId: agent.agentUserId,
    });

    try {
      // Get recent conversation context
      const recentMessages = await ctx.runQuery(
        internal.agentRunner.getRecentChannelMessages,
        { channelId: args.channelId, limit: 20 },
      );

      // Search knowledge graph if available
      const graphitiUrl = process.env.GRAPHITI_API_URL ?? "http://localhost:8000";
      let factsContext = "";
      try {
        const searchController = new AbortController();
        const searchTimeout = setTimeout(() => searchController.abort(), 10000);
        let searchResponse: Response;
        try {
          searchResponse = await fetch(`${graphitiUrl}/search`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              group_ids: [args.channelId],
              query: args.query,
              max_facts: 10,
            }),
            signal: searchController.signal,
          });
        } finally {
          clearTimeout(searchTimeout);
        }
        if (searchResponse.ok) {
          const searchData = await searchResponse.json();
          const facts = searchData.facts ?? [];
          if (facts.length > 0) {
            factsContext =
              "\n\nRelevant knowledge graph facts:\n" +
              facts
                .map(
                  (f: { fact: string; valid_at: string | null }, i: number) =>
                    `[${i + 1}] ${f.fact}${f.valid_at ? ` (as of ${f.valid_at})` : ""}`,
                )
                .join("\n");
          }
        }
      } catch {
        // Knowledge graph unavailable, continue without it
      }

      // Fetch integration objects (Linear tickets, GitHub PRs) for context
      let integrationsContext = "";
      try {
        const integrations = await ctx.runQuery(
          internal.agentRunner.getWorkspaceIntegrations,
          { workspaceId: agent.workspaceId, query: args.query, limit: 20 },
        );
        console.log(`[agentRunner] integrations found: ${integrations.length}`);
        if (integrations.length > 0) {
          integrationsContext =
            "\n\nWorkspace integrations (Linear tickets & GitHub PRs):\n" +
            integrations
              .map(
                (io) =>
                  `- [${io.type === "linear_ticket" ? "Linear" : "GitHub"}] ${io.externalId}: ${io.title} (${io.status}) by ${io.author}`,
              )
              .join("\n");
        }
      } catch (err) {
        console.error("[agentRunner] integration fetch failed:", err);
      }

      const systemPrompt =
        agent.systemPrompt ??
        `You are ${agent.name}, an AI agent in the PING workspace. Be helpful, concise, and cite sources when available.`;

      const messages = [
        {
          role: "system" as const,
          content: systemPrompt + factsContext + integrationsContext,
        },
        ...recentMessages,
        { role: "user" as const, content: args.query },
      ];

      // Map display model names to actual OpenAI model IDs
      const modelMap: Record<string, string> = {
        "gpt-5.4-nano": "gpt-4o-mini",
        "gpt-5.4": "gpt-4o",
      };
      const model = modelMap[agent.model ?? "gpt-5.4-nano"] ?? agent.model ?? "gpt-4o-mini";

      const llmController = new AbortController();
      const llmTimeout = setTimeout(() => llmController.abort(), 15000);
      let response: Response;
      try {
        response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model,
            messages,
            temperature: 0.3,
            max_tokens: 1000,
          }),
          signal: llmController.signal,
        });
      } finally {
        clearTimeout(llmTimeout);
      }

      if (!response.ok) {
        console.error(`[agentRunner] OpenAI failed: ${response.status}`);
        return;
      }

      const result = await response.json();
      const answer =
        result.choices[0]?.message?.content ??
        "Sorry, I couldn't generate a response.";

      // Insert bot message
      await ctx.runMutation(internal.bot.insertBotMessage, {
        conversationId: args.channelId,
        authorId: agent.agentUserId,
        body: answer,
      });

      await ctx.runMutation(internal.agentRunner.updateLastActive, {
        agentId: args.agentId,
      });
    } finally {
      // Clear typing indicator
      await ctx.runMutation(internal.typing.clearAgentTypingChannel, {
        channelId: args.channelId,
        agentUserId: agent.agentUserId,
      });
    }
  },
});

// ── DM response ─────────────────────────────────────────────────────

export const respondInDM = internalAction({
  args: {
    agentId: v.id("agents"),
    conversationId: v.id("conversations"),
    query: v.string(),
    triggerMessageId: v.id("messages"),
    triggerUserId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.error("[agentRunner] OPENAI_API_KEY not set");
      return;
    }

    const data = await ctx.runQuery(internal.agentRunner.getAgentWithContext, {
      agentId: args.agentId,
    });
    if (!data) return;
    const { agent } = data;
    if (!agent.agentUserId) return;

    console.log(`[agentRunner] respondInDM: agent=${agent.name} conv=${args.conversationId}`);

    // Show typing indicator
    await ctx.runMutation(internal.typing.setAgentTypingDM, {
      conversationId: args.conversationId,
      agentUserId: agent.agentUserId,
    });

    try {
      // Get conversation history
      const recentMessages = await ctx.runQuery(
        internal.agentRunner.getRecentDMMessages,
        { conversationId: args.conversationId, limit: 20 },
      );

      // Search knowledge graph with expanded scope for agent DMs
      const graphitiUrl = process.env.GRAPHITI_API_URL ?? "http://localhost:8000";
      const groupIds: string[] = [`dm-${args.conversationId}`];

      // Expand search to user's conversations
      const conversationIds: string[] = await ctx.runQuery(
        internal.bot.getUserConversationIds,
        { userId: args.triggerUserId },
      );
      groupIds.push(...conversationIds);

      let factsContext = "";
      try {
        const searchResponse = await fetch(`${graphitiUrl}/search`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            group_ids: groupIds,
            query: args.query,
            max_facts: 10,
          }),
        });
        if (searchResponse.ok) {
          const searchData = await searchResponse.json();
          const facts = searchData.facts ?? [];
          if (facts.length > 0) {
            factsContext =
              "\n\nRelevant knowledge graph facts:\n" +
              facts
                .map(
                  (f: { fact: string; valid_at: string | null }, i: number) =>
                    `[${i + 1}] ${f.fact}${f.valid_at ? ` (as of ${f.valid_at})` : ""}`,
                )
                .join("\n");
          }
        }
      } catch {
        // Knowledge graph unavailable
      }

      // Fetch integration objects for context
      let integrationsContext = "";
      try {
        const integrations = await ctx.runQuery(
          internal.agentRunner.getWorkspaceIntegrations,
          { workspaceId: agent.workspaceId, query: args.query, limit: 20 },
        );
        console.log(`[agentRunner] DM integrations found: ${integrations.length}`);
        if (integrations.length > 0) {
          integrationsContext =
            "\n\nWorkspace integrations (Linear tickets & GitHub PRs):\n" +
            integrations
              .map(
                (io) =>
                  `- [${io.type === "linear_ticket" ? "Linear" : "GitHub"}] ${io.externalId}: ${io.title} (${io.status}) by ${io.author}`,
              )
              .join("\n");
        }
      } catch (err) {
        console.error("[agentRunner] DM integration fetch failed:", err);
      }

      const systemPrompt =
        agent.systemPrompt ??
        `You are ${agent.name}, an AI agent in the PING workspace. Be helpful, concise, and cite sources when available.`;

      const messages = [
        {
          role: "system" as const,
          content: systemPrompt + factsContext + integrationsContext,
        },
        ...recentMessages,
        { role: "user" as const, content: args.query },
      ];

      // Map display model names to actual OpenAI model IDs
      const modelMap: Record<string, string> = {
        "gpt-5.4-nano": "gpt-4o-mini",
        "gpt-5.4": "gpt-4o",
      };
      const model = modelMap[agent.model ?? "gpt-5.4-nano"] ?? agent.model ?? "gpt-4o-mini";

      const llmController = new AbortController();
      const llmTimeout = setTimeout(() => llmController.abort(), 15000);
      let response: Response;
      try {
        response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model,
            messages,
            temperature: 0.3,
            max_tokens: 1000,
          }),
          signal: llmController.signal,
        });
      } finally {
        clearTimeout(llmTimeout);
      }

      if (!response.ok) {
        console.error(`[agentRunner] OpenAI failed: ${response.status}`);
        return;
      }

      const result = await response.json();
      const answer =
        result.choices[0]?.message?.content ??
        "Sorry, I couldn't generate a response.";

      await ctx.runMutation(internal.bot.insertBotMessage, {
        conversationId: args.conversationId,
        authorId: agent.agentUserId,
        body: answer,
      });

      await ctx.runMutation(internal.agentRunner.updateLastActive, {
        agentId: args.agentId,
      });
    } finally {
      // Clear typing indicator
      await ctx.runMutation(internal.typing.clearAgentTypingDM, {
        conversationId: args.conversationId,
        agentUserId: agent.agentUserId,
      });
    }
  },
});

// ── Dispatch: channel @mention ──────────────────────────────────────

/**
 * Called from messages.send — checks if the message @mentions any active agent
 * and schedules a response for each.
 */
export const dispatchChannelMention = internalMutation({
  args: {
    channelId: v.id("conversations"),
    messageId: v.id("messages"),
    body: v.string(),
    authorId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const conversation = await ctx.db.get(args.channelId);
    if (!conversation) return;

    // Get all active agents in the workspace
    const agents = await ctx.db
      .query("agents")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", conversation.workspaceId))
      .take(50);

    const activeAgents = agents.filter((a) => a.status === "active" && a.agentUserId);

    for (const agent of activeAgents) {
      const triggers = agent.triggers ?? ["on_mention", "on_dm"];
      const bodyLower = args.body.toLowerCase();
      const agentNameLower = agent.name.toLowerCase();

      const isMentioned =
        bodyLower.includes(`@${agentNameLower}`) ||
        bodyLower.includes(`@${agentNameLower.replace(/\s+/g, "")}`);

      const hasChannelTrigger = triggers.includes("on_channel_message");

      if (!isMentioned && !hasChannelTrigger) continue;
      if (isMentioned && !triggers.includes("on_mention")) continue;

      // Don't respond to own messages
      if (agent.agentUserId === args.authorId) continue;

      // Strip the @mention from the query
      const query = args.body
        .replace(new RegExp(`@${agent.name}`, "gi"), "")
        .replace(new RegExp(`@${agent.name.replace(/\s+/g, "")}`, "gi"), "")
        .trim() || args.body;

      await ctx.scheduler.runAfter(0, internal.agentRunner.respondInChannel, {
        agentId: agent._id,
        channelId: args.channelId,
        query,
        triggerMessageId: args.messageId,
      });
    }
  },
});

// ── Dispatch: DM to agent ───────────────────────────────────────────

/**
 * Called from messages.send — if the conversation has agent members,
 * schedules each agent to respond.
 */
export const dispatchDMResponse = internalMutation({
  args: {
    conversationId: v.id("conversations"),
    messageId: v.id("messages"),
    body: v.string(),
    authorId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) {
      console.log("[agentRunner] dispatchDMResponse: conversation not found");
      return;
    }

    // Get all members of this conversation
    const members = await ctx.db
      .query("conversationMembers")
      .withIndex("by_conversation", (q) =>
        q.eq("conversationId", args.conversationId),
      )
      .take(50);

    console.log(`[agentRunner] dispatchDMResponse: ${members.length} members, agents: ${members.filter(m => m.isAgent).map(m => m.userId).join(",")}`);

    // Find agent members (exclude the sender)
    const agentMembers = members.filter((m) => m.isAgent && m.userId !== args.authorId);
    if (agentMembers.length === 0) {
      console.log("[agentRunner] dispatchDMResponse: no agent members found");
      return;
    }

    for (const agentMember of agentMembers) {
      // Look up the agent record by agentUserId
      const agentRecords = await ctx.db
        .query("agents")
        .withIndex("by_agent_user", (q) => q.eq("agentUserId", agentMember.userId))
        .take(1);

      const agent = agentRecords[0];
      if (!agent || agent.status !== "active") continue;

      const triggers = agent.triggers ?? ["on_mention", "on_dm"];
      const isAided = conversation.kind === "agent_group";
      const bodyLower = args.body.toLowerCase();
      const agentNameLower = agent.name.toLowerCase();
      const isMentioned =
        bodyLower.includes(`@${agentNameLower}`) ||
        bodyLower.includes(`@${agentNameLower.replace(/\s+/g, "")}`);

      // Determine if agent should respond
      let shouldRespond = false;

      if (isAided) {
        // Aided group chat: check aided-specific triggers
        if (isMentioned && triggers.includes("on_mention")) {
          shouldRespond = true;
        } else if (triggers.includes("on_aided_always")) {
          shouldRespond = true;
        } else if (triggers.includes("on_aided_smart")) {
          // Smart: respond if message is a question or mentions AI/help/bot
          const smartPatterns = /\?|help|can you|could you|what|how|why|please|agent|bot|ai/i;
          shouldRespond = smartPatterns.test(args.body);
        }
      } else {
        // 1:1 agent DM: use on_dm trigger
        if (!triggers.includes("on_dm")) continue;
        shouldRespond = true;
      }

      if (!shouldRespond) continue;

      await ctx.scheduler.runAfter(0, internal.agentRunner.respondInDM, {
        agentId: agent._id,
        conversationId: args.conversationId,
        query: args.body,
        triggerMessageId: args.messageId,
        triggerUserId: args.authorId,
      });
    }
  },
});
