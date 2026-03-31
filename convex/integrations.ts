import { query, mutation, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { requireAuth, requireUser } from "./auth";
import { integrationMetadataValidator } from "./schema";

function truncate(text: string, maxLen: number): string {
  return text.length > maxLen ? text.slice(0, maxLen) + "..." : text;
}

function buildIntegrationMessageBody(
  type: "github_pr" | "linear_ticket",
  title: string,
  status: string,
  url: string,
  author: string,
  metadata: Record<string, unknown>,
  isUpdate: boolean,
): string {
  const action = isUpdate ? "updated" : "created";
  const description = truncate((metadata?.description as string) ?? "", 120);

  if (type === "github_pr") {
    const repo = (metadata?.repo as string) ?? "";
    const prNumber = (metadata?.number as number) ?? "";
    const parts = [
      `**[GitHub PR ${action}]** [#${prNumber} ${title}](${url})`,
      repo ? `Repository: \`${repo}\`` : null,
      `Author: ${author} | Status: ${status}`,
      description ? `> ${description}` : null,
    ];
    return parts.filter(Boolean).join("\n");
  }

  const priority = (metadata?.priority as string) ?? "";
  const identifier = (metadata?.identifier as string) ?? "";
  const parts = [
    `**[Linear ticket ${action}]** [${identifier ? `${identifier} ` : ""}${title}](${url})`,
    `Author: ${author} | Status: ${status}${priority ? ` | Priority: ${priority}` : ""}`,
    description ? `> ${description}` : null,
  ];
  return parts.filter(Boolean).join("\n");
}

/**
 * Find a workspace whose `integrations.linearOrgId` matches the given Linear
 * organization ID.  Falls back to the first workspace in the DB when no match
 * is found so that single-workspace deployments work out of the box.
 */
export const findWorkspaceByLinearOrgId = internalQuery({
  args: { linearOrgId: v.string() },
  handler: async (ctx, args) => {
    // Scan all workspaces – the table is small (one per tenant).
    const workspaces = await ctx.db.query("workspaces").collect();

    for (const ws of workspaces) {
      if (ws.integrations?.linearOrgId === args.linearOrgId) {
        return ws;
      }
    }

    // Fallback: return the first workspace (single-workspace deployments).
    return workspaces[0] ?? null;
  },
});

export const findWorkspaceByGithubOrg = internalQuery({
  args: { orgLogin: v.string() },
  handler: async (ctx, args) => {
    const workspaces = await ctx.db.query("workspaces").collect();
    for (const ws of workspaces) {
      if (ws.integrations?.githubOrgLogin === args.orgLogin) {
        return ws;
      }
    }
    // Fallback: first workspace (single-workspace deployments)
    return workspaces[0] ?? null;
  },
});

export const upsert = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    type: v.union(v.literal("github_pr"), v.literal("linear_ticket")),
    externalId: v.string(),
    title: v.string(),
    status: v.string(),
    url: v.string(),
    author: v.string(),
    metadata: integrationMetadataValidator,
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("integrationObjects")
      .withIndex("by_external_id", (q) => q.eq("externalId", args.externalId))
      .unique();

    const isUpdate = !!existing;
    let objectId;

    if (existing) {
      await ctx.db.patch(existing._id, {
        title: args.title,
        status: args.status,
        url: args.url,
        author: args.author,
        metadata: args.metadata,
        lastSyncedAt: Date.now(),
      });
      objectId = existing._id;
    } else {
      objectId = await ctx.db.insert("integrationObjects", {
        workspaceId: args.workspaceId,
        type: args.type,
        externalId: args.externalId,
        title: args.title,
        status: args.status,
        url: args.url,
        author: args.author,
        metadata: args.metadata,
        lastSyncedAt: Date.now(),
      });
    }

    const integrationType = args.type === "github_pr" ? "github" : "linear";
    const routingRules = await ctx.db
      .query("integrationRouting")
      .withIndex("by_workspace_type", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("integrationType", integrationType),
      )
      .collect();

    const meta = args.metadata as Record<string, unknown> | undefined;
    const objectTarget =
      integrationType === "github"
        ? ((meta?.repo as string) ?? "")
        : ((meta?.project as string) ?? "");

    // Use workspace creator as the message author for integration posts
    const workspace = await ctx.db.get(args.workspaceId);
    const botUserId = workspace?.createdBy;

    if (botUserId) {
      const body = buildIntegrationMessageBody(
        args.type,
        args.title,
        args.status,
        args.url,
        args.author,
        (meta ?? {}) as Record<string, unknown>,
        isUpdate,
      );

      for (const rule of routingRules) {
        if (rule.externalTarget !== "*" && objectTarget && rule.externalTarget !== objectTarget) {
          continue;
        }

        // For updates, find and edit the existing message instead of creating a new one
        if (isUpdate) {
          const existingMessages = await ctx.db
            .query("messages")
            .withIndex("by_channel", (q) => q.eq("channelId", rule.channelId))
            .order("desc")
            .take(100);

          const existingMsg = existingMessages.find(
            (m) => m.type === "integration" && m.integrationObjectId === objectId,
          );

          if (existingMsg) {
            const history = (existingMsg.integrationHistory as Array<{ body: string; timestamp: number }>) ?? [];
            history.push({ body: existingMsg.body, timestamp: existingMsg._creationTime });
            await ctx.db.patch(existingMsg._id, {
              body,
              isEdited: true,
              integrationHistory: history,
            });
            continue;
          }
        }

        const messageId = await ctx.db.insert("messages", {
          channelId: rule.channelId,
          authorId: botUserId,
          body,
          type: "integration",
          integrationObjectId: objectId,
          isEdited: false,
        });

        // Ingest integration message into knowledge graph
        await ctx.scheduler.runAfter(0, internal.ingest.processMessage, {
          messageId,
        });
      }
    }

    // Ingest the integration object itself into knowledge graph
    await ctx.scheduler.runAfter(0, internal.ingest.processIntegrationObject, {
      objectId,
    });

    return objectId;
  },
});

