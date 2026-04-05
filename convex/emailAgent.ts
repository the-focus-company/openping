import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

type EisenhowerQuadrant = "urgent-important" | "important" | "urgent" | "fyi";

const QUADRANT_ORDER: EisenhowerQuadrant[] = [
  "urgent-important",
  "important",
  "urgent",
  "fyi",
];

// ─── Internal queries / mutations ─────────────────────────────────────────────

export const getPendingEmails = internalQuery({
  args: { limit: v.number() },
  handler: async (ctx, args) => {
    // Emails without agentClassifiedAt are pending classification
    const emails = await ctx.db
      .query("emails")
      .filter((q) =>
        q.eq(q.field("agentClassifiedAt"), undefined),
      )
      .take(args.limit);

    return emails;
  },
});

export const getThreadEmails = internalQuery({
  args: { threadId: v.string(), excludeEmailId: v.id("emails") },
  handler: async (ctx, args) => {
    const threadEmails = await ctx.db
      .query("emails")
      .withIndex("by_thread", (q) => q.eq("threadId", args.threadId))
      .take(20);

    return threadEmails
      .filter((e) => e._id !== args.excludeEmailId)
      .map((e) => ({
        from: e.from,
        subject: e.subject,
        bodyPlain: (e.bodyPlain ?? "").slice(0, 500),
        receivedAt: e.receivedAt,
      }));
  },
});

export const getUserForEmail = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return ctx.db.get(args.userId);
  },
});

export const patchEmailClassification = internalMutation({
  args: {
    emailId: v.id("emails"),
    eisenhowerQuadrant: v.union(
      v.literal("urgent-important"),
      v.literal("important"),
      v.literal("urgent"),
      v.literal("fyi"),
    ),
    agentSummary: v.string(),
    suggestedAction: v.string(),
    agentClassifiedAt: v.number(),
    reminderAt: v.optional(v.number()),
    delegateTo: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const { emailId, ...patch } = args;
    await ctx.db.patch(emailId, patch);
  },
});

// ─── AI classification ────────────────────────────────────────────────────────

interface ClassificationResult {
  eisenhowerQuadrant: EisenhowerQuadrant;
  summary: string;
  suggestedAction: string;
  reminderMinutes?: number;
}

async function classifyEmailWithAI(
  email: { from: string; subject: string; bodyPlain: string },
  threadContext: Array<{ from: string; subject: string; bodyPlain: string }>,
  userName: string,
): Promise<ClassificationResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY environment variable is not set");
  }

  const threadText =
    threadContext.length > 0
      ? `\n\nPrevious emails in thread:\n${threadContext
          .map((t) => `From: ${t.from}\nSubject: ${t.subject}\n${t.bodyPlain}`)
          .join("\n---\n")}`
      : "";

  const prompt = `You are an AI email classifier using the Eisenhower Matrix for ${userName}.

Classify this email into one of these quadrants:
- "urgent-important": Direct requests needing action now, deadlines today, critical issues, escalations mentioning ${userName}
- "important": Decisions needed, strategic discussions, project updates requiring review
- "urgent": Time-sensitive FYI, meeting invites, quick approvals
- "fyi": Newsletters, general updates, CC'd threads, automated notifications

Email:
From: ${email.from}
Subject: ${email.subject}
Body: ${email.bodyPlain.slice(0, 2000)}
${threadText}

Respond with valid JSON only, no markdown:
{
  "eisenhowerQuadrant": "urgent-important" | "important" | "urgent" | "fyi",
  "summary": "one-sentence summary of the email",
  "suggestedAction": "brief suggested next action (e.g. 'Reply with approval', 'Delegate to engineering', 'No action needed')",
  "reminderMinutes": null
}

If the email needs follow-up later, set reminderMinutes to a number (e.g. 60, 1440 for 24h). Otherwise null.`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);
  let response: Response;
  try {
    response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        response_format: { type: "json_object" },
      }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  const raw = JSON.parse(data.choices[0].message.content);

  const quadrant = QUADRANT_ORDER.includes(raw.eisenhowerQuadrant)
    ? raw.eisenhowerQuadrant
    : "fyi";

  return {
    eisenhowerQuadrant: quadrant as EisenhowerQuadrant,
    summary: raw.summary ?? "No summary available",
    suggestedAction: raw.suggestedAction ?? "Review email",
    reminderMinutes:
      typeof raw.reminderMinutes === "number" ? raw.reminderMinutes : undefined,
  };
}

// ─── classifyEmail internalAction ─────────────────────────────────────────────

