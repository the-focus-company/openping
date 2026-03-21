import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireUser } from "./auth";

// ── Per-Sender Rules (VIP, muted, auto-archive, unsubscribe) ────────────────

export const listRules = query({
  args: {
    category: v.optional(
      v.union(v.literal("vip"), v.literal("normal"), v.literal("muted")),
    ),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    if (args.category) {
      return await ctx.db
        .query("emailSenderRules")
        .withIndex("by_user_category", (q) =>
          q.eq("userId", user._id).eq("category", args.category!),
        )
        .collect();
    }

    return await ctx.db
      .query("emailSenderRules")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
  },
});

export const getRule = query({
  args: { senderAddress: v.string() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    return await ctx.db
      .query("emailSenderRules")
      .withIndex("by_user_sender", (q) =>
        q.eq("userId", user._id).eq("senderAddress", args.senderAddress),
      )
      .unique();
  },
});

export const upsertRule = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    senderAddress: v.string(),
    category: v.union(
      v.literal("vip"),
      v.literal("normal"),
      v.literal("muted"),
    ),
    autoArchive: v.optional(v.boolean()),
    autoLabel: v.optional(v.string()),
    suggestUnsubscribe: v.optional(v.boolean()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const now = Date.now();

    const existing = await ctx.db
      .query("emailSenderRules")
      .withIndex("by_user_sender", (q) =>
        q.eq("userId", user._id).eq("senderAddress", args.senderAddress),
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        category: args.category,
        autoArchive: args.autoArchive,
        autoLabel: args.autoLabel,
        suggestUnsubscribe: args.suggestUnsubscribe,
        notes: args.notes,
        updatedAt: now,
      });
      return existing._id;
    }

    return await ctx.db.insert("emailSenderRules", {
      userId: user._id,
      workspaceId: args.workspaceId,
      senderAddress: args.senderAddress,
      category: args.category,
      autoArchive: args.autoArchive,
      autoLabel: args.autoLabel,
      suggestUnsubscribe: args.suggestUnsubscribe,
      notes: args.notes,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const deleteRule = mutation({
  args: { ruleId: v.id("emailSenderRules") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const rule = await ctx.db.get(args.ruleId);
    if (!rule || rule.userId !== user._id) {
      throw new Error("Rule not found");
    }
    await ctx.db.delete(args.ruleId);
  },
});

// ── VIP shortcut ────────────────────────────────────────────────────────────

export const listVips = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    return await ctx.db
      .query("emailSenderRules")
      .withIndex("by_user_category", (q) =>
        q.eq("userId", user._id).eq("category", "vip"),
      )
      .collect();
  },
});

// ── Unsubscribe suggestions ─────────────────────────────────────────────────

export const listUnsubscribeSuggestions = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const rules = await ctx.db
      .query("emailSenderRules")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    return rules.filter((r) => r.suggestUnsubscribe === true);
  },
});

export const markSuggestUnsubscribe = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    senderAddress: v.string(),
    suggest: v.boolean(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const now = Date.now();

    const existing = await ctx.db
      .query("emailSenderRules")
      .withIndex("by_user_sender", (q) =>
        q.eq("userId", user._id).eq("senderAddress", args.senderAddress),
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        suggestUnsubscribe: args.suggest,
        updatedAt: now,
      });
      return existing._id;
    }

    return await ctx.db.insert("emailSenderRules", {
      userId: user._id,
      workspaceId: args.workspaceId,
      senderAddress: args.senderAddress,
      category: "normal",
      suggestUnsubscribe: args.suggest,
      createdAt: now,
      updatedAt: now,
    });
  },
});
