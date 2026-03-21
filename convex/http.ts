import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { hashToken } from "./agentAuth";
import { Id } from "./_generated/dataModel";

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

        if (result.isNew) {
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

// --- Agent API helpers ---

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function authenticateAgent(ctx: any, request: Request) {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const rawToken = authHeader.slice(7);
  const tokenHash = await hashToken(rawToken);
  const result = await ctx.runQuery(internal.agentAuth.validateToken, {
    tokenHash,
  });
  if (!result) return null;
  await ctx.runMutation(internal.agentAuth.updateTokenLastUsed, {
    tokenId: result.token._id,
  });
  return result;
}

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify({ data }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function errorResponse(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// --- Agent API routes ---

// GET /api/agent/v1/me
http.route({
  path: "/api/agent/v1/me",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateAgent(ctx, request);
    if (!auth) return errorResponse("Unauthorized", 401);
    const result = await ctx.runQuery(internal.agentApi.getAgentSelf, {
      agentId: auth.agent._id,
    });
    if (!result) return errorResponse("Agent not found", 404);
    return jsonResponse(result);
  }),
});

// GET /api/agent/v1/channels
http.route({
  path: "/api/agent/v1/channels",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateAgent(ctx, request);
    if (!auth) return errorResponse("Unauthorized", 401);
    const result = await ctx.runQuery(internal.agentApi.listAgentChannels, {
      workspaceId: auth.agent.workspaceId,
    });
    return jsonResponse(result);
  }),
});

// GET /api/agent/v1/channel-messages
http.route({
  path: "/api/agent/v1/channel-messages",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateAgent(ctx, request);
    if (!auth) return errorResponse("Unauthorized", 401);
    const url = new URL(request.url);
    const channelId = url.searchParams.get("channelId");
    if (!channelId) return errorResponse("Missing channelId parameter", 400);
    const limitParam = url.searchParams.get("limit");
    const limit = limitParam ? parseInt(limitParam, 10) : undefined;
    const result = await ctx.runQuery(internal.agentApi.readChannelMessages, {
      channelId: channelId as Id<"channels">,
      workspaceId: auth.agent.workspaceId,
      limit,
    });
    if (result === null) return errorResponse("Channel not found", 404);
    return jsonResponse(result);
  }),
});

// POST /api/agent/v1/channel-messages
http.route({
  path: "/api/agent/v1/channel-messages",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateAgent(ctx, request);
    if (!auth) return errorResponse("Unauthorized", 401);
    const body = await request.json();
    const { channelId, body: messageBody } = body;
    if (!channelId || !messageBody) {
      return errorResponse("Missing channelId or body", 400);
    }
    try {
      const result = await ctx.runMutation(
        internal.agentApi.sendChannelMessage,
        {
          channelId: channelId as Id<"channels">,
          workspaceId: auth.agent.workspaceId,
          authorId: auth.agentUser._id,
          body: messageBody,
        },
      );
      return jsonResponse(result, 201);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Internal error";
      return errorResponse(message, 400);
    }
  }),
});

// GET /api/agent/v1/conversations
http.route({
  path: "/api/agent/v1/conversations",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateAgent(ctx, request);
    if (!auth) return errorResponse("Unauthorized", 401);
    const result = await ctx.runQuery(
      internal.agentApi.listAgentConversations,
      { userId: auth.agentUser._id },
    );
    return jsonResponse(result);
  }),
});

// GET /api/agent/v1/conversation-messages
http.route({
  path: "/api/agent/v1/conversation-messages",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateAgent(ctx, request);
    if (!auth) return errorResponse("Unauthorized", 401);
    const url = new URL(request.url);
    const conversationId = url.searchParams.get("conversationId");
    if (!conversationId) {
      return errorResponse("Missing conversationId parameter", 400);
    }
    const limitParam = url.searchParams.get("limit");
    const limit = limitParam ? parseInt(limitParam, 10) : undefined;
    const result = await ctx.runQuery(
      internal.agentApi.readConversationMessages,
      {
        conversationId: conversationId as Id<"directConversations">,
        userId: auth.agentUser._id,
        limit,
      },
    );
    if (result === null) return errorResponse("Conversation not found", 404);
    return jsonResponse(result);
  }),
});

// POST /api/agent/v1/conversation-messages
http.route({
  path: "/api/agent/v1/conversation-messages",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateAgent(ctx, request);
    if (!auth) return errorResponse("Unauthorized", 401);
    const body = await request.json();
    const { conversationId, body: messageBody } = body;
    if (!conversationId || !messageBody) {
      return errorResponse("Missing conversationId or body", 400);
    }
    try {
      const result = await ctx.runMutation(
        internal.agentApi.sendConversationMessage,
        {
          conversationId: conversationId as Id<"directConversations">,
          userId: auth.agentUser._id,
          body: messageBody,
        },
      );
      return jsonResponse(result, 201);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Internal error";
      return errorResponse(message, 400);
    }
  }),
});

export default http;
