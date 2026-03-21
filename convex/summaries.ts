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
}

interface GeneratedSummary {
  bullets: SummaryBullet[];
  eisenhowerQuadrant: EisenhowerQuadrant;
}

async function classifyWithAI(
  messages: Array<{ body: string; authorName: string; _id: string }>,
  targetUserName: string,
): Promise<GeneratedSummary> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY environment variable is not set");
  }

  const messageText = messages
    .slice(-30)
    .map((m) => `[${m.authorName}]: ${m.body}`)
    .join("\n");

  const prompt = `You are an AI assistant that summarizes Slack-like channel messages using the Eisenhower Matrix.

Classify each bullet into one of these quadrants:
- "urgent-important": Blockers, incidents, direct requests needing action NOW (mentions of ${targetUserName}, prod issues, deadlines today)
- "important": Decisions, architecture discussions, PRs awaiting review, strategic topics
- "urgent": Time-sensitive FYI, meeting reminders, quick mentions
- "fyi": General discussion, status updates, casual conversation

Messages:
${messageText}

Respond with valid JSON only, no markdown:
{
  "bullets": [
    {
      "text": "one-sentence summary of the key point",
      "priority": "urgent-important" | "important" | "urgent" | "fyi",
      "relatedMessageIndices": [0, 1]
    }
  ]
}

Rules:
- Generate 2-4 bullets covering the main topics
- If ${targetUserName} is @mentioned in an "important" topic, promote it to "urgent-important"
- Be concise and actionable`;

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
  const raw = JSON.parse(data.choices[0].message.content);

  const bullets: SummaryBullet[] = (raw.bullets ?? []).map(
    (b: { text: string; priority: string; relatedMessageIndices?: number[] }) => ({
      text: b.text,
      priority: (QUADRANT_ORDER.includes(b.priority as EisenhowerQuadrant)
        ? b.priority
        : "fyi") as EisenhowerQuadrant,
      relatedMessageIds: (b.relatedMessageIndices ?? [])
        .map((i: number) => messages[i]?._id)
        .filter(Boolean),
    }),
  );

  // Overall card quadrant = highest priority bullet
  const quadrantRanks = bullets.map((b) => QUADRANT_ORDER.indexOf(b.priority));
  const topRank = Math.min(...(quadrantRanks.length ? quadrantRanks : [3]));
  const eisenhowerQuadrant: EisenhowerQuadrant = QUADRANT_ORDER[topRank] ?? "fyi";

  return { bullets, eisenhowerQuadrant };
}

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
          .collect();

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
        const threadLabel = m.threadParentId ? " [thread reply]" : "";
        const replyLabel =
          m.replyCount && m.replyCount > 0
            ? ` [has ${m.replyCount} thread replies]`
            : "";
        return {
          _id: m._id as string,
          body: m.body + threadLabel + replyLabel,
          authorName: author?.name ?? "Unknown",
        };
      }),
    );
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

export const generateChannelSummaries = internalAction({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const windowMs = 15 * 60 * 1000; // 15-minute window
    const periodStart = now - windowMs;

    const channels = await ctx.runQuery(internal.summaries.getActiveChannels, {});

    for (const channel of channels) {
      const messages = await ctx.runQuery(internal.summaries.getRecentMessages, {
        channelId: channel._id,
        since: periodStart,
      });

      if (messages.length < 3) continue;

      for (const member of channel.members) {
        try {
          const summary = await classifyWithAI(messages, member.name);

          // Sort bullets Q1 → Q2 → Q3 → Q4
          const sortedBullets = [...summary.bullets].sort(
            (a, b) =>
              QUADRANT_ORDER.indexOf(a.priority) - QUADRANT_ORDER.indexOf(b.priority),
          );

          await ctx.runMutation(internal.summaries.writeSummary, {
            userId: member._id,
            channelId: channel._id,
            eisenhowerQuadrant: summary.eisenhowerQuadrant,
            bullets: sortedBullets.map((b) => ({
              ...b,
              relatedMessageIds: b.relatedMessageIds as Id<"messages">[],
            })),
            messageCount: messages.length,
            periodStart,
            periodEnd: now,
          });
        } catch (err) {
          console.error(
            `[summaries] Failed for user ${member._id} in channel ${channel._id}:`,
            err,
          );
        }
      }
    }
  },
});
