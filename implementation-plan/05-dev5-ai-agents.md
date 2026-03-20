# Dev 5 — AI: Summarization, @KnowledgeBot, Proactive AI Agents, Prompt Engineering

**Scope:** All AI-powered functionality — channel summarization CRON, @KnowledgeBot Q&A with citations, 5 proactive AI agents (draft completion, unanswered question detection, PR review nudges, incident auto-routing, blocked task detection), prompt engineering, output schema design.

**Key files:**
- `convex/summaries.ts` — Channel summarization CRON action
- `convex/bot.ts` — @KnowledgeBot respond action
- `convex/drafts.ts` — Draft AI suggestion (generateSuggestion action)
- `convex/proactive.ts` — All 5 proactive agent actions
- `convex/crons.ts` — CRON schedule definitions

---

## AI Stack

- **Vercel AI SDK** (`ai` package): model-agnostic orchestration
- **OpenAI** (primary): `generateObject` with Zod schemas for structured output
- **Claude** (fallback): via Anthropic provider
- **Graphiti** (via knowledge-engine REST API): Graph-RAG context retrieval

---

## Sprint-by-Sprint Tasks

### Phase 0 (Day 0)

- **Vercel AI SDK spike**:
  - Install `ai` + `@ai-sdk/openai` packages
  - Test `generateText` and `generateObject` from within a Convex action context
  - Verify streaming works (`streamText`) or determine if Convex requires non-streaming
  - Test `@ai-sdk/anthropic` as fallback
- **Draft system prompts** for:
  1. Channel summarization (3 bullets + priorities + action items)
  2. KnowledgeBot Q&A with citations

---

### Sprint 1 (Days 1-3)

**Day 1:**
- Vercel AI SDK setup in Convex:
  - Configure OpenAI provider with API key from env
  - Create helper function for `generateObject` with Zod schema validation
  - Handle errors: API rate limits, timeouts, malformed output

**Day 2:**
- **Summarization system prompt**:
```
You are an AI assistant that summarizes team chat channel activity.
Given the last N messages from a channel, produce exactly 3 bullet point summaries.

For each bullet:
- Write a concise, actionable summary (max 2 sentences)
- Classify priority: "high" (requires action/attention), "medium" (important info), "low" (FYI)
- Note any action items with assignees

Output format (Zod schema enforced):
{ bullets: [{ text, priority, relatedMessageIds }], actionItems: [{ text, assignee? }] }

Guidelines:
- Prioritize decisions, blockers, and action items over casual discussion
- Use @mentions to identify who needs to act
- If a user is specifically mentioned or assigned, mark that bullet as high priority for them
```
- Test with hardcoded 20 messages → validate 3-bullet output format

**Day 3:**
- **KnowledgeBot Q&A prompt**:
```
You are @KnowledgeBot, the AI assistant for this workspace.
Answer questions using ONLY the provided context from the workspace knowledge graph.

Rules:
- Always cite your sources using the provided citation data
- If the context doesn't contain enough information, say "I don't have enough context about that in the workspace history."
- Never make up information — only use what's in the provided context
- Be concise but thorough
- Reference specific people, PRs, tickets, and dates when available

Context format: You receive ranked search results from the knowledge graph with sourceType, author, timestamp, and snippet.
Output: A natural language answer with inline citations.
```
- Test Q&A with hardcoded context → validate cited answer format
- Define Zod output schemas for both summarization and Q&A

---

### Sprint 2 (Days 4-7)

**Day 4-5:**
- `convex/summaries.ts` — `generateChannelSummaries` internal action:
  - Fetch all active channels
  - For each channel: fetch messages since last summary periodEnd
  - If messageCount > threshold (5 messages): call OpenAI `generateObject`
  - Zod schema validation on output
  - For each user in channel: create `inboxSummary` with personalized priority
    - If user is @mentioned in a bullet → mark that bullet as "high" priority for them
  - Handle edge cases: empty channels skip, < 5 messages skip, bot-only channels skip
- **`drafts.generateSuggestion` action** (`convex/drafts.ts`):
  - Triggered after `drafts.save` (scheduled by Dev 3)
  - Fetch: draft text, recent messages in channel (last 20), the message being replied to
  - AI prompt: "The user started writing this reply: '[draft]'. Based on the conversation context, suggest how to complete this message. Be concise and match the user's tone."
  - Store: `contextSnapshot` (what user was responding to) + `suggestedCompletion` (AI-generated finish)

