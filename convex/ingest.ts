import {
  internalAction,
  internalQuery,
  internalMutation,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 30_000;

// ── Channel message queries ────────────────────────────────────────

export const getMessage = internalQuery({
  args: { messageId: v.id("messages") },
  handler: async (ctx, args) => {
    const message = await ctx.db.get(args.messageId);
    if (!message) return null;
    const author = await ctx.db.get(message.authorId);
    const channel = await ctx.db.get(message.channelId);
    return {
      _id: message._id,
      body: message.body,
      channelId: message.channelId,
      channelName: channel?.name ?? "",
      authorId: message.authorId,
      authorName: author?.name ?? "Unknown",
      createdAt: message._creationTime,
      type: message.type,
    };
  },
});

export const patchEpisodeId = internalMutation({
  args: {
    messageId: v.id("messages"),
    graphitiEpisodeId: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.messageId, {
      graphitiEpisodeId: args.graphitiEpisodeId,
    });
  },
});

export const getThreadContext = internalQuery({
  args: { threadId: v.id("messages") },
  handler: async (ctx, args) => {
    const parent = await ctx.db.get(args.threadId);
    if (!parent) return null;
    const author = await ctx.db.get(parent.authorId);
    return {
      parentBody: parent.body,
      parentAuthorName: author?.name ?? "Unknown",
    };
  },
});

// ── DM queries ─────────────────────────────────────────────────────

export const getDirectMessage = internalQuery({
  args: { messageId: v.id("directMessages") },
  handler: async (ctx, args) => {
    const message = await ctx.db.get(args.messageId);
    if (!message) return null;
    const author = await ctx.db.get(message.authorId);
    const conversation = await ctx.db.get(message.conversationId);
    return {
      _id: message._id,
      body: message.body,
      conversationId: message.conversationId,
      conversationName: conversation?.name ?? "Direct Message",
      authorId: message.authorId,
      authorName: author?.name ?? "Unknown",
      createdAt: message._creationTime,
      type: message.type,
    };
  },
});

export const patchDirectMessageEpisodeId = internalMutation({
  args: {
    messageId: v.id("directMessages"),
    graphitiEpisodeId: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.messageId, {
      graphitiEpisodeId: args.graphitiEpisodeId,
    });
  },
});

export const getThreadContextDM = internalQuery({
  args: { threadId: v.id("directMessages") },
  handler: async (ctx, args) => {
    const parent = await ctx.db.get(args.threadId);
    if (!parent) return null;
    const author = await ctx.db.get(parent.authorId);
    return {
      parentBody: parent.body,
      parentAuthorName: author?.name ?? "Unknown",
    };
  },
});

// ── Channel message ingestion ──────────────────────────────────────

export const processMessage = internalAction({
  args: {
    messageId: v.id("messages"),
    threadId: v.optional(v.id("messages")),
    retryCount: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const graphitiUrl =
      process.env.GRAPHITI_API_URL ?? "http://localhost:8000";
    const retryCount = args.retryCount ?? 0;

    const message = await ctx.runQuery(internal.ingest.getMessage, {
      messageId: args.messageId,
    });
    if (!message) {
      console.warn("[ingest] Message not found:", args.messageId);
      return;
    }

    // Build content with optional thread context
    let content = message.body;
    if (args.threadId) {
      const threadCtx = await ctx.runQuery(
        internal.ingest.getThreadContext,
        { threadId: args.threadId },
      );
      if (threadCtx) {
        content = `[Thread reply to: "${threadCtx.parentBody}"] ${content}`;
      }
    }

    const response = await fetch(`${graphitiUrl}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        group_id: message.channelId,
        messages: [
          {
            content,
            role_type: message.type === "bot" ? "assistant" : "user",
            role: message.authorName,
            timestamp: new Date(message.createdAt).toISOString(),
            source_description: `channel:${message.channelName}`,
            uuid: message._id,
            name: `${message.authorName} in #${message.channelName}`,
          },
        ],
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      if (
        (response.status === 429 || response.status === 503) &&
        retryCount < MAX_RETRIES
      ) {
        console.warn(
          `[ingest] Graphiti unavailable (${response.status}), retry ${retryCount + 1}/${MAX_RETRIES} in ${RETRY_DELAY_MS / 1000}s`,
        );
        await ctx.scheduler.runAfter(
          RETRY_DELAY_MS,
          internal.ingest.processMessage,
          {
            messageId: args.messageId,
            threadId: args.threadId,
            retryCount: retryCount + 1,
          },
        );
        return;
      }
      console.error(
        `[ingest] Graphiti /messages failed: ${response.status} ${body}`,
      );
      return;
    }

    await ctx.runMutation(internal.ingest.patchEpisodeId, {
      messageId: args.messageId,
      graphitiEpisodeId: message._id,
    });

    console.log("[ingest] Ingested message:", args.messageId);
  },
});

