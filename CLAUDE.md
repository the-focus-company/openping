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
apps/web/        — Next.js 15 frontend (App Router)
convex/          — Convex serverless backend (DB + functions)
packages/shared/ — Shared TypeScript types/utilities
```

### Frontend (`apps/web/`)

Next.js 15 with React 19, TypeScript, and Tailwind CSS 4. Uses Radix UI for headless components and `cmdk` for the command palette.

Route groups:
- `(auth)/` — WorkOS OAuth callback
- `(dashboard)/` — Main app: channels, DMs, inbox, settings
- `admin/` — Admin panel

### Backend (`convex/`)

All backend logic lives here as Convex serverless functions. Key files:

- `schema.ts` — Database schema (source of truth for all tables)
- `auth.config.ts` / `auth.ts` — JWT auth via WorkOS
- `http.ts` — HTTP endpoints for webhooks/integrations
- `channels.ts`, `messages.ts` — Channel messaging
- `directConversations.ts`, `directMessages.ts` — DMs
- `inboxSummaries.ts` — AI-generated Eisenhower inbox summaries
- `proactiveAlerts.ts` — AI-driven nudges and blocker detection
- `users.ts`, `workspaces.ts` — User/org management
- `openapi.yaml` — OpenAPI schema (update with `/convex-swagger` when adding functions)

### Data Model Highlights

- **Multi-workspace**: Users belong to workspaces with roles (`admin`/`member`)
- **Channels**: Support full-text search on messages
- **DirectConversations**: Supports 1:1, group, and agent-type conversations
- **InboxSummaries**: AI-ranked bullets + action items per user
- **ProactiveAlerts**: Typed alerts (`unanswered_question`, `pr_review`, `incident`, `blocker`)
- **IntegrationObjects**: References to GitHub PRs, Linear tickets
- Graphiti episode IDs stored for future knowledge graph integration

### Authentication

WorkOS handles SSO/SAML. JWT tokens verified by Convex. Use `ctx.auth.getUserIdentity()` in Convex functions and `identity.tokenIdentifier` (not `identity.subject`) for user lookups. Never accept `userId` as a function argument for auth.

### Deployment

Deployed on Vercel (`vercel.json` in root). Convex is its own hosted backend.
