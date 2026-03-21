import { query, mutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { requireAuth, requireUser } from "./auth";

export const getOnboardingState = query({
  args: {
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx, args.workspaceId);
    const workspace = await ctx.db.get(args.workspaceId);

    return {
      onboardingStatus: user.onboardingStatus,
      role: user.role,
      userName: user.name,
      userEmail: user.email,
      workspaceName: workspace?.name,
      workspaceId: args.workspaceId,
    };
  },
});

export const savePersonalContext = mutation({
  args: {
    title: v.optional(v.string()),
    department: v.optional(v.string()),
    bio: v.optional(v.string()),
    expertise: v.optional(v.array(v.string())),
    workContext: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    await ctx.db.patch(user._id, {
      title: args.title,
      department: args.department,
      bio: args.bio,
      expertise: args.expertise,
      workContext: args.workContext,
    });
  },
});

export const saveCompanyContext = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    companyName: v.optional(v.string()),
    slug: v.optional(v.string()),
    industry: v.optional(v.string()),
    companySize: v.optional(v.string()),
    companyDescription: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx, args.workspaceId);
    if (user.role !== "admin") {
      throw new Error("Only admins can update company context");
    }

    const updates: Record<string, unknown> = {};
    if (args.industry !== undefined) updates.industry = args.industry;
    if (args.companySize !== undefined) updates.companySize = args.companySize;
    if (args.companyDescription !== undefined) updates.companyDescription = args.companyDescription;
    if (args.companyName !== undefined) updates.name = args.companyName;

    if (args.slug) {
      const normalized = args.slug.toLowerCase().replace(/[^a-z0-9-]/g, "");
      if (!normalized) throw new Error("Invalid slug");
      const existing = await ctx.db
        .query("workspaces")
        .withIndex("by_slug", (q) => q.eq("slug", normalized))
        .unique();
      if (existing && existing._id !== args.workspaceId) {
        throw new Error("Slug already taken");
      }
      updates.slug = normalized;
    }

    await ctx.db.patch(args.workspaceId, updates);

    // Update WorkOS organization name if company name changed
    if (args.companyName) {
      const workspace = await ctx.db.get(args.workspaceId);
      if (workspace?.workosOrgId) {
        await ctx.scheduler.runAfter(0, internal.workos.updateOrganization, {
          workosOrgId: workspace.workosOrgId,
          name: args.companyName,
        });
      }
    }
  },
});

export const createDefaultChannels = mutation({
  args: {
    channelNames: v.array(v.string()),
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx, args.workspaceId);
    if (user.role !== "admin") {
      throw new Error("Only admins can create default channels");
    }

    const createdNames: string[] = [];

    for (const name of args.channelNames) {
      const existing = await ctx.db
        .query("channels")
        .withIndex("by_workspace_name", (q) =>
          q.eq("workspaceId", args.workspaceId).eq("name", name),
        )
        .unique();

      if (existing) continue;

      const channelId = await ctx.db.insert("channels", {
        name,
        workspaceId: args.workspaceId,
        createdBy: user._id,
        isDefault: false,
        isArchived: false,
        type: "public",
      });

      await ctx.db.insert("channelMembers", {
        channelId,
        userId: user._id,
      });

      createdNames.push(name);
    }

    await ctx.db.patch(args.workspaceId, {
      defaultChannels: createdNames,
    });
  },
});

export const saveAiPrefs = mutation({
  args: {
    aiPrefs: v.object({
      summaryDetail: v.union(v.literal("concise"), v.literal("detailed")),
      proactiveLevel: v.union(v.literal("minimal"), v.literal("balanced"), v.literal("aggressive")),
      autoTriage: v.boolean(),
    }),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    await ctx.db.patch(user._id, { aiPrefs: args.aiPrefs });
  },
});

export const saveCommunicationPrefs = mutation({
  args: {
    communicationPrefs: v.object({
      timezone: v.optional(v.string()),
      preferredHours: v.optional(v.string()),
      responseTimeGoal: v.optional(v.string()),
    }),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    await ctx.db.patch(user._id, { communicationPrefs: args.communicationPrefs });
  },
});

export const completeOnboarding = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    await ctx.db.patch(user._id, { onboardingStatus: "completed" });
  },
});
