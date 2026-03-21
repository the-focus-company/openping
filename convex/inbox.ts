import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireUser } from "./auth";

export const getInbox = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);

    const allSummaries = await ctx.db
      .query("inboxSummaries")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .take(500);

    const summaries = allSummaries
      .filter((s) => !s.isArchived)
      .sort((a, b) => b.periodEnd - a.periodEnd);

    const enriched = await Promise.all(
      summaries.map(async (summary) => {
        // Skip summaries for channels the user has left
        const membership = await ctx.db
          .query("channelMembers")
          .withIndex("by_channel_user", (q) =>
            q.eq("channelId", summary.channelId).eq("userId", user._id),
          )
          .unique();
        if (!membership) return null;

        const channel = await ctx.db.get(summary.channelId);
        return {
          ...summary,
          channel: channel
            ? {
                _id: channel._id,
                name: channel.name,
                description: channel.description,
              }
            : null,
        };
      }),
    );

    return enriched.filter(
      (e): e is NonNullable<typeof e> => e !== null,
    );
  },
});

export const markRead = mutation({
  args: { summaryId: v.id("inboxSummaries") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const summary = await ctx.db.get(args.summaryId);
    if (!summary) throw new Error("Summary not found");
    if (summary.userId !== user._id) throw new Error("Not authorized");

    await ctx.db.patch(args.summaryId, { isRead: true });
  },
});

export const archive = mutation({
  args: { summaryId: v.id("inboxSummaries") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const summary = await ctx.db.get(args.summaryId);
    if (!summary) throw new Error("Summary not found");
    if (summary.userId !== user._id) throw new Error("Not authorized");

    await ctx.db.patch(args.summaryId, { isArchived: true });
  },
});
