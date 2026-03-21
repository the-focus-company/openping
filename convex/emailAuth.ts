import { query } from "./_generated/server";
import { v } from "convex/values";
import { requireUser } from "./auth";

/**
 * Stub: returns a placeholder OAuth URL for email account connection.
 * In production this would generate a real Google/Microsoft OAuth URL
 * with proper state parameters and redirect URIs.
 *
 * Using a query instead of action since we don't have `action` imported
 * elsewhere in this codebase. The real implementation would be an HTTP action
 * that redirects to the OAuth provider.
 */
export const getOAuthUrl = query({
  args: {
    provider: v.union(v.literal("gmail"), v.literal("outlook")),
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    // Stub: return a placeholder URL
    // In production, this would:
    // 1. Generate a state token and store it in sessions
    // 2. Build the OAuth authorization URL for the provider
    // 3. Return the URL for client-side redirect
    const baseUrl =
      args.provider === "gmail"
        ? "https://accounts.google.com/o/oauth2/v2/auth"
        : "https://login.microsoftonline.com/common/oauth2/v2/authorize";

    return {
      url: `${baseUrl}?client_id=PLACEHOLDER&redirect_uri=PLACEHOLDER&scope=email&state=${user._id}`,
      provider: args.provider,
    };
  },
});
