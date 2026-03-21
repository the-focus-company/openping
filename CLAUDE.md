# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

<!-- convex-ai-start -->
This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read `convex/_generated/ai/guidelines.md` first** for important guidelines on how to correctly use Convex APIs and patterns. The file contains rules that override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running `npx convex ai-files install`.
<!-- convex-ai-end -->

## Commands

This is a pnpm monorepo managed with Turbo. Run commands from the repo root.

```bash
pnpm dev          # Start all packages in dev mode (Next.js + Convex)
pnpm build        # Build all packages
pnpm lint         # Lint all packages
pnpm typecheck    # Type-check all packages
```

To run the web app alone:
```bash
cd apps/web && pnpm dev
```

To run Convex backend separately:
```bash
npx convex dev
```

## Architecture

**PING** is an AI-native workspace communication platform (think Slack replacement). It's a Turbo monorepo with pnpm.

```
apps/web/                  — Next.js 15 frontend (App Router)
apps/docs/                 — Astro + Starlight documentation site
convex/                    — Convex serverless backend (DB + functions)
packages/shared/           — Shared TypeScript types/utilities
services/knowledge-engine/ — Graphiti knowledge engine (Docker/Fly.io)
docs/                      — Product docs (pitch, architecture, UX spec)
```

### Frontend (`apps/web/`)

Next.js 15 with React 19, TypeScript, and Tailwind CSS 4. Uses Radix UI for headless components, `cmdk` for the command palette, and Lucide for icons.

**Route groups:**
- `(auth)/callback` — WorkOS OAuth callback
- `(dashboard)/` — Main app (protected, requires auth + onboarding)
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
- `api/auth/token` — Convex JWT generation
- `api/.well-known/jwks.json` — JWKS endpoint
- `sign-in`, `sign-out` — Auth pages

**Key component areas:**
- `components/inbox/` — InboxCard, DraftReminderCard, UnansweredQuestionCard, BlockedTaskCard, FactCheckCard, CrossTeamSyncCard
- `components/channel/` — MessageList, MarkdownContent, MentionPopover, GroupChatHeader
- `components/integrations/` — GitHubPRCard, LinearTicketCard
- `components/onboarding/` — WelcomeModal, wizard steps
- `components/layout/` — DashboardShell, Sidebar, TopBar
- `components/command-palette/` — CommandPalette (⌘K)
- `components/ui/` — Radix-based primitives (button, dialog, dropdown, etc.)

**State management:** Convex real-time hooks (`useQuery`, `useMutation`, `useConvexAuth`) — no Redux/Zustand. Presence heartbeat every 60s.

**Keyboard shortcuts:** ⌘B (toggle sidebar), ⌘K (command palette), g+i (inbox), g+t (team settings)

### Backend (`convex/`)

All backend logic lives here as Convex serverless functions (queries, mutations, actions, HTTP actions).

**Core files:**
- `schema.ts` — Database schema (source of truth, 16 tables)
- `auth.config.ts` / `auth.ts` — JWT auth via WorkOS, `requireAuth()` and `requireChannelMember()` middleware
- `http.ts` — HTTP routes (WorkOS webhooks at POST `/webhooks/workos`)
- `channels.ts` — Channel CRUD, join/leave, archive, search
- `messages.ts` — Channel messages (send, list)
- `directConversations.ts` — DM conversations (1:1, group, agent)
- `directMessages.ts` — DM messages with pagination
- `inboxSummaries.ts` — Eisenhower inbox (list, markRead, archive, unreadCount)
- `summaries.ts` — AI summary generation via OpenAI (cron-driven)
- `proactiveAlerts.ts` — Alert lifecycle (listPending, dismiss, cron scans)
- `proactive.ts` — Proactive detection logic
- `users.ts` — User CRUD with invitation handling
- `workspaces.ts` — Workspace management
- `onboarding.ts` — Onboarding state management
- `invitations.ts` — Workspace invitations (create, accept, resend)
- `integrations.ts` — GitHub PR & Linear ticket sync
- `presence.ts` — User presence (heartbeat, status, getOnlineUsers)
- `reactions.ts` — Emoji reactions (toggle, grouped retrieval)
- `typing.ts` — Typing indicators with expiration
- `drafts.ts` — Draft message management
- `crons.ts` — Scheduled jobs (summaries every 15m, fact-checks every 10m, cross-team sync every 15m)
- `seed.ts` — Development database seeding
- `bot.ts` — Bot/agent logic
- `workos.ts` — WorkOS organization creation
- `openapi.yaml` — OpenAPI schema (update with `/convex-swagger` when adding functions)

### Data Model (16 tables)

- **users** — Profiles with workspace assignment, roles (`admin`/`member`), presence, onboarding fields, AI preferences
- **workspaces** — Multi-tenant orgs with integration config, onboarding metadata
- **channels** — Public/DM/group channels with full-text search on messages
- **channelMembers** — Channel membership with read tracking
- **messages** — Channel messages (user/bot/system/integration types), mentions, citations, Graphiti episode IDs
- **directConversations** — 1:1, group, and agent conversations
- **directConversationMembers** — DM membership with agent flag
- **directMessages** — DM messages with pagination support
- **inboxSummaries** — AI-ranked Eisenhower quadrant summaries with action items
- **drafts** — Unsent drafts with suggested completions
- **proactiveAlerts** — Typed alerts (unanswered_question, pr_review_nudge, incident_route, blocked_task, fact_check, cross_team_sync)
- **integrationObjects** — GitHub PRs, Linear tickets with sync metadata
- **sessions** — JWT sessions
- **typingIndicators** — Real-time typing state
- **reactions** — Emoji reactions
- **invitations** — Workspace invitations with token-based acceptance

### Authentication

WorkOS handles SSO/SAML. JWT tokens (RS256) verified by Convex against WorkOS JWKS.

**Auth flow:** Sign-in → WorkOS OAuth → `/callback` → fetch JWT from `/api/auth/token` → Convex client authenticates.

**Rules:**
- Use `ctx.auth.getUserIdentity()` in Convex functions
- Look up users by `identity.subject` → `workosUserId` index
- Never accept `userId` as a function argument for auth
- Always use `requireAuth(ctx)` for protected operations

### External Integrations

- **WorkOS** — SSO/SAML/SCIM, OAuth, org provisioning, webhooks (user.created/updated)
- **OpenAI** — GPT for Eisenhower classification, channel summarization, fact-checking
- **Graphiti** — Knowledge graph engine (episode IDs in messages/integrations), deployed via Docker/Fly.io
- **GitHub & Linear** — PR/ticket status sync as `integrationObjects`

### Deployment

- **Frontend**: Vercel (`vercel.json` — builds with `npx convex codegen && pnpm run build`)
- **Backend**: Convex hosted (deployed via `npx convex deploy` on main push)
- **Docs**: GitHub Pages (Astro/Starlight, deployed via GitHub Actions when docs change)
- **Knowledge Engine**: Fly.io (Neo4j + Graphiti)

### Testing

No test framework configured yet. Test scripts are placeholder (`echo "No tests configured yet"`).
