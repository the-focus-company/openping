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
    channelId: v.id("channels"),
    limit: v.number(),
  },
  handler: async (ctx, args) => {
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_channel", (q) => q.eq("channelId", args.channelId))
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
    conversationId: v.id("directConversations"),
    limit: v.number(),
  },
  handler: async (ctx, args) => {
    const messages = await ctx.db
      .query("directMessages")
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

// ── Channel response ────────────────────────────────────────────────

export const respondInChannel = internalAction({
  args: {
    agentId: v.id("agents"),
    channelId: v.id("channels"),
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
        const searchResponse = await fetch(`${graphitiUrl}/search`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            group_ids: [args.channelId],
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
        // Knowledge graph unavailable, continue without it
      }

      const systemPrompt =
        agent.systemPrompt ??
        `You are ${agent.name}, an AI agent in the PING workspace. Be helpful, concise, and cite sources when available.`;

      const messages = [
        {
          role: "system" as const,
          content: systemPrompt + factsContext,
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

      const response = await fetch("https://api.openai.com/v1/chat/completions", {
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
      });

      if (!response.ok) {
        const errBody = await response.text();
        console.error(`[agentRunner] OpenAI failed: ${response.status} ${errBody}`);
        return;
      }

      const result = await response.json();
      const answer =
        result.choices[0]?.message?.content ??
        "Sorry, I couldn't generate a response.";

      // Insert bot message
      await ctx.runMutation(internal.bot.insertBotMessage, {
        channelId: args.channelId,
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
    conversationId: v.id("directConversations"),
    query: v.string(),
    triggerMessageId: v.id("directMessages"),
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
      const groupIds: string[] = [`dm:${args.conversationId}`];

      // Expand search to user's channels
      const channelIds: string[] = await ctx.runQuery(
        internal.bot.getUserChannelIds,
        { userId: args.triggerUserId },
      );
      groupIds.push(...channelIds);

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

      const systemPrompt =
        agent.systemPrompt ??
        `You are ${agent.name}, an AI agent in the PING workspace. Be helpful, concise, and cite sources when available.`;

      const messages = [
        {
          role: "system" as const,
          content: systemPrompt + factsContext,
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

      const response = await fetch("https://api.openai.com/v1/chat/completions", {
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
      });

      if (!response.ok) {
        const errBody = await response.text();
        console.error(`[agentRunner] OpenAI failed: ${response.status} ${errBody}`);
        return;
      }

      const result = await response.json();
      const answer =
        result.choices[0]?.message?.content ??
        "Sorry, I couldn't generate a response.";

      await ctx.runMutation(internal.bot.insertBotDirectMessage, {
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
    channelId: v.id("channels"),
    messageId: v.id("messages"),
    body: v.string(),
    authorId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const channel = await ctx.db.get(args.channelId);
    if (!channel) return;

    // Get all active agents in the workspace
    const agents = await ctx.db
      .query("agents")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", channel.workspaceId))
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
 * Called from directMessages.send — if the conversation has agent members,
 * schedules each agent to respond.
 */
export const dispatchDMResponse = internalMutation({
  args: {
    conversationId: v.id("directConversations"),
    messageId: v.id("directMessages"),
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
      .query("directConversationMembers")
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
      if (!triggers.includes("on_dm")) continue;

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
