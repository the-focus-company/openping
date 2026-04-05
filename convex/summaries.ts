import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";

type EisenhowerQuadrant = "urgent-important" | "important" | "urgent" | "fyi";

const QUADRANT_ORDER: EisenhowerQuadrant[] = [
  "urgent-important",
  "important",
  "urgent",
  "fyi",
];

interface SummaryBullet {
  text: string;
  priority: EisenhowerQuadrant;
  relatedMessageIds: string[];
  mentionedUsers: string[];
}

interface GeneratedSummary {
  bullets: SummaryBullet[];
  eisenhowerQuadrant: EisenhowerQuadrant;
}

interface ConversationMessages {
  conversationId: string;
  conversationName: string;
  messages: Array<{ body: string; authorName: string; _id: string }>;
}

interface RawBullet {
  text: string;
  priority: string;
  relatedMessageIndices?: number[];
  mentionedUsers?: string[];
}

function computeTopQuadrant(bullets: SummaryBullet[]): EisenhowerQuadrant {
  const ranks = bullets.map((b) => QUADRANT_ORDER.indexOf(b.priority));
  const topRank = Math.min(...(ranks.length ? ranks : [3]));
  return QUADRANT_ORDER[topRank] ?? "fyi";
}

function parseBullets(
  rawBullets: RawBullet[],
  messages: Array<{ _id: string }>,
): SummaryBullet[] {
  return rawBullets.map((b) => ({
    text: b.text,
    priority: (QUADRANT_ORDER.includes(b.priority as EisenhowerQuadrant)
      ? b.priority
      : "fyi") as EisenhowerQuadrant,
    relatedMessageIds: (b.relatedMessageIndices ?? [])
      .map((i) => messages[i]?._id)
      .filter(Boolean),
    mentionedUsers: b.mentionedUsers ?? [],
  }));
}

async function callOpenAI(prompt: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY environment variable is not set");
  }

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
        model: "gpt-5.4-nano",
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
  return data.choices[0].message.content;
}

const QUADRANT_DESCRIPTIONS = `- "urgent-important": Blockers, incidents, production issues, deadlines today
- "important": Decisions, architecture discussions, PRs awaiting review, strategic topics
- "urgent": Time-sensitive FYI, meeting reminders, quick mentions
- "fyi": General discussion, status updates, casual conversation`;

const BULLET_RULES = `Rules:
- Generate 2-4 bullets per channel covering the main topics
- Include the list of user names explicitly @mentioned or called out in each bullet
- Be concise and actionable`;

const BULLET_SCHEMA = `{
      "text": "one-sentence summary of the key point",
      "priority": "urgent-important" | "important" | "urgent" | "fyi",
      "relatedMessageIndices": [0, 1],
      "mentionedUsers": ["Alice", "Bob"]
    }`;

function formatMessages(
  messages: Array<{ body: string; authorName: string }>,
): string {
  return messages
    .slice(-30)
    .map((m) => `[${m.authorName}]: ${m.body}`)
    .join("\n");
}

/**
 * Generate a single base summary for one conversation. Shared across all members.
 */
async function generateConversationSummary(
  messages: Array<{ body: string; authorName: string; _id: string }>,
  conversationName: string,
): Promise<GeneratedSummary> {
  const prompt = `You are an AI assistant that summarizes Slack-like channel messages using the Eisenhower Matrix.

Classify each bullet into one of these quadrants:
${QUADRANT_DESCRIPTIONS}

Channel: #${conversationName}

Messages:
${formatMessages(messages)}

Respond with valid JSON only, no markdown:
{
  "bullets": [
    ${BULLET_SCHEMA}
  ]
}

${BULLET_RULES}`;

  const content = await callOpenAI(prompt);
  const raw = JSON.parse(content);
  const bullets = parseBullets(raw.bullets ?? [], messages);
  return { bullets, eisenhowerQuadrant: computeTopQuadrant(bullets) };
}

