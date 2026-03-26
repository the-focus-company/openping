import { query, mutation, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { requireAuth, requireUser } from "./auth";
import { cleanupEmptyPersonalWorkspaces } from "./invitations";

export const create = mutation({
  args: {
    name: v.string(),
    slug: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const existing = await ctx.db
      .query("workspaces")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
    if (existing) throw new Error("Workspace slug already taken");

    const workspaceId = await ctx.db.insert("workspaces", {
      name: args.name,
      slug: args.slug,
      createdBy: user._id,
    });

    await ctx.db.insert("workspaceMembers", {
      userId: user._id,
      workspaceId,
      role: "admin",
      joinedAt: Date.now(),
    });

    // Create a default #general channel
    const channelId = await ctx.db.insert("channels", {
      name: "general",
      description: "General discussion",
      workspaceId,
      createdBy: user._id,
      isDefault: true,
      isArchived: false,
    });

    await ctx.db.insert("channelMembers", {
      channelId,
      userId: user._id,
    });

    // Provision managed agents (mrPING etc.)
    await ctx.scheduler.runAfter(
      0,
      internal.managedAgents.ensureManagedAgents,
      { workspaceId },
    );

    return workspaceId;
  },
});

export const get = query({
  args: {
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx, args.workspaceId);
    return await ctx.db.get(args.workspaceId);
  },
});

export const update = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    name: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx, args.workspaceId);
    if (user.role !== "admin") {
      throw new Error("Only admins can update the workspace");
    }
    if (args.name !== undefined) {
      await ctx.db.patch(args.workspaceId, { name: args.name });
    }
  },
});

export const setWorkosOrgId = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    workosOrgId: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.workspaceId, { workosOrgId: args.workosOrgId });
  },
});

export const connectIntegration = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    provider: v.union(v.literal("github"), v.literal("linear")),
    accountName: v.string(),
    // Optional external org/workspace identifier for webhook routing
    orgId: v.optional(v.string()),
    // Webhook signing secret for signature verification
    webhookSecret: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx, args.workspaceId);
    if (user.role !== "admin") {
      throw new Error("Only admins can manage integrations");
    }

    const workspace = await ctx.db.get(args.workspaceId);
    if (!workspace) throw new Error("Workspace not found");

    // Update integrationConfig (UI state)
    const existingConfig = workspace.integrationConfig ?? {};
    const updatedConfig = {
      ...existingConfig,
      [args.provider]: {
        connected: true,
        ...(args.provider === "github"
          ? { accountName: args.accountName }
          : { orgName: args.accountName }),
        connectedAt: Date.now(),
      },
    };

    // Update integrations (webhook lookup) with orgId for multi-workspace routing
    const existingIntegrations = (workspace.integrations as Record<string, unknown>) ?? {};
    const updatedIntegrations = {
      ...existingIntegrations,
      ...(args.provider === "github" && args.orgId
        ? { githubOrgLogin: args.orgId }
        : {}),
      ...(args.provider === "github" && args.webhookSecret
        ? { githubWebhookSecret: args.webhookSecret }
        : {}),
      ...(args.provider === "linear" && args.orgId
        ? { linearOrgId: args.orgId }
        : {}),
      ...(args.provider === "linear" && args.webhookSecret
        ? { linearWebhookSecret: args.webhookSecret }
        : {}),
    };

    await ctx.db.patch(args.workspaceId, {
      integrationConfig: updatedConfig,
      integrations: updatedIntegrations,
    });
  },
});

export const disconnectIntegration = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    provider: v.union(v.literal("github"), v.literal("linear")),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx, args.workspaceId);
    if (user.role !== "admin") {
      throw new Error("Only admins can manage integrations");
    }

    const workspace = await ctx.db.get(args.workspaceId);
    if (!workspace) throw new Error("Workspace not found");

    const existing = workspace.integrationConfig ?? {};
    const updated = {
      ...existing,
      [args.provider]: { connected: false },
    };

    await ctx.db.patch(args.workspaceId, { integrationConfig: updated });
  },
});

