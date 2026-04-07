import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api, internal } from "./_generated/api";

const http = httpRouter();

http.route({
  path: "/webhooks/workos",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const rawBody = await request.text();

    // Verify WorkOS webhook signature
    const secret = process.env.WORKOS_WEBHOOK_SECRET;
    if (secret) {
      const sigHeader = request.headers.get("workos-signature");
      if (!sigHeader) {
        return new Response(JSON.stringify({ error: "Missing signature" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }
      // WorkOS signature format: t=<timestamp>, v1=<hash>
      const parts = Object.fromEntries(
        sigHeader.split(", ").map((p) => p.split("=", 2) as [string, string]),
      );
      const timestamp = parts.t;
      const sigHash = parts.v1;
      if (!timestamp || !sigHash) {
        return new Response(JSON.stringify({ error: "Malformed signature" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }
      const expected = await hmacSha256Hex(secret, `${timestamp}.${rawBody}`);
      if (!timingSafeEqual(sigHash, expected)) {
        return new Response(JSON.stringify({ error: "Invalid signature" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    const body = JSON.parse(rawBody);
    const eventType = body.event;

    switch (eventType) {
      case "user.created":
      case "user.updated": {
        const {
          id,
          email,
          first_name,
          last_name,
          profile_picture_url,
        } = body.data;

        const result = await ctx.runMutation(api.users.createOrUpdate, {
          workosUserId: id,
          email: email ?? "",
          name: [first_name, last_name].filter(Boolean).join(" ") || "User",
          avatarUrl: profile_picture_url ?? undefined,
        });

        if (result.isNew && !result.wasInvited) {
          await ctx.runAction(internal.workos.createOrganization, {
            workspaceId: result.workspaceId,
            name: result.workspaceName,
          });
        }
        break;
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }),
});

// ---------------------------------------------------------------------------
// Linear issue webhooks
// ---------------------------------------------------------------------------

/** Constant-time string comparison to prevent timing attacks. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

/** Compute HMAC-SHA256 hex digest using the Web Crypto API. */
async function hmacSha256Hex(
  secret: string,
  message: string,
): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

http.route({
  path: "/webhooks/linear",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    // ---- Read body as text so we can verify the signature ----
    const rawBody = await request.text();
    const body: Record<string, unknown> = JSON.parse(rawBody);

    // ---- Resolve workspace first (need its secret for verification) ----
    const linearOrgId = (body.organizationId as string) ?? "";
    const workspace = await ctx.runQuery(
      internal.integrations.findWorkspaceByLinearOrgId,
      { linearOrgId },
    );

    if (!workspace) {
      return new Response(
        JSON.stringify({ error: "No workspace found for this Linear org" }),
        { status: 404, headers: { "Content-Type": "application/json" } },
      );
    }

    // ---- Signature verification (HMAC-SHA256) ----
    // Use per-workspace secret from integrations config, fall back to global env var
    const integrations = workspace.integrations as
      | { linearWebhookSecret?: string }
      | undefined;
    const secret = integrations?.linearWebhookSecret ?? process.env.LINEAR_WEBHOOK_SECRET;
    if (!secret) {
      return new Response(
        JSON.stringify({ error: "Webhook secret not configured" }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }

    const signatureHeader = request.headers.get("linear-signature");
    if (!signatureHeader) {
      return new Response(
        JSON.stringify({ error: "Missing linear-signature header" }),
        { status: 401, headers: { "Content-Type": "application/json" } },
      );
    }

    const expected = await hmacSha256Hex(secret, rawBody);

    if (!timingSafeEqual(signatureHeader, expected)) {
      return new Response(
        JSON.stringify({ error: "Invalid signature" }),
        { status: 401, headers: { "Content-Type": "application/json" } },
      );
    }

    const action = body.action as string | undefined;
    const type = body.type as string | undefined;

    // We only care about Issue events.
    if (type !== "Issue") {
      return new Response(JSON.stringify({ received: true, skipped: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const supportedActions = ["create", "update"];
    if (!action || !supportedActions.includes(action)) {
      return new Response(JSON.stringify({ received: true, skipped: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const data = body.data as Record<string, unknown> | undefined;
    if (!data) {
      return new Response(
        JSON.stringify({ error: "Missing data payload" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    // ---- Map Linear state to a friendly status string ----
    const stateObj = data.state as
      | { name?: string; type?: string }
      | undefined;
    let status = stateObj?.name ?? "Unknown";

    // Normalise completed / cancelled from the state type when available.
    if (stateObj?.type === "completed") status = "Done";
    if (stateObj?.type === "canceled" || stateObj?.type === "cancelled")
      status = "Cancelled";

    // ---- Extract metadata ----
    const assignee = data.assignee as
      | { name?: string; email?: string }
      | undefined;
    const labels = (
      data.labels as Array<{ name?: string }> | undefined
    )?.map((l) => l.name ?? "") ?? [];
    const priorityNum = data.priority as number | undefined;
    const priorityLabels: Record<number, string> = {
      0: "No priority",
      1: "Urgent",
      2: "High",
      3: "Medium",
      4: "Low",
    };

    const metadata = {
      linearId: data.id as string,
      identifier: data.identifier as string | undefined,
      priority: priorityNum != null ? (priorityLabels[priorityNum] ?? String(priorityNum)) : undefined,
      labels,
      assigneeEmail: assignee?.email,
      teamKey: (data.team as { key?: string } | undefined)?.key,
      createdAt: data.createdAt as string | undefined,
      updatedAt: data.updatedAt as string | undefined,
    };

    // ---- Upsert integration object ----
    await ctx.runMutation(internal.integrations.upsert, {
      workspaceId: workspace._id,
      type: "linear_ticket",
      externalId: `linear_${data.id as string}`,
      title: (data.title as string) ?? "Untitled",
      status,
      url: (data.url as string) ?? `https://linear.app/issue/${data.identifier ?? data.id}`,
      author: assignee?.name ?? "Unassigned",
      metadata,
    });

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }),
});

// ---------------------------------------------------------------------------
// GitHub PR webhooks
// ---------------------------------------------------------------------------

http.route({
  path: "/webhooks/github",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const rawBody = await request.text();

    const event = request.headers.get("x-github-event");
    if (event !== "pull_request") {
      return new Response(JSON.stringify({ received: true, skipped: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const body: Record<string, unknown> = JSON.parse(rawBody);
    const action = body.action as string | undefined;
    const supportedActions = ["opened", "closed", "reopened", "synchronize", "ready_for_review"];
    if (!action || !supportedActions.includes(action)) {
      return new Response(JSON.stringify({ received: true, skipped: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const pr = body.pull_request as Record<string, unknown> | undefined;
    const repo = body.repository as Record<string, unknown> | undefined;
    if (!pr || !repo) {
      return new Response(JSON.stringify({ error: "Missing pull_request or repository" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const orgLogin = (repo.owner as Record<string, unknown> | undefined)?.login as string ?? "";
    const workspace = await ctx.runQuery(
      internal.integrations.findWorkspaceByGithubOrg,
      { orgLogin },
    );
    if (!workspace) {
      return new Response(JSON.stringify({ error: "No workspace found for this GitHub org" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Verify HMAC-SHA256 signature — per-workspace secret with env var fallback
    const integrations = workspace.integrations as
      | { githubWebhookSecret?: string }
      | undefined;
    const secret = integrations?.githubWebhookSecret ?? process.env.GITHUB_WEBHOOK_SECRET;
    if (!secret) {
      return new Response(JSON.stringify({ error: "Webhook secret not configured" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const sigHeader = request.headers.get("x-hub-signature-256");
    if (!sigHeader) {
      return new Response(JSON.stringify({ error: "Missing x-hub-signature-256" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }
    const expected = "sha256=" + await hmacSha256Hex(secret, rawBody);
    if (!timingSafeEqual(sigHeader, expected)) {
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const isMerged = !!(pr.merged as boolean);
    let status: string;
    if (pr.state === "closed") {
      status = isMerged ? "Merged" : "Closed";
    } else if (pr.draft) {
      status = "Draft";
    } else {
      status = "Open";
    }

    const prUser = pr.user as Record<string, unknown> | undefined;
    const repoFullName = repo.full_name as string ?? "";

    await ctx.runMutation(internal.integrations.upsert, {
      workspaceId: workspace._id,
      type: "github_pr",
      externalId: `github_pr_${pr.id as number}`,
      title: (pr.title as string) ?? "Untitled PR",
      status,
      url: (pr.html_url as string) ?? "",
      author: (prUser?.login as string) ?? "unknown",
      metadata: {
        number: pr.number as number | undefined,
        repo: repoFullName,
        description: pr.body ? String(pr.body).slice(0, 200) : "",
        draft: pr.draft as boolean | undefined,
        merged: isMerged,
      },
    });

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }),
});

// ---------------------------------------------------------------------------
// Shared helpers for API authentication & rate limiting
// ---------------------------------------------------------------------------

type ApiCtx = {
  runQuery: (ref: any, args: any) => Promise<any>;
  runMutation: (ref: any, args: any) => Promise<any>;
};

type ApiCallerUser = {
  kind: "user";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  user: { _id: any; name: string; email: string };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  workspaceId: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tokenId: any;
};

type ApiCallerAgent = {
  kind: "agent";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  agent: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  user: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  workspaceId: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tokenId: any;
};

type ApiCaller = ApiCallerUser | ApiCallerAgent;

async function hashToken(raw: string): Promise<string> {
  const encoded = new TextEncoder().encode(raw);
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Authenticate a Bearer token as either a user API key (ping_u_*) or agent token. */
async function authenticateApiCaller(
  ctx: ApiCtx,
  request: Request,
): Promise<ApiCaller | null> {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const rawToken = authHeader.slice(7);
  const tokenHash = await hashToken(rawToken);

  if (rawToken.startsWith("ping_u_")) {
    const result = await ctx.runQuery(internal.apiAuth.getUserByTokenHash, {
      tokenHash,
    });
    if (!result) return null;

    await ctx.runMutation(internal.apiAuth.touchUserToken, {
      tokenId: result.tokenId,
    });

    return {
      kind: "user",
      user: result.user,
      workspaceId: result.workspaceId,
      tokenId: result.tokenId,
    };
  }

  // Fall back to agent token lookup
  const result = await ctx.runQuery(internal.agentApi.getAgentByTokenHash, {
    tokenHash,
  });
  if (!result) return null;

  await ctx.runMutation(internal.agentApi.touchToken, {
    tokenId: result.tokenId,
  });

  return {
    kind: "agent",
    agent: result.agent,
    user: result.user,
    workspaceId: result.workspaceId,
    tokenId: result.tokenId,
  };
}

async function checkApiRateLimit(
  ctx: ApiCtx,
  tokenId: string,
  isWrite: boolean,
): Promise<Response | null> {
  const result = await ctx.runMutation(internal.rateLimit.checkRateLimit, {
    key: `token:${tokenId}`,
    maxPerWindow: isWrite ? 30 : 60,
  });
  if (!result.allowed) {
    const retryAfter = Math.ceil((result.resetAt - Date.now()) / 1000);
    return new Response(
      JSON.stringify({
        error: "Rate limit exceeded",
        retryAfter,
      }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(result.resetAt),
          "Retry-After": String(retryAfter),
        },
      },
    );
  }
  return null;
}

// ---------------------------------------------------------------------------
// Agent REST API
// ---------------------------------------------------------------------------

/** Extract and validate a Bearer token from the Authorization header. */
async function authenticateAgent(ctx: ApiCtx, request: Request) {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const rawToken = authHeader.slice(7);
  const tokenHash = await hashToken(rawToken);

  const result = await ctx.runQuery(internal.agentApi.getAgentByTokenHash, {
    tokenHash,
  });
  if (!result) return null;

  await ctx.runMutation(internal.agentApi.touchToken, {
    tokenId: result.tokenId,
  });

  return result;
}

const ALLOWED_ORIGINS = [
  process.env.APP_URL,
  "https://openping.app",
  "http://localhost:3000",
].filter(Boolean) as string[];

function getCorsHeaders(origin?: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (origin && ALLOWED_ORIGINS.some((o) => origin === o || origin.endsWith(`.${new URL(o).hostname}`))) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS";
    headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization";
    headers["Access-Control-Max-Age"] = "86400";
  }
  return headers;
}

function jsonResponse(data: unknown, status = 200, request?: Request) {
  const origin = request?.headers.get("origin");
  return new Response(JSON.stringify(data), {
    status,
    headers: getCorsHeaders(origin),
  });
}

// GET /api/agent/v1/me — Agent identity
http.route({
  path: "/api/agent/v1/me",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateAgent(ctx, request);
    if (!auth) return jsonResponse({ error: "Unauthorized" }, 401);

    return jsonResponse({
      agent: auth.agent,
      user: auth.user,
      workspaceId: auth.workspaceId,
    });
  }),
});

// GET /api/agent/v1/channels — List workspace channels
http.route({
  path: "/api/agent/v1/channels",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateAgent(ctx, request);
    if (!auth) return jsonResponse({ error: "Unauthorized" }, 401);

    const channels = await ctx.runQuery(
      internal.agentApi.listChannelsForWorkspace,
      { workspaceId: auth.workspaceId },
    );

    return jsonResponse({ channels });
  }),
});

// GET /api/agent/v1/channels/:channelId/messages — Read channel messages
http.route({
  path: "/api/agent/v1/messages/channel",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateAgent(ctx, request);
    if (!auth) return jsonResponse({ error: "Unauthorized" }, 401);

    const body = await request.json();
    const channelId = body.channelId;
    const limit = body.limit ?? 50;

    if (!channelId) return jsonResponse({ error: "channelId required" }, 400);

    const messages = await ctx.runQuery(
      internal.agentApi.readChannelMessages,
      { channelId, workspaceId: auth.workspaceId, limit },
    );

    return jsonResponse({ messages });
  }),
});

// POST /api/agent/v1/send/channel — Send message to channel
http.route({
  path: "/api/agent/v1/send/channel",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateAgent(ctx, request);
    if (!auth) return jsonResponse({ error: "Unauthorized" }, 401);

    const rateLimited = await checkApiRateLimit(ctx, auth.tokenId, true);
    if (rateLimited) return rateLimited;

    const body = await request.json();
    const { channelId, message } = body;

    if (!channelId || !message) {
      return jsonResponse({ error: "channelId and message required" }, 400);
    }

    const result = await ctx.runMutation(
      internal.agentApi.sendChannelMessage,
      {
        channelId,
        workspaceId: auth.workspaceId,
        authorId: auth.user._id,
        body: message,
      },
    );

    return jsonResponse(result);
  }),
});

// POST /api/agent/v1/send/dm — Send DM
http.route({
  path: "/api/agent/v1/send/dm",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateAgent(ctx, request);
    if (!auth) return jsonResponse({ error: "Unauthorized" }, 401);

    const rateLimited = await checkApiRateLimit(ctx, auth.tokenId, true);
    if (rateLimited) return rateLimited;

    const body = await request.json();
    const { conversationId, message } = body;

    if (!conversationId || !message) {
      return jsonResponse(
        { error: "conversationId and message required" },
        400,
      );
    }

    const result = await ctx.runMutation(
      internal.agentApi.sendDirectMessage,
      {
        conversationId,
        userId: auth.user._id,
        body: message,
      },
    );

    return jsonResponse(result);
  }),
});

// GET /api/agent/v1/conversations — List DM conversations
http.route({
  path: "/api/agent/v1/conversations",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateAgent(ctx, request);
    if (!auth) return jsonResponse({ error: "Unauthorized" }, 401);

    const conversations = await ctx.runQuery(
      internal.agentApi.listConversationsForUser,
      { userId: auth.user._id },
    );

    return jsonResponse({ conversations });
  }),
});

// Health check
http.route({
  path: "/health",
  method: "GET",
  handler: httpAction(async () => {
    return jsonResponse({ status: "ok", timestamp: new Date().toISOString() });
  }),
});

// ---------------------------------------------------------------------------
// Mobile Auth — Token Exchange
// ---------------------------------------------------------------------------

http.route({
  path: "/auth/mobile-token",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const body = await request.json();
      const { code, redirect_uri } = body;

      if (!code) {
        return jsonResponse({ error: "code is required" }, 400);
      }

      // Rate limit by code prefix to prevent brute force
      const rateKey = `mobile-auth:${String(code).slice(0, 16)}`;
      const rateResult = await ctx.runMutation(internal.rateLimit.checkRateLimit, {
        key: rateKey,
        maxPerWindow: 10,
      });
      if (!rateResult.allowed) {
        return jsonResponse({ error: "Too many attempts" }, 429);
      }

      const clientId = process.env.WORKOS_CLIENT_ID;
      const clientSecret = process.env.WORKOS_API_KEY;

      if (!clientId || !clientSecret) {
        return jsonResponse({ error: "Server misconfigured" }, 500);
      }

      const tokenResponse = await fetch(
        "https://api.workos.com/user_management/authenticate",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            grant_type: "authorization_code",
            client_id: clientId,
            client_secret: clientSecret,
            code,
            ...(redirect_uri ? { redirect_uri } : {}),
          }),
        },
      );

      if (!tokenResponse.ok) {
        const errorBody = await tokenResponse.text();
        return jsonResponse(
          { error: "Token exchange failed" },
          tokenResponse.status,
        );
      }

      const tokenData = await tokenResponse.json();
      const { access_token, refresh_token, user: workosUser } = tokenData;

      if (workosUser) {
        await ctx.runMutation(api.users.createOrUpdate, {
          workosUserId: workosUser.id,
          email: workosUser.email ?? "",
          name:
            [workosUser.first_name, workosUser.last_name]
              .filter(Boolean)
              .join(" ") || "User",
          avatarUrl: workosUser.profile_picture_url ?? undefined,
        });
      }

      return jsonResponse({
        accessToken: access_token,
        refreshToken: refresh_token,
      });
    } catch (e: any) {
      return jsonResponse(
        { error: "Internal error" },
        500,
      );
    }
  }),
});

http.route({
  path: "/auth/mobile-refresh",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const body = await request.json();
      const { refresh_token } = body;

      if (!refresh_token) {
        return jsonResponse({ error: "refresh_token is required" }, 400);
      }

      // Rate limit by token prefix
      const refreshRateKey = `mobile-refresh:${String(refresh_token).slice(0, 16)}`;
      const refreshRateResult = await ctx.runMutation(internal.rateLimit.checkRateLimit, {
        key: refreshRateKey,
        maxPerWindow: 10,
      });
      if (!refreshRateResult.allowed) {
        return jsonResponse({ error: "Too many attempts" }, 429);
      }

      const clientId = process.env.WORKOS_CLIENT_ID;
      const clientSecret = process.env.WORKOS_API_KEY;

      if (!clientId || !clientSecret) {
        return jsonResponse({ error: "Server misconfigured" }, 500);
      }

      const tokenResponse = await fetch(
        "https://api.workos.com/user_management/authenticate",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            grant_type: "refresh_token",
            client_id: clientId,
            client_secret: clientSecret,
            refresh_token,
          }),
        },
      );

      if (!tokenResponse.ok) {
        const errorBody = await tokenResponse.text();
        return jsonResponse(
          { error: "Token refresh failed" },
          tokenResponse.status,
        );
      }

      const tokenData = await tokenResponse.json();
      return jsonResponse({
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
      });
    } catch (e: any) {
      return jsonResponse(
        { error: "Internal error" },
        500,
      );
    }
  }),
});

// ---------------------------------------------------------------------------
// User / Unified API (v1)
// ---------------------------------------------------------------------------

// GET /api/v1/me — Caller identity (user or agent)
http.route({
  path: "/api/v1/me",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const caller = await authenticateApiCaller(ctx, request);
    if (!caller) return jsonResponse({ error: "Unauthorized" }, 401);

    const rateLimited = await checkApiRateLimit(ctx, caller.tokenId, false);
    if (rateLimited) return rateLimited;

    if (caller.kind === "user") {
      return jsonResponse({
        kind: "user",
        user: caller.user,
        workspaceId: caller.workspaceId,
      });
    }

    return jsonResponse({
      kind: "agent",
      agent: caller.agent,
      user: caller.user,
      workspaceId: caller.workspaceId,
    });
  }),
});

// GET /api/v1/keys — List caller's API keys (user tokens only)
http.route({
  path: "/api/v1/keys",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const caller = await authenticateApiCaller(ctx, request);
    if (!caller) return jsonResponse({ error: "Unauthorized" }, 401);
    if (caller.kind !== "user") {
      return jsonResponse({ error: "Only user tokens can manage keys" }, 403);
    }

    const rateLimited = await checkApiRateLimit(ctx, caller.tokenId, false);
    if (rateLimited) return rateLimited;

    const tokens = await ctx.runQuery(internal.apiAuth.listTokens, {
      userId: caller.user._id,
      workspaceId: caller.workspaceId,
    });

    return jsonResponse({ keys: tokens });
  }),
});

// POST /api/v1/keys — Generate a new API key
http.route({
  path: "/api/v1/keys",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const caller = await authenticateApiCaller(ctx, request);
    if (!caller) return jsonResponse({ error: "Unauthorized" }, 401);
    if (caller.kind !== "user") {
      return jsonResponse({ error: "Only user tokens can manage keys" }, 403);
    }

    const rateLimited = await checkApiRateLimit(ctx, caller.tokenId, true);
    if (rateLimited) return rateLimited;

    const body = await request.json();
    const label = body.label as string | undefined;

    const rawToken = `ping_u_${crypto.randomUUID()}`;
    const tokenHash = await hashToken(rawToken);
    const tokenPrefix = rawToken.slice(0, 12) + "...";

    const result = await ctx.runMutation(internal.apiAuth.generateToken, {
      userId: caller.user._id,
      workspaceId: caller.workspaceId,
      tokenHash,
      tokenPrefix,
      label,
    });

    return jsonResponse({
      token: rawToken,
      tokenId: result.tokenId,
      tokenPrefix,
      label,
    });
  }),
});

// DELETE /api/v1/keys — Revoke a key
http.route({
  path: "/api/v1/keys",
  method: "DELETE",
  handler: httpAction(async (ctx, request) => {
    const caller = await authenticateApiCaller(ctx, request);
    if (!caller) return jsonResponse({ error: "Unauthorized" }, 401);
    if (caller.kind !== "user") {
      return jsonResponse({ error: "Only user tokens can manage keys" }, 403);
    }

    const rateLimited = await checkApiRateLimit(ctx, caller.tokenId, true);
    if (rateLimited) return rateLimited;

    const body = await request.json();
    const keyId = body.keyId as string;
    if (!keyId) {
      return jsonResponse({ error: "keyId required" }, 400);
    }

    const result = await ctx.runMutation(internal.apiAuth.revokeToken, {
      tokenId: keyId as any,
      userId: caller.user._id,
    });

    if (!result.success) {
      return jsonResponse({ error: result.error }, 400);
    }

    return jsonResponse({ success: true });
  }),
});

// ---------------------------------------------------------------------------
// Public Channel API (v1)
// ---------------------------------------------------------------------------

// GET /api/v1/channels — List workspace channels
http.route({
  path: "/api/v1/channels",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateApiCaller(ctx, request);
    if (!auth) return jsonResponse({ error: "Unauthorized" }, 401);

    const channels = await ctx.runQuery(internal.publicApi.listChannels, {
      workspaceId: auth.workspaceId,
    });
    return jsonResponse({ channels });
  }),
});

// POST /api/v1/channels — Create channel
http.route({
  path: "/api/v1/channels",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateApiCaller(ctx, request);
    if (!auth) return jsonResponse({ error: "Unauthorized" }, 401);

    const body = await request.json();
    const { name, description, isPrivate } = body;
    if (!name) return jsonResponse({ error: "name is required" }, 400);

    const result = await ctx.runMutation(internal.publicApi.createChannel, {
      workspaceId: auth.workspaceId,
      userId: auth.user._id,
      name,
      description,
      isPrivate,
    });
    return jsonResponse(result, 201);
  }),
});

// POST /api/v1/channels/members — List channel members
http.route({
  path: "/api/v1/channels/members",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateApiCaller(ctx, request);
    if (!auth) return jsonResponse({ error: "Unauthorized" }, 401);

    const body = await request.json();
    const { channelId } = body;
    if (!channelId) return jsonResponse({ error: "channelId is required" }, 400);

    const members = await ctx.runQuery(internal.publicApi.listChannelMembers, {
      channelId,
      workspaceId: auth.workspaceId,
    });
    return jsonResponse({ members });
  }),
});

// ---------------------------------------------------------------------------
// Public API v1 — Channel Messages
// ---------------------------------------------------------------------------

// POST /api/v1/channels/messages — List messages with date filtering
http.route({
  path: "/api/v1/channels/messages",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateApiCaller(ctx, request);
    if (!auth) return jsonResponse({ error: "Unauthorized" }, 401);

    const body = await request.json();
    const { channelId, limit = 50, startTime, endTime } = body;
    if (!channelId)
      return jsonResponse({ error: "channelId is required" }, 400);

    const messages = await ctx.runQuery(
      internal.publicApi.readChannelMessages,
      {
        channelId,
        workspaceId: auth.workspaceId,
        userId: auth.user._id,
        limit: Math.min(limit, 200),
        startTime,
        endTime,
      },
    );
    return jsonResponse({ messages });
  }),
});

// POST /api/v1/channels/messages/send — Send or reply
http.route({
  path: "/api/v1/channels/messages/send",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateApiCaller(ctx, request);
    if (!auth) return jsonResponse({ error: "Unauthorized" }, 401);

    const rateLimited = await checkApiRateLimit(ctx, auth.tokenId, true);
    if (rateLimited) return rateLimited;

    const body = await request.json();
    const { channelId, message, threadId } = body;
    if (!channelId || !message)
      return jsonResponse(
        { error: "channelId and message are required" },
        400,
      );

    const result = await ctx.runMutation(
      internal.publicApi.sendChannelMessageApi,
      {
        channelId,
        workspaceId: auth.workspaceId,
        userId: auth.user._id,
        body: message,
        messageType: auth.kind === "user" ? "user" : "bot",
        threadId,
      },
    );
    return jsonResponse(result, 201);
  }),
});

// POST /api/v1/channels/messages/thread — List thread replies
http.route({
  path: "/api/v1/channels/messages/thread",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateApiCaller(ctx, request);
    if (!auth) return jsonResponse({ error: "Unauthorized" }, 401);

    const body = await request.json();
    const { threadId } = body;
    if (!threadId)
      return jsonResponse({ error: "threadId is required" }, 400);

    const result = await ctx.runQuery(
      internal.publicApi.listChannelThreadReplies,
      {
        threadId,
        workspaceId: auth.workspaceId,
        userId: auth.user._id,
      },
    );
    return jsonResponse(result);
  }),
});

// ---------------------------------------------------------------------------
// Public API v1 — DM Conversations & Messages
// ---------------------------------------------------------------------------

// GET /api/v1/conversations
http.route({
  path: "/api/v1/conversations",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateApiCaller(ctx, request);
    if (!auth) return jsonResponse({ error: "Unauthorized" }, 401);
    const conversations = await ctx.runQuery(
      internal.publicApi.listConversations,
      { userId: auth.user._id },
    );
    return jsonResponse({ conversations });
  }),
});

