import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

const http = httpRouter();

// --- Shared HMAC helper ---

async function verifyHmacSha256(
  secret: string,
  payload: string,
  expectedHex: string,
): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  const actualHex = Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // Constant-time comparison
  if (actualHex.length !== expectedHex.length) return false;
  let mismatch = 0;
  for (let i = 0; i < actualHex.length; i++) {
    mismatch |= actualHex.charCodeAt(i) ^ expectedHex.charCodeAt(i);
  }
  return mismatch === 0;
}

function jsonResponse(data: object, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// --- Route 1: WorkOS ---

http.route({
  path: "/webhooks/workos",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const secret = process.env.WORKOS_WEBHOOK_SECRET;
    if (!secret) {
      console.error("WORKOS_WEBHOOK_SECRET not configured");
      return jsonResponse({ error: "Webhook secret not configured" }, 500);
    }

    const rawBody = await request.text();
    const signatureHeader = request.headers.get("workos-signature") ?? "";

    // Parse "t=<timestamp>,v1=<signature>"
    const parts = Object.fromEntries(
      signatureHeader.split(",").map((part) => {
        const [key, ...rest] = part.split("=");
        return [key.trim(), rest.join("=")];
      }),
    );

    const timestamp = parts["t"];
    const v1 = parts["v1"];
    if (!timestamp || !v1) {
      return jsonResponse({ error: "Invalid signature header" }, 401);
    }

    const signPayload = `${timestamp}.${rawBody}`;
    const valid = await verifyHmacSha256(secret, signPayload, v1);
    if (!valid) {
      return jsonResponse({ error: "Invalid signature" }, 401);
    }

    const body = JSON.parse(rawBody);
    const eventType = body.event;

    switch (eventType) {
      case "user.created":
      case "user.updated": {
        const { id, email, first_name, last_name, profile_picture_url } =
          body.data;
        await ctx.runMutation(
          internal.webhooks.internalCreateOrUpdateUser,
          {
            workosUserId: id,
            email,
            name: `${first_name ?? ""} ${last_name ?? ""}`.trim(),
            avatarUrl: profile_picture_url ?? undefined,
          },
        );
        break;
      }
      case "dsync.user.created": {
        const data = body.data;
        const email =
          data.emails?.[0]?.value ?? data.email ?? "";
        await ctx.runMutation(
          internal.webhooks.internalCreateOrUpdateUser,
          {
            workosUserId: data.id,
            email,
            name:
              `${data.first_name ?? ""} ${data.last_name ?? ""}`.trim() ||
              email,
            avatarUrl: data.profile_picture_url ?? undefined,
          },
        );
        break;
      }
      case "dsync.user.deleted": {
        await ctx.runMutation(internal.webhooks.deactivateUser, {
          workosUserId: body.data.id,
        });
        break;
      }
    }

    return jsonResponse({ received: true });
  }),
});

// --- Route 2: GitHub ---