/**
 * Batch-summarize multiple low-activity conversations in a single LLM call.
 */
async function generateBatchSummary(
  conversationsBatch: ConversationMessages[],
): Promise<Map<string, GeneratedSummary>> {
  const sections = conversationsBatch.map((ch) => {
    return `### Channel: #${ch.conversationName} (id: ${ch.conversationId})\n${formatMessages(ch.messages)}`;
  });

  const prompt = `You are an AI assistant that summarizes Slack-like channel messages using the Eisenhower Matrix.

Classify each bullet into one of these quadrants:
${QUADRANT_DESCRIPTIONS}

Below are messages from multiple channels. Summarize each channel separately.

${sections.join("\n\n")}

Respond with valid JSON only, no markdown:
{
  "channels": {
    "<conversationId>": {
      "bullets": [
        ${BULLET_SCHEMA}
      ]
    }
  }
}

${BULLET_RULES}`;

  const content = await callOpenAI(prompt);
  const raw = JSON.parse(content);

  const results = new Map<string, GeneratedSummary>();
  const channelsMap = raw.channels ?? {};

  for (const ch of conversationsBatch) {
    const chRaw = channelsMap[ch.conversationId];
    if (!chRaw) continue;

    const bullets = parseBullets(chRaw.bullets ?? [], ch.messages);
    results.set(ch.conversationId, {
      bullets,
      eisenhowerQuadrant: computeTopQuadrant(bullets),
    });
  }

  return results;
}

/**
 * Personalise a shared channel summary for a specific user.
 * Promotes bullets where the user is mentioned, and adjusts overall quadrant
 * based on user role (admins get higher priority for "important" items).
 */
function personalizeForUser(
  baseSummary: GeneratedSummary,
  userName: string,
  userRole: string,
): GeneratedSummary {
  const personalizedBullets: SummaryBullet[] = baseSummary.bullets.map((b) => {
    const bullet = { ...b };
    const isUserMentioned = b.mentionedUsers.some(
      (name) => name.toLowerCase() === userName.toLowerCase(),
    );

    // Promote priority if user is mentioned in a lower-priority bullet
    if (isUserMentioned) {
      const currentIdx = QUADRANT_ORDER.indexOf(bullet.priority);
      if (currentIdx > 0) {
        bullet.priority = QUADRANT_ORDER[currentIdx - 1]!;
      }
    }

    // Admins see "important" items promoted so they never miss strategic decisions
    if (userRole === "admin" && bullet.priority === "important") {
      bullet.priority = "urgent-important";
    }

    return bullet;
  });

  return {
    bullets: personalizedBullets,
    eisenhowerQuadrant: computeTopQuadrant(personalizedBullets),
  };
}

// ---------------------------------------------------------------------------
// Convex queries / mutations
// ---------------------------------------------------------------------------

export const getActiveConversations = internalQuery({
  args: {},
  handler: async (ctx) => {
    const conversations = await ctx.db
      .query("conversations")
      .filter((q) => q.eq(q.field("isArchived"), false))
      .take(100);

    return Promise.all(
      conversations.map(async (conversation) => {
        const memberRows = await ctx.db
          .query("conversationMembers")
          .withIndex("by_conversation", (q) => q.eq("conversationId", conversation._id))
          .take(500);

        const members = (
          await Promise.all(memberRows.map((m) => ctx.db.get(m.userId)))
        ).filter(Boolean) as Array<{ _id: Id<"users">; name: string }>;

        return { _id: conversation._id, name: conversation.name, members };
      }),
    );
  },
});

export const getRecentMessages = internalQuery({
  args: {
    conversationId: v.id("conversations"),
    since: v.number(),
  },
  handler: async (ctx, args) => {
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) => q.eq("conversationId", args.conversationId))
      .filter((q) =>
        q.and(
          q.gte(q.field("_creationTime"), args.since),
          q.eq(q.field("type"), "user"),
        ),
      )
      .take(50);

    return Promise.all(
      messages.map(async (m) => {
        const author = await ctx.db.get(m.authorId);
        return {
          _id: m._id as string,
          body: m.body,
          authorName: author?.name ?? "Unknown",
        };
      }),
    );
  },
});

