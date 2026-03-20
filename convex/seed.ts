import { internalMutation } from "./_generated/server";

export const seedDefaultData = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Check if default workspace already exists
    const existingWorkspace = await ctx.db
      .query("workspaces")
      .withIndex("by_slug", (q) => q.eq("slug", "default"))
      .unique();

    if (existingWorkspace) return;

    // Create a system user for seeding
    const systemUserId = await ctx.db.insert("users", {
      workosUserId: "system",
      email: "system@ping.app",
      name: "System",
      role: "admin",
      workspaceId: "" as any, // Will be updated
      status: "active",
    });

    const workspaceId = await ctx.db.insert("workspaces", {
      name: "Default Workspace",
      slug: "default",
      createdBy: systemUserId,
    });

    // Update system user with workspace
    await ctx.db.patch(systemUserId, { workspaceId });

    // Create default channels
    const generalId = await ctx.db.insert("channels", {
      name: "general",
      description: "Company-wide announcements and discussion",
      workspaceId,
      createdBy: systemUserId,
      isDefault: true,
      isArchived: false,
      type: "public",
    });

    await ctx.db.insert("channels", {
      name: "engineering",
      description: "Engineering team discussions",
      workspaceId,
      createdBy: systemUserId,
      isDefault: true,
      isArchived: false,
      type: "public",
    });

    // Add system user to channels
    await ctx.db.insert("channelMembers", {
      channelId: generalId,
      userId: systemUserId,
    });
  },
});