// ── DM ingestion ───────────────────────────────────────────────────

export const processDirectMessage = internalAction({
  args: {
    messageId: v.id("directMessages"),
    threadId: v.optional(v.id("directMessages")),
    retryCount: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const graphitiUrl =
      process.env.GRAPHITI_API_URL ?? "http://localhost:8000";
    const retryCount = args.retryCount ?? 0;

    const message = await ctx.runQuery(internal.ingest.getDirectMessage, {
      messageId: args.messageId,
    });
    if (!message) {
      console.warn("[ingest] DM not found:", args.messageId);
      return;
    }

    // Build content with optional thread context
    let content = message.body;
    if (args.threadId) {
      const threadCtx = await ctx.runQuery(
        internal.ingest.getThreadContextDM,
        { threadId: args.threadId },
      );
      if (threadCtx) {
        content = `[Thread reply to: "${threadCtx.parentBody}"] ${content}`;
      }
    }

    const groupId = `dm-${message.conversationId}`;

    const response = await fetch(`${graphitiUrl}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        group_id: groupId,
        messages: [
          {
            content,
            role_type: message.type === "bot" ? "assistant" : "user",
            role: message.authorName,
            timestamp: new Date(message.createdAt).toISOString(),
            source_description: `dm:${message.conversationName}`,
            uuid: message._id,
            name: `${message.authorName} in ${message.conversationName}`,
          },
        ],
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      if (
        (response.status === 429 || response.status === 503) &&
        retryCount < MAX_RETRIES
      ) {
        console.warn(
          `[ingest] Graphiti unavailable (${response.status}), retry ${retryCount + 1}/${MAX_RETRIES} in ${RETRY_DELAY_MS / 1000}s`,
        );
        await ctx.scheduler.runAfter(
          RETRY_DELAY_MS,
          internal.ingest.processDirectMessage,
          {
            messageId: args.messageId,
            threadId: args.threadId,
            retryCount: retryCount + 1,
          },
        );
        return;
      }
      console.error(
        `[ingest] Graphiti /messages failed: ${response.status} ${body}`,
      );
      return;
    }

    await ctx.runMutation(internal.ingest.patchDirectMessageEpisodeId, {
      messageId: args.messageId,
      graphitiEpisodeId: message._id,
    });

    console.log("[ingest] Ingested DM:", args.messageId);
  },
});

// ── Integration object ingestion ──────────────────────────────────

export const getIntegrationObject = internalQuery({
  args: { objectId: v.id("integrationObjects") },
  handler: async (ctx, args) => {
    const obj = await ctx.db.get(args.objectId);
    if (!obj) return null;
    return {
      _id: obj._id,
      workspaceId: obj.workspaceId,
      type: obj.type,
      externalId: obj.externalId,
      title: obj.title,
      status: obj.status,
      url: obj.url,
      author: obj.author,
      metadata: obj.metadata as Record<string, unknown> | undefined,
      lastSyncedAt: obj.lastSyncedAt,
    };
  },
});

export const patchIntegrationObjectEpisodeId = internalMutation({
  args: {
    objectId: v.id("integrationObjects"),
    graphitiEpisodeId: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.objectId, {
      graphitiEpisodeId: args.graphitiEpisodeId,
    });
  },
});

export const processIntegrationObject = internalAction({
  args: {
    objectId: v.id("integrationObjects"),
    retryCount: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const graphitiUrl =
      process.env.GRAPHITI_API_URL ?? "http://localhost:8000";
    const retryCount = args.retryCount ?? 0;

    const obj = await ctx.runQuery(internal.ingest.getIntegrationObject, {
      objectId: args.objectId,
    });
    if (!obj) {
      console.warn("[ingest] Integration object not found:", args.objectId);
      return;
    }

    // Build rich content from integration metadata
    const meta = obj.metadata ?? {};
    const parts: string[] = [];

    if (obj.type === "github_pr") {
      const repo = (meta.repo as string) ?? "";
      const prNumber = (meta.number as number) ?? "";
      parts.push(`[GitHub PR] #${prNumber} ${obj.title}`);
      if (repo) parts.push(`Repository: ${repo}`);
      parts.push(`Author: ${obj.author} | Status: ${obj.status}`);
      if (meta.description) parts.push(`Description: ${(meta.description as string).slice(0, 500)}`);
    } else {
      const identifier = (meta.identifier as string) ?? "";
      const priority = (meta.priority as string) ?? "";
      parts.push(`[Linear Ticket] ${identifier} ${obj.title}`);
      parts.push(`Author: ${obj.author} | Status: ${obj.status}${priority ? ` | Priority: ${priority}` : ""}`);
      if (meta.description) parts.push(`Description: ${(meta.description as string).slice(0, 500)}`);
    }

    const content = parts.join("\n");

    const response = await fetch(`${graphitiUrl}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        group_id: `integrations-${obj.workspaceId}`,
        messages: [
          {
            content,
            role_type: "user",
            role: obj.author,
            timestamp: new Date(obj.lastSyncedAt).toISOString(),
            source_description: `integration:${obj.type}`,
            uuid: obj._id,
            name: `${obj.type}:${obj.externalId}`,
          },
        ],
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      if (
        (response.status === 429 || response.status === 503) &&
        retryCount < MAX_RETRIES
      ) {
        console.warn(
          `[ingest] Graphiti unavailable (${response.status}), retry ${retryCount + 1}/${MAX_RETRIES}`,
        );
        await ctx.scheduler.runAfter(
          RETRY_DELAY_MS,
          internal.ingest.processIntegrationObject,
          { objectId: args.objectId, retryCount: retryCount + 1 },
        );
        return;
      }
      console.error(
        `[ingest] Graphiti integration ingest failed: ${response.status} ${body}`,
      );
      return;
    }

    await ctx.runMutation(internal.ingest.patchIntegrationObjectEpisodeId, {
      objectId: args.objectId,
      graphitiEpisodeId: obj._id,
    });

    console.log("[ingest] Ingested integration object:", args.objectId);
  },
});

// ── Decision ingestion ────────────────────────────────────────────

export const getDecision = internalQuery({
  args: { decisionId: v.id("decisions") },
  handler: async (ctx, args) => {
    const decision = await ctx.db.get(args.decisionId);
    if (!decision) return null;
    const user = await ctx.db.get(decision.userId);
    return {
      _id: decision._id,
      workspaceId: decision.workspaceId,
      type: decision.type,
      title: decision.title,
      summary: decision.summary,
      eisenhowerQuadrant: decision.eisenhowerQuadrant,
      status: decision.status,
      userName: user?.name ?? "Unknown",
      outcome: decision.outcome,
      createdAt: decision.createdAt,
    };
  },
});

export const patchDecisionEpisodeId = internalMutation({
  args: {
    decisionId: v.id("decisions"),
    graphitiEpisodeId: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.decisionId, {
      graphitiEpisodeId: args.graphitiEpisodeId,
    });
  },
});

export const processDecision = internalAction({
  args: {
    decisionId: v.id("decisions"),
    retryCount: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const graphitiUrl =
      process.env.GRAPHITI_API_URL ?? "http://localhost:8000";
    const retryCount = args.retryCount ?? 0;

    const decision = await ctx.runQuery(internal.ingest.getDecision, {
      decisionId: args.decisionId,
    });
    if (!decision) {
      console.warn("[ingest] Decision not found:", args.decisionId);
      return;
    }

    let content: string;
    if (decision.outcome) {
      content = `Decision made [${decision.type}]: ${decision.title}. Action: ${decision.outcome.action}.${decision.outcome.comment ? ` Comment: ${decision.outcome.comment}` : ""} (Quadrant: ${decision.eisenhowerQuadrant})`;
    } else {
      content = `Decision pending [${decision.type}]: ${decision.title}. ${decision.summary} (Quadrant: ${decision.eisenhowerQuadrant})`;
    }

    const response = await fetch(`${graphitiUrl}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        group_id: `decisions-${decision.workspaceId}`,
        messages: [
          {
            content,
            role_type: "user",
            role: decision.userName,
            timestamp: new Date(decision.createdAt).toISOString(),
            source_description: `decision:${decision.type}`,
            uuid: decision._id,
            name: `${decision.userName} decision:${decision.type}`,
          },
        ],
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      if (
        (response.status === 429 || response.status === 503) &&
        retryCount < MAX_RETRIES
      ) {
        console.warn(
          `[ingest] Graphiti unavailable (${response.status}), retry ${retryCount + 1}/${MAX_RETRIES}`,
        );
        await ctx.scheduler.runAfter(
          RETRY_DELAY_MS,
          internal.ingest.processDecision,
          { decisionId: args.decisionId, retryCount: retryCount + 1 },
        );
        return;
      }
      console.error(
        `[ingest] Graphiti decision ingest failed: ${response.status} ${body}`,
      );
      return;
    }

    await ctx.runMutation(internal.ingest.patchDecisionEpisodeId, {
      decisionId: args.decisionId,
      graphitiEpisodeId: decision._id,
    });

    console.log("[ingest] Ingested decision:", args.decisionId);
  },
});