**Day 6-7:**
- CRON schedule setup in `convex/crons.ts`: 15-minute interval for summaries
- Deduplication: check last summary's `periodEnd` to avoid re-summarizing
- Personalized priority: adjust based on @mentions of specific user
- **Begin unanswered question classifier prompt**:
```
Classify this message. Is it a question directed at a specific person or role?

Return:
{ isQuestion: boolean, targetUser?: string, urgency: "high"|"normal", topic: string }

Examples:
- "Does anyone know why staging is down? @devops" → { isQuestion: true, targetUser: "devops", urgency: "high", topic: "staging deployment" }
- "Great work on the migration!" → { isQuestion: false }
- "@sarah can you review PR #142?" → { isQuestion: true, targetUser: "sarah", urgency: "normal", topic: "PR review" }
```
- Test classifier with 20+ messages, measure accuracy

---

### Sprint 3 (Days 8-12)

**Day 8-9:**
- `convex/bot.ts` — `respond` action (full implementation):
  1. Extract question from the trigger message (strip @KnowledgeBot mention)
  2. Call knowledge-engine: `POST /query` with the question text
  3. Receive Graphiti results with source citations
  4. Construct prompt:
     - System prompt (Q&A prompt from Sprint 1)
     - Context: formatted Graphiti results as numbered sources
     - User question
  5. Call OpenAI via Vercel AI SDK `generateObject`
  6. Parse response: answer text + citation references
  7. Map citations to schema format: `{ sourceType, sourceId, snippet, author, timestamp }`
  8. Insert bot message via internal mutation with type "bot" + citations array
  9. Handle edge cases: Graphiti returns no results → "I don't have enough context"

- **`proactive.scanUnansweredQuestions` internal action**:
  1. Fetch messages from last 30 minutes across all channels
  2. For each message: run question classifier prompt
  3. For identified questions: check if addressed person replied within threshold (30 min high-priority, 2 hr normal)
  4. If unanswered: query Graphiti for potential answer context
  5. Generate AI suggestion: brief proposed answer or "Consider pinging @person"
  6. Create `proactiveAlert` with type "unanswered_question"

**Day 10-12:**
- Citation quality: ensure sources are specific (exact message, not vague topic references)
- Fallback: "I don't have enough context" when Graphiti returns empty or low-relevance results
- Prompt iteration: test with 20+ diverse questions, refine system prompt for accuracy
- **`proactive.scanPRReviewNudges` internal action**:
  1. Query `integrationObjects` where type "github_pr" and status "open"
  2. Filter: PR open > 4 hours (configurable threshold)
  3. Identify reviewers from PR metadata
  4. Query Graphiti: "Who has domain expertise on files changed in this PR?"
  5. Generate AI context: "This PR changes src/middleware/ — you reviewed the last 3 PRs in this area"
  6. Create `proactiveAlert` with type "pr_review_nudge" for each relevant reviewer
- Summary quality refinement: test with multi-topic channel discussions

---

### Sprint 4 (Days 13-16)

**Day 13-14:**
- Multi-source answers: bot combines citations from messages + PRs + tickets in a single answer
- Accuracy validation: test 30+ questions, measure answer quality rate (target > 85% accurate)
- Hallucination guardrails:
  - System prompt: "NEVER generate information not present in the provided context"
  - Post-processing: verify each citation ID exists in the provided context
  - If AI references something not in context → strip that citation
- **`proactive.routeIncident` action** (event-driven, triggered by Dev 3 when incident keywords detected):
  1. Fetch incident message + surrounding context
  2. AI analysis: extract affected component/service from message text
  3. Query Graphiti: "Who last modified [component]?" + "What was the fix for similar past issues?"
  4. Generate `suggestedAction` with:
     - Who should handle it (based on commit history)
     - What the fix might be (based on past incidents)
     - Link to relevant past PR
  5. Create URGENT `proactiveAlert` with type "incident_route"
  6. Post system message in #incidents: "PING AI routed this to @person. Reason: ..."

