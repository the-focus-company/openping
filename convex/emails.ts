import { query, mutation, action } from "./_generated/server";
import { v } from "convex/values";
import { requireUser } from "./auth";

// ─── Public queries ───────────────────────────────────────────────────────────

export const listByQuadrant = query({
  args: {
    quadrant: v.optional(
      v.union(
        v.literal("urgent-important"),
        v.literal("important"),
        v.literal("urgent"),
        v.literal("fyi"),
      ),
    ),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    if (args.quadrant) {
      return ctx.db
        .query("emails")
        .withIndex("by_user_quadrant", (q) =>
          q.eq("userId", user._id).eq("eisenhowerQuadrant", args.quadrant!),
        )
        .filter((q) => q.eq(q.field("isArchived"), false))
        .take(50);
    }

    // Return all non-archived, classified emails for this user
    return ctx.db
      .query("emails")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .filter((q) =>
        q.and(
          q.eq(q.field("isArchived"), false),
          q.neq(q.field("agentClassifiedAt"), undefined),
        ),
      )
      .take(50);
  },
});

export const unreadCount = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const unread = await ctx.db
      .query("emails")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .filter((q) =>
        q.and(
          q.eq(q.field("isRead"), false),
          q.eq(q.field("isArchived"), false),
        ),
      )
      .take(100);
    return unread.length;
  },
});

export const list = query({
  args: {
    quadrant: v.optional(
      v.union(
        v.literal("urgent-important"),
        v.literal("important"),
        v.literal("urgent"),
        v.literal("fyi"),
      ),
    ),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    if (args.quadrant) {
      return ctx.db
        .query("emails")
        .withIndex("by_user_quadrant", (q) =>
          q.eq("userId", user._id).eq("eisenhowerQuadrant", args.quadrant!),
        )
        .filter((q) => q.eq(q.field("isArchived"), false))
        .take(50);
    }
    return ctx.db
      .query("emails")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .filter((q) => q.eq(q.field("isArchived"), false))
      .take(50);
  },
});

export const search = query({
  args: { query: v.string() },
  handler: async (ctx, args) => {
    if (args.query.length > 1000) throw new Error("Search query too long");
    const user = await requireUser(ctx);
    const lowerQuery = args.query.toLowerCase();
    const emails = await ctx.db
      .query("emails")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .filter((q) => q.eq(q.field("isArchived"), false))
      .take(200);
    return emails.filter(
      (e) =>
        e.subject.toLowerCase().includes(lowerQuery) ||
        e.from.toLowerCase().includes(lowerQuery) ||
        e.snippet?.toLowerCase().includes(lowerQuery),
    );
  },
});

export const listByThread = query({
  args: { threadId: v.string() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    return ctx.db
      .query("emails")
      .withIndex("by_thread", (q) => q.eq("threadId", args.threadId))
      .filter((q) => q.eq(q.field("userId"), user._id))
      .collect();
  },
});

export const markRead = mutation({
  args: { emailId: v.id("emails") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const email = await ctx.db.get(args.emailId);
    if (!email || email.userId !== user._id) throw new Error("Not found");
    await ctx.db.patch(args.emailId, { isRead: true });
  },
});

export const archive = mutation({
  args: { emailId: v.id("emails") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const email = await ctx.db.get(args.emailId);
    if (!email || email.userId !== user._id) throw new Error("Not found");
    await ctx.db.patch(args.emailId, { isArchived: true });
  },
});

export const markUnread = mutation({
  args: { emailId: v.id("emails") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const email = await ctx.db.get(args.emailId);
    if (!email || email.userId !== user._id) throw new Error("Not found");
    await ctx.db.patch(args.emailId, { isRead: false });
  },
});

export const toggleStar = mutation({
  args: { emailId: v.id("emails") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const email = await ctx.db.get(args.emailId);
    if (!email || email.userId !== user._id) throw new Error("Not found");
    await ctx.db.patch(args.emailId, { isStarred: !email.isStarred });
  },
});

export const listAccounts = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    return ctx.db
      .query("emailAccounts")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
  },
});

export const disconnectAccount = mutation({
  args: { accountId: v.id("emailAccounts") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const account = await ctx.db.get(args.accountId);
    if (!account || account.userId !== user._id) throw new Error("Not found");
    await ctx.db.patch(args.accountId, { isActive: false });
  },
});

// ─── Semantic search (8LI-129) ────────────────────────────────────────────────

export const semanticSearch = action({
  args: {
    query: v.string(),
    maxResults: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const graphitiUrl =
      process.env.GRAPHITI_API_URL ?? "http://localhost:8000";

    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    // We need the user ID to scope the search. Look up via the subject.
    // Actions cannot read the DB directly, so we use the Graphiti group_id pattern.
    const groupId = `email-${identity.subject}`;

    const searchResponse = await fetch(`${graphitiUrl}/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        group_ids: [groupId],
        query: args.query,
        max_facts: args.maxResults ?? 10,
      }),
    });

    if (!searchResponse.ok) {
      console.error(
        `[emails] Graphiti semantic search failed: ${searchResponse.status}`,
      );
      return { facts: [], episodes: [] };
    }

    const data = await searchResponse.json();
    return {
      facts: data.facts ?? [],
      episodes: data.episodes ?? [],
    };
  },
});