/**
 * Get the latest summary time for a channel so we can skip channels
 * with no new messages since the last run.
 */
export const getLastSummaryTime = internalQuery({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    const latest = await ctx.db
      .query("inboxItems")
      .filter((q) =>
        q.and(
          q.eq(q.field("conversationId"), args.conversationId),
          q.eq(q.field("type"), "channel_summary"),
        ),
      )
      .order("desc")
      .first();
    return latest?.createdAt ?? null;
  },
});

/**
 * Look up workspace role and AI preferences for a user.
 */
export const getUserRoleAndPrefs = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const [membership, user] = await Promise.all([
      ctx.db
        .query("workspaceMembers")
        .withIndex("by_user", (q) => q.eq("userId", args.userId))
        .first(),
      ctx.db.get(args.userId),
    ]);
    return {
      role: membership?.role ?? "member",
      aiPrefs: user?.aiPrefs ?? null,
    };
  },
});

const QUADRANT_TO_CATEGORY: Record<string, "do" | "decide" | "delegate" | "skip"> = {
  "urgent-important": "do",
  "important": "decide",
  "urgent": "delegate",
  "fyi": "skip",
};

export const writeSummary = internalMutation({
  args: {
    userId: v.id("users"),
    conversationId: v.id("conversations"),
    eisenhowerQuadrant: v.union(
      v.literal("urgent-important"),
      v.literal("important"),
      v.literal("urgent"),
      v.literal("fyi"),
    ),
    bullets: v.array(
      v.object({
        text: v.string(),
        priority: v.union(
          v.literal("urgent-important"),
          v.literal("important"),
          v.literal("urgent"),
          v.literal("fyi"),
        ),
        relatedMessageIds: v.array(v.id("messages")),
      }),
    ),
    messageCount: v.number(),
    periodStart: v.number(),
    periodEnd: v.number(),
  },
  handler: async (ctx, args) => {
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) return;

    const title = args.bullets[0]?.text ?? "New activity";
    const summary = args.bullets.slice(1).map((b) => b.text).join(". ");
    const category = QUADRANT_TO_CATEGORY[args.eisenhowerQuadrant] ?? "skip";

    await ctx.db.insert("inboxItems", {
      userId: args.userId,
      workspaceId: conversation.workspaceId,
      type: "channel_summary",
      category,
      title,
      summary,
      status: "pending",
      conversationId: args.conversationId,
      createdAt: Date.now(),
    });
  },
});

// ---------------------------------------------------------------------------
// Main cron entry point
// ---------------------------------------------------------------------------

/** Conversations with <= this many messages are batched into a single LLM call. */
const LOW_ACTIVITY_THRESHOLD = 10;
/** Max conversations per single batch LLM call. */
const MAX_BATCH_SIZE = 5;

