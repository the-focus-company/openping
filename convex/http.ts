import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";

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

        await ctx.runMutation(api.users.createOrUpdate, {
          workosUserId: id,
          email: email ?? "",
          name: [first_name, last_name].filter(Boolean).join(" ") || "User",
          avatarUrl: profile_picture_url ?? undefined,
        });
        break;
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }),
});

export default http;
