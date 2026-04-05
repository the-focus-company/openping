import { query, mutation, internalMutation, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { requireUser, requireConversationMember } from "./auth";

const TYPING_TTL = 5000;

export const setTyping = mutation({
  args: {
    conversationId: v.optional(v.id("conversations")),
    threadMessageId: v.optional(v.id("messages")),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    if (!args.conversationId && !args.threadMessageId) {
      throw new Error("Must provide conversationId or threadMessageId");
    }

    if (args.threadMessageId) {
      // Thread typing — verify membership via parent message's conversation
      const parent = await ctx.db.get(args.threadMessageId);
      if (!parent) throw new Error("Parent message not found");
      await requireConversationMember(ctx, parent.conversationId!, user._id);

      const existing = await ctx.db
        .query("typingIndicators")
        .withIndex("by_thread_message_and_user", (q) =>
          q
            .eq("threadMessageId", args.threadMessageId!)
            .eq("userId", user._id),
        )
        .unique();

      if (existing) {
        await ctx.db.patch(existing._id, {
          expiresAt: Date.now() + TYPING_TTL,
        });
      } else {
        await ctx.db.insert("typingIndicators", {
          threadMessageId: args.threadMessageId,
          userId: user._id,
          expiresAt: Date.now() + TYPING_TTL,
        });
      }
    } else {
      // Conversation typing
      await requireConversationMember(ctx, args.conversationId!, user._id);

      const existing = await ctx.db
        .query("typingIndicators")
        .withIndex("by_conversation_and_user", (q) =>
          q
            .eq("conversationId", args.conversationId!)
            .eq("userId", user._id),
        )
        .unique();

      if (existing) {
        await ctx.db.patch(existing._id, {
          expiresAt: Date.now() + TYPING_TTL,
        });
      } else {
        await ctx.db.insert("typingIndicators", {
          conversationId: args.conversationId,
          userId: user._id,
          expiresAt: Date.now() + TYPING_TTL,
        });
      }
    }
  },
});

export const clearTyping = mutation({
  args: {
    conversationId: v.optional(v.id("conversations")),
    threadMessageId: v.optional(v.id("messages")),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    if (!args.conversationId && !args.threadMessageId) {
      throw new Error("Must provide conversationId or threadMessageId");
    }

    if (args.threadMessageId) {
      const existing = await ctx.db
        .query("typingIndicators")
        .withIndex("by_thread_message_and_user", (q) =>
          q
            .eq("threadMessageId", args.threadMessageId!)
            .eq("userId", user._id),
        )
        .unique();

      if (existing) {
        await ctx.db.delete(existing._id);
      }
    } else {
      const existing = await ctx.db
        .query("typingIndicators")
        .withIndex("by_conversation_and_user", (q) =>
          q
            .eq("conversationId", args.conversationId!)
            .eq("userId", user._id),
        )
        .unique();

      if (existing) {
        await ctx.db.delete(existing._id);
      }
    }
  },
});

export const getTypingUsers = query({
  args: {
    conversationId: v.optional(v.id("conversations")),
    threadMessageId: v.optional(v.id("messages")),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    if (!args.conversationId && !args.threadMessageId) {
      throw new Error("Must provide conversationId or threadMessageId");
    }

    let indicators;
    if (args.threadMessageId) {
      const parent = await ctx.db.get(args.threadMessageId);
      if (!parent) throw new Error("Parent message not found");
      await requireConversationMember(ctx, parent.conversationId!, user._id);

      indicators = await ctx.db
        .query("typingIndicators")
        .withIndex("by_thread_message", (q) =>
          q.eq("threadMessageId", args.threadMessageId!),
        )
        .take(20);
    } else {
      await requireConversationMember(ctx, args.conversationId!, user._id);

      indicators = await ctx.db
        .query("typingIndicators")
        .withIndex("by_conversation", (q) =>
          q.eq("conversationId", args.conversationId!),
        )
        .take(20);
    }

    const now = Date.now();
    const activeIndicators = indicators.filter(
      (ind) => ind.expiresAt > now && ind.userId !== user._id,
    );

    const users = await Promise.all(
      activeIndicators.map((ind) => ctx.db.get(ind.userId)),
    );

    return users
      .filter((u) => u !== null)
      .map((u) => ({ _id: u._id, name: u.name, avatarUrl: u.avatarUrl }));
  },
});

// ── Agent typing (internal, no auth required) ───────────────────────

const AGENT_TYPING_TTL = 30000; // 30s — longer since agents take time

async function _setAgentTypingImpl(
  ctx: MutationCtx,
  conversationId: Id<"conversations">,
  agentUserId: Id<"users">,
) {
  const existing = await ctx.db
    .query("typingIndicators")
    .withIndex("by_conversation_and_user", (q) =>
      q.eq("conversationId", conversationId).eq("userId", agentUserId),
    )
    .unique();

  if (existing) {
    await ctx.db.patch(existing._id, {
      expiresAt: Date.now() + AGENT_TYPING_TTL,
    });
  } else {
    await ctx.db.insert("typingIndicators", {
      conversationId,
      userId: agentUserId,
      expiresAt: Date.now() + AGENT_TYPING_TTL,
    });
  }
}

async function _clearAgentTypingImpl(
  ctx: MutationCtx,
  conversationId: Id<"conversations">,
  agentUserId: Id<"users">,
) {
  const existing = await ctx.db
    .query("typingIndicators")
    .withIndex("by_conversation_and_user", (q) =>
      q.eq("conversationId", conversationId).eq("userId", agentUserId),
    )
    .unique();

  if (existing) {
    await ctx.db.delete(existing._id);
  }
}

export const setAgentTyping = internalMutation({
  args: {
    conversationId: v.id("conversations"),
    agentUserId: v.id("users"),
  },
  handler: async (ctx, args) => {
    await _setAgentTypingImpl(ctx, args.conversationId, args.agentUserId);
  },
});

export const clearAgentTyping = internalMutation({
  args: {
    conversationId: v.id("conversations"),
    agentUserId: v.id("users"),
  },
  handler: async (ctx, args) => {
    await _clearAgentTypingImpl(ctx, args.conversationId, args.agentUserId);
  },
});

// ── Legacy aliases for gradual migration ────────────────────────────

/** @deprecated Use setAgentTyping instead */
export const setAgentTypingDM = internalMutation({
  args: {
    conversationId: v.id("conversations"),
    agentUserId: v.id("users"),
  },
  handler: async (ctx, args) => {
    await _setAgentTypingImpl(ctx, args.conversationId, args.agentUserId);
  },
});

/** @deprecated Use clearAgentTyping instead */
export const clearAgentTypingDM = internalMutation({
  args: {
    conversationId: v.id("conversations"),
    agentUserId: v.id("users"),
  },
  handler: async (ctx, args) => {
    await _clearAgentTypingImpl(ctx, args.conversationId, args.agentUserId);
  },
});

/** @deprecated Use setAgentTyping instead */
export const setAgentTypingChannel = internalMutation({
  args: {
    channelId: v.id("conversations"),
    agentUserId: v.id("users"),
  },
  handler: async (ctx, args) => {
    await _setAgentTypingImpl(ctx, args.channelId, args.agentUserId);
  },
});

/** @deprecated Use clearAgentTyping instead */
export const clearAgentTypingChannel = internalMutation({
  args: {
    channelId: v.id("conversations"),
    agentUserId: v.id("users"),
  },
  handler: async (ctx, args) => {
    await _clearAgentTypingImpl(ctx, args.channelId, args.agentUserId);
  },
});

// ── Cleanup ─────────────────────────────────────────────────────────

export const cleanupExpired = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const expired = await ctx.db
      .query("typingIndicators")
      .filter((q) => q.lt(q.field("expiresAt"), now))
      .take(500);

    await Promise.all(expired.map((ind) => ctx.db.delete(ind._id)));
  },
});
