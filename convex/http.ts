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

// ── GitHub Webhook ──────────────────────────────────────────────────────────

function jsonResponse(data: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function verifyGitHubSignature(
  secret: string,
  payload: string,
  signatureHeader: string | null,
): Promise<boolean> {
  if (!signatureHeader) return false;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(payload),
  );

  const expectedHex = Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const expected = `sha256=${expectedHex}`;

  // Constant-time comparison to prevent timing attacks
  if (expected.length !== signatureHeader.length) return false;
  const a = encoder.encode(expected);
  const b = encoder.encode(signatureHeader);
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a[i] ^ b[i];
  }
  return mismatch === 0;
}

function derivePRStatus(
  action: string,
  pullRequest: { merged?: boolean; draft?: boolean; state?: string },
): string {
  if (action === "closed" && pullRequest.merged) return "merged";
  if (action === "closed") return "closed";
  if (pullRequest.draft) return "draft";
  return pullRequest.state ?? "open";
}

function extractReviewers(pullRequest: {
  requested_reviewers?: Array<{ login?: string }>;
  requested_teams?: Array<{ slug?: string }>;
}): string[] {
  const reviewers: string[] = [];
  for (const r of pullRequest.requested_reviewers ?? []) {
    if (r.login) reviewers.push(r.login);
  }
  for (const t of pullRequest.requested_teams ?? []) {
    if (t.slug) reviewers.push(`team:${t.slug}`);
  }
  return reviewers;
}

function extractLabels(
  pullRequest: { labels?: Array<{ name?: string }> },
): string[] {
  return (pullRequest.labels ?? [])
    .map((l) => l.name)
    .filter((n): n is string => Boolean(n));
}

const HANDLED_PR_ACTIONS = new Set([
  "opened",
  "closed",
  "reopened",
  "review_requested",
  "synchronize",
  "ready_for_review",
  "converted_to_draft",
  "labeled",
  "unlabeled",
]);

const HANDLED_REVIEW_ACTIONS = new Set(["submitted", "dismissed"]);

http.route({
  path: "/webhooks/github",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const rawBody = await request.text();

    const secret = process.env.GITHUB_WEBHOOK_SECRET;
    if (!secret) {
      console.error("GITHUB_WEBHOOK_SECRET is not configured");
      return jsonResponse({ error: "Webhook secret not configured" }, 500);
    }

    const signatureHeader = request.headers.get("x-hub-signature-256");
    const isValid = await verifyGitHubSignature(secret, rawBody, signatureHeader);
    if (!isValid) {
      return jsonResponse({ error: "Invalid signature" }, 401);
    }

    const githubEvent = request.headers.get("x-github-event");
    const body = JSON.parse(rawBody);

    if (githubEvent === "ping") {
      return jsonResponse({ received: true, event: "ping" });
    }

    if (
      githubEvent !== "pull_request" &&
      githubEvent !== "pull_request_review"
    ) {
      return jsonResponse({ received: true, event: githubEvent, skipped: true });
    }

    const action: string = body.action ?? "";
    const pullRequest = body.pull_request;

    if (!pullRequest) {
      return jsonResponse({ received: true, error: "No pull_request in payload" });
    }

    if (githubEvent === "pull_request" && !HANDLED_PR_ACTIONS.has(action)) {
      return jsonResponse({ received: true, action, skipped: true });
    }
    if (
      githubEvent === "pull_request_review" &&
      !HANDLED_REVIEW_ACTIONS.has(action)
    ) {
      return jsonResponse({ received: true, action, skipped: true });
    }

    const workspace = await ctx.runQuery(
      internal.webhooks.getDefaultWorkspace,
      {},
    );
    if (!workspace) {
      console.error("No default workspace found for GitHub webhook");
      return jsonResponse({ error: "No workspace found" });
    }

    const status = derivePRStatus(action, pullRequest);
    const reviewers = extractReviewers(pullRequest);
    const labels = extractLabels(pullRequest);
    const externalId = `github_pr_${pullRequest.id}`;

    const review =
      githubEvent === "pull_request_review" && body.review
        ? {
            reviewer: body.review.user?.login ?? "unknown",
            state: body.review.state,
            submittedAt: body.review.submitted_at,
          }
        : undefined;

    const metadata = {
      number: pullRequest.number,
      repoFullName: body.repository?.full_name,
      reviewers,
      labels,
      draft: pullRequest.draft ?? false,
      headBranch: pullRequest.head?.ref,
      baseBranch: pullRequest.base?.ref,
      additions: pullRequest.additions,
      deletions: pullRequest.deletions,
      changedFiles: pullRequest.changed_files,
      createdAt: pullRequest.created_at,
      updatedAt: pullRequest.updated_at,
      mergedAt: pullRequest.merged_at,
      closedAt: pullRequest.closed_at,
      lastReview: review,
    };

    await ctx.runMutation(internal.integrations.upsert, {
      workspaceId: workspace._id,
      type: "github_pr",
      externalId,
      title: pullRequest.title ?? "Untitled PR",
      status,
      url: pullRequest.html_url ?? "",
      author: pullRequest.user?.login ?? "unknown",
      metadata,
    });

    return jsonResponse({ received: true, event: githubEvent, action, status });
  }),
});

export default http;
