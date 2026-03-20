# Dev 2 — Frontend: Auth UI, Integration Cards, Polish, Onboarding

**Scope:** Login/callback pages, auth middleware, AuthProvider, @mention dropdown, markdown rendering, GitHubPRCard, LinearTicketCard, Settings page, onboarding flow, Blocked Task proactive card, responsive design, cross-browser testing.

**Key directories:**
- `apps/web/app/(auth)/` — login, callback pages
- `apps/web/components/auth/` — AuthProvider
- `apps/web/components/integrations/` — GitHubPRCard, LinearTicketCard
- `apps/web/components/channel/` — MessageInput (mention popover), MessageItem (markdown)
- `apps/web/components/bot/` — BotMessage styling
- `apps/web/components/proactive/` — BlockedTaskCard
- `apps/web/hooks/useAuth.ts`
- `apps/web/lib/workos.ts`

---

## Design System Reference (same palette as Dev 1)

Login page: full-screen centered, bg-primary, PING logo (red dot + "PING" text-2xl semibold), "Your team's second brain" subtitle, Google sign-in button (white bg, 44px height, 280px width, border-radius 6px).

---

## Sprint-by-Sprint Tasks

### Phase 0 (Day 0)
- WorkOS AuthKit research: validate `@workos-inc/authkit-nextjs` with Next.js App Router
- Test OAuth flow locally, document required environment variables

### Sprint 1 (Days 1-3)

**Day 1:**
- Login page (`app/(auth)/login/page.tsx`):
  - Full-screen centered layout, bg-primary
  - PING logo: red circle (12px) + "PING" text-2xl semibold
  - Subtitle: "Your team's second brain" text-secondary text-base
  - "Sign in with Google" button: white bg, Google G icon, 44px height, 280px width, border-radius 6px, border #333
  - Footer: "By continuing, you agree..." text-tertiary text-xs
  - Clicking redirects to WorkOS AuthKit hosted login
- OAuth callback page (`app/(auth)/callback/page.tsx`):
  - Handles WorkOS authorization code exchange
  - Creates session, redirects to /inbox
- Auth middleware (`middleware.ts`):
  - Protects all (dashboard) routes
  - Redirects unauthenticated users to /login

**Day 2:**
- AuthProvider (`components/auth/AuthProvider.tsx`):
  - React context wrapping WorkOS session state
  - Provides: currentUser, isLoading, logout function
- `useAuth` hook (`hooks/useAuth.ts`):
  - Wraps AuthProvider context for components
- WorkOS client init (`lib/workos.ts`):
  - Client-side initialization

**Day 3:**
- ConvexProviderWithAuth integration:
  - Pass WorkOS token to Convex for server-side validation
  - Update `app/layout.tsx` with auth wrapper
- User avatar dropdown in TopBar:
  - 28px avatar circle, click → DropdownMenu
  - Items: "Profile" (disabled), separator, "Sign out"

---

### Sprint 2 (Days 4-7)

**Day 4-5:**
- @mention popover in MessageInput:
  - Typing `@` triggers Popover above cursor position
  - List items: avatar (24px) + name + role badge
  - "KnowledgeBot" always first with "Ask a question" subtitle and robot icon
  - Arrow key navigation, Enter to select, Escape to dismiss
  - Selected mention → styled inline pill: bg-accent-muted, text-accent-primary, border-radius 4px

**Day 6-7:**
- Markdown rendering in MessageItem:
  - Use `react-markdown` + `rehype-highlight`
  - Inline code: bg-elevated, text-sm JetBrains Mono, border-radius 4px, 2px 6px padding
  - Code blocks: bg-elevated full-width, JetBrains Mono, syntax highlighting, 12px padding, border-radius 6px, language label top-right text-xs text-tertiary
  - Bold, italic, links (blue underline), lists
  - @mentions: bg-accent-muted, text-accent-primary, cursor pointer
- BotMessage initial styling (`components/bot/BotMessage.tsx`):
  - bg-secondary background, left 3px accent-primary border
  - Robot avatar with "AI" badge
- Timestamp formatting:
  - Relative time ("10:32 AM"), hover tooltip shows full datetime
  - Utility in `lib/utils.ts`

---

### Sprint 3 (Days 8-12)

