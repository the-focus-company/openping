import { query, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { requireUser } from "./auth";

export const upsert = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    type: v.union(v.literal("github_pr"), v.literal("linear_ticket")),
    externalId: v.string(),
    title: v.string(),
    status: v.string(),
    url: v.string(),
    author: v.string(),
    metadata: v.any(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("integrationObjects")
      .withIndex("by_external_id", (q) => q.eq("externalId", args.externalId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        title: args.title,
        status: args.status,
        url: args.url,
        author: args.author,
        metadata: args.metadata,
        lastSyncedAt: Date.now(),
      });
      return existing._id;
    }

    return await ctx.db.insert("integrationObjects", {
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
      .collect();

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
      .collect();

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
        .collect();
    }

    return await ctx.db
      .query("integrationObjects")
      .withIndex("by_workspace", (q) =>
        q.eq("workspaceId", args.workspaceId),
      )
      .collect();
  },
});
