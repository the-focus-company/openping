import { query } from "./_generated/server";

export const listWorkspaces = query({
  args: {},
  handler: async (ctx) => {
    const workspaces = await ctx.db.query("workspaces").collect();

    const results = await Promise.all(
      workspaces.map(async (ws) => {
        const members = await ctx.db
          .query("users")
          .withIndex("by_workspace", (q) => q.eq("workspaceId", ws._id))
          .collect();

        const activeMembers = members.filter((m) => m.status === "active");

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
