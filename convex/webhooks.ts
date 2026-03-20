import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { createOrUpdateUserHandler } from "./users";

export const getDefaultWorkspace = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("workspaces")
      .withIndex("by_slug", (q) => q.eq("slug", "default"))
      .unique();
  },
});

export const internalCreateOrUpdateUser = internalMutation({
  args: {
    workosUserId: v.string(),
    email: v.string(),
    name: v.string(),
    avatarUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await createOrUpdateUserHandler(ctx, args);
  },
});

export const deactivateUser = internalMutation({
  args: { workosUserId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_workos_id", (q) =>
        q.eq("workosUserId", args.workosUserId),
      )
      .unique();

    if (!user) return;

    await ctx.db.patch(user._id, { status: "deactivated" });
  },
});

export const postSystemMessage = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    channelName: v.string(),
    body: v.string(),
    integrationObjectId: v.optional(v.id("integrationObjects")),
  },
  handler: async (ctx, args) => {
    // Find system user
    const systemUser = await ctx.db
      .query("users")
      .withIndex("by_workos_id", (q) => q.eq("workosUserId", "system"))
      .unique();

    if (!systemUser) return;

    // Find channel by name, fall back to "engineering" then "general"
    let channel = await ctx.db
      .query("channels")
      .withIndex("by_workspace_name", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("name", args.channelName),
      )
      .unique();

    if (!channel) {
      channel = await ctx.db
        .query("channels")
        .withIndex("by_workspace_name", (q) =>
          q.eq("workspaceId", args.workspaceId).eq("name", "engineering"),
        )
        .unique();
    }

    if (!channel) {
      channel = await ctx.db
        .query("channels")
        .withIndex("by_workspace_name", (q) =>
          q.eq("workspaceId", args.workspaceId).eq("name", "general"),
        )
        .unique();
    }

    if (!channel) return;

    await ctx.db.insert("messages", {
      channelId: channel._id,
      authorId: systemUser._id,
      body: args.body,
      type: "system",
      integrationObjectId: args.integrationObjectId,
      isEdited: false,
    });
  },
});