export const generateChannelSummaries = internalAction({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const windowMs = 15 * 60 * 1000;
    const periodStart = now - windowMs;

    const conversations = await ctx.runQuery(internal.summaries.getActiveConversations, {});

    // 1. Fetch messages for all conversations & skip those with no new activity
    const conversationData: Array<{
      conversationId: Id<"conversations">;
      conversationName: string;
      messages: Array<{ body: string; authorName: string; _id: string }>;
      members: Array<{ _id: Id<"users">; name: string }>;
    }> = [];

    for (const conversation of conversations) {
      // Check if we already generated a summary for this period before fetching messages
      const lastSummaryTime = await ctx.runQuery(
        internal.summaries.getLastSummaryTime,
        { conversationId: conversation._id },
      );
      if (lastSummaryTime !== null && lastSummaryTime >= periodStart) continue;

      const messages = await ctx.runQuery(internal.summaries.getRecentMessages, {
        conversationId: conversation._id,
        since: periodStart,
      });

      if (messages.length < 3) continue;

      conversationData.push({
        conversationId: conversation._id,
        conversationName: conversation.name ?? "Conversation",
        messages,
        members: conversation.members,
      });
    }

    // 2. Separate high-activity vs low-activity conversations
    const highActivity = conversationData.filter(
      (ch) => ch.messages.length > LOW_ACTIVITY_THRESHOLD,
    );
    const lowActivity = conversationData.filter(
      (ch) => ch.messages.length <= LOW_ACTIVITY_THRESHOLD,
    );

    // 3. Generate one summary per high-activity conversation (1 LLM call each)
    const summaryMap = new Map<string, GeneratedSummary>();

    for (const ch of highActivity) {
      try {
        const summary = await generateConversationSummary(ch.messages, ch.conversationName);
        summaryMap.set(ch.conversationId as string, summary);
      } catch (err) {
        console.error(
          `[summaries] Failed to summarize conversation ${ch.conversationId}:`,
          err,
        );
      }
    }

    // 4. Batch low-activity conversations into groups and summarize together
    for (let i = 0; i < lowActivity.length; i += MAX_BATCH_SIZE) {
      const batch = lowActivity.slice(i, i + MAX_BATCH_SIZE);
      const batchInput: ConversationMessages[] = batch.map((ch) => ({
        conversationId: ch.conversationId as string,
        conversationName: ch.conversationName,
        messages: ch.messages,
      }));

      try {
        const batchResults = await generateBatchSummary(batchInput);
        for (const [conversationId, summary] of batchResults) {
          summaryMap.set(conversationId, summary);
        }
      } catch (err) {
        console.error("[summaries] Batch summary failed, falling back to individual calls");
        for (const ch of batch) {
          try {
            const summary = await generateConversationSummary(ch.messages, ch.conversationName);
            summaryMap.set(ch.conversationId as string, summary);
          } catch (innerErr) {
            console.error(
              `[summaries] Fallback failed for conversation ${ch.conversationId}:`,
              innerErr,
            );
          }
        }
      }
    }

    // 5. Personalise per user and write summaries (parallelized)
    for (const ch of conversationData) {
      const baseSummary = summaryMap.get(ch.conversationId as string);
      if (!baseSummary) continue;

      await Promise.all(
        ch.members.map(async (member) => {
          try {
            const { role } = await ctx.runQuery(
              internal.summaries.getUserRoleAndPrefs,
              { userId: member._id },
            );

            const personalised = personalizeForUser(baseSummary, member.name, role);

            const sortedBullets = [...personalised.bullets].sort(
              (a, b) =>
                QUADRANT_ORDER.indexOf(a.priority) -
                QUADRANT_ORDER.indexOf(b.priority),
            );

            await ctx.runMutation(internal.summaries.writeSummary, {
              userId: member._id,
              conversationId: ch.conversationId,
              eisenhowerQuadrant: personalised.eisenhowerQuadrant,
              bullets: sortedBullets.map((b) => ({
                text: b.text,
                priority: b.priority,
                relatedMessageIds: b.relatedMessageIds as Id<"messages">[],
              })),
              messageCount: ch.messages.length,
              periodStart,
              periodEnd: now,
            });
          } catch (err) {
            console.error(
              `[summaries] Failed for user ${member._id} in conversation ${ch.conversationId}`
            );
          }
        }),
      );
    }
  },
});

// ─── Email summaries (8LI-130) ────────────────────────────────────────────────

