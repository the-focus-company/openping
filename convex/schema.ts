import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { attachmentValidator } from "./files";

/** Validator for workspace/invitation roles. */
export const roleValidator = v.union(
  v.literal("admin"),
  v.literal("member"),
  v.literal("guest"),
);

/** Typed metadata for integration objects (GitHub PRs and Linear tickets). */
export const integrationMetadataValidator = v.union(
  v.object({
    number: v.optional(v.number()),
    repo: v.optional(v.string()),
    description: v.optional(v.string()),
    draft: v.optional(v.boolean()),
    merged: v.optional(v.boolean()),
  }),
  v.object({
    linearId: v.optional(v.string()),
    identifier: v.optional(v.string()),
    description: v.optional(v.string()),
    priority: v.optional(v.string()),
    labels: v.optional(v.array(v.string())),
    assigneeEmail: v.optional(v.string()),
    teamKey: v.optional(v.string()),
    createdAt: v.optional(v.string()),
    updatedAt: v.optional(v.string()),
  }),
);

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
    // Push notification tokens (one per device)
    pushTokens: v.optional(v.array(v.string())),
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
    role: roleValidator,
    joinedAt: v.number(),
    onboardingStatus: v.optional(v.union(v.literal("pending"), v.literal("completed"))),
  })
    .index("by_user", ["userId"])
    .index("by_workspace", ["workspaceId"])
    .index("by_user_workspace", ["userId", "workspaceId"]),

  workspaces: defineTable({
    name: v.string(),
    slug: v.string(),
    workosOrgId: v.optional(v.string()),
    createdBy: v.optional(v.id("users")),
    integrations: v.optional(
      v.object({
        githubOrgLogin: v.optional(v.string()),
        githubWebhookSecret: v.optional(v.string()),
        linearOrgId: v.optional(v.string()),
        linearWebhookSecret: v.optional(v.string()),
      }),
    ),
    integrationConfig: v.optional(
      v.object({
        github: v.optional(
          v.object({
            connected: v.boolean(),
            accountName: v.optional(v.string()),
            connectedAt: v.optional(v.number()),
          }),
        ),
        linear: v.optional(
          v.object({
            connected: v.boolean(),
            orgName: v.optional(v.string()),
            connectedAt: v.optional(v.number()),
          }),
        ),
      }),
    ),
    industry: v.optional(v.string()),
    companySize: v.optional(v.string()),
    companyDescription: v.optional(v.string()),
    defaultChannels: v.optional(v.array(v.string())),
    publicInviteEnabled: v.optional(v.boolean()),
  })
    .index("by_slug", ["slug"])
    .index("by_workos_org", ["workosOrgId"]),

  accessRequests: defineTable({
    workspaceId: v.id("workspaces"),
    email: v.string(),
    name: v.optional(v.string()),
    message: v.optional(v.string()),
    userId: v.optional(v.id("users")),
    status: v.union(v.literal("pending"), v.literal("approved"), v.literal("rejected")),
    reviewedBy: v.optional(v.id("users")),
    reviewedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_status", ["workspaceId", "status"])
    .index("by_email_workspace", ["email", "workspaceId"]),

  // ── Unified conversations (replaces channels + directConversations) ──
  conversations: defineTable({
    workspaceId: v.id("workspaces"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    kind: v.union(
      v.literal("1to1"),
      v.literal("group"),
      v.literal("agent_1to1"),
      v.literal("agent_group"),
    ),
    visibility: v.union(
      v.literal("public"),
      v.literal("secret"),
      v.literal("secret_can_be_public"),
    ),
    isLockedSecret: v.optional(v.boolean()),
    createdBy: v.id("users"),
    isDefault: v.optional(v.boolean()),
    isArchived: v.boolean(),
    archivedAt: v.optional(v.number()),
    deletedAt: v.optional(v.number()),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_and_name", ["workspaceId", "name"]),

  // ── Unified conversation members (replaces channelMembers + directConversationMembers) ──
  conversationMembers: defineTable({
    conversationId: v.id("conversations"),
    userId: v.id("users"),
    isAgent: v.optional(v.boolean()),
    lastReadAt: v.optional(v.number()),
    unreadCount: v.optional(v.number()),
    unreadMentionCount: v.optional(v.number()),
    isStarred: v.optional(v.boolean()),
    isMuted: v.optional(v.boolean()),
    folder: v.optional(v.string()),
  })
    .index("by_conversation", ["conversationId"])
    .index("by_user", ["userId"])
    .index("by_conversation_and_user", ["conversationId", "userId"]),

  // ── Unified messages (replaces messages + directMessages) ──
  messages: defineTable({
    /** After backfill this becomes required again. Legacy docs may have channelId instead. */
    conversationId: v.optional(v.id("conversations")),
    /** @deprecated Legacy field — use conversationId instead. Removed after backfill. */
    channelId: v.optional(v.string()),
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
    attachments: v.optional(v.array(attachmentValidator)),
    meetingId: v.optional(v.id("meetings")),
    // Integration update history (previous states when message is edited by webhook)
    integrationHistory: v.optional(v.array(v.object({
      body: v.string(),
      timestamp: v.number(),
    }))),
    // Thread fields
    threadId: v.optional(v.id("messages")),
    alsoSentToConversation: v.optional(v.boolean()),
    /** @deprecated Legacy field — use alsoSentToConversation instead. */
    alsoSentToChannel: v.optional(v.boolean()),
    threadReplyCount: v.optional(v.number()),
    threadLastReplyAt: v.optional(v.number()),
    threadLastReplyAuthorId: v.optional(v.id("users")),
    threadParticipantIds: v.optional(v.array(v.id("users"))),
  })
    .index("by_conversation", ["conversationId"])
    .index("by_author", ["authorId"])
    .index("by_thread", ["threadId"])
    .searchIndex("search_body", {
      searchField: "body",
      filterFields: ["conversationId"],
    }),

  integrationObjects: defineTable({
    workspaceId: v.id("workspaces"),
    type: v.union(v.literal("github_pr"), v.literal("linear_ticket")),
    externalId: v.string(),
    title: v.string(),
    status: v.string(),
    url: v.string(),
    author: v.string(),
    metadata: integrationMetadataValidator,
    lastSyncedAt: v.number(),
    graphitiEpisodeId: v.optional(v.string()),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_type", ["workspaceId", "type"])
    .index("by_external_id", ["externalId"]),

  inboxItems: defineTable({
    userId: v.id("users"),
    workspaceId: v.id("workspaces"),
    type: v.union(
      v.literal("pr_review"),
      v.literal("ticket_triage"),
      v.literal("question_answer"),
      v.literal("blocked_unblock"),
      v.literal("fact_verify"),
      v.literal("cross_team_ack"),
      v.literal("channel_summary"),
      v.literal("email_summary"),
    ),
    category: v.union(
      v.literal("do"),
      v.literal("decide"),
      v.literal("delegate"),
      v.literal("skip"),
    ),
    title: v.string(),
    summary: v.string(),
    context: v.optional(v.string()),
    pingWillDo: v.optional(v.string()),
    status: v.union(
      v.literal("pending"),
      v.literal("snoozed"),
      v.literal("archived"),
    ),
    conversationId: v.optional(v.id("conversations")),
    /** @deprecated Legacy field — use conversationId instead. Will be removed after backfill. */
    channelId: v.optional(v.string()),
    sourceMessageId: v.optional(v.id("messages")),
    sourceIntegrationObjectId: v.optional(v.id("integrationObjects")),
    orgTrace: v.optional(
      v.array(
        v.object({
          userId: v.optional(v.id("users")),
          name: v.string(),
          role: v.union(
            v.literal("author"),
            v.literal("assignee"),
            v.literal("mentioned"),
            v.literal("to_consult"),
          ),
          avatarUrl: v.optional(v.string()),
        }),
      ),
    ),
    recommendedActions: v.optional(
      v.array(
        v.object({
          label: v.string(),
          actionKey: v.string(),
          primary: v.optional(v.boolean()),
          needsComment: v.optional(v.boolean()),
        }),
      ),
    ),
    nextSteps: v.optional(
      v.array(
        v.object({
          actionKey: v.string(),
          label: v.string(),
          automated: v.boolean(),
        }),
      ),
    ),
    links: v.optional(
      v.array(
        v.object({
          title: v.string(),
          url: v.string(),
          type: v.union(
            v.literal("doc"),
            v.literal("sheet"),
            v.literal("video"),
            v.literal("pr"),
            v.literal("other"),
          ),
        }),
      ),
    ),
    relatedItemIds: v.optional(v.array(v.id("inboxItems"))),
    outcome: v.optional(
      v.object({
        action: v.string(),
        comment: v.optional(v.string()),
        delegatedTo: v.optional(v.id("users")),
        decidedAt: v.number(),
      }),
    ),
    agentExecutionStatus: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("running"),
        v.literal("completed"),
        v.literal("failed"),
      ),
    ),
    agentExecutionResult: v.optional(v.string()),
    delegatedTo: v.optional(v.id("users")),
    snoozedUntil: v.optional(v.number()),
    expiresAt: v.optional(v.number()),
    createdAt: v.number(),
    graphitiEpisodeId: v.optional(v.string()),
  })
    .index("by_user_status", ["userId", "status"])
    .index("by_user_category", ["userId", "category"])
    .index("by_workspace_type", ["workspaceId", "type"]),

  drafts: defineTable({
    userId: v.id("users"),
    conversationId: v.id("conversations"),
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
    .index("by_user_and_conversation", ["userId", "conversationId"])
    .index("by_user_status", ["userId", "status"]),

  sessions: defineTable({
    userId: v.id("users"),
    workosSessionId: v.string(),
    expiresAt: v.number(),
  })
    .index("by_session_id", ["workosSessionId"])
    .index("by_user", ["userId"]),

  typingIndicators: defineTable({
    conversationId: v.optional(v.id("conversations")),
    threadMessageId: v.optional(v.id("messages")),
    userId: v.id("users"),
    expiresAt: v.number(),
  })
    .index("by_conversation", ["conversationId"])
    .index("by_conversation_and_user", ["conversationId", "userId"])
    .index("by_thread_message", ["threadMessageId"])
    .index("by_thread_message_and_user", ["threadMessageId", "userId"]),

  invitations: defineTable({
    workspaceId: v.id("workspaces"),
    email: v.string(),
    invitedBy: v.id("users"),
    role: roleValidator,
    status: v.union(v.literal("pending"), v.literal("accepted"), v.literal("expired")),
    token: v.string(),
    expiresAt: v.number(),
  })
    .index("by_email", ["email"])
    .index("by_token", ["token"])
    .index("by_workspace", ["workspaceId"]),

  conversationInvitations: defineTable({
    conversationId: v.id("conversations"),
    workspaceId: v.id("workspaces"),
    createdBy: v.id("users"),
    email: v.optional(v.string()),
    token: v.string(),
    expiresAt: v.number(),
    status: v.union(v.literal("active"), v.literal("revoked")),
  })
    .index("by_token", ["token"])
    .index("by_conversation", ["conversationId"])
    .index("by_conversation_and_email", ["conversationId", "email"]),

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
    provider: v.union(
      v.literal("google"),
      v.literal("microsoft"),
      v.literal("imap"),
      v.literal("gmail"),
      v.literal("outlook"),
    ),
    emailAddress: v.string(),
    accessToken: v.optional(v.string()),
    refreshToken: v.optional(v.string()),
    tokenExpiresAt: v.optional(v.number()),
    syncCursor: v.optional(v.string()),
    lastSyncedAt: v.optional(v.number()),
    isActive: v.boolean(),
    pushChannelId: v.optional(v.string()),
    pushExpiresAt: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_user_workspace", ["userId", "workspaceId"])
    .index("by_workspace", ["workspaceId"])
    .index("by_email", ["emailAddress"])
    .index("by_push_channel", ["pushChannelId"]),

  emails: defineTable({
    emailAccountId: v.id("emailAccounts"),
    userId: v.id("users"),
    workspaceId: v.id("workspaces"),
    externalId: v.string(),
    threadId: v.optional(v.string()),
    from: v.string(),
    to: v.array(v.string()),
    cc: v.optional(v.array(v.string())),
    subject: v.string(),
    bodyPlain: v.optional(v.string()),
    bodyHtml: v.optional(v.string()),
    bodyText: v.optional(v.string()),
    snippet: v.optional(v.string()),
    receivedAt: v.number(),
    isRead: v.boolean(),
    isArchived: v.boolean(),
    isStarred: v.optional(v.boolean()),
    labels: v.optional(v.array(v.string())),
    inReplyTo: v.optional(v.string()),
    references: v.optional(v.array(v.string())),
    attachments: v.optional(
      v.array(
        v.object({
          filename: v.string(),
          mimeType: v.string(),
          size: v.number(),
          externalAttachmentId: v.string(),
        }),
      ),
    ),
    senderCategory: v.optional(v.string()),
    // AI classification fields
    eisenhowerQuadrant: v.optional(
      v.union(
        v.literal("urgent-important"),
        v.literal("important"),
        v.literal("urgent"),
        v.literal("fyi"),
      ),
    ),
    aiSummary: v.optional(v.string()),
    agentSummary: v.optional(v.string()),
    agentClassifiedAt: v.optional(v.number()),
    suggestedAction: v.optional(v.string()),
    reminderAt: v.optional(v.number()),
    delegateTo: v.optional(v.id("users")),
    graphitiEpisodeId: v.optional(v.string()),
  })
    .index("by_user", ["userId"])
    .index("by_user_unclassified", ["userId", "agentClassifiedAt"])
    .index("by_user_quadrant", ["userId", "eisenhowerQuadrant"])
    .index("by_user_read", ["userId", "isRead"])
    .index("by_user_archived", ["userId", "isArchived"])
    .index("by_thread", ["threadId"])
    .index("by_account", ["emailAccountId"])
    .index("by_external_id", ["externalId"])
    .index("by_reminder", ["reminderAt"])
    .searchIndex("search_body", {
      searchField: "bodyPlain",
      filterFields: ["userId"],
    })
    .searchIndex("search_subject", {
      searchField: "subject",
      filterFields: ["userId"],
    }),

  emailSenderRules: defineTable({
    userId: v.id("users"),
    workspaceId: v.id("workspaces"),
    senderAddress: v.string(),
    category: v.union(
      v.literal("vip"),
      v.literal("normal"),
      v.literal("muted"),
    ),
    autoArchive: v.optional(v.boolean()),
    autoLabel: v.optional(v.string()),
    suggestUnsubscribe: v.optional(v.boolean()),
    notes: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_sender", ["userId", "senderAddress"])
    .index("by_user_category", ["userId", "category"]),

  emailDrafts: defineTable({
    userId: v.id("users"),
    workspaceId: v.id("workspaces"),
    emailAccountId: v.id("emailAccounts"),
    threadId: v.optional(v.string()),
    inReplyTo: v.optional(v.id("emails")),
    to: v.array(v.string()),
    cc: v.optional(v.array(v.string())),
    bcc: v.optional(v.array(v.string())),
    subject: v.string(),
    body: v.optional(v.string()),
    bodyHtml: v.optional(v.string()),
    bodyText: v.optional(v.string()),
    mode: v.optional(
      v.union(
        v.literal("compose"),
        v.literal("reply"),
        v.literal("reply_all"),
        v.literal("forward"),
      ),
    ),
    replyToEmailId: v.optional(v.id("emails")),
    suggestedAction: v.optional(v.string()),
    attachmentIds: v.optional(v.array(v.id("_storage"))),
    status: v.union(
      v.literal("draft"),
      v.literal("sending"),
      v.literal("sent"),
      v.literal("failed"),
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_status", ["userId", "status"]),

  userApiTokens: defineTable({
    userId: v.id("users"),
    workspaceId: v.id("workspaces"),
    tokenHash: v.string(),
    tokenPrefix: v.string(),
    label: v.optional(v.string()),
    status: v.union(v.literal("active"), v.literal("revoked")),
    expiresAt: v.optional(v.number()),
    lastUsedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_token_hash", ["tokenHash"])
    .index("by_user", ["userId"])
    .index("by_user_workspace", ["userId", "workspaceId"]),

  // Agent platform tables
  agents: defineTable({
    workspaceId: v.id("workspaces"),
    userId: v.id("users"),
    name: v.string(),
    description: v.optional(v.string()),
    systemPrompt: v.optional(v.string()),
    color: v.optional(v.string()),
    model: v.optional(v.string()),
    scope: v.union(v.literal("workspace"), v.literal("private")),
    // Preconfigured capabilities
    tools: v.optional(v.array(v.string())),
    restrictions: v.optional(v.array(v.string())),
    triggers: v.optional(v.array(v.string())),
    jobs: v.optional(v.array(v.string())),
    status: v.union(
      v.literal("active"),
      v.literal("inactive"),
      v.literal("revoked"),
    ),
    lastActiveAt: v.optional(v.number()),
    createdBy: v.id("users"),
    // Links agent to its user record so it can participate in channels/DMs
    agentUserId: v.optional(v.id("users")),
    // Managed agents are platform-defined and cannot be deleted by users
    isManaged: v.optional(v.boolean()),
    managedSlug: v.optional(v.string()),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_agent_user", ["agentUserId"])
    .index("by_managed_slug", ["managedSlug"]),

  agentApiTokens: defineTable({
    agentId: v.id("agents"),
    tokenHash: v.string(),
    label: v.optional(v.string()),
    status: v.union(v.literal("active"), v.literal("revoked")),
    expiresAt: v.optional(v.number()),
    lastUsedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_token_hash", ["tokenHash"])
    .index("by_agent", ["agentId"]),

  agentAuditLogs: defineTable({
    agentId: v.id("agents"),
    workspaceId: v.id("workspaces"),
    action: v.string(),
    resourceType: v.optional(v.string()),
    resourceId: v.optional(v.string()),
    metadata: v.optional(v.record(v.string(), v.any())),
    tokenPrefix: v.string(),
    durationMs: v.optional(v.number()),
    timestamp: v.number(),
  })
    .index("by_agent", ["agentId"])
    .index("by_workspace", ["workspaceId"]),

  agentConversationScopes: defineTable({
    agentId: v.id("agents"),
    conversationId: v.id("conversations"),
    permissions: v.union(v.literal("read"), v.literal("read_write")),
    grantedBy: v.id("users"),
    grantedAt: v.number(),
  })
    .index("by_agent", ["agentId"])
    .index("by_conversation", ["conversationId"])
    .index("by_agent_and_conversation", ["agentId", "conversationId"]),

  integrationRouting: defineTable({
    conversationId: v.optional(v.id("conversations")),
    /** @deprecated Legacy field — use conversationId instead. Will be removed after backfill. */
    channelId: v.optional(v.string()),
    workspaceId: v.id("workspaces"),
    integrationType: v.union(v.literal("github"), v.literal("linear")),
    externalTarget: v.string(),
    externalTargetLabel: v.optional(v.string()),
    createdBy: v.id("users"),
  })
    .index("by_conversation", ["conversationId"])
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_type", ["workspaceId", "integrationType"])
    .index("by_conversation_and_type_and_target", ["conversationId", "integrationType", "externalTarget"]),

  quickChats: defineTable({
    workspaceId: v.id("workspaces"),
    userId: v.id("users"),
    query: v.string(),
    response: v.optional(v.string()),
    agentId: v.optional(v.id("agents")),
    status: v.union(
      v.literal("pending"),
      v.literal("done"),
      v.literal("error"),
    ),
    promotedToConversationId: v.optional(v.id("conversations")),
  })
    .index("by_user", ["userId"]),

  // Sidebar layout tables (per-user, per-workspace)
  sidebarSections: defineTable({
    userId: v.id("users"),
    workspaceId: v.id("workspaces"),
    name: v.string(),
    sortOrder: v.number(),
    isCollapsed: v.boolean(),
    isDefault: v.boolean(),
    sortMode: v.optional(
      v.union(
        v.literal("alphabetical"),
        v.literal("recent"),
        v.literal("custom"),
      ),
    ),
  })
    .index("by_user_workspace", ["userId", "workspaceId"]),

  sidebarItems: defineTable({
    userId: v.id("users"),
    workspaceId: v.id("workspaces"),
    sectionId: v.id("sidebarSections"),
    conversationId: v.optional(v.id("conversations")),
    sortOrder: v.number(),
  })
    .index("by_user_workspace", ["userId", "workspaceId"])
    .index("by_section", ["sectionId"])
    .index("by_user_and_conversation", ["userId", "conversationId"]),

  sidebarPreferences: defineTable({
    userId: v.id("users"),
    workspaceId: v.id("workspaces"),
    sortMode: v.union(
      v.literal("alphabetical"),
      v.literal("recent"),
      v.literal("custom"),
    ),
  })
    .index("by_user_workspace", ["userId", "workspaceId"]),

  meetings: defineTable({
    workspaceId: v.id("workspaces"),
    conversationId: v.optional(v.id("conversations")),
    threadMessageId: v.optional(v.id("messages")),
    title: v.string(),
    provider: v.union(
      v.literal("jitsi"),
      v.literal("google_meet"),
      v.literal("zoom"),
    ),
    meetingUrl: v.string(),
    externalMeetingId: v.optional(v.string()),
    status: v.union(v.literal("active"), v.literal("ended")),
    startedBy: v.id("users"),
    startedAt: v.number(),
    endedAt: v.optional(v.number()),
    messageId: v.optional(v.id("messages")),
    participants: v.optional(
      v.array(
        v.object({
          userId: v.id("users"),
          joinedAt: v.number(),
        }),
      ),
    ),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_conversation_and_status", ["conversationId", "status"]),

  rateLimitCounters: defineTable({
    key: v.string(),
    windowStart: v.number(),
    count: v.number(),
  })
    .index("by_key", ["key"]),

  trafficEvents: defineTable({
    source: v.string(),
    target: v.string(),
    name: v.string(),
    callType: v.string(),
    startMs: v.number(),
    endMs: v.number(),
    durationMs: v.number(),
    status: v.string(),
    error: v.optional(v.string()),
    metadata: v.optional(v.string()),
    sessionId: v.string(),
    scenarioTag: v.optional(v.string()),
  })
    .index("by_session_startMs", ["sessionId", "startMs"])
    .index("by_startMs", ["startMs"]),

  feedback: defineTable({
    userId: v.id("users"),
    workspaceId: v.id("workspaces"),
    type: v.union(v.literal("bug"), v.literal("idea")),
    message: v.string(),
    context: v.optional(v.string()),
  })
    .index("by_workspace", ["workspaceId"]),
});
