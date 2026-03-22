import {
  internalAction,
  internalQuery,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

const BATCH_SIZE = 50;
const BATCH_DELAY_MS = 1_000;
const RATE_LIMIT_DELAY_MS = 5_000;

// ── Queries ────────────────────────────────────────────────────────

export const getUnindexedMessages = internalQuery({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const messages = await ctx.db
      .query("messages")
      .order("asc")
      .take((args.limit ?? BATCH_SIZE) * 3);

    const unindexed = messages
      .filter((m) => m.graphitiEpisodeId === undefined)
      .slice(0, args.limit ?? BATCH_SIZE);

    return Promise.all(
      unindexed.map(async (m) => {
        const author = await ctx.db.get(m.authorId);
        const channel = await ctx.db.get(m.channelId);
        return {
          _id: m._id,
          body: m.body,
          channelId: m.channelId,
          channelName: channel?.name ?? "",
          authorName: author?.name ?? "Unknown",
          createdAt: m._creationTime,
          threadId: m.threadId ?? null,
        };
      }),
    );
  },
});

export const getUnindexedDirectMessages = internalQuery({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const messages = await ctx.db
      .query("directMessages")
      .order("asc")
      .take((args.limit ?? BATCH_SIZE) * 3);

    const unindexed = messages
      .filter((m) => m.graphitiEpisodeId === undefined)
      .slice(0, args.limit ?? BATCH_SIZE);

    return Promise.all(
      unindexed.map(async (m) => {
        const author = await ctx.db.get(m.authorId);
        const conversation = await ctx.db.get(m.conversationId);
        return {
          _id: m._id,
          body: m.body,
          conversationId: m.conversationId,
          conversationName: conversation?.name ?? "Direct Message",
          authorName: author?.name ?? "Unknown",
          createdAt: m._creationTime,
          threadId: m.threadId ?? null,
        };
      }),
    );
  },
});

// ── Backfill actions ───────────────────────────────────────────────

export const backfillMessages = internalAction({
  args: {},
  handler: async (ctx) => {
    const graphitiUrl =
      process.env.GRAPHITI_API_URL ?? "http://localhost:8000";

    const batch = await ctx.runQuery(
      internal.backfill.getUnindexedMessages,
      { limit: BATCH_SIZE },
    );

    if (batch.length === 0) {
      console.log("[backfill] Channel messages: done, no more to process");
      return;
    }

    let processed = 0;
    let rateLimited = false;

    for (const msg of batch) {
      // Build content with thread context inline
      let content = msg.body;
      if (msg.threadId) {
        const threadCtx = await ctx.runQuery(
          internal.ingest.getThreadContext,
          { threadId: msg.threadId },
        );
        if (threadCtx) {
          content = `[Thread reply to: "${threadCtx.parentBody}"] ${content}`;
        }
      }

      const response = await fetch(`${graphitiUrl}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          group_id: msg.channelId,
          messages: [
            {
              content,
              role_type: "user",
              role: msg.authorName,
              timestamp: new Date(msg.createdAt).toISOString(),
              source_description: `channel:${msg.channelName}`,
              name: `${msg.authorName} in #${msg.channelName}`,
            },
          ],
        }),
      });

      if (response.status === 429) {
        rateLimited = true;
        console.warn("[backfill] Rate limited, will retry with longer delay");
        break;
      }

      if (!response.ok) {
        console.error(
          `[backfill] Failed to ingest message ${msg._id}: ${response.status}`,
        );
        continue;
      }

      await ctx.runMutation(internal.ingest.patchEpisodeId, {
        messageId: msg._id,
        graphitiEpisodeId: msg._id,
      });
      processed++;
    }

    console.log(
      `[backfill] Channel messages: processed ${processed}/${batch.length}`,
    );

    // Schedule next batch
    const delay = rateLimited ? RATE_LIMIT_DELAY_MS : BATCH_DELAY_MS;
    await ctx.scheduler.runAfter(
      delay,
      internal.backfill.backfillMessages,
      {},
    );
  },
});

export const backfillDirectMessages = internalAction({
  args: {},
  handler: async (ctx) => {
    const graphitiUrl =
      process.env.GRAPHITI_API_URL ?? "http://localhost:8000";

    const batch = await ctx.runQuery(
      internal.backfill.getUnindexedDirectMessages,
      { limit: BATCH_SIZE },
    );

    if (batch.length === 0) {
      console.log("[backfill] DMs: done, no more to process");
      return;
    }

    let processed = 0;
    let rateLimited = false;

    for (const msg of batch) {
      let content = msg.body;
      if (msg.threadId) {
        const threadCtx = await ctx.runQuery(
          internal.ingest.getThreadContextDM,
          { threadId: msg.threadId },
        );
        if (threadCtx) {
          content = `[Thread reply to: "${threadCtx.parentBody}"] ${content}`;
        }
      }

      const groupId = `dm-${msg.conversationId}`;

      const response = await fetch(`${graphitiUrl}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          group_id: groupId,
          messages: [
            {
              content,
              role_type: "user",
              role: msg.authorName,
              timestamp: new Date(msg.createdAt).toISOString(),
              source_description: `dm:${msg.conversationName}`,
              name: `${msg.authorName} in ${msg.conversationName}`,
            },
          ],
        }),
      });

      if (response.status === 429) {
        rateLimited = true;
        console.warn("[backfill] Rate limited, will retry with longer delay");
        break;
      }

      if (!response.ok) {
        console.error(
          `[backfill] Failed to ingest DM ${msg._id}: ${response.status}`,
        );
        continue;
      }

      await ctx.runMutation(internal.ingest.patchDirectMessageEpisodeId, {
        messageId: msg._id,
        graphitiEpisodeId: msg._id,
      });
      processed++;
    }

    console.log(
      `[backfill] DMs: processed ${processed}/${batch.length}`,
    );

    const delay = rateLimited ? RATE_LIMIT_DELAY_MS : BATCH_DELAY_MS;
    await ctx.scheduler.runAfter(
      delay,
      internal.backfill.backfillDirectMessages,
      {},
    );
  },
});

// ── Entry point ────────────────────────────────────────────────────

export const startBackfill = internalAction({
  args: {},
  handler: async (ctx) => {
    console.log("[backfill] Starting backfill for channel messages and DMs");
    await ctx.scheduler.runAfter(
      0,
      internal.backfill.backfillMessages,
      {},
    );
    await ctx.scheduler.runAfter(
      0,
      internal.backfill.backfillDirectMessages,
      {},
    );
  },
});
