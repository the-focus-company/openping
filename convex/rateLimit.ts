import { v } from "convex/values";
import { internalMutation } from "./_generated/server";

const WINDOW_MS = 60_000; // 60 seconds

export const checkRateLimit = internalMutation({
  args: {
    key: v.string(),
    maxPerWindow: v.number(),
  },
  handler: async (ctx, { key, maxPerWindow }) => {
    const now = Date.now();
    const windowStart = now - (now % WINDOW_MS);

    const existing = await ctx.db
      .query("rateLimitCounters")
      .withIndex("by_key", (q) => q.eq("key", key))
      .first();

    if (existing && existing.windowStart === windowStart) {
      if (existing.count >= maxPerWindow) {
        return {
          allowed: false,
          remaining: 0,
          resetAt: windowStart + WINDOW_MS,
        };
      }
      await ctx.db.patch(existing._id, { count: existing.count + 1 });
      return {
        allowed: true,
        remaining: maxPerWindow - existing.count - 1,
        resetAt: windowStart + WINDOW_MS,
      };
    }

    // Delete old record if exists
    if (existing) {
      await ctx.db.delete(existing._id);
    }

    await ctx.db.insert("rateLimitCounters", {
      key,
      windowStart,
      count: 1,
    });

    return {
      allowed: true,
      remaining: maxPerWindow - 1,
      resetAt: windowStart + WINDOW_MS,
    };
  },
});

export const cleanupExpiredWindows = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - 5 * 60_000; // 5 minutes ago
    const expired = await ctx.db
      .query("rateLimitCounters")
      .filter((q) => q.lt(q.field("windowStart"), cutoff))
      .take(500);

    for (const record of expired) {
      await ctx.db.delete(record._id);
    }
  },
});