export const getBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("workspaces")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
  },
});

export const getPublicInfo = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    const workspace = await ctx.db
      .query("workspaces")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
    if (!workspace) return null;
    return {
      _id: workspace._id,
      name: workspace.name,
      slug: workspace.slug,
      publicInviteEnabled: workspace.publicInviteEnabled,
    };
  },
});

export const joinViaPublicLink = mutation({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const workspace = await ctx.db
      .query("workspaces")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
    if (!workspace) throw new Error("Workspace not found");
    if (!workspace.publicInviteEnabled) throw new Error("Public invite is not enabled for this workspace");

    const existingMembership = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_user_workspace", (q) =>
        q.eq("userId", user._id).eq("workspaceId", workspace._id),
      )
      .unique();

    if (existingMembership) {
      return { alreadyMember: true, workspaceId: workspace._id, slug: workspace.slug };
    }

    await ctx.db.insert("workspaceMembers", {
      userId: user._id,
      workspaceId: workspace._id,
      role: "member",
      joinedAt: Date.now(),
    });

    // Auto-join #general channel
    const generalChannel = await ctx.db
      .query("channels")
      .withIndex("by_workspace_name", (q) =>
        q.eq("workspaceId", workspace._id).eq("name", "general"),
      )
      .unique();

    if (generalChannel) {
      await ctx.db.insert("channelMembers", {
        channelId: generalChannel._id,
        userId: user._id,
      });
    }

    await cleanupEmptyPersonalWorkspaces(ctx, user._id, workspace._id);

    return { alreadyMember: false, workspaceId: workspace._id, slug: workspace.slug };
  },
});

export const togglePublicInvite = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    enabled: v.boolean(),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx, args.workspaceId);
    if (user.role !== "admin") {
      throw new Error("Only admins can toggle public invite");
    }
    await ctx.db.patch(args.workspaceId, { publicInviteEnabled: args.enabled });
  },
});

export const listForUser = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const memberships = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    const workspaces = await Promise.all(
      memberships.map((m) => ctx.db.get(m.workspaceId)),
    );
    return workspaces.filter(Boolean) as NonNullable<(typeof workspaces)[number]>[];
  },
});

export const getPublicInfo = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    const workspace = await ctx.db
      .query("workspaces")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
    if (!workspace) return null;
    return {
      _id: workspace._id,
      name: workspace.name,
      slug: workspace.slug,
      publicInviteEnabled: workspace.publicInviteEnabled,
    };
  },
});

export const joinViaPublicLink = mutation({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const workspace = await ctx.db
      .query("workspaces")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
    if (!workspace) throw new Error("Workspace not found");
    if (!workspace.publicInviteEnabled) {
      throw new Error("Public join is not enabled for this workspace");
    }

    const existingMembership = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_user_workspace", (q) =>
        q.eq("userId", user._id).eq("workspaceId", workspace._id),
      )
      .unique();

    if (existingMembership) {
      return { workspaceId: workspace._id, slug: workspace.slug, alreadyMember: true };
    }

    await ctx.db.insert("workspaceMembers", {
      userId: user._id,
      workspaceId: workspace._id,
      role: "member",
      joinedAt: Date.now(),
    });

    // Auto-join #general channel
    const generalChannel = await ctx.db
      .query("channels")
      .withIndex("by_workspace_name", (q) =>
        q.eq("workspaceId", workspace._id).eq("name", "general"),
      )
      .unique();

    if (generalChannel) {
      await ctx.db.insert("channelMembers", {
        channelId: generalChannel._id,
        userId: user._id,
      });
    }

    await cleanupEmptyPersonalWorkspaces(ctx, user._id, workspace._id);

    return { workspaceId: workspace._id, slug: workspace.slug, alreadyMember: false };
  },
});

export const togglePublicInvite = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    enabled: v.boolean(),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx, args.workspaceId);
    if (user.role !== "admin") {
      throw new Error("Only admins can toggle public invite");
    }
    await ctx.db.patch(args.workspaceId, { publicInviteEnabled: args.enabled });
  },
});
