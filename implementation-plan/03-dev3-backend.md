# Dev 3 — Backend: Convex Schema, Auth, APIs, Webhooks, Seed Data

**Scope:** Full Convex schema (10 tables), auth validation, all CRUD mutations/queries, WorkOS webhooks, GitHub/Linear webhook handlers, drafts persistence, proactive alerts CRUD, seed scripts, production deployment.

**Key directories:**
- `convex/` — all backend logic
- `convex/webhooks/` — github.ts, linear.ts, workos.ts
- `scripts/` — seed-demo-data.ts

---

## Phase 0 (Day 0) — Project Setup Lead

You own this phase. All devs assist.

- Initialize monorepo: `pnpm init`, create `pnpm-workspace.yaml` (packages: `apps/*`, `packages/*`, `services/*`)
- Scaffold `apps/web`: `npx create-next-app@latest apps/web --typescript --tailwind --app`
- Initialize Convex: `npx convex init` at repo root
- Create `services/knowledge-engine`: `pnpm init`, add Express deps
- Create `packages/shared`: shared TypeScript types
- Setup Turborepo: `turbo.json` with `build`, `dev`, `lint`, `typecheck` pipelines
- ESLint + Prettier: shared config at root
- Git hooks: husky + lint-staged for pre-commit linting
- CI pipeline: GitHub Actions — lint, typecheck, build on PR
- `.env.example` with all required keys documented

---

## Convex Schema — Full Specification

**File: `convex/schema.ts`** — Deploy first, everything depends on this.

### 10 Tables:

**1. users**
```
workosUserId: string, email: string, name: string, avatarUrl?: string
role: "admin" | "member", workspaceId: Id<"workspaces">
status: "active" | "invited" | "deactivated", lastSeenAt?: number
Indexes: by_workos_id[workosUserId], by_email[email], by_workspace[workspaceId]
```

**2. workspaces**
```
name: string, slug: string, workosOrgId?: string, createdBy: Id<"users">
integrations?: { github?: { installationId, repos[] }, linear?: { teamId, webhookSecret } }
Indexes: by_slug[slug], by_workos_org[workosOrgId]
```

**3. channels**
```
name: string, description?: string, workspaceId: Id<"workspaces">
createdBy: Id<"users">, isDefault: boolean, isArchived: boolean
Indexes: by_workspace[workspaceId], by_workspace_name[workspaceId, name]
```

**4. channelMembers**
```
channelId: Id<"channels">, userId: Id<"users">, lastReadAt?: number
Indexes: by_channel[channelId], by_user[userId], by_channel_user[channelId, userId]
```

**5. messages**
```
channelId: Id<"channels">, authorId: Id<"users">, body: string
type: "user" | "bot" | "system" | "integration"
integrationObjectId?: Id<"integrationObjects">
citations?: [{ sourceType, sourceId, snippet, author?, timestamp? }]
mentions?: string[], graphitiEpisodeId?: string, isEdited: boolean
Indexes: by_channel[channelId], by_channel_time[channelId, _creationTime], by_author[authorId]
SearchIndex: search_body on body, filter by channelId
```

**6. integrationObjects**
```
workspaceId: Id<"workspaces">, type: "github_pr" | "linear_ticket"
externalId: string, title: string, status: string, url: string
author: string, metadata: any, lastSyncedAt: number, graphitiEpisodeId?: string
Indexes: by_workspace[workspaceId], by_workspace_type[workspaceId, type], by_external_id[externalId]
```

**7. inboxSummaries**
```
userId: Id<"users">, channelId: Id<"channels">
bullets: [{ text, priority: "high"|"medium"|"low", relatedMessageIds: Id<"messages">[] }]
messageCount: number, periodStart: number, periodEnd: number
isRead: boolean, isArchived: boolean
actionItems?: [{ text, assignee?, relatedIntegrationObjectId? }]
Indexes: by_user[userId], by_user_read[userId, isRead], by_user_channel[userId, channelId], by_channel_period[channelId, periodEnd]
```

