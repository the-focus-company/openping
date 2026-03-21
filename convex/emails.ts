import { query, mutation, QueryCtx, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { Id } from "./_generated/dataModel";
import { requireUser } from "./auth";

const quadrantValidator = v.union(
  v.literal("urgent-important"),
  v.literal("important"),
  v.literal("urgent"),
  v.literal("fyi"),
);

async function requireOwnEmail(
  ctx: QueryCtx | MutationCtx,
  emailId: Id<"emails">,
) {
  const user = await requireUser(ctx);
  const email = await ctx.db.get(emailId);
  if (!email || email.userId !== user._id) {
    throw new Error("Email not found");
  }
  return { user, email };
}

export const list = query({
  args: {
    paginationOpts: paginationOptsValidator,
    quadrant: v.optional(quadrantValidator),
    isRead: v.optional(v.boolean()),
    isArchived: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    let baseQuery;

    if (args.quadrant !== undefined) {
      baseQuery = ctx.db
        .query("emails")
        .withIndex("by_user_quadrant", (q) =>
          q.eq("userId", user._id).eq("eisenhowerQuadrant", args.quadrant!),
        );
    } else if (args.isRead !== undefined) {
      baseQuery = ctx.db
        .query("emails")
        .withIndex("by_user_unread", (q) =>
          q.eq("userId", user._id).eq("isRead", args.isRead!),
        );
    } else {
      baseQuery = ctx.db
        .query("emails")
        .withIndex("by_user", (q) => q.eq("userId", user._id));
    }

    const results = await baseQuery.order("desc").paginate(args.paginationOpts);

    const filtered = results.page.filter((email) => {
      if (args.isArchived !== undefined && email.isArchived !== args.isArchived)
        return false;
      if (args.quadrant !== undefined && args.isRead !== undefined && email.isRead !== args.isRead)
        return false;
      return true;
    });

    return { ...results, page: filtered };
  },
});

export const get = query({
  args: { emailId: v.id("emails") },
  handler: async (ctx, args) => {
    const { email } = await requireOwnEmail(ctx, args.emailId);
    return email;
  },
});

export const listByThread = query({
  args: { threadId: v.string() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const emails = await ctx.db
      .query("emails")
      .withIndex("by_thread", (q) => q.eq("threadId", args.threadId))
      .take(100);

    return emails.filter((email) => email.userId === user._id);
  },
});

export const markRead = mutation({
  args: { emailId: v.id("emails") },
  handler: async (ctx, args) => {
    await requireOwnEmail(ctx, args.emailId);
    await ctx.db.patch(args.emailId, { isRead: true });
  },
});

export const archive = mutation({
  args: { emailId: v.id("emails") },
  handler: async (ctx, args) => {
    await requireOwnEmail(ctx, args.emailId);
    await ctx.db.patch(args.emailId, { isArchived: true });
  },
});

export const updateQuadrant = mutation({
  args: {
    emailId: v.id("emails"),
    quadrant: quadrantValidator,
  },
  handler: async (ctx, args) => {
    await requireOwnEmail(ctx, args.emailId);
    await ctx.db.patch(args.emailId, { eisenhowerQuadrant: args.quadrant });
  },
});

export const setReminder = mutation({
  args: {
    emailId: v.id("emails"),
    reminderAt: v.number(),
  },
  handler: async (ctx, args) => {
    await requireOwnEmail(ctx, args.emailId);
    await ctx.db.patch(args.emailId, { reminderAt: args.reminderAt });
  },
});

export const search = query({
  args: { query: v.string() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const results = await ctx.db
      .query("emails")
      .withSearchIndex("search_body", (q) =>
        q.search("bodyPlain", args.query).eq("userId", user._id),
      )
      .take(50);

    return results;
  },
});
