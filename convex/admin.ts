import { query } from "./_generated/server";

export const listWorkspaces = query({
  args: {},
  handler: async (ctx) => {
    const workspaces = await ctx.db.query("workspaces").collect();

    const results = await Promise.all(
      workspaces.map(async (ws) => {
        const memberships = await ctx.db
          .query("workspaceMembers")
          .withIndex("by_workspace", (q) => q.eq("workspaceId", ws._id))
          .collect();

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