- **`proactive.scanBlockedTasks` internal action**:
  1. Query `integrationObjects` where type "linear_ticket" and status "in_progress"
  2. Filter: in-progress > 2 days without updates
  3. Query Graphiti: check for blocker signals:
     - Did assignee mention being "blocked", "waiting", "stuck" in chat?
     - Are there dependency PRs/tickets? Have they been resolved?
  4. Generate AI suggestion:
     - If blocking dependency resolved: "PR #142 was merged 2 hours ago, you may be able to continue"
     - If stuck: "Consider asking @sarah for help — she solved a similar issue in ENG-289"
  5. Create `proactiveAlert` with type "blocked_task"

**Day 15-16:**
- Summary personalization: weight user-specific @mentions higher in priority for their inbox view
- Cost optimization:
  - Track token usage per operation (log to console for monitoring)
  - Truncate message batches to fit context window (max 100 messages or 8000 tokens for summarization)
  - Prompt length limits for bot queries
- Latency optimization:
  - Minimize bot response time: parallel Graphiti query + prompt construction
  - Consider splitting long actions into chained scheduled actions if hitting Convex time limits
- **Tune all proactive AI prompts**:
  - Question classification accuracy: test 30+ messages, target > 90% precision
  - Incident routing precision: test 10+ scenarios, ensure correct engineer identified
  - Blocked task detection recall: test 10+ scenarios, ensure genuine blocks detected

---

### Sprint 5 (Days 17-20)

**Day 17-18:**
- **Demo flow validation**: execute exact script from `pitch_strategy.md`:
  1. Flood 100 messages in #engineering → switch to Inbox → verify 3-bullet summary appears
  2. Ask "@KnowledgeBot how did we decide on the DB schema?" → verify cited answer
  3. Start typing a reply, switch channels → verify Draft Reminder appears on return
  4. Post unanswered question → wait → verify alert appears
  5. Verify PR Review Nudge for stale demo PRs
  6. Post incident message → verify auto-routing
- Tune prompts for all 10 curated demo questions until each produces a perfect answer
- **Proactive demo flow**: test all 5 agent types with seed data

**Day 19-20:**
- Summary quality for demo: ensure summaries are compelling and actionable, not generic
- Bot personality refinement:
  - Helpful, concise, professional tone
  - Natural citation format (not robotic "Source 1: ...")
  - Conversational but accurate
- **Proactive agent accuracy tuning**: ensure zero false positives in demo seed data
- Token cost estimates documented per operation:
  - Summarization: ~$X per channel per run
  - Bot Q&A: ~$X per query
  - Proactive scans: ~$X per CRON cycle
  - Draft suggestions: ~$X per draft

---

## Prompt Library Summary

| Prompt | Purpose | Trigger |
|--------|---------|---------|
| Channel Summarizer | 3-bullet summary + action items | CRON every 15 min |
| KnowledgeBot Q&A | Cited answer from workspace knowledge | @KnowledgeBot mention |
| Draft Completer | Suggest how to finish a draft reply | Draft auto-save event |
| Question Classifier | Detect directed questions | CRON every 10 min |
| PR Review Context | Explain why reviewer was suggested | CRON every 15 min |
| Incident Analyzer | Identify affected component + route to engineer | Incident keywords detected |
| Blocked Task Analyzer | Detect blockers + suggest unblock actions | CRON every 30 min |

---

## CRON Schedule

```
generate-inbox-summaries:      every 15 min
scan-unanswered-questions:     every 10 min
scan-pr-review-nudges:         every 15 min
scan-blocked-tasks:            every 30 min
expire-stale-alerts:           every 60 min
```

Draft suggestions are event-driven (not CRON).

---

## Dependencies on Other Devs

| I need | From | When |
|--------|------|------|
| Convex schema deployed (messages, inboxSummaries, drafts, proactiveAlerts) | Dev 3 | Day 1 |
| `drafts.save` triggers `drafts.generateSuggestion` scheduling | Dev 3 | Day 5 |
| Knowledge engine `/query` endpoint | Dev 4 | Day 8 |
| Proactive query patterns ("who modified X?", "past fix for Y?") | Dev 4 | Day 13 |
| `messages.send` triggers incident detection scheduling | Dev 3 | Day 15 |
| Seed demo data in Convex DB | Dev 3 | Day 17 |
| Seed knowledge graph in Graphiti | Dev 4 | Day 17 |