**Day 8-9:**
- GitHubPRCard (`components/integrations/GitHubPRCard.tsx`):
  - bg-elevated, 1px border #2A2A2E, border-radius 6px, 12px padding, max-width 560px
  - Header: GitHub icon (16px) + repo name (text-xs text-secondary)
  - Title: PR title (text-base semibold) + PR number (text-sm text-secondary)
  - Status badge: green dot "Open" / purple dot "Merged" / red dot "Closed"
  - Diff stats: +green / -red in text-xs
  - Reviewers: 20px avatars, CI status check/X
  - Action: "Open in GitHub →" (text-sm accent-primary, new tab)
- LinearTicketCard (`components/integrations/LinearTicketCard.tsx`):
  - Same container style
  - Header: Linear icon (16px) + ticket ID (text-xs text-secondary)
  - Title: text-base semibold
  - Status: filled circle + text (Backlog gray, Todo gray, In Progress amber, Done green, Cancelled red)
  - Priority: icon + label (Urgent red, High orange, Medium yellow, Low blue)
  - Assignee: text-sm text-secondary
  - Action: "Open in Linear →"
- Render integration cards inline in MessageList when message has `integrationObjectId`

**Day 10-12:**
- Settings page (`app/(dashboard)/settings/page.tsx`):
  - Section headers: text-xs uppercase text-tertiary
  - Workspace card: bg-secondary, name + member count
  - Integrations card: GitHub/Linear icon + name + status (green "Connected" / gray "Not Connected")
  - Webhook URL: text-xs JetBrains Mono, truncated, [Copy] button
  - Danger zone: [Sign Out] button
- Channel creation modal:
  - shadcn/ui Dialog
  - Name input: auto-lowercase, replace spaces with dashes, validate uniqueness
  - Description textarea (optional)
  - [Cancel] ghost, [Create Channel] accent-primary bg (disabled until valid)
  - After creation: navigate to channel, auto-join
- General UI polish: consistent spacing, hover states, focus rings

---

### Sprint 4 (Days 13-16)

**Day 13-14:**
- Integration card enhancements:
  - GitHub PR: review comment count, CI pass/fail icon
  - Linear ticket: sub-task count, cycle info, priority icons (Urgent red, High orange, Medium yellow, Low blue)
- **Blocked Task inbox card** (`components/proactive/BlockedTaskCard.tsx`):
  - bg-secondary, left 3px amber border
  - "Possible Blocked Task" heading with brick icon
  - Mini LinearTicketCard (compact: ticket ID + title + status)
  - "In Progress for 3 days" metadata
  - AI suggestion: detected blockers + unblock actions (text-sm)
  - Buttons: [Open in Linear →] / [Ask @person →] / [Dismiss]
  - "Ask @person →" pre-fills a message mentioning the suggested person

**Day 15-16:**
- User presence indicators:
  - Green dot (8px) overlay on avatars for online users (lastSeenAt < 5min)
  - In MessageItem and Sidebar
- Integration connection UI in settings: status badges, webhook URL display + copy
- Responsive design pass:
  - Test at 768px, 1024px, 1440px
  - Sidebar overlay on < 768px
  - Full-width content, reduced padding on mobile
  - All proactive cards stack correctly
- **All 5 proactive card types verified styled and responsive**

---

### Sprint 5 (Days 17-20)

**Day 17-18:**
- 3-step onboarding flow:
  - Step 1: Full-screen modal, PING logo, "Welcome, [name]! Let's get you set up." [Continue →]
  - Step 2: Highlight Inbox in sidebar with pulsing ring, tooltip: "This is your Copilot Inbox..." [Next →]
  - Step 3: Sample bot interaction, tooltip: "Type @KnowledgeBot..." [Get Started →] → dismiss, navigate to Inbox
- "Memory Magic" progress UI: progress bar when bulk-ingesting GitHub/Linear history
- Demo mode env flag: toggle for demo presentations

**Day 19-20:**
- Integration empty states: "Connect GitHub" / "Connect Linear" prompts
- Cross-browser testing: Chrome, Firefox, Safari, Edge
- Screenshot-ready polish for pitch deck captures

---

## Dependencies on Other Devs

| I need | From | When |
|--------|------|------|
| Convex schema + user mutations | Dev 3 | Day 2 |
| `channels.list` query | Dev 3 | Day 3 |
| `integrationObjects` queries | Dev 3 | Day 8 |
| `proactive.getAlerts` query | Dev 3 | Day 13 |
| WorkOS token validation in Convex | Dev 3 | Day 2 |
