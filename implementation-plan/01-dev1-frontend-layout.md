# Dev 1 — Frontend: Layout, Copilot Inbox, Core Messaging UI

**Scope:** Dashboard shell, Sidebar, TopBar, Copilot Inbox, MessageList/MessageItem/MessageInput, proactive card UI (Draft Reminder, Unanswered Q, PR Nudge, Incident, Blocked Task inbox cards), Command Palette, animations.

**Key directories:**
- `apps/web/app/(dashboard)/` — page routes
- `apps/web/components/layout/` — Sidebar, TopBar, CommandPalette
- `apps/web/components/inbox/` — InboxCard, InboxList, InboxActions, InboxEmptyState
- `apps/web/components/channel/` — MessageList, MessageItem, MessageInput, ChannelHeader
- `apps/web/components/proactive/` — DraftReminder
- `apps/web/hooks/` — useChannel, useInbox

---

## Design System Reference

### Color Palette (Dark Theme)
```
Background: #0A0A0B (primary), #111113 (secondary/cards), #1A1A1E (hover), #222226 (elevated/modals)
Text: #EDEDEF (primary), #8B8B8E (secondary), #5C5C5F (tertiary)
Accent: #6366F1 (indigo primary), #818CF8 (hover), #6366F1/10% (muted bg)
Status: #22C55E (online), #EF4444 (danger/urgent), #F59E0B (warning), #3B82F6 (info), #A855F7 (merged)
Priority: High=#EF4444, Medium=#F59E0B, Low=#6366F1
```

### Typography
```
Font: Inter (primary), JetBrains Mono (code)
Sizes: xs=12px, sm=13px, base=14px, lg=16px, xl=20px, 2xl=24px
Weights: 400 (body), 500 (sidebar/labels), 600 (headings)
```

### Layout
```
Sidebar: 240px (collapsible), TopBar: 48px, Message padding: 16px horiz / 6px vert
Card padding: 16px, Border radius: 6px (cards), 4px (buttons), 999px (avatars/badges)
```

---

## Sprint-by-Sprint Tasks

### Phase 0 (Day 0)
- Install shadcn/ui components: Button, Card, Input, Textarea, Badge, Avatar, ScrollArea, Tooltip, DropdownMenu, Dialog, Popover, Command, Separator, Skeleton, Tabs
- Configure Tailwind theme with full color palette, Inter + JetBrains Mono fonts
- Create base `ui/` component directory

### Sprint 1 (Days 1-3)

