import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    workosUserId: v.string(),
    email: v.string(),
    name: v.string(),
    avatarUrl: v.optional(v.string()),
    role: v.union(v.literal("admin"), v.literal("member")),
    workspaceId: v.id("workspaces"),
    status: v.union(
      v.literal("active"),
      v.literal("invited"),
      v.literal("deactivated"),
    ),
    lastSeenAt: v.optional(v.number()),
    presenceStatus: v.optional(v.union(v.literal("online"), v.literal("away"), v.literal("offline"))),
    statusMessage: v.optional(v.string()),
    statusEmoji: v.optional(v.string()),
  })
    .index("by_workos_id", ["workosUserId"])
    .index("by_email", ["email"])
    .index("by_workspace", ["workspaceId"]),

  workspaces: defineTable({
    name: v.string(),
    slug: v.string(),
    workosOrgId: v.optional(v.string()),
    createdBy: v.id("users"),
    integrations: v.optional(v.any()),
  })
    .index("by_slug", ["slug"])
    .index("by_workos_org", ["workosOrgId"]),

  channels: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    workspaceId: v.id("workspaces"),
    createdBy: v.id("users"),
    isDefault: v.boolean(),
    isArchived: v.boolean(),
    type: v.optional(v.union(v.literal("public"), v.literal("dm"), v.literal("group"))),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_name", ["workspaceId", "name"])
    .index("by_workspace_type", ["workspaceId", "type"]),

  channelMembers: defineTable({
    channelId: v.id("channels"),
    userId: v.id("users"),
    lastReadAt: v.optional(v.number()),
  })
    .index("by_channel", ["channelId"])
    .index("by_user", ["userId"])
    .index("by_channel_user", ["channelId", "userId"]),

  messages: defineTable({
    channelId: v.id("channels"),
    authorId: v.id("users"),
    body: v.string(),
    type: v.union(
      v.literal("user"),
      v.literal("bot"),
      v.literal("system"),
      v.literal("integration"),
    ),
    integrationObjectId: v.optional(v.id("integrationObjects")),
    citations: v.optional(
      v.array(
        v.object({
          text: v.string(),
          sourceUrl: v.optional(v.string()),
          sourceTitle: v.optional(v.string()),
        }),
      ),
    ),
    mentions: v.optional(v.array(v.string())),
    graphitiEpisodeId: v.optional(v.string()),
    isEdited: v.boolean(),
  })
    .index("by_channel", ["channelId"])
    .index("by_author", ["authorId"])
    .searchIndex("search_body", {
      searchField: "body",
      filterFields: ["channelId"],
    }),

  integrationObjects: defineTable({
    workspaceId: v.id("workspaces"),
    type: v.union(v.literal("github_pr"), v.literal("linear_ticket")),
    externalId: v.string(),
    title: v.string(),
    status: v.string(),
    url: v.string(),
    author: v.string(),
    metadata: v.any(),
    lastSyncedAt: v.number(),
    graphitiEpisodeId: v.optional(v.string()),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_type", ["workspaceId", "type"])
    .index("by_external_id", ["externalId"]),

  inboxSummaries: defineTable({
    userId: v.id("users"),
    channelId: v.id("channels"),
    bullets: v.array(
      v.object({
        text: v.string(),
        priority: v.union(
          v.literal("high"),
          v.literal("medium"),
          v.literal("low"),
        ),
        relatedMessageIds: v.array(v.id("messages")),
      }),
    ),
    messageCount: v.number(),
    periodStart: v.number(),
    periodEnd: v.number(),
    isRead: v.boolean(),
    isArchived: v.boolean(),
    actionItems: v.optional(
      v.array(
        v.object({
          text: v.string(),
          assignee: v.optional(v.string()),
          relatedIntegrationObjectId: v.optional(v.id("integrationObjects")),
        }),
      ),
    ),
  })
    .index("by_user", ["userId"])
    .index("by_user_read", ["userId", "isRead"])
    .index("by_user_channel", ["userId", "channelId"])
    .index("by_channel_period", ["channelId", "periodEnd"]),

  drafts: defineTable({
    userId: v.id("users"),
    channelId: v.id("channels"),
    body: v.string(),
    replyToMessageId: v.optional(v.id("messages")),
    contextSnapshot: v.string(),
    suggestedCompletion: v.string(),
    status: v.union(
      v.literal("active"),
      v.literal("dismissed"),
      v.literal("sent"),
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_channel", ["userId", "channelId"])
    .index("by_user_status", ["userId", "status"]),

  proactiveAlerts: defineTable({
    userId: v.id("users"),
    workspaceId: v.id("workspaces"),
    type: v.union(
      v.literal("unanswered_question"),
      v.literal("pr_review_nudge"),
      v.literal("incident_route"),
      v.literal("blocked_task"),
    ),
    channelId: v.id("channels"),
    title: v.string(),
    body: v.string(),
    sourceMessageId: v.optional(v.id("messages")),
    sourceIntegrationObjectId: v.optional(v.id("integrationObjects")),
    suggestedAction: v.string(),
    priority: v.union(
      v.literal("high"),
      v.literal("medium"),
      v.literal("low"),
    ),
    status: v.union(
      v.literal("pending"),
      v.literal("acted"),
      v.literal("dismissed"),
      v.literal("expired"),
    ),
    expiresAt: v.number(),
    createdAt: v.number(),
  })
    .index("by_user_status", ["userId", "status"])
    .index("by_user_type", ["userId", "type"])
    .index("by_workspace_type", ["workspaceId", "type"]),

  sessions: defineTable({
    userId: v.id("users"),
    workosSessionId: v.string(),
    expiresAt: v.number(),
  })
    .index("by_session_id", ["workosSessionId"])
    .index("by_user", ["userId"]),

  reactions: defineTable({
    messageId: v.id("messages"),
    userId: v.id("users"),
    emoji: v.string(),
  })
    .index("by_message", ["messageId"])
    .index("by_message_user", ["messageId", "userId"]),

  typingIndicators: defineTable({
    channelId: v.id("channels"),
    userId: v.id("users"),
    expiresAt: v.number(),
  })
    .index("by_channel", ["channelId"])
    .index("by_channel_user", ["channelId", "userId"]),
});
