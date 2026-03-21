# AGENTS.md

This file provides guidance for AI agents working with code in this repository.

<!-- convex-ai-start -->
This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read `convex/_generated/ai/guidelines.md` first** for important guidelines on how to correctly use Convex APIs and patterns. The file contains rules that override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running `npx convex ai-files install`.
<!-- convex-ai-end -->

## Project Overview

**PING** is an AI-native workspace communication platform (Slack replacement). The core innovation is an AI-powered Eisenhower inbox that auto-prioritizes messages, proactive nudges for blockers/reviews, and a knowledge graph that syncs context across teams.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Monorepo | pnpm workspaces + Turborepo |
| Frontend | Next.js 15, React 19, TypeScript, Tailwind CSS 4 |
| Backend | Convex (serverless functions, real-time sync, DB) |
| Auth | WorkOS (SSO/SAML/SCIM, JWT RS256) |
| AI | OpenAI GPT (summarization, classification, fact-checking) |
| Knowledge | Graphiti (relational knowledge graphs, Neo4j) |
| UI | Radix UI, cmdk, Lucide icons |
| Docs | Astro + Starlight |
| Deployment | Vercel (frontend), Convex Cloud (backend), GitHub Pages (docs), Fly.io (knowledge engine) |

## Repository Structure

```
apps/web/                  — Next.js 15 frontend (App Router)
apps/docs/                 — Astro + Starlight documentation site
convex/                    — Convex serverless backend (DB + functions)
packages/shared/           — Shared TypeScript types/utilities
services/knowledge-engine/ — Graphiti knowledge engine (Docker/Fly.io)
docs/                      — Product docs (pitch, architecture, UX spec)
scripts/                   — Utility scripts
```

## Commands

```bash
pnpm dev          # Start all packages in dev mode (Next.js + Convex)
pnpm build        # Build all packages
pnpm lint         # Lint all packages
pnpm typecheck    # Type-check all packages
```

```bash
cd apps/web && pnpm dev    # Web app only
npx convex dev             # Convex backend only
```

## Frontend Architecture (`apps/web/`)

### Route Structure (App Router)

- `(auth)/callback` — WorkOS OAuth callback
- `(dashboard)/` — Protected main app (auth + onboarding required)
  - `inbox` — Eisenhower Matrix AI inbox
  - `channel/[channelId]` — Channel messages
  - `dm/[conversationId]` — Direct message conversations
  - `dms` — DM directory
  - `onboarding` — Multi-step onboarding wizard
  - `settings/profile` — User profile
  - `settings/team` — Team management & invitations
  - `settings/workspace` — Workspace settings
  - `settings/agents` — AI agent configuration
  - `settings/analytics` — Analytics dashboard
  - `settings/knowledge-graph` — Knowledge graph settings
- `admin/[tenantId]/` — Admin panel (proxy, security)
- `api/auth/token` — JWT generation for Convex
- `api/.well-known/jwks.json` — JWKS endpoint
- `sign-in`, `sign-out` — Auth pages

### Component Organization

| Directory | Purpose |
|-----------|---------|
| `components/inbox/` | InboxCard, DraftReminderCard, UnansweredQuestionCard, BlockedTaskCard, FactCheckCard, CrossTeamSyncCard |
| `components/channel/` | MessageList, MarkdownContent, MentionPopover, GroupChatHeader |
| `components/integrations/` | GitHubPRCard, LinearTicketCard, IntegrationEmptyState |
| `components/onboarding/` | WelcomeModal, wizard steps (personal, company, channels, integrations, invite, prefs) |
| `components/layout/` | DashboardShell, Sidebar, TopBar, KeyboardShortcutsDialog |
| `components/command-palette/` | CommandPalette (⌘K) |
| `components/bot/` | AgentCard, CitationPill |
| `components/ui/` | Radix-based primitives (button, dialog, dropdown, etc.) |
| `components/providers/` | ConvexClientProvider (auth + Convex setup) |
| `hooks/` | useAuth, usePresenceHeartbeat |
| `lib/` | cn() utility, formatRelativeTime, constants |

### State Management

- **Convex hooks**: `useQuery()`, `useMutation()`, `useConvexAuth()` — no Redux/Zustand
- **Real-time sync**: WebSocket subscriptions handled by Convex automatically
- **Presence**: Heartbeat every 60s via `usePresenceHeartbeat` hook
- **Keyboard shortcuts**: ⌘B (sidebar), ⌘K (command palette), g+i (inbox), g+t (team)

### Design System (Tailwind)

