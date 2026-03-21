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

    // ---- Signature verification (HMAC-SHA256) ----
    const secret = process.env.LINEAR_WEBHOOK_SECRET;
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

    const body: Record<string, unknown> = JSON.parse(rawBody);

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

    // ---- Resolve workspace ----
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

export default http;
