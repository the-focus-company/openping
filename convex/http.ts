import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api, internal } from "./_generated/api";
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

http.route({
  path: "/webhooks/email-oauth-callback",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const body = await request.json() as {
      code?: string;
      state?: string;
    };

    if (!body.code || !body.state) {
      return new Response(
        JSON.stringify({ error: "Missing code or state parameter" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    let state: { userId: string; workspaceId: string };
    try {
      state = JSON.parse(body.state) as { userId: string; workspaceId: string };
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid state parameter" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    try {
      await ctx.runAction(internal.emailAuth.handleOAuthCallback, {
        code: body.code,
        userId: state.userId as Id<"users">,
        workspaceId: state.workspaceId as Id<"workspaces">,
      });

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return new Response(
        JSON.stringify({ error: message }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }
  }),
});

export default http;