// POST /api/v1/conversations/create
http.route({
  path: "/api/v1/conversations/create",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateApiCaller(ctx, request);
    if (!auth) return jsonResponse({ error: "Unauthorized" }, 401);
    const body = await request.json();
    const { kind, memberIds, name } = body;
    if (!kind || !memberIds)
      return jsonResponse(
        { error: "kind and memberIds are required" },
        400,
      );
    const result = await ctx.runMutation(
      internal.publicApi.createConversation,
      {
        workspaceId: auth.workspaceId,
        userId: auth.user._id,
        kind,
        memberIds,
        name,
      },
    );
    return jsonResponse(result, 201);
  }),
});

// POST /api/v1/conversations/members
http.route({
  path: "/api/v1/conversations/members",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateApiCaller(ctx, request);
    if (!auth) return jsonResponse({ error: "Unauthorized" }, 401);
    const body = await request.json();
    const { conversationId } = body;
    if (!conversationId)
      return jsonResponse(
        { error: "conversationId is required" },
        400,
      );
    const members = await ctx.runQuery(
      internal.publicApi.listConversationMembers,
      {
        conversationId,
        userId: auth.user._id,
      },
    );
    return jsonResponse({ members });
  }),
});

// POST /api/v1/conversations/messages
http.route({
  path: "/api/v1/conversations/messages",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateApiCaller(ctx, request);
    if (!auth) return jsonResponse({ error: "Unauthorized" }, 401);
    const body = await request.json();
    const { conversationId, limit = 50, startTime, endTime } = body;
    if (!conversationId)
      return jsonResponse(
        { error: "conversationId is required" },
        400,
      );
    const messages = await ctx.runQuery(
      internal.publicApi.readDMMessages,
      {
        conversationId,
        userId: auth.user._id,
        limit: Math.min(limit, 200),
        startTime,
        endTime,
      },
    );
    return jsonResponse({ messages });
  }),
});

