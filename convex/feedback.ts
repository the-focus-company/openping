import { v } from "convex/values";
import { mutation, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { requireAuth } from "./auth";

export const submit = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    type: v.union(v.literal("bug"), v.literal("idea")),
    message: v.string(),
    context: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx, args.workspaceId);

    await ctx.db.insert("feedback", {
      userId: user._id,
      workspaceId: args.workspaceId,
      type: args.type,
      message: args.message,
      context: args.context,
    });

    await ctx.scheduler.runAfter(0, internal.feedback.createLinearIssue, {
      type: args.type,
      message: args.message,
      context: args.context,
      userName: user.name,
      userEmail: user.email,
    });
  },
});

export const createLinearIssue = internalAction({
  args: {
    type: v.union(v.literal("bug"), v.literal("idea")),
    message: v.string(),
    context: v.optional(v.string()),
    userName: v.string(),
    userEmail: v.string(),
  },
  handler: async (_ctx, args) => {
    const apiKey = process.env.LINEAR_API_KEY;
    const teamId = process.env.LINEAR_TEAM_ID;
    if (!apiKey || !teamId) return;

    const labelPrefix = args.type === "bug" ? "Bug" : "Feature";
    const title =
      args.message.length > 80
        ? args.message.slice(0, 77) + "..."
        : args.message;

    const description = [
      `**Type:** ${args.type === "bug" ? "🐛 Bug" : "💡 Idea"}`,
      `**From:** ${args.userName} (${args.userEmail})`,
      args.context ? `**Page:** \`${args.context}\`` : null,
      "",
      args.message,
    ]
      .filter(Boolean)
      .join("\n");

    const query = `
      mutation IssueCreate($input: IssueCreateInput!) {
        issueCreate(input: $input) {
          success
          issue { id identifier url }
        }
      }
    `;

    const resp = await fetch("https://api.linear.app/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: apiKey,
      },
      body: JSON.stringify({
        query,
        variables: {
          input: {
            teamId,
            title: `[${labelPrefix}] ${title}`,
            description,
            labelIds: process.env.LINEAR_FEEDBACK_LABEL_ID
              ? [process.env.LINEAR_FEEDBACK_LABEL_ID]
              : undefined,
          },
        },
      }),
    });

    if (!resp.ok) {
      console.error("Linear API error:", resp.status, await resp.text());
    }
  },
});
