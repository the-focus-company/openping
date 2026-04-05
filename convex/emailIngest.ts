import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

// ─── Internal helpers ─────────────────────────────────────────────────────────

export const getEmailById = internalQuery({
  args: { emailId: v.id("emails") },
  handler: async (ctx, args) => {
    return ctx.db.get(args.emailId);
  },
});

export const patchGraphitiEpisodeId = internalMutation({
  args: {
    emailId: v.id("emails"),
    graphitiEpisodeId: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.emailId, {
      graphitiEpisodeId: args.graphitiEpisodeId,
    });
  },
});

// ─── Graphiti ingestion (8LI-128) ─────────────────────────────────────────────

export const ingestEmailToGraphiti = internalAction({
  args: { emailId: v.id("emails") },
  handler: async (ctx, args) => {
    const graphitiUrl =
      process.env.GRAPHITI_API_URL ?? "http://localhost:8000";

    const email = await ctx.runQuery(internal.emailIngest.getEmailById, {
      emailId: args.emailId,
    });
    if (!email) {
      console.warn(`[emailIngest] Email ${args.emailId} not found`);
      return;
    }

    // Already ingested
    if (email.graphitiEpisodeId) return;

    const episodeContent = [
      `From: ${email.from}`,
      `To: ${email.to.join(", ")}`,
      email.cc?.length ? `CC: ${email.cc.join(", ")}` : null,
      `Subject: ${email.subject}`,
      `Date: ${new Date(email.receivedAt).toISOString()}`,
      "",
      (email.bodyPlain ?? "").slice(0, 3000),
    ]
      .filter(Boolean)
      .join("\n");

    const groupId = `email-${email.userId}`;

    try {
      const response = await fetch(`${graphitiUrl}/episodes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          group_id: groupId,
          name: `Email: ${email.subject}`,
          content: episodeContent,
          source: "email",
          source_description: `Email from ${email.from}`,
          reference_time: new Date(email.receivedAt).toISOString(),
        }),
      });

      if (!response.ok) {
        console.error(
          `[emailIngest] Graphiti ingestion failed: ${response.status}`,
        );
        return;
      }

      const data = await response.json();
      const episodeId: string = data.uuid ?? data.episode_id ?? data.id;

      if (episodeId) {
        await ctx.runMutation(internal.emailIngest.patchGraphitiEpisodeId, {
          emailId: args.emailId,
          graphitiEpisodeId: episodeId,
        });
      }
    } catch (err) {
      console.error(`[emailIngest] Failed for email ${args.emailId}`);
    }
  },
});
