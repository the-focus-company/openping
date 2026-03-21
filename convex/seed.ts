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
      status: "active",
    });

    const workspaceId = await ctx.db.insert("workspaces", {
      name: "Default Workspace",
      slug: "default",
      createdBy: systemUserId,
    });

    // Create workspace membership for system user
    await ctx.db.insert("workspaceMembers", {
      userId: systemUserId,
      workspaceId,
      role: "admin",
      joinedAt: Date.now(),
    });

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