http.route({
  path: "/webhooks/github",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const secret = process.env.GITHUB_WEBHOOK_SECRET;
    if (!secret) {
      console.error("GITHUB_WEBHOOK_SECRET not configured");
      return jsonResponse({ error: "Webhook secret not configured" }, 500);
    }

    const rawBody = await request.text();
    const signatureHeader =
      request.headers.get("X-Hub-Signature-256") ?? "";
    const expectedHex = signatureHeader.replace("sha256=", "");

    if (!expectedHex) {
      return jsonResponse({ error: "Missing signature" }, 401);
    }

    const valid = await verifyHmacSha256(secret, rawBody, expectedHex);
    if (!valid) {
      return jsonResponse({ error: "Invalid signature" }, 401);
    }

    const event = request.headers.get("X-GitHub-Event") ?? "";
    const body = JSON.parse(rawBody);

    if (event === "ping") {
      return jsonResponse({ received: true });
    }

    const workspace = await ctx.runQuery(
      internal.webhooks.getDefaultWorkspace,
    );
    if (!workspace) {
      console.error("No default workspace found");
      return jsonResponse({ received: true });
    }

    if (event === "pull_request") {
      const pr = body.pull_request;
      const repo = body.repository?.full_name ?? body.repository?.name ?? "";
      const number = pr.number;
      const action = body.action;

      const integrationObjectId = await ctx.runMutation(
        internal.integrations.upsert,
        {
          workspaceId: workspace._id,
          type: "github_pr",
          externalId: `github_pr_${repo}_${number}`,
          title: pr.title,
          status: pr.merged
            ? "merged"
            : pr.state === "closed"
              ? "closed"
              : pr.draft
                ? "draft"
                : "open",
          url: pr.html_url,
          author: pr.user?.login ?? "unknown",
          metadata: {
            repo,
            number,
            additions: pr.additions,
            deletions: pr.deletions,
            baseBranch: pr.base?.ref,
            headBranch: pr.head?.ref,
          },
        },
      );

      if (
        action === "opened" ||
        action === "closed" ||
        action === "reopened"
      ) {
        const verb =
          action === "closed" && pr.merged
            ? "merged"
            : action === "closed"
              ? "closed"
              : action;
        const user = pr.user?.login ?? "unknown";
        await ctx.runMutation(internal.webhooks.postSystemMessage, {
          workspaceId: workspace._id,
          channelName: "engineering",
          body: `PR #${number} ${verb} by ${user}: ${pr.title}`,
          integrationObjectId,
        });
      }
    }

    if (event === "pull_request_review") {
      const review = body.review;
      const pr = body.pull_request;
      const number = pr.number;
      const reviewer = review.user?.login ?? "unknown";
      const state = review.state; // "approved", "changes_requested", "commented"

      if (state === "approved" || state === "changes_requested") {
        const verb =
          state === "approved" ? "approved" : "requested changes on";
        await ctx.runMutation(internal.webhooks.postSystemMessage, {
          workspaceId: workspace._id,
          channelName: "engineering",
          body: `${reviewer} ${verb} PR #${number}: ${pr.title}`,
        });
      }
    }

    return jsonResponse({ received: true });
  }),
});

// --- Route 3: Linear ---

http.route({
  path: "/webhooks/linear",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const secret = process.env.LINEAR_WEBHOOK_SECRET;
    if (!secret) {
      console.error("LINEAR_WEBHOOK_SECRET not configured");
      return jsonResponse({ error: "Webhook secret not configured" }, 500);
    }

    const rawBody = await request.text();
    const signatureHeader =
      request.headers.get("linear-signature") ?? "";

    if (!signatureHeader) {
      return jsonResponse({ error: "Missing signature" }, 401);
    }

    const valid = await verifyHmacSha256(secret, rawBody, signatureHeader);
    if (!valid) {
      return jsonResponse({ error: "Invalid signature" }, 401);
    }

    const body = JSON.parse(rawBody);

    // Only handle Issue events
    if (body.type !== "Issue") {
      return jsonResponse({ received: true });
    }

    const action = body.action; // "create", "update", "remove"
    const data = body.data;

    if (action === "create" || action === "update") {
      const workspace = await ctx.runQuery(
        internal.webhooks.getDefaultWorkspace,
      );
      if (!workspace) {
        console.error("No default workspace found");
        return jsonResponse({ received: true });
      }

      const identifier = data.identifier ?? data.id;

      const integrationObjectId = await ctx.runMutation(
        internal.integrations.upsert,
        {
          workspaceId: workspace._id,
          type: "linear_ticket",
          externalId: `linear_${data.id}`,
          title: data.title,
          status: data.state?.name ?? "Unknown",
          url: data.url ?? "",
          author: data.creatorUser?.name ?? data.creator?.name ?? "unknown",
          metadata: {
            identifier,
            priority: data.priority,
            teamName: data.team?.name,
            labels: data.labels?.map(
              (l: { name: string }) => l.name,
            ),
          },
        },
      );

      if (action === "create") {
        await ctx.runMutation(internal.webhooks.postSystemMessage, {
          workspaceId: workspace._id,
          channelName: "engineering",
          body: `Linear issue ${identifier} created: ${data.title}`,
          integrationObjectId,
        });
      }

      // Status change detection
      if (
        action === "update" &&
        body.updatedFrom?.stateId !== undefined &&
        body.updatedFrom.stateId !== data.stateId
      ) {
        const stateName = data.state?.name ?? "Unknown";
        await ctx.runMutation(internal.webhooks.postSystemMessage, {
          workspaceId: workspace._id,
          channelName: "engineering",
          body: `Linear issue ${identifier} moved to ${stateName}: ${data.title}`,
          integrationObjectId,
        });
      }
    }

    return jsonResponse({ received: true });
  }),
});

export default http;