export const classifyEmail = internalAction({
  args: { emailId: v.id("emails") },
  handler: async (ctx, args) => {
    // Fetch the email via a query (Convex actions cannot read DB directly)
    const emails = await ctx.runQuery(internal.emailAgent.getPendingEmails, {
      limit: 100,
    });
    const email = emails.find((e: { _id: string }) => e._id === args.emailId);
    if (!email) {
      console.warn(`[emailAgent] Email ${args.emailId} not found or already classified`);
      return;
    }

    // Fetch thread context
    const threadContext = email.threadId
      ? await ctx.runQuery(internal.emailAgent.getThreadEmails, {
          threadId: email.threadId,
          excludeEmailId: email._id,
        })
      : [];

    // Fetch user name
    const user = await ctx.runQuery(internal.emailAgent.getUserForEmail, {
      userId: email.userId,
    });
    const userName = user?.name ?? "User";

    try {
      const result = await classifyEmailWithAI(
        {
          from: email.from,
          subject: email.subject,
          bodyPlain: email.bodyPlain ?? "",
        },
        threadContext,
        userName,
      );

      const now = Date.now();

      await ctx.runMutation(internal.emailAgent.patchEmailClassification, {
        emailId: email._id,
        eisenhowerQuadrant: result.eisenhowerQuadrant,
        agentSummary: result.summary,
        suggestedAction: result.suggestedAction,
        agentClassifiedAt: now,
        reminderAt: result.reminderMinutes
          ? now + result.reminderMinutes * 60 * 1000
          : undefined,
      });

      // Trigger Graphiti ingestion after classification
      await ctx.scheduler.runAfter(0, internal.emailIngest.ingestEmailToGraphiti, {
        emailId: email._id,
      });
    } catch (err) {
      console.error(`[emailAgent] Classification failed for email ${email._id}:`, err);
    }
  },
});

// ─── classifyPendingEmails cron (8LI-126) ─────────────────────────────────────

export const classifyPendingEmails = internalAction({
  args: {},
  handler: async (ctx) => {
    const pendingEmails = await ctx.runQuery(internal.emailAgent.getPendingEmails, {
      limit: 20,
    });

    for (const email of pendingEmails) {
      try {
        await ctx.scheduler.runAfter(0, internal.emailAgent.classifyEmail, {
          emailId: email._id,
        });
      } catch (err) {
        console.error(`[emailAgent] Failed to schedule classification for ${email._id}:`, err);
      }
    }
  },
});

// ─── checkReminders cron (8LI-127) ────────────────────────────────────────────

export const getEmailsDueForReminder = internalQuery({
  args: { now: v.number() },
  handler: async (ctx, args) => {
    // Find emails with a reminderAt that is in the past and not yet acted on
    const emails = await ctx.db
      .query("emails")
      .filter((q) =>
        q.and(
          q.neq(q.field("reminderAt"), undefined),
          q.lte(q.field("reminderAt"), args.now),
          q.eq(q.field("isArchived"), false),
        ),
      )
      .take(50);

    return emails;
  },
});

export const clearEmailReminder = internalMutation({
  args: { emailId: v.id("emails") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.emailId, { reminderAt: undefined });
  },
});

export const getWorkspaceForUser = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const membership = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    if (!membership) return null;
    return { workspaceId: membership.workspaceId };
  },
});

export const getUserDefaultConversation = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    // Find any conversation membership for the user to use as the alert conversation
    const membership = await ctx.db
      .query("conversationMembers")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    return membership ? { conversationId: membership.conversationId } : null;
  },
});

export const checkReminders = internalAction({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const dueEmails = await ctx.runQuery(internal.emailAgent.getEmailsDueForReminder, {
      now,
    });

    for (const email of dueEmails) {
      try {
        const workspace = await ctx.runQuery(internal.emailAgent.getWorkspaceForUser, {
          userId: email.userId,
        });
        if (!workspace) continue;

        const conversation = await ctx.runQuery(internal.emailAgent.getUserDefaultConversation, {
          userId: email.userId,
        });
        if (!conversation) continue;

        // Create an inbox item for the reminder
        await ctx.runMutation(internal.inboxItems.insertItem, {
          userId: email.userId,
          workspaceId: workspace.workspaceId,
          type: "email_summary",
          category: "do",
          conversationId: conversation.conversationId,
          title: `Email reminder: ${email.subject}`,
          summary: email.agentSummary ?? `Follow up on email from ${email.from}`,
          pingWillDo: email.suggestedAction ?? "Follow up on this email",
        });

        // Clear the reminder so we don't fire again
        await ctx.runMutation(internal.emailAgent.clearEmailReminder, {
          emailId: email._id,
        });
      } catch (err) {
        console.error(`[emailAgent] Reminder failed for email ${email._id}:`, err);
      }
    }
  },
});