- **Colors**: PING purple (#5E6AD2), surface grays, status colors (online/danger/warning/info/merged)
- **Priority colors**: urgent (#EF4444), important (#F59E0B), delegate (#3B82F6), low (#5E6AD2)
- **Fonts**: Geist Sans, Geist Mono
- **Spacing tokens**: topbar (48px), sidebar (240px)

## Backend Architecture (`convex/`)

### Function Types

- **Query** — Read-only, real-time subscriptions via WebSocket
- **Mutation** — Write operations with optimistic updates on client
- **Action** — Long-running tasks (AI inference, external API calls)
- **Internal Query/Mutation/Action** — Backend-only (crons, webhooks)
- **HTTP Action** — Webhook handlers (e.g., WorkOS events)

### Key Files

| File | Purpose |
|------|---------|
| `schema.ts` | Database schema (16 tables, source of truth) |
| `auth.config.ts` / `auth.ts` | JWT auth, `requireAuth()` and `requireChannelMember()` middleware |
| `http.ts` | HTTP routes (WorkOS webhooks at POST `/webhooks/workos`) |
| `channels.ts` | Channel CRUD, join/leave, archive, search |
| `messages.ts` | Channel messages (send, list) |
| `directConversations.ts` | DM conversations (1:1, group, agent types) |
| `directMessages.ts` | DM messages with pagination |
| `inboxSummaries.ts` | Eisenhower inbox (list, markRead, archive, unreadCount) |
| `summaries.ts` | AI summary generation via OpenAI (cron-driven) |
| `proactiveAlerts.ts` | Alert lifecycle (listPending, dismiss, cron scans) |
| `proactive.ts` | Proactive detection logic |
| `users.ts` | User CRUD with invitation handling |
| `workspaces.ts` | Workspace management |
| `onboarding.ts` | Onboarding state management |
| `invitations.ts` | Workspace invitations (create, accept, resend) |
| `integrations.ts` | GitHub PR & Linear ticket sync |
| `presence.ts` | User presence (heartbeat, status, getOnlineUsers) |
| `reactions.ts` | Emoji reactions (toggle, grouped retrieval) |
| `typing.ts` | Typing indicators with expiration |
| `drafts.ts` | Draft message management |
| `crons.ts` | Scheduled jobs (summaries 15m, fact-checks 10m, cross-team sync 15m) |
| `seed.ts` | Development database seeding |
| `bot.ts` | Bot/agent logic |
| `workos.ts` | WorkOS organization creation |
| `openapi.yaml` | OpenAPI schema (update with `/convex-swagger` skill) |

### Database Schema (16 tables)

| Table | Purpose |
|-------|---------|
| `users` | Profiles, workspace assignment, roles (admin/member), presence, onboarding fields, AI preferences |
| `workspaces` | Multi-tenant orgs, integration config, onboarding metadata |
| `channels` | Public/DM/group channels |
| `channelMembers` | Channel membership with read tracking |
| `messages` | Channel messages (user/bot/system/integration types), mentions, citations |
| `directConversations` | 1:1, group, and agent conversations |
| `directConversationMembers` | DM membership with agent flag |
| `directMessages` | DM messages with pagination |
| `inboxSummaries` | AI-ranked Eisenhower quadrant summaries with action items |
| `drafts` | Unsent drafts with suggested completions |
| `proactiveAlerts` | Typed alerts (unanswered_question, pr_review_nudge, incident_route, blocked_task, fact_check, cross_team_sync) |
| `integrationObjects` | GitHub PRs, Linear tickets with sync metadata |
| `sessions` | JWT sessions |
| `typingIndicators` | Real-time typing state |
| `reactions` | Emoji reactions |
| `invitations` | Workspace invitations with token-based acceptance |

### Authentication Rules

1. WorkOS handles SSO/SAML. JWT tokens (RS256) verified against WorkOS JWKS.
2. Auth flow: Sign-in → WorkOS OAuth → `/callback` → fetch JWT from `/api/auth/token` → Convex authenticates.
3. Always use `requireAuth(ctx)` for protected operations.
4. Look up users by `identity.subject` → `workosUserId` index.
5. **Never** accept `userId` as a function argument — always derive from auth context.

### Cron Jobs

| Job | Interval | File |
|-----|----------|------|
| `generate-channel-summaries` | 15 min | `summaries.ts` |
| `scan-fact-checks` | 10 min | `proactiveAlerts.ts` |
| `scan-cross-team-sync` | 15 min | `proactiveAlerts.ts` |

## External Integrations

| Service | Purpose | Config |
|---------|---------|--------|
| WorkOS | SSO/SAML/SCIM, OAuth, org provisioning | `WORKOS_API_KEY`, `WORKOS_CLIENT_ID` |
| OpenAI | Eisenhower classification, summarization, fact-checking | `OPENAI_API_KEY` |
| Graphiti | Knowledge graph engine | `GRAPHITI_API_URL` (default: `http://localhost:8000`) |
| GitHub | PR status sync → `integrationObjects` | Via workspace integrations config |
| Linear | Ticket status sync → `integrationObjects` | Via workspace integrations config |

## Deployment

| Component | Platform | Trigger |
|-----------|----------|---------|
| Frontend | Vercel | Push to main (via webhook) |
| Backend | Convex Cloud | `npx convex deploy` on main push (GitHub Actions) |
| Docs | GitHub Pages | Push to main when docs change (GitHub Actions) |
| Knowledge Engine | Fly.io | Manual (`services/knowledge-engine/deploy.sh`) |

## Testing

No test framework configured yet. Test scripts are placeholder.

## Conventions

- **Auth**: Always `requireAuth(ctx)`, never accept `userId` as argument
- **DB indexes**: Index all foreign keys; composite indexes for common filters
- **Search**: Full-text search indexes on message bodies
- **Pagination**: Use `paginationOptsValidator` for paginated queries
- **Components**: Radix UI primitives wrapped in `components/ui/`
- **Styling**: Tailwind utility classes, `cn()` for conditional classes
- **Icons**: Lucide React
- **OpenAPI**: Run `/convex-swagger` skill after adding/changing Convex functions