**8. drafts**
```
userId: Id<"users">, channelId: Id<"channels">, body: string
replyToMessageId?: Id<"messages">, contextSnapshot: string
suggestedCompletion: string, status: "active" | "dismissed" | "sent"
createdAt: number, updatedAt: number
Indexes: by_user[userId], by_user_channel[userId, channelId], by_user_status[userId, status]
```

**9. proactiveAlerts**
```
userId: Id<"users">, workspaceId: Id<"workspaces">
type: "unanswered_question" | "pr_review_nudge" | "incident_route" | "blocked_task"
channelId: Id<"channels">, title: string, body: string
sourceMessageId?: Id<"messages">, sourceIntegrationObjectId?: Id<"integrationObjects">
suggestedAction: string, priority: "high" | "medium" | "low"
status: "pending" | "acted" | "dismissed" | "expired", expiresAt: number, createdAt: number
Indexes: by_user_status[userId, status], by_user_type[userId, type], by_workspace_type[workspaceId, type]
```

**10. sessions**
```
userId: Id<"users">, workosSessionId: string, expiresAt: number
Indexes: by_session_id[workosSessionId], by_user[userId]
```

---

## Sprint-by-Sprint Tasks

### Sprint 1 (Days 1-3)

**Day 1:**
- Deploy full Convex schema (`convex/schema.ts`)
- `convex/users.ts`: `getMe` query, `getByWorkosId` query, `createOrUpdate` mutation
- `convex/auth.ts`: helper function to validate WorkOS JWT and resolve user — called by every query/mutation

**Day 2:**
- `convex/channels.ts`: `create` mutation (validate name uniqueness), `list` query (by workspace, with unread count), `get` query, `join` mutation
- Workspace mutations: `create`, `getBySlug`
- Seed function (`convex/seed.ts`): internal mutation creating default workspace + #general and #engineering channels

**Day 3:**
- WorkOS webhook handler (`convex/webhooks/workos.ts`): user provisioning from directory sync events
- HTTP router (`convex/http.ts`): route /webhooks/workos
- Session management: create/validate/expire sessions

---

### Sprint 2 (Days 4-7)

**Day 4-5:**
- `convex/messages.ts` — `send` mutation:
  - Validate user is member of channel
  - Insert message with type: "user"
  - Parse mentions array from body
  - If mentions includes "knowledgebot" → `ctx.scheduler.runAfter(0, internal.bot.respond, { channelId, query, triggerMessageId })`
  - Schedule `ctx.scheduler.runAfter(0, internal.ingest.processMessage, { messageId })`
- `convex/messages.ts` — `list` query:
  - Paginated by `by_channel_time` index, most recent first
  - Join with users table for author info (name, avatar)
  - Join with integrationObjects when `integrationObjectId` is set
- **`convex/drafts.ts`**:
  - `save` mutation: upsert draft for user+channel (check by_user_channel, update if exists, insert if new). Debounce-friendly (client debounces).
  - `getForChannel` query: return active draft for current user in given channel
  - `dismiss` mutation: set status to "dismissed"

**Day 6-7:**
- `channelMembers.updateLastRead` mutation: update lastReadAt timestamp when user views channel
- Unread count query: count messages in channel after user's lastReadAt
- `convex/ingest.ts` — `processMessage` internal action:
  - Fetch message + author info
  - POST to knowledge-engine REST API (`KNOWLEDGE_ENGINE_URL/ingest/message`)
  - On success: patch message with `graphitiEpisodeId` (via internal mutation)
- **`drafts.getAll` query**: return all active drafts for user (for inbox integration)

---

### Sprint 3 (Days 8-12)

**Day 8-9:**
- `convex/inbox.ts`:
  - `getInbox` query: filter by user, join channels for name, sort by periodEnd desc, filter by isRead/isArchived. Include active drafts and pending proactive alerts in results.
  - `markRead` mutation: set isRead true
  - `archive` mutation: set isArchived true
- `convex/integrations.ts`:
  - `upsert` mutation: insert or update by externalId
  - `getByExternalId` query
  - `listByWorkspace` query (filterable by type)
  - On upsert: post system message to configured channel, schedule `ingest.processIntegrationObject`