**Day 1:**
- Root layout (`app/layout.tsx`) with ConvexProviderWithAuth wrapper
- Sidebar component (`components/layout/Sidebar.tsx`):
  - Workspace name (text-lg semibold, truncate with ellipsis)
  - Separator
  - Inbox link with unread badge (bg-accent-primary, white text, pill shape)
  - "Channels" section header (text-xs uppercase text-tertiary)
  - Channel list (# prefix + name, 32px height, hover bg-tertiary, active: bg-accent-muted + left 2px accent border)
  - "+ Add channel" button
  - Bottom: search shortcut ghost button
- TopBar component (`components/layout/TopBar.tsx`):
  - Page title (text-lg semibold), flexible spacer, user avatar (28px circle)
  - 48px height, bottom 1px border, 16px horizontal padding

**Day 2:**
- Dashboard layout (`app/(dashboard)/layout.tsx`) — authenticated shell wrapping sidebar + content area
- Inbox page placeholder (`app/(dashboard)/inbox/page.tsx`) with empty state:
  - Check-circle icon (64px, text-tertiary)
  - "You're all caught up" heading (text-lg semibold)
  - Subtitle (text-sm text-secondary)
- Channel page placeholder (`app/(dashboard)/channel/[channelId]/page.tsx`)

**Day 3:**
- Responsive sidebar: collapses fully on < 768px, hamburger toggle in TopBar
- Keyboard: Cmd+B toggles sidebar
- Wire sidebar to `channels.list` Convex query (real channel data)
- Unread dot indicators on channels with new messages

---

### Sprint 2 (Days 4-7)

**Day 4-5:**
- MessageList (`components/channel/MessageList.tsx`):
  - ScrollArea, auto-scroll to bottom on new messages (only if already at bottom)
  - Scroll-up loads older messages (cursor-based pagination, 50 at a time)
  - "New messages ↓" floating pill when scrolled up and new message arrives
  - Loading: 5 skeleton rows (avatar circle + 2 text lines, pulsing)
  - Message grouping: consecutive same-author within 5min shows only body
- MessageItem (`components/channel/MessageItem.tsx`):
  - 32px avatar (top-aligned), author name (text-sm semibold), timestamp (text-xs text-tertiary, hover shows full datetime)
  - Body: text-base, 48px left margin from avatar
  - Hover: bg-tertiary on entire row
  - 6px vertical padding between messages, 16px horizontal
- MessageInput (`components/channel/MessageInput.tsx`):
  - Fixed at bottom, 1px top border, bg-secondary, 12px padding
  - Auto-resize textarea (1-5 lines), placeholder "Write a message..."
  - bg-primary background, border-radius 6px, focus: accent-primary ring
  - Send button: 32px square, accent-primary bg, white arrow, disabled when empty
  - Enter to send, Shift+Enter for newline
  - **Draft auto-save**: on blur/channel-switch, if text > 5 chars, call `drafts.save` mutation (debounce 2s)

**Day 6-7:**
- ChannelHeader (`components/channel/ChannelHeader.tsx`):
  - 52px height, # channel-name (text-lg semibold), member count (text-sm text-secondary)
  - Description below (text-sm text-secondary, truncated)
- Unread badge indicators on sidebar channels (count badge)
- Empty channel state (hash icon 48px + "No messages yet" + "Start the conversation!")
- Loading skeletons for messages
- Scroll-to-load-more (older messages)
- Message grouping logic
- **DraftReminder banner** (`components/proactive/DraftReminder.tsx`):
  - Position: top of message area, below ChannelHeader, above MessageList
  - bg-elevated, left 3px border amber, border-radius 0 6px 6px 0, 14px padding
  - "You have an unfinished reply" — text-sm semibold
  - Context line: text-sm text-secondary
  - Draft text: text-sm italic, truncated 1 line
  - AI suggestion: text-sm accent-primary, max 3 lines
  - Buttons: [Restore My Draft] ghost, [Use AI Suggestion] accent-primary bg, [Dismiss] ghost text-tertiary
  - Slide-down animation 200ms ease-out
  - Auto-dismissed after sending a message

---

### Sprint 3 (Days 8-12)

**Day 8-9:**
- InboxCard (`components/inbox/InboxCard.tsx`):
  - bg-secondary card, border-radius 6px, 1px border, 16px padding
  - Unread: left 3px accent-primary border, brighter bg #141416
  - Read: no left border, dimmer
  - Header: # + channel name (text-sm semibold) | timestamp (text-xs text-tertiary) | kebab menu
  - 3 bullets: priority dot (12px circle: red/amber/indigo) + text (text-base, max 2 lines)
  - Sub-text: text-sm text-secondary, @mentions in accent-primary
  - 10px spacing between bullets
  - Footer: 3 ghost buttons right-aligned — "Mark Read" (eye icon), "Archive" (archive icon), "Go to Channel →" (accent-primary)
  - Click anywhere → navigate to channel. Hover: bg-tertiary
- InboxList (`components/inbox/InboxList.tsx`):
  - Vertical stack, 8px gap, sorted unread-first then by periodEnd desc
  - Infinite scroll
- Wire to `inbox.getInbox` Convex query (real-time subscription)
- **Draft Reminder inbox card**: amber left border, "Unfinished Reply" heading, "Continue in Channel →" / "Dismiss"

**Day 10-12:**
- Action Items section in InboxCards: "Action Items" header (text-xs uppercase text-tertiary), checkbox list, assignee text
- InboxEmptyState per spec
- Filter tabs: "Unread" | "All" | "Action Items" | **"AI Alerts"**
  - Tab style: text-sm medium, underline active in accent-primary
  - "AI Alerts" shows only proactiveAlert cards
- Card animations:
  - Archive: slide left + fade out, 200ms ease-out, cards below slide up
  - Mark read: left border fades out, 150ms
- Keyboard navigation: arrows between cards, `e` archive, `r` read, Enter open
- **Unanswered Question inbox card**: left 3px accent-primary border, "Unanswered Question for You" heading, quoted question italic, AI suggestion with light bulb, [Reply in Channel →] / [Use AI Answer] / [Dismiss]

---

### Sprint 4 (Days 13-16)

**Day 13-14:**
- BotMessage (`components/bot/BotMessage.tsx`):
  - bg-secondary, left 3px accent-primary border, border-radius 0 6px 6px 0
  - 32px robot avatar with "AI" badge overlay (8px circle)
  - Same markdown rendering as user messages
  - Citations section: "Sources:" (text-xs uppercase text-tertiary)
  - Citation pills: bg-elevated, border-radius 999px, icon + author + date, text-xs text-secondary
  - Click pill → expands inline: bg-elevated block with source snippet (text-sm italic) + "Jump to message →"
- BotThinking (`components/bot/BotThinking.tsx`):
  - Same container style, "Searching workspace knowledge..." text-sm text-secondary italic
  - 3 pulsing dots cycling opacity (0.2 → 1.0, staggered 200ms)
- Inbox → channel deep link: clicking a summary bullet scrolls to relevant messages
- **PR Review Nudge inbox card**: "PR Waiting for Your Review" heading, mini PR card (compact: title + status + diff stats), AI context line, [Review in GitHub →] / [Snooze 2h] / [Dismiss]

**Day 15-16:**
- Inbox unread badge in sidebar (counts summaries + proactive alerts)
- Full keyboard navigation within inbox
- "New messages ↓" floating pill in channel when scrolled up
- **Incident Routed inbox card**: left 3px red border, "URGENT" badge (bg-status-danger, white text, pill shape top-right), "Incident Routed to You" heading, incident description, AI routing explanation, "View Previous Fix →" link, [Respond in Channel →]

---

### Sprint 5 (Days 17-20)

**Day 17-18:**
- Command palette (`components/layout/CommandPalette.tsx`):
  - Cmd+K / Ctrl+K trigger
  - Uses shadcn/ui Command (cmdk), backdrop bg-primary at 60%
  - Dialog: bg-secondary, max-width 560px, border-radius 8px
  - Search input 48px, text-base, auto-focused
  - Results grouped: Channels, Actions — text-sm, keyboard navigable
- Transitions per animation spec:
  - New message: fade in from bottom, 150ms
  - Sidebar hover: bg transition 100ms
  - Modal: fade backdrop 150ms + scale 0.95→1.0
  - Mention popover: fade in + slide up 4px, 100ms
- Accessibility audit: keyboard nav, ARIA labels, focus management, color contrast

**Day 19-20:**
- Loading skeletons for all pages (avatar circle + text rectangles, pulsing 0.3→0.6 opacity)
- Error banner: top of content, bg-status-danger/10%, red text, [Retry] link, auto-dismiss 10s
- Final visual QA: pixel-perfect alignment, consistent typography, correct color tokens

---

## Dependencies on Other Devs

| I need | From | When |
|--------|------|------|
| Auth validation + ConvexProviderWithAuth | Dev 2 + Dev 3 | Day 2-3 |
| `channels.list` query | Dev 3 | Day 3 |
| `messages.send` / `messages.list` | Dev 3 | Day 4 |
| `inbox.getInbox` query | Dev 3 | Day 8 |
| `drafts.save` / `getForChannel` / `dismiss` | Dev 3 | Day 5 |
| `proactive.getAlerts` query | Dev 3 | Day 10 |
| AI-generated draft suggestions | Dev 5 | Day 6 |
