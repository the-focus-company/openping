import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api, internal } from "./_generated/api";

const http = httpRouter();

http.route({
  path: "/webhooks/workos",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const body = await request.json();
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
    if (secret) {
      const signatureHeader = request.headers.get("linear-signature");
      if (!signatureHeader) {
        return new Response(
          JSON.stringify({ error: "Missing linear-signature header" }),
          { status: 401, headers: { "Content-Type": "application/json" } },
        );
      }

      const expected = await hmacSha256Hex(secret, rawBody);

      if (signatureHeader !== expected) {
        return new Response(
          JSON.stringify({ error: "Invalid signature" }),
          { status: 401, headers: { "Content-Type": "application/json" } },
        );
      }
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
    if (secret) {
      const sigHeader = request.headers.get("x-hub-signature-256");
      if (!sigHeader) {
        return new Response(JSON.stringify({ error: "Missing x-hub-signature-256" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }
      const expected = "sha256=" + await hmacSha256Hex(secret, rawBody);
      if (sigHeader !== expected) {
        return new Response(JSON.stringify({ error: "Invalid signature" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }
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
        number: pr.number,
        repo: repoFullName,
        description: pr.body ? String(pr.body).slice(0, 200) : "",
        draft: pr.draft,
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
  user: { _id: string; name: string; email: string };
  workspaceId: string;
  tokenId: string;
};

type ApiCallerAgent = {
  kind: "agent";
  agent: any;
  user: any;
  workspaceId: string;
  tokenId: string;
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

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
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
      tokenId: keyId,
      userId: caller.user._id,
    });

    if (!result.success) {
      return jsonResponse({ error: result.error }, 400);
    }

    return jsonResponse({ success: true });
  }),
});

export default http;
