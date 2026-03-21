import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

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

interface ChannelMessages {
  channelId: string;
  channelName: string;
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

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
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
  });

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
 * Generate a single base summary for one channel. Shared across all members.
 */
async function generateChannelSummary(
  messages: Array<{ body: string; authorName: string; _id: string }>,
  channelName: string,
): Promise<GeneratedSummary> {
  const prompt = `You are an AI assistant that summarizes Slack-like channel messages using the Eisenhower Matrix.

Classify each bullet into one of these quadrants:
${QUADRANT_DESCRIPTIONS}

Channel: #${channelName}

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
 * Batch-summarize multiple low-activity channels in a single LLM call.
 */
async function generateBatchSummary(
  channelsBatch: ChannelMessages[],
): Promise<Map<string, GeneratedSummary>> {
  const sections = channelsBatch.map((ch) => {
    return `### Channel: #${ch.channelName} (id: ${ch.channelId})\n${formatMessages(ch.messages)}`;
  });

  const prompt = `You are an AI assistant that summarizes Slack-like channel messages using the Eisenhower Matrix.

Classify each bullet into one of these quadrants:
${QUADRANT_DESCRIPTIONS}

Below are messages from multiple channels. Summarize each channel separately.

${sections.join("\n\n")}

Respond with valid JSON only, no markdown:
{
  "channels": {
    "<channelId>": {
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

  for (const ch of channelsBatch) {
    const chRaw = channelsMap[ch.channelId];
    if (!chRaw) continue;

    const bullets = parseBullets(chRaw.bullets ?? [], ch.messages);
    results.set(ch.channelId, {
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

export const getActiveChannels = internalQuery({
  args: {},
  handler: async (ctx) => {
    const channels = await ctx.db
      .query("channels")
      .filter((q) => q.eq(q.field("isArchived"), false))
      .take(100);

    return Promise.all(
      channels.map(async (channel) => {
        const memberRows = await ctx.db
          .query("channelMembers")
          .withIndex("by_channel", (q) => q.eq("channelId", channel._id))
          .take(500);

        const members = (
          await Promise.all(memberRows.map((m) => ctx.db.get(m.userId)))
        ).filter(Boolean) as Array<{ _id: Id<"users">; name: string }>;

        return { _id: channel._id, name: channel.name, members };
      }),
    );
  },
});

export const getRecentMessages = internalQuery({
  args: {
    channelId: v.id("channels"),
    since: v.number(),
  },
  handler: async (ctx, args) => {
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_channel", (q) => q.eq("channelId", args.channelId))
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
 * Get the latest summary period end for a channel so we can skip channels
 * with no new messages since the last run.
 */
export const getLastSummaryTime = internalQuery({
  args: { channelId: v.id("channels") },
  handler: async (ctx, args) => {
    const latest = await ctx.db
      .query("inboxSummaries")
      .withIndex("by_channel_period", (q) => q.eq("channelId", args.channelId))
      .order("desc")
      .first();
    return latest?.periodEnd ?? null;
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

export const writeSummary = internalMutation({
  args: {
    userId: v.id("users"),
    channelId: v.id("channels"),
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
    await ctx.db.insert("inboxSummaries", {
      userId: args.userId,
      channelId: args.channelId,
      eisenhowerQuadrant: args.eisenhowerQuadrant,
      bullets: args.bullets,
      messageCount: args.messageCount,
      periodStart: args.periodStart,
      periodEnd: args.periodEnd,
      isRead: false,
      isArchived: false,
    });
  },
});

// ---------------------------------------------------------------------------
// Main cron entry point
// ---------------------------------------------------------------------------

/** Channels with <= this many messages are batched into a single LLM call. */
const LOW_ACTIVITY_THRESHOLD = 10;
/** Max channels per single batch LLM call. */
const MAX_BATCH_SIZE = 5;

export const generateChannelSummaries = internalAction({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const windowMs = 15 * 60 * 1000;
    const periodStart = now - windowMs;

    const channels = await ctx.runQuery(internal.summaries.getActiveChannels, {});

    // 1. Fetch messages for all channels & skip those with no new activity
    const channelData: Array<{
      channelId: Id<"channels">;
      channelName: string;
      messages: Array<{ body: string; authorName: string; _id: string }>;
      members: Array<{ _id: Id<"users">; name: string }>;
    }> = [];

    for (const channel of channels) {
      // Check if we already generated a summary for this period before fetching messages
      const lastSummaryTime = await ctx.runQuery(
        internal.summaries.getLastSummaryTime,
        { channelId: channel._id },
      );
      if (lastSummaryTime !== null && lastSummaryTime >= periodStart) continue;

      const messages = await ctx.runQuery(internal.summaries.getRecentMessages, {
        channelId: channel._id,
        since: periodStart,
      });

      if (messages.length < 3) continue;

      channelData.push({
        channelId: channel._id,
        channelName: channel.name,
        messages,
        members: channel.members,
      });
    }

    // 2. Separate high-activity vs low-activity channels
    const highActivity = channelData.filter(
      (ch) => ch.messages.length > LOW_ACTIVITY_THRESHOLD,
    );
    const lowActivity = channelData.filter(
      (ch) => ch.messages.length <= LOW_ACTIVITY_THRESHOLD,
    );

    // 3. Generate one summary per high-activity channel (1 LLM call each)
    const summaryMap = new Map<string, GeneratedSummary>();

    for (const ch of highActivity) {
      try {
        const summary = await generateChannelSummary(ch.messages, ch.channelName);
        summaryMap.set(ch.channelId as string, summary);
      } catch (err) {
        console.error(
          `[summaries] Failed to summarize channel ${ch.channelId}:`,
          err,
        );
      }
    }

    // 4. Batch low-activity channels into groups and summarize together
    for (let i = 0; i < lowActivity.length; i += MAX_BATCH_SIZE) {
      const batch = lowActivity.slice(i, i + MAX_BATCH_SIZE);
      const batchInput: ChannelMessages[] = batch.map((ch) => ({
        channelId: ch.channelId as string,
        channelName: ch.channelName,
        messages: ch.messages,
      }));

      try {
        const batchResults = await generateBatchSummary(batchInput);
        for (const [channelId, summary] of batchResults) {
          summaryMap.set(channelId, summary);
        }
      } catch (err) {
        console.error("[summaries] Batch summary failed, falling back to individual calls:", err);
        for (const ch of batch) {
          try {
            const summary = await generateChannelSummary(ch.messages, ch.channelName);
            summaryMap.set(ch.channelId as string, summary);
          } catch (innerErr) {
            console.error(
              `[summaries] Fallback failed for channel ${ch.channelId}:`,
              innerErr,
            );
          }
        }
      }
    }

    // 5. Personalise per user and write summaries
    for (const ch of channelData) {
      const baseSummary = summaryMap.get(ch.channelId as string);
      if (!baseSummary) continue;

      for (const member of ch.members) {
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
            channelId: ch.channelId,
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
            `[summaries] Failed for user ${member._id} in channel ${ch.channelId}:`,
            err,
          );
        }
      }
    }
  },
});