**Day 10-12:**
- GitHub webhook handler (`convex/webhooks/github.ts`):
  - Verify HMAC signature from `X-Hub-Signature-256` header
  - Parse `X-GitHub-Event` header
  - Handle `pull_request` events: upsert integrationObject with type "github_pr"
  - Post system message: "PR #142 opened by sarah: feat: migrate users table"
- Linear webhook handler (`convex/webhooks/linear.ts`):
  - Verify token
  - Handle issue events: upsert integrationObject with type "linear_ticket"
- HTTP router (`convex/http.ts`): add routes for /webhooks/github, /webhooks/linear
- Schedule `ingest.processIntegrationObject` on every upsert

---

### Sprint 4 (Days 13-16)

**Day 13-14:**
- Webhook idempotency: check `externalId` exists before insert, use upsert pattern
- Integration status sync: update PR status (open→merged) on new webhook
- Cursor-based pagination for `messages.list` using Convex `.paginate()`
- **`convex/proactive.ts`** — Alert CRUD:
  - `getAlerts` query: filter by user, optional type and status filters
  - `actOnAlert` mutation: set status to "acted"
  - `dismissAlert` mutation: set status to "dismissed"
  - `createAlert` internal mutation: insert new proactiveAlert (called by AI agents)

**Day 15-16:**
- User presence: `updateLastSeen` mutation (called on app focus/heartbeat interval)
- `channels.listMembers` query, `channels.leave` mutation
- Error handling audit: all mutations/queries handle edge cases (deleted channels, deactivated users, malformed input)
- **`proactive.expireStaleAlerts` CRON**: internal mutation that expires alerts > 24h (set status "expired")
- **Incident auto-routing trigger**: in `messages.send`, if channel is #incidents and body contains keywords ("down", "outage", "5xx", "latency spike", "alert"), schedule `proactive.routeIncident`

---

### Sprint 5 (Days 17-20)

**Day 17-18:**
- Seed script (`scripts/seed-demo-data.ts`):
  - 5 users with realistic names/avatars (Sarah Chen, Alex Rivera, Jordan Smith, etc.)
  - 4 channels: #general, #engineering, #incidents, #product
  - 200+ realistic technical messages (database migration discussions, PR reviews, CI fixes, architecture decisions)
  - 10 GitHub PRs: mix of open, merged, closed
  - 15 Linear tickets: various statuses and priorities
  - **Seed proactive scenarios**: 2 unanswered questions, 3 stale PRs (> 4h), 2 in-progress tickets (> 2 days), 1 incident message
- Rate limiting: basic rate limits on `messages.send` (5/sec per user) and `bot.respond` (1/min per channel)

**Day 19-20:**
- Trigger all CRONs manually to generate inbox summaries + proactive alerts from seed data
- End-to-end manual test: auth → send message → see in inbox → ask bot → get answer → draft reminder → proactive alerts
- Production deployment config: Convex production environment, environment variable audit
- Document all Convex function signatures for team reference

---

## CRON Schedule (`convex/crons.ts`)

```typescript
crons.interval("generate-inbox-summaries", { minutes: 15 }, internal.summaries.generateChannelSummaries);
crons.interval("scan-unanswered-questions", { minutes: 10 }, internal.proactive.scanUnansweredQuestions);
crons.interval("scan-pr-review-nudges", { minutes: 15 }, internal.proactive.scanPRReviewNudges);
crons.interval("scan-blocked-tasks", { minutes: 30 }, internal.proactive.scanBlockedTasks);
crons.interval("expire-stale-alerts", { minutes: 60 }, internal.proactive.expireStaleAlerts);
```

---

## Dependencies on Other Devs

| I need | From | When |
|--------|------|------|
| Knowledge engine REST API running | Dev 4 | Day 7 |
| AI summarization action | Dev 5 | Day 6 |
| Bot respond action | Dev 5 | Day 8 |
| Proactive agent actions (scanUnansweredQuestions, etc.) | Dev 5 | Day 10-14 |
| Draft AI suggestion action | Dev 5 | Day 6 |
