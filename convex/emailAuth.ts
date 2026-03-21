import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.modify",
].join(" ");

export const getOAuthUrl = action({
  args: {
    userId: v.id("users"),
    workspaceId: v.id("workspaces"),
  },
  handler: async (_ctx, args) => {
    const clientId = process.env.GMAIL_CLIENT_ID;
    const redirectUri = process.env.GMAIL_REDIRECT_URI;
    if (!clientId || !redirectUri) {
      throw new Error(
        "GMAIL_CLIENT_ID and GMAIL_REDIRECT_URI must be configured",
      );
    }

    const state = JSON.stringify({
      userId: args.userId,
      workspaceId: args.workspaceId,
    });

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: GMAIL_SCOPES,
      access_type: "offline",
      prompt: "consent",
      state,
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  },
});

export const handleOAuthCallback = internalAction({
  args: {
    code: v.string(),
    userId: v.id("users"),
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    const clientId = process.env.GMAIL_CLIENT_ID;
    const clientSecret = process.env.GMAIL_CLIENT_SECRET;
    const redirectUri = process.env.GMAIL_REDIRECT_URI;
    if (!clientId || !clientSecret || !redirectUri) {
      throw new Error("Gmail OAuth environment variables not configured");
    }

    const tokenResponse = await fetch(
      "https://oauth2.googleapis.com/token",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code: args.code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: "authorization_code",
        }),
      },
    );

    if (!tokenResponse.ok) {
      const errorBody = await tokenResponse.text();
      throw new Error(`Token exchange failed: ${errorBody}`);
    }

    const tokens = (await tokenResponse.json()) as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
    };

    const profileResponse = await fetch(
      "https://www.googleapis.com/gmail/v1/users/me/profile",
      {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      },
    );

    if (!profileResponse.ok) {
      throw new Error("Failed to fetch Gmail profile");
    }

    const profile = (await profileResponse.json()) as {
      emailAddress: string;
    };

    const accountId = await ctx.runMutation(
      internal.emailAuth.createEmailAccount,
      {
        userId: args.userId,
        workspaceId: args.workspaceId,
        email: profile.emailAddress,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        tokenExpiresAt: Date.now() + tokens.expires_in * 1000,
      },
    );

    await ctx.scheduler.runAfter(0, internal.emailSync.initialSync, {
      emailAccountId: accountId,
    });

    return accountId;
  },
});

export const refreshToken = internalAction({
  args: {
    emailAccountId: v.id("emailAccounts"),
  },
  handler: async (ctx, args) => {
    const account = await ctx.runQuery(
      internal.emailAuth.getEmailAccount,
      { emailAccountId: args.emailAccountId },
    );
    if (!account) {
      throw new Error("Email account not found");
    }

    const clientId = process.env.GMAIL_CLIENT_ID;
    const clientSecret = process.env.GMAIL_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      throw new Error("Gmail OAuth environment variables not configured");
    }

    const tokenResponse = await fetch(
      "https://oauth2.googleapis.com/token",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: account.refreshToken,
          grant_type: "refresh_token",
        }),
      },
    );

    if (!tokenResponse.ok) {
      const errorBody = await tokenResponse.text();
      await ctx.runMutation(internal.emailAuth.updateAccountStatus, {
        emailAccountId: args.emailAccountId,
        status: "error",
        errorMessage: `Token refresh failed: ${errorBody}`,
      });
      throw new Error(`Token refresh failed: ${errorBody}`);
    }

    const tokens = (await tokenResponse.json()) as {
      access_token: string;
      expires_in: number;
    };

    await ctx.runMutation(internal.emailAuth.updateTokens, {
      emailAccountId: args.emailAccountId,
      accessToken: tokens.access_token,
      tokenExpiresAt: Date.now() + tokens.expires_in * 1000,
    });

    return tokens.access_token;
  },
});

export const getEmailAccount = internalQuery({
  args: { emailAccountId: v.id("emailAccounts") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.emailAccountId);
  },
});

export const createEmailAccount = internalMutation({
  args: {
    userId: v.id("users"),
    workspaceId: v.id("workspaces"),
    email: v.string(),
    accessToken: v.string(),
    refreshToken: v.string(),
    tokenExpiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("emailAccounts")
      .withIndex("by_user_email", (q) =>
        q.eq("userId", args.userId).eq("email", args.email),
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        accessToken: args.accessToken,
        refreshToken: args.refreshToken,
        tokenExpiresAt: args.tokenExpiresAt,
        status: "active",
        errorMessage: undefined,
      });
      return existing._id;
    }

    return await ctx.db.insert("emailAccounts", {
      userId: args.userId,
      workspaceId: args.workspaceId,
      provider: "gmail",
      email: args.email,
      accessToken: args.accessToken,
      refreshToken: args.refreshToken,
      tokenExpiresAt: args.tokenExpiresAt,
      status: "active",
    });
  },
});

export const updateTokens = internalMutation({
  args: {
    emailAccountId: v.id("emailAccounts"),
    accessToken: v.string(),
    tokenExpiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.emailAccountId, {
      accessToken: args.accessToken,
      tokenExpiresAt: args.tokenExpiresAt,
      status: "active",
      errorMessage: undefined,
    });
  },
});

export const updateAccountStatus = internalMutation({
  args: {
    emailAccountId: v.id("emailAccounts"),
    status: v.union(
      v.literal("active"),
      v.literal("disconnected"),
      v.literal("error"),
    ),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.emailAccountId, {
      status: args.status,
      errorMessage: args.errorMessage,
    });
  },
});
