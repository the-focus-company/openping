import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireUser } from "./auth";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);

    const unread = await ctx.db
      .query("inboxSummaries")
      .withIndex("by_user_read", (q) =>
        q.eq("userId", user._id).eq("isRead", false),
      )
      .take(50);

    const read = await ctx.db
      .query("inboxSummaries")
      .withIndex("by_user_read", (q) =>
        q.eq("userId", user._id).eq("isRead", true),
      )
      .take(20);

    const all = [...unread, ...read].filter((s) => !s.isArchived);

    const enriched = await Promise.all(
      all.map(async (summary) => {
        const channel = await ctx.db.get(summary.channelId);

        const actionItemsEnriched = summary.actionItems
          ? await Promise.all(
              summary.actionItems.map(async (ai) => {
                if (ai.relatedIntegrationObjectId) {
                  const obj = await ctx.db.get(ai.relatedIntegrationObjectId);
                  return { ...ai, integrationUrl: obj?.url ?? null };
                }
                return { ...ai, integrationUrl: null as string | null };
              }),
            )
          : undefined;

        return {
          ...summary,
          channelName: channel?.name ?? "unknown",
          actionItems: actionItemsEnriched,
        };
      }),
    );

    return enriched;
  },
});

export const markRead = mutation({
  args: { summaryId: v.id("inboxSummaries") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const summary = await ctx.db.get(args.summaryId);
    if (!summary || summary.userId !== user._id) {
      throw new Error("Not found");
    }
    await ctx.db.patch(args.summaryId, { isRead: true });
  },
});

export const archive = mutation({
  args: { summaryId: v.id("inboxSummaries") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const summary = await ctx.db.get(args.summaryId);
    if (!summary || summary.userId !== user._id) {
      throw new Error("Not found");
    }
    await ctx.db.patch(args.summaryId, { isArchived: true });
  },
});

export const unreadCount = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const unread = await ctx.db
      .query("inboxSummaries")
      .withIndex("by_user_read", (q) =>
        q.eq("userId", user._id).eq("isRead", false),
      )
      .take(100);
    return unread.length;
  },
});
