import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireUser } from "./auth";

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
    isRead: v.optional(v.boolean()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const limit = args.limit ?? 50;

    if (args.quadrant) {
      const emails = await ctx.db
        .query("emails")
        .withIndex("by_user_quadrant", (q) =>
          q.eq("userId", user._id).eq("eisenhowerQuadrant", args.quadrant!),
        )
        .order("desc")
        .take(limit);
      return emails.filter((e) => !e.isArchived);
    }

    if (args.isRead !== undefined) {
      const emails = await ctx.db
        .query("emails")
        .withIndex("by_user_read", (q) =>
          q.eq("userId", user._id).eq("isRead", args.isRead!),
        )
        .order("desc")
        .take(limit);
      return emails.filter((e) => !e.isArchived);
    }

    const emails = await ctx.db
      .query("emails")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(limit);
    return emails.filter((e) => !e.isArchived);
  },
});

export const get = query({
  args: { emailId: v.id("emails") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const email = await ctx.db.get(args.emailId);
    if (!email || email.userId !== user._id) {
      return null;
    }
    return email;
  },
});

export const listByThread = query({
  args: { threadId: v.string() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const emails = await ctx.db
      .query("emails")
      .withIndex("by_thread", (q) =>
        q.eq("userId", user._id).eq("threadId", args.threadId),
      )
      .order("asc")
      .take(100);
    return emails;
  },
});

export const search = query({
  args: { query: v.string() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const emails = await ctx.db
      .query("emails")
      .withSearchIndex("search_subject", (q) =>
        q.search("subject", args.query).eq("userId", user._id),
      )
      .take(20);
    return emails;
  },
});

export const markRead = mutation({
  args: { emailId: v.id("emails") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const email = await ctx.db.get(args.emailId);
    if (!email || email.userId !== user._id) {
      throw new Error("Not found");
    }
    await ctx.db.patch(args.emailId, { isRead: true });
  },
});

export const markUnread = mutation({
  args: { emailId: v.id("emails") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const email = await ctx.db.get(args.emailId);
    if (!email || email.userId !== user._id) {
      throw new Error("Not found");
    }
    await ctx.db.patch(args.emailId, { isRead: false });
  },
});

export const archive = mutation({
  args: { emailId: v.id("emails") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const email = await ctx.db.get(args.emailId);
    if (!email || email.userId !== user._id) {
      throw new Error("Not found");
    }
    await ctx.db.patch(args.emailId, { isArchived: true });
  },
});

export const toggleStar = mutation({
  args: { emailId: v.id("emails") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const email = await ctx.db.get(args.emailId);
    if (!email || email.userId !== user._id) {
      throw new Error("Not found");
    }
    await ctx.db.patch(args.emailId, { isStarred: !email.isStarred });
  },
});

export const unreadCount = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const unread = await ctx.db
      .query("emails")
      .withIndex("by_user_read", (q) =>
        q.eq("userId", user._id).eq("isRead", false),
      )
      .take(100);
    return unread.filter((e) => !e.isArchived).length;
  },
});

export const listAccounts = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    return await ctx.db
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
    if (!account || account.userId !== user._id) {
      throw new Error("Not found");
    }
    await ctx.db.patch(args.accountId, {
      status: "disconnected",
      accessToken: undefined,
      refreshToken: undefined,
    });
  },
});