export const getRecentClassifiedEmails = internalQuery({
  args: { since: v.number() },
  handler: async (ctx, args) => {
    const emails = await ctx.db
      .query("emails")
      .filter((q) =>
        q.and(
          q.neq(q.field("agentClassifiedAt"), undefined),
          q.gte(q.field("agentClassifiedAt"), args.since),
          q.eq(q.field("isArchived"), false),
        ),
      )
      .take(200);

    // Group by userId
    const byUser = new Map<string, Array<Doc<"emails">>>();
    for (const email of emails) {
      const key = email.userId as string;
      if (!byUser.has(key)) byUser.set(key, []);
      byUser.get(key)!.push(email);
    }

    return Array.from(byUser.entries()).map(([userId, userEmails]) => ({
      userId: userId as Id<"users">,
      emails: userEmails.map((e) => ({
        _id: e._id as string,
        from: e.from,
        subject: e.subject,
        bodyPlain: (e.bodyPlain ?? "").slice(0, 300),
        eisenhowerQuadrant: e.eisenhowerQuadrant,
        agentSummary: e.agentSummary,
      })),
    }));
  },
});

export const writeEmailSummary = internalMutation({
  args: {
    userId: v.id("users"),
    conversationId: v.id("conversations"),
    eisenhowerQuadrant: v.union(
      v.literal("urgent-important"),
      v.literal("important"),
      v.literal("urgent"),
      v.literal("fyi"),
    ),
    bullets: v.array(
      v.object({
        text: v.string(),
        priority: v.union(
          v.literal("urgent-important"),
          v.literal("important"),
          v.literal("urgent"),
          v.literal("fyi"),
        ),
        relatedMessageIds: v.array(v.id("messages")),
      }),
    ),
    messageCount: v.number(),
    periodStart: v.number(),
    periodEnd: v.number(),
  },
  handler: async (ctx, args) => {
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) return;

    const title = args.bullets[0]?.text ?? "Email summary";
    const summary = args.bullets.slice(1).map((b) => b.text).join(". ");
    const category = QUADRANT_TO_CATEGORY[args.eisenhowerQuadrant] ?? "skip";

    await ctx.db.insert("inboxItems", {
      userId: args.userId,
      workspaceId: conversation.workspaceId,
      type: "email_summary",
      category,
      title,
      summary,
      status: "pending",
      conversationId: args.conversationId,
      createdAt: Date.now(),
    });
  },
});

export const generateEmailSummaries = internalAction({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const windowMs = 15 * 60 * 1000;
    const periodStart = now - windowMs;

    const userGroups = await ctx.runQuery(
      internal.summaries.getRecentClassifiedEmails,
      { since: periodStart },
    );

    for (const group of userGroups) {
      if (group.emails.length < 1) continue;

      // Aggregate email quadrants into a single inbox summary
      const quadrantCounts: Record<string, number> = {};
      const bullets: Array<{
        text: string;
        priority: EisenhowerQuadrant;
        relatedMessageIds: Id<"messages">[];
      }> = [];

      for (const email of group.emails) {
        const q = email.eisenhowerQuadrant ?? "fyi";
        quadrantCounts[q] = (quadrantCounts[q] ?? 0) + 1;

        bullets.push({
          text: email.agentSummary ?? `${email.subject} from ${email.from}`,
          priority: q as EisenhowerQuadrant,
          relatedMessageIds: [],
        });
      }

      // Sort bullets by quadrant priority
      const sortedBullets = [...bullets].sort(
        (a, b) =>
          QUADRANT_ORDER.indexOf(a.priority) -
          QUADRANT_ORDER.indexOf(b.priority),
      );

      // Overall quadrant = highest priority among emails
      const topQuadrant = sortedBullets[0]?.priority ?? "fyi";

      // Find user's default channel for the summary
      const conversationMembership = await ctx.runQuery(
        internal.emailAgent.getUserDefaultConversation,
        { userId: group.userId },
      );
      if (!conversationMembership) continue;

      try {
        await ctx.runMutation(internal.summaries.writeEmailSummary, {
          userId: group.userId,
          conversationId: conversationMembership.conversationId,
          eisenhowerQuadrant: topQuadrant,
          bullets: sortedBullets.slice(0, 5),
          messageCount: group.emails.length,
          periodStart,
          periodEnd: now,
        });
      } catch (err) {
        console.error(
          `[summaries] Failed email summary for user ${group.userId}:`,
          err,
        );
      }
    }
  },
});
