import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { WorkOS } from "@workos-inc/node";

const workos = new WorkOS(process.env.WORKOS_API_KEY);

export const updateOrganization = internalAction({
  args: {
    workosOrgId: v.string(),
    name: v.string(),
  },
  handler: async (_ctx, args) => {
    await workos.organizations.updateOrganization({
      organization: args.workosOrgId,
      name: args.name,
    });
  },
});

export const createOrganization = internalAction({
  args: {
    workspaceId: v.id("workspaces"),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const org = await workos.organizations.createOrganization({
      name: args.name,
    });

    await ctx.runMutation(internal.workspaces.setWorkosOrgId, {
      workspaceId: args.workspaceId,
      workosOrgId: org.id,
    });

    return org.id;
  },
});
