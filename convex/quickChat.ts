import { query, mutation, internalQuery, internalMutation, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { requireUser } from "./auth";

export const send = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    query: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const id = await ctx.db.insert("quickChats", {
      workspaceId: args.workspaceId,
      userId: user._id,
      query: args.query,
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
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content:
                "You are a quick assistant in a workspace communication app called PING. Answer concisely in 1-3 sentences. Be helpful and direct.",
            },
            { role: "user", content: chat.query },
          ],
          temperature: 0.3,
          max_tokens: 300,
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