// POST /api/v1/conversations/messages/send
http.route({
  path: "/api/v1/conversations/messages/send",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateApiCaller(ctx, request);
    if (!auth) return jsonResponse({ error: "Unauthorized" }, 401);

    const rateLimited = await checkApiRateLimit(ctx, auth.tokenId, true);
    if (rateLimited) return rateLimited;

    const body = await request.json();
    const { conversationId, message, threadId } = body;
    if (!conversationId || !message)
      return jsonResponse(
        { error: "conversationId and message are required" },
        400,
      );
    const result = await ctx.runMutation(internal.publicApi.sendDMApi, {
      conversationId,
      userId: auth.user._id,
      body: message,
      messageType: auth.kind === "user" ? "user" : "bot",
      threadId,
    });
    return jsonResponse(result, 201);
  }),
});

// POST /api/v1/conversations/messages/thread
http.route({
  path: "/api/v1/conversations/messages/thread",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateApiCaller(ctx, request);
    if (!auth) return jsonResponse({ error: "Unauthorized" }, 401);
    const body = await request.json();
    const { threadId } = body;
    if (!threadId)
      return jsonResponse({ error: "threadId is required" }, 400);
    const result = await ctx.runQuery(
      internal.publicApi.listDMThreadReplies,
      {
        threadId,
        userId: auth.user._id,
      },
    );
    return jsonResponse(result);
  }),
});

// POST /api/v1/reactions/toggle — Add/remove emoji reaction
http.route({
  path: "/api/v1/reactions/toggle",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateApiCaller(ctx, request);
    if (!auth) return jsonResponse({ error: "Unauthorized" }, 401);

    const rateLimited = await checkApiRateLimit(ctx, auth.tokenId, true);
    if (rateLimited) return rateLimited;

    const body = await request.json();
    const { messageId, emoji } = body;

    if (!messageId || !emoji) {
      return jsonResponse({ error: "messageId and emoji are required" }, 400);
    }

    const result = await ctx.runMutation(internal.publicApi.toggleReaction, {
      messageId,
      userId: auth.user._id,
      workspaceId: auth.workspaceId,
      emoji,
    });

    return jsonResponse(result);
  }),
});

export default http;
