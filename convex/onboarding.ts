import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAuth } from "./auth";

export const getOnboardingState = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireAuth(ctx);
    const workspace = await ctx.db.get(user.workspaceId);

    return {
      onboardingStatus: user.onboardingStatus,
      role: user.role,
      userName: user.name,
      userEmail: user.email,
      workspaceName: workspace?.name,
      workspaceId: user.workspaceId,
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
    const user = await requireAuth(ctx);
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
    companyName: v.optional(v.string()),
    industry: v.optional(v.string()),
    companySize: v.optional(v.string()),
    companyDescription: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    if (user.role !== "admin") {
      throw new Error("Only admins can update company context");
    }

    const updates: Record<string, unknown> = {};
    if (args.industry !== undefined) updates.industry = args.industry;
    if (args.companySize !== undefined) updates.companySize = args.companySize;
    if (args.companyDescription !== undefined) updates.companyDescription = args.companyDescription;
    if (args.companyName !== undefined) updates.name = args.companyName;

    await ctx.db.patch(user.workspaceId, updates);
  },
});

export const createDefaultChannels = mutation({
  args: {
    channelNames: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    if (user.role !== "admin") {
      throw new Error("Only admins can create default channels");
    }

    const createdNames: string[] = [];

    for (const name of args.channelNames) {
      const existing = await ctx.db
        .query("channels")
        .withIndex("by_workspace_name", (q) =>
          q.eq("workspaceId", user.workspaceId).eq("name", name),
        )
        .unique();

      if (existing) continue;

      const channelId = await ctx.db.insert("channels", {
        name,
        workspaceId: user.workspaceId,
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

    await ctx.db.patch(user.workspaceId, {
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
    const user = await requireAuth(ctx);
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
    const user = await requireAuth(ctx);
    await ctx.db.patch(user._id, { communicationPrefs: args.communicationPrefs });
  },
});

export const completeOnboarding = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireAuth(ctx);
    await ctx.db.patch(user._id, { onboardingStatus: "completed" });
  },
});
