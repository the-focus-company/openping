import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    workosUserId: v.string(),
    email: v.string(),
    name: v.string(),
    avatarUrl: v.optional(v.string()),
    status: v.union(
      v.literal("active"),
      v.literal("invited"),
      v.literal("deactivated"),
    ),
    lastSeenAt: v.optional(v.number()),
    presenceStatus: v.optional(v.union(v.literal("online"), v.literal("offline"))),
    statusMessage: v.optional(v.string()),
    statusEmoji: v.optional(v.string()),
    notificationPrefs: v.optional(
      v.object({
        inboxNotifications: v.boolean(),
        proactiveAlerts: v.boolean(),
      }),
    ),
    // Onboarding fields
    onboardingStatus: v.optional(v.union(v.literal("pending"), v.literal("completed"))),
    title: v.optional(v.string()),
    department: v.optional(v.string()),
    bio: v.optional(v.string()),
    expertise: v.optional(v.array(v.string())),
    workContext: v.optional(v.string()),
    communicationPrefs: v.optional(v.object({
      timezone: v.optional(v.string()),
      preferredHours: v.optional(v.string()),
      responseTimeGoal: v.optional(v.string()),
    })),
    aiPrefs: v.optional(v.object({
      summaryDetail: v.union(v.literal("concise"), v.literal("detailed")),
      proactiveLevel: v.union(v.literal("minimal"), v.literal("balanced"), v.literal("aggressive")),
      autoTriage: v.boolean(),
    })),
  })
    .index("by_workos_id", ["workosUserId"])
    .index("by_email", ["email"]),

  workspaceMembers: defineTable({
    userId: v.id("users"),
    workspaceId: v.id("workspaces"),
    role: v.union(v.literal("admin"), v.literal("member")),
    joinedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_workspace", ["workspaceId"])
    .index("by_user_workspace", ["userId", "workspaceId"]),

  workspaces: defineTable({
    name: v.string(),
    slug: v.string(),
    workosOrgId: v.optional(v.string()),
    createdBy: v.optional(v.id("users")),
    integrations: v.optional(v.any()),
    industry: v.optional(v.string()),
    companySize: v.optional(v.string()),
    companyDescription: v.optional(v.string()),
    defaultChannels: v.optional(v.array(v.string())),
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
    .index("by_workspace_name", ["workspaceId", "name"]),

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
      v.literal("fact_check"),
      v.literal("cross_team_sync"),
    ),
    channelId: v.id("channels"),
    sourceChannelId: v.optional(v.id("channels")),
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

  directConversations: defineTable({
    workspaceId: v.id("workspaces"),
    kind: v.union(
      v.literal("1to1"),
      v.literal("group"),
      v.literal("agent_1to1"),
      v.literal("agent_group"),
    ),
    name: v.optional(v.string()),
    createdBy: v.id("users"),
    isArchived: v.boolean(),
  })
    .index("by_workspace", ["workspaceId"]),

  directConversationMembers: defineTable({
    conversationId: v.id("directConversations"),
    userId: v.id("users"),
    isAgent: v.boolean(),
    lastReadAt: v.optional(v.number()),
  })
    .index("by_conversation", ["conversationId"])
    .index("by_user", ["userId"])
    .index("by_conversation_user", ["conversationId", "userId"]),

  directMessages: defineTable({
    conversationId: v.id("directConversations"),
    authorId: v.id("users"),
    body: v.string(),
    type: v.union(v.literal("user"), v.literal("bot"), v.literal("system")),
    isEdited: v.boolean(),
  })
    .index("by_conversation", ["conversationId"])
    .index("by_author", ["authorId"]),

  typingIndicators: defineTable({
    channelId: v.id("channels"),
    userId: v.id("users"),
    expiresAt: v.number(),
  })
    .index("by_channel", ["channelId"])
    .index("by_channel_user", ["channelId", "userId"]),

  invitations: defineTable({
    workspaceId: v.id("workspaces"),
    email: v.string(),
    invitedBy: v.id("users"),
    role: v.union(v.literal("admin"), v.literal("member")),
    status: v.union(v.literal("pending"), v.literal("accepted"), v.literal("expired")),
    token: v.string(),
    expiresAt: v.number(),
  })
    .index("by_email", ["email"])
    .index("by_token", ["token"])
    .index("by_workspace", ["workspaceId"]),

  reactions: defineTable({
    messageId: v.id("messages"),
    userId: v.id("users"),
    emoji: v.string(),
  })
    .index("by_message", ["messageId"])
    .index("by_message_user", ["messageId", "userId"]),

  emailAccounts: defineTable({
    userId: v.id("users"),
    workspaceId: v.id("workspaces"),
    provider: v.union(v.literal("gmail"), v.literal("outlook")),
    email: v.string(),
    accessToken: v.string(),
    refreshToken: v.string(),
    tokenExpiresAt: v.number(),
    syncCursor: v.optional(v.string()),
    status: v.union(
      v.literal("active"),
      v.literal("paused"),
      v.literal("error"),
    ),
    lastSyncedAt: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_user_email", ["userId", "email"]),

  emails: defineTable({
    userId: v.id("users"),
    workspaceId: v.id("workspaces"),
    emailAccountId: v.id("emailAccounts"),
    externalId: v.string(),
    threadId: v.string(),
    subject: v.string(),
    from: v.string(),
    to: v.array(v.string()),
    cc: v.optional(v.array(v.string())),
    bcc: v.optional(v.array(v.string())),
    bodyPlain: v.string(),
    bodyHtml: v.optional(v.string()),
    receivedAt: v.number(),
    isRead: v.boolean(),
    isArchived: v.boolean(),
    eisenhowerQuadrant: v.optional(
      v.union(
        v.literal("urgent-important"),
        v.literal("important"),
        v.literal("urgent"),
        v.literal("fyi"),
      ),
    ),
    agentSummary: v.optional(v.string()),
    agentClassifiedAt: v.optional(v.number()),
    suggestedAction: v.optional(v.string()),
    reminderAt: v.optional(v.number()),
    delegateTo: v.optional(v.string()),
    graphitiEpisodeId: v.optional(v.string()),
  })
    .index("by_user", ["userId"])
    .index("by_user_quadrant", ["userId", "eisenhowerQuadrant"])
    .index("by_user_unread", ["userId", "isRead"])
    .index("by_thread", ["threadId"])
    .index("by_external_id", ["externalId"])
    .searchIndex("search_body", {
      searchField: "bodyPlain",
      filterFields: ["userId", "subject"],
    }),

  emailDrafts: defineTable({
    userId: v.id("users"),
    workspaceId: v.id("workspaces"),
    emailAccountId: v.id("emailAccounts"),
    to: v.array(v.string()),
    cc: v.optional(v.array(v.string())),
    bcc: v.optional(v.array(v.string())),
    subject: v.string(),
    body: v.string(),
    inReplyToEmailId: v.optional(v.id("emails")),
    status: v.union(
      v.literal("draft"),
      v.literal("sending"),
      v.literal("sent"),
      v.literal("failed"),
    ),
  })
    .index("by_user", ["userId"]),
});
