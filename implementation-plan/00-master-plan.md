# PING Platform MVP — Master Implementation Plan (20 Days, 5 Devs)

## Context

PING is an AI-native team communication platform positioned as "Company Brain Infrastructure" for 50-200 person product teams. It replaces Slack/Teams with:
1. **Copilot Inbox** — AI-curated summaries instead of chronological chat noise
2. **Integration-First Native Objects** — GitHub PRs, Linear tickets as actionable cards
3. **Temporal Knowledge Graph** — @KnowledgeBot answers company questions with cited sources
4. **Proactive AI System** — 5 agents that detect and resolve issues before you ask

**Key docs:** `system_architecture.md`, `pitch_strategy.md`, `product_vision.md`, `product_mission.md`

---

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Frontend | Next.js 14 (App Router) + Tailwind CSS + shadcn/ui |
| Backend | Convex (serverless BaaS — real-time sync, vector search, CRON) |
| Auth | WorkOS AuthKit (Google OAuth for MVP, SAML deferred) |
| Knowledge Graph | Graphiti + Neo4j (temporal semantic graph-RAG) |
| AI | Vercel AI SDK + OpenAI (primary) / Claude (fallback) |
| Monorepo | Turborepo + pnpm workspaces |

---

## Team Structure

| Role | Scope | Plan File |
|------|-------|-----------|
| **Dev 1** | Frontend — Layout, Copilot Inbox UI, core messaging UI, proactive card UI | `01-dev1-frontend-layout.md` |
| **Dev 2** | Frontend — Auth UI, integration cards, polish, onboarding, proactive card styling | `02-dev2-frontend-auth-integrations.md` |
| **Dev 3** | Backend — Convex schema, auth, APIs, webhooks, seed data, proactive alert CRUD | `03-dev3-backend.md` |
| **Dev 4** | Knowledge Engine — Graphiti service, ingestion pipeline, graph queries | `04-dev4-knowledge-engine.md` |
| **Dev 5** | AI — Summarization, @KnowledgeBot, 5 Proactive AI Agents, prompt engineering | `05-dev5-ai-agents.md` |

---

## Monorepo Structure

```
platform/
├── turbo.json
├── package.json                    # pnpm workspaces root
├── pnpm-workspace.yaml
├── .env.example
├── apps/
│   └── web/                        # Next.js 14 App Router
│       ├── middleware.ts            # WorkOS auth route protection
│       ├── app/
│       │   ├── layout.tsx           # Root: ConvexProviderWithAuth
│       │   ├── (auth)/
│       │   │   ├── login/page.tsx
│       │   │   └── callback/page.tsx
│       │   └── (dashboard)/
│       │       ├── layout.tsx       # Sidebar + TopBar shell
│       │       ├── inbox/page.tsx   # Copilot Inbox
│       │       ├── channel/[channelId]/page.tsx
│       │       └── settings/page.tsx
│       ├── components/
│       │   ├── ui/                  # shadcn/ui primitives
│       │   ├── layout/              # Sidebar, TopBar, CommandPalette
│       │   ├── inbox/               # InboxCard, InboxList, InboxActions
│       │   ├── channel/             # MessageList, MessageItem, MessageInput
│       │   ├── integrations/        # GitHubPRCard, LinearTicketCard
│       │   ├── bot/                 # BotMessage, BotThinking
│       │   ├── proactive/           # DraftReminder, UnansweredBanner, PRReviewNudge, IncidentRouter, BlockedTaskAlert
│       │   └── auth/                # AuthProvider
│       ├── hooks/                   # useAuth, useChannel, useInbox, useBotQuery
│       └── lib/                     # workos.ts, utils.ts, constants.ts
├── packages/
│   └── shared/                     # Shared TypeScript types + Zod validators
├── convex/                          # Convex backend (root-level per convention)
│   ├── schema.ts                   # All table definitions (10 tables)
│   ├── auth.ts, users.ts, channels.ts, messages.ts
│   ├── inbox.ts, integrations.ts, bot.ts, summaries.ts, ingest.ts
│   ├── drafts.ts                   # Draft persistence + AI completion suggestions
│   ├── proactive.ts                # Proactive AI agents
│   ├── crons.ts                    # CRON schedule (summaries, proactive scans)
│   ├── http.ts                     # HTTP router for webhooks
│   └── webhooks/                   # github.ts, linear.ts, workos.ts
├── services/
│   └── knowledge-engine/           # Express + Graphiti + Neo4j
│       ├── docker-compose.yml
│       ├── src/
│       │   ├── index.ts, graphiti-client.ts, ingest.ts, query.ts, seed.ts
│       └── Dockerfile
└── scripts/
    ├── seed-demo-data.ts
    └── setup-dev.sh
```

---

## Convex Schema (10 tables)

- **`users`** — WorkOS identity, email, name, avatar, role, workspace, status, lastSeenAt
- **`workspaces`** — name, slug, WorkOS org, integrations config
- **`channels`** — name, description, workspace, isDefault, isArchived
- **`channelMembers`** — channel, user, lastReadAt
- **`messages`** — channel, author, body, type (user/bot/system/integration), integrationObjectId, citations, mentions, graphitiEpisodeId
- **`integrationObjects`** — workspace, type (github_pr/linear_ticket), externalId, title, status, url, author, metadata
- **`inboxSummaries`** — user, channel, bullets (3 with priority), action items, read/archived state
- **`drafts`** — user, channel, body, replyToMessageId, contextSnapshot, suggestedCompletion, status
- **`proactiveAlerts`** — user, workspace, type (5 types), channel, title, body, suggestedAction, priority, status, expiresAt
- **`sessions`** — user, WorkOS session, expiry

---

## Sprint Overview

| Sprint | Days | Focus |
|--------|------|-------|
| Phase 0 | Day 0 | Project setup, tech spikes, dev environment |
| Sprint 1 | Days 1-3 | Foundation: schema, auth, UI shell |
| Sprint 2 | Days 4-7 | Core messaging, drafts, CRON summaries |
| Sprint 3 | Days 8-12 | Copilot Inbox, @KnowledgeBot, webhooks, unanswered Q + PR nudge agents |
| Sprint 4 | Days 13-16 | Intelligence: citation UI, incident routing, blocked tasks, all proactive agents |
| Sprint 5 | Days 17-20 | Polish, demo data, testing, deployment |

---

## Scope Cuts (NOT in MVP)

Direct messages, complex threading, file uploads, production SAML/SSO, custom agent builder, mobile app (Expo), advanced RBAC, audit logging, emoji reactions, message editing/deletion, notification sounds, dark/light theme toggle, PagerDuty/Datadog direct webhooks, user-configurable proactive thresholds.

---

## Final Demo Flow

1. Flood 100 messages in #engineering
2. Switch to Copilot Inbox — 3-bullet AI summary appears
3. Ask "@KnowledgeBot how did we decide on the DB schema?" — cited answer
4. Start typing a reply, switch channels — Draft Reminder appears when returning
5. See "Unanswered Question" alert for a teammate's question
6. See "PR Review Nudge" for a stale PR
7. Post incident in #incidents — AI auto-routes to the right engineer
8. See "Blocked Task" alert when a blocking PR is merged

For detailed per-developer plans, see the individual files in this directory.
