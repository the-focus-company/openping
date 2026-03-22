import { query, mutation, internalQuery, internalMutation, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { requireUser } from "./auth";

export const send = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    query: v.string(),
    agentId: v.optional(v.id("agents")),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const id = await ctx.db.insert("quickChats", {
      workspaceId: args.workspaceId,
      userId: user._id,
      query: args.query,
      agentId: args.agentId,
      status: "pending",
    });
    await ctx.scheduler.runAfter(0, internal.quickChat.generateResponse, {
      quickChatId: id,
    });
    return id;
  },
});

export const get = query({
  args: { quickChatId: v.id("quickChats") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const chat = await ctx.db.get(args.quickChatId);
    if (!chat || chat.userId !== user._id) return null;
    return chat;
  },
});

export const saveResponse = internalMutation({
  args: {
    quickChatId: v.id("quickChats"),
    response: v.string(),
    status: v.union(v.literal("done"), v.literal("error")),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.quickChatId, {
      response: args.response,
      status: args.status,
    });
  },
});

export const generateResponse = internalAction({
  args: { quickChatId: v.id("quickChats") },
  handler: async (ctx, args) => {
    const chat = await ctx.runQuery(internal.quickChat.getInternal, {
      quickChatId: args.quickChatId,
    });
    if (!chat) return;

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      await ctx.runMutation(internal.quickChat.saveResponse, {
        quickChatId: args.quickChatId,
        response: "AI is not configured.",
        status: "error",
      });
      return;
    }

    try {
      // Load agent config if specified
      let systemPrompt =
        "You are a quick assistant in a workspace communication app called PING. Answer concisely in 1-3 sentences. Be helpful and direct.";
      let model = "gpt-4o-mini";
      let factsContext = "";

      if (chat.agentId) {
        const agent = await ctx.runQuery(internal.quickChat.getAgent, {
          agentId: chat.agentId,
        });
        if (agent?.systemPrompt) {
          systemPrompt = agent.systemPrompt;
        }
        const modelMap: Record<string, string> = {
          "gpt-5.4-nano": "gpt-4o-mini",
          "gpt-5.4": "gpt-4o",
        };
        if (agent?.model) {
          model = modelMap[agent.model] ?? agent.model;
        }

        // Search knowledge graph for context
        const graphitiUrl = process.env.GRAPHITI_API_URL ?? "http://localhost:8000";
        try {
          const searchResponse = await fetch(`${graphitiUrl}/search`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              group_ids: [chat.workspaceId],
              query: chat.query,
              max_facts: 8,
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

        // Fetch integration objects for context
        try {
          const integrations = await ctx.runQuery(
            internal.quickChat.getWorkspaceIntegrations,
            { workspaceId: chat.workspaceId, query: chat.query, limit: 20 },
          );
          if (integrations.length > 0) {
            factsContext +=
              "\n\nWorkspace integrations (Linear tickets & GitHub PRs):\n" +
              integrations
                .map(
                  (io: { type: string; externalId: string; title: string; status: string; author: string }) =>
                    `- [${io.type === "linear_ticket" ? "Linear" : "GitHub"}] ${io.externalId}: ${io.title} (${io.status}) by ${io.author}`,
                )
                .join("\n");
          }
        } catch {
          // Integrations unavailable
        }
      }

      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: "system",
              content: systemPrompt + factsContext,
            },
            { role: "user", content: chat.query },
          ],
          temperature: 0.3,
          max_tokens: 500,
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const data = await response.json();
      const answer =
        data.choices?.[0]?.message?.content ?? "No response generated.";

      await ctx.runMutation(internal.quickChat.saveResponse, {
        quickChatId: args.quickChatId,
        response: answer,
        status: "done",
      });
    } catch (err) {
      await ctx.runMutation(internal.quickChat.saveResponse, {
        quickChatId: args.quickChatId,
        response: err instanceof Error ? err.message : "Something went wrong.",
        status: "error",
      });
    }
  },
});

export const getInternal = internalQuery({
  args: { quickChatId: v.id("quickChats") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.quickChatId);
  },
});

export const getAgent = internalQuery({
  args: { agentId: v.id("agents") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.agentId);
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

    const queryLower = args.query.toLowerCase();
    const idPatterns = args.query.match(/[A-Z]+-\d+|#\d+/gi) ?? [];
    const keywords = queryLower
      .replace(/[^a-z0-9\s-]/g, "")
      .split(/\s+/)
      .filter((w) => w.length >= 3);

    const scored = allObjects.map((o) => {
      let score = 0;
      const extLower = o.externalId.toLowerCase();
      const titleLower = o.title.toLowerCase();
      for (const id of idPatterns) {
        if (extLower === id.toLowerCase()) score += 100;
        if (extLower.includes(id.toLowerCase())) score += 50;
      }
      for (const kw of keywords) {
        if (titleLower.includes(kw)) score += 10;
      }
      return { obj: o, score };
    });

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
    }));
  },
});
