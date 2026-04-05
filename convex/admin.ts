import { query } from "./_generated/server";
import { requireUser } from "./auth";

export const listWorkspaces = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);

    // Verify the caller is an admin in at least one workspace
    const adminMembership = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .filter((q) => q.eq(q.field("role"), "admin"))
      .first();
    if (!adminMembership) {
      throw new Error("Admin access required");
    }

    // Only return workspaces where this user is admin
    const allMemberships = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .take(100);
    const adminWorkspaceIds = allMemberships
      .filter((m) => m.role === "admin")
      .map((m) => m.workspaceId);
    const workspaces = (
      await Promise.all(adminWorkspaceIds.map((id) => ctx.db.get(id)))
    ).filter((ws): ws is NonNullable<typeof ws> => ws !== null);

    const results = await Promise.all(
      workspaces.map(async (ws) => {
        const memberships = await ctx.db
          .query("workspaceMembers")
          .withIndex("by_workspace", (q) => q.eq("workspaceId", ws._id))
          .take(1000);

        const members = await Promise.all(
          memberships.map((m) => ctx.db.get(m.userId)),
        );

        const activeMembers = members.filter((m) => m && m.status === "active");

        return {
          _id: ws._id,
          name: ws.name,
          slug: ws.slug,
          memberCount: activeMembers.length,
          creationTime: ws._creationTime,
        };
      }),
    );

    return results;
  },
});