export const listOpenPRs = internalQuery({
  args: {
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    const prs = await ctx.db
      .query("integrationObjects")
      .withIndex("by_workspace_type", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("type", "github_pr"),
      )
      .take(500);

    return prs.filter((pr) => pr.status === "open" || pr.status === "draft");
  },
});

export const listInProgressTickets = internalQuery({
  args: {
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    const tickets = await ctx.db
      .query("integrationObjects")
      .withIndex("by_workspace_type", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("type", "linear_ticket"),
      )
      .take(500);

    return tickets.filter((t) => t.status === "In Progress");
  },
});

export const getByExternalId = query({
  args: { externalId: v.string() },
  handler: async (ctx, args) => {
    await requireUser(ctx);

    return await ctx.db
      .query("integrationObjects")
      .withIndex("by_external_id", (q) =>
        q.eq("externalId", args.externalId),
      )
      .unique();
  },
});

export const listByWorkspace = query({
  args: {
    workspaceId: v.id("workspaces"),
    type: v.optional(
      v.union(v.literal("github_pr"), v.literal("linear_ticket")),
    ),
  },
  handler: async (ctx, args) => {
    await requireUser(ctx);

    if (args.type) {
      return await ctx.db
        .query("integrationObjects")
        .withIndex("by_workspace_type", (q) =>
          q.eq("workspaceId", args.workspaceId).eq("type", args.type!),
        )
        .take(500);
    }

    return await ctx.db
      .query("integrationObjects")
      .withIndex("by_workspace", (q) =>
        q.eq("workspaceId", args.workspaceId),
      )
      .take(500);
  },
});

export const addRouting = mutation({
  args: {
    channelId: v.id("channels"),
    workspaceId: v.id("workspaces"),
    integrationType: v.union(v.literal("github"), v.literal("linear")),
    externalTarget: v.string(),
    externalTargetLabel: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx, args.workspaceId);

    const channel = await ctx.db.get(args.channelId);
    if (!channel || channel.workspaceId !== args.workspaceId) {
      throw new Error("Channel not found in this workspace");
    }

    const existing = await ctx.db
      .query("integrationRouting")
      .withIndex("by_channel_type_target", (q) =>
        q
          .eq("channelId", args.channelId)
          .eq("integrationType", args.integrationType)
          .eq("externalTarget", args.externalTarget),
      )
      .unique();
    if (existing) throw new Error("Routing rule already exists");

    return await ctx.db.insert("integrationRouting", {
      channelId: args.channelId,
      workspaceId: args.workspaceId,
      integrationType: args.integrationType,
      externalTarget: args.externalTarget,
      externalTargetLabel: args.externalTargetLabel,
      createdBy: user._id,
    });
  },
});

export const removeRouting = mutation({
  args: {
    routingId: v.id("integrationRouting"),
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx, args.workspaceId);

    const rule = await ctx.db.get(args.routingId);
    if (!rule || rule.workspaceId !== args.workspaceId) {
      throw new Error("Routing rule not found");
    }

    await ctx.db.delete(args.routingId);
  },
});

export const listRoutingByChannel = query({
  args: {
    channelId: v.id("channels"),
  },
  handler: async (ctx, args) => {
    await requireUser(ctx);

    return await ctx.db
      .query("integrationRouting")
      .withIndex("by_channel", (q) => q.eq("channelId", args.channelId))
      .collect();
  },
});

export const listRoutingByWorkspace = query({
  args: {
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx, args.workspaceId);

    return await ctx.db
      .query("integrationRouting")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();
  },
});
