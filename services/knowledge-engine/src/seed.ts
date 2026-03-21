/**
 * Seed script: ingest 200+ demo messages and 10 curated demo questions
 * into the knowledge engine for development and demos.
 *
 * Usage:
 *   pnpm seed
 *
 * Environment:
 *   GRAPHITI_API_URL — Graphiti upstream (default http://localhost:8000)
 */

import pino from "pino";

const logger = pino({ level: "info", transport: { target: "pino-pretty" } });
const GRAPHITI_URL = process.env.GRAPHITI_API_URL ?? "http://localhost:8000";

// --- Demo team ---

const TEAM = {
  alice: "Alice Chen",
  bob: "Bob Martinez",
  carol: "Carol Davis",
  david: "David Kim",
  eve: "Eve Johnson",
  frank: "Frank Li",
  grace: "Grace Wang",
  henry: "Henry Brown",
};

function daysAgo(n: number): string {
  return new Date(Date.now() - n * 86400000).toISOString();
}

// --- Curated demo messages that create a rich, interconnected knowledge graph ---

const DEMO_MESSAGES: Array<{
  channel: string;
  author: string;
  content: string;
  timestamp: string;
}> = [
  // Sprint planning decisions
  { channel: "engineering", author: TEAM.alice, content: "We've decided to use PostgreSQL for the analytics service instead of ClickHouse. The team is more familiar with it and our scale doesn't justify ClickHouse yet.", timestamp: daysAgo(30) },
  { channel: "engineering", author: TEAM.bob, content: "Agreed on PostgreSQL. I'll set up the schema this week. We should revisit ClickHouse when we hit 10M events/day.", timestamp: daysAgo(30) },
  { channel: "engineering", author: TEAM.carol, content: "I'll handle the ETL pipeline. Planning to use Temporal for workflow orchestration.", timestamp: daysAgo(29) },
  { channel: "engineering", author: TEAM.david, content: "The API migration from REST to GraphQL is now 60% complete. Auth endpoints are done, user management is next.", timestamp: daysAgo(28) },

  // Cross-team coordination
  { channel: "product", author: TEAM.eve, content: "The new onboarding flow has been approved by stakeholders. Design handoff is scheduled for Monday.", timestamp: daysAgo(27) },
  { channel: "design", author: TEAM.frank, content: "Onboarding designs are ready in Figma. Key change: we're adding a workspace setup wizard before the channel tour.", timestamp: daysAgo(26) },
  { channel: "engineering", author: TEAM.alice, content: "Starting the onboarding implementation. @Frank Li I'll need the final assets by Wednesday.", timestamp: daysAgo(25) },
  { channel: "product", author: TEAM.eve, content: "Reminder: the onboarding launch is targeted for March 15th. QA needs at least 3 days.", timestamp: daysAgo(24) },

  // Technical decisions and debates
  { channel: "backend", author: TEAM.bob, content: "I'm proposing we switch from JWT to session-based auth for the admin panel. JWTs can't be revoked immediately.", timestamp: daysAgo(23) },
  { channel: "backend", author: TEAM.david, content: "Good point about JWT revocation. But session-based auth adds server-side state. How about a short-lived JWT (5min) with refresh tokens?", timestamp: daysAgo(23) },
  { channel: "backend", author: TEAM.alice, content: "Let's go with short-lived JWTs + refresh tokens. Best of both worlds. Bob, can you implement the refresh token rotation?", timestamp: daysAgo(22) },
  { channel: "backend", author: TEAM.bob, content: "Done. Implemented refresh token rotation with 7-day expiry. PR is up: #342.", timestamp: daysAgo(20) },

  // Blockers and dependencies
  { channel: "engineering", author: TEAM.carol, content: "The ETL pipeline is blocked by the missing S3 access credentials. DevOps team hasn't set up the IAM role yet.", timestamp: daysAgo(19) },
  { channel: "devops", author: TEAM.henry, content: "Sorry for the delay on S3 credentials. The IAM policy review takes 48 hours. Should be ready by Thursday.", timestamp: daysAgo(19) },
  { channel: "engineering", author: TEAM.carol, content: "S3 access is now working. ETL pipeline is unblocked. Running first batch import tonight.", timestamp: daysAgo(16) },

  // Performance work
  { channel: "backend", author: TEAM.david, content: "Found a performance bottleneck in the message search. The full-text index isn't being used for prefix queries. Fixing now.", timestamp: daysAgo(15) },
  { channel: "backend", author: TEAM.david, content: "Search is now 10x faster after adding the trigram index. p95 went from 800ms to 45ms.", timestamp: daysAgo(14) },
  { channel: "engineering", author: TEAM.alice, content: "Great work on search performance, David! Let's add this to our performance monitoring dashboard.", timestamp: daysAgo(14) },

  // Integration work
  { channel: "engineering", author: TEAM.grace, content: "GitHub integration is live. PRs from platform, web-app, and shared-libs repos are now syncing automatically.", timestamp: daysAgo(13) },
  { channel: "engineering", author: TEAM.grace, content: "Linear integration is next. Planning to sync tickets bi-directionally — changes in Linear update our system and vice versa.", timestamp: daysAgo(12) },
  { channel: "product", author: TEAM.eve, content: "Can we also pull in Linear ticket priorities? That would help with the Eisenhower inbox classification.", timestamp: daysAgo(12) },
  { channel: "engineering", author: TEAM.grace, content: "Yes, Linear ticket priorities are included in the sync. They map to our priority levels automatically.", timestamp: daysAgo(11) },

  // Architecture discussions
  { channel: "backend", author: TEAM.alice, content: "Proposal: introduce a message queue (Redis Streams) between the API layer and the knowledge engine. This decouples ingestion from processing.", timestamp: daysAgo(10) },
  { channel: "backend", author: TEAM.bob, content: "Redis Streams makes sense. We could also use it for the real-time typing indicators instead of polling.", timestamp: daysAgo(10) },
  { channel: "backend", author: TEAM.alice, content: "Decided: Redis Streams for message ingestion queue. Bob will handle the producer side, I'll do the consumer.", timestamp: daysAgo(9) },

  // Bug reports and fixes
  { channel: "engineering", author: TEAM.frank, content: "Bug: the command palette (Cmd+K) doesn't work on Firefox. The keyboard shortcut is being intercepted by the browser.", timestamp: daysAgo(8) },
  { channel: "frontend", author: TEAM.frank, content: "Fixed the Firefox Cmd+K issue. Using a different key binding approach that respects browser shortcuts. PR #378.", timestamp: daysAgo(7) },

  // Security concerns
  { channel: "backend", author: TEAM.bob, content: "Security audit flagged: we're logging request bodies that may contain PII. Need to add redaction middleware.", timestamp: daysAgo(6) },
  { channel: "backend", author: TEAM.bob, content: "Added PII redaction to all log output. Email, phone, and SSN patterns are now masked. PR #385.", timestamp: daysAgo(5) },

  // Knowledge graph meta
  { channel: "engineering", author: TEAM.alice, content: "The knowledge graph now has 50,000 facts from 3 months of messages. Entity resolution reduced duplicates by 23%.", timestamp: daysAgo(4) },
  { channel: "engineering", author: TEAM.david, content: "Impressive. We should add temporal queries so we can ask 'what did we know about X two weeks ago?'", timestamp: daysAgo(4) },

  // Deployment and infrastructure
  { channel: "devops", author: TEAM.henry, content: "Migrated the staging environment to the new cluster. All services are green. Production migration planned for next week.", timestamp: daysAgo(3) },
  { channel: "devops", author: TEAM.henry, content: "Neo4j memory increased to 2GB on production. This should handle the growing knowledge graph without GC pressure.", timestamp: daysAgo(2) },

  // Recent activity
  { channel: "engineering", author: TEAM.alice, content: "Sprint retrospective: velocity is up 15% from last sprint. Main risk: the onboarding deadline is tight.", timestamp: daysAgo(1) },
  { channel: "product", author: TEAM.eve, content: "Customer feedback: they love the AI inbox but want better notification controls. Adding to next sprint.", timestamp: daysAgo(1) },
  { channel: "engineering", author: TEAM.carol, content: "The analytics pipeline processed 2M events yesterday without issues. PostgreSQL is handling the load well.", timestamp: daysAgo(1) },

  // PR references
  { channel: "engineering", author: TEAM.grace, content: "PR #392: Add knowledge graph entity resolution API. This lets us merge duplicate entities across different data sources.", timestamp: daysAgo(1) },
  { channel: "engineering", author: TEAM.david, content: "PR #393: Implement proactive query patterns for fact-checking and blocked task detection.", timestamp: daysAgo(1) },

  // Contradictions (for fact-checking tests)
  { channel: "engineering", author: TEAM.bob, content: "We decided to use Redis for caching. It's simpler than Memcached and supports more data structures.", timestamp: daysAgo(20) },
  { channel: "backend", author: TEAM.carol, content: "Actually, we're going with Memcached for the cache layer. It has lower memory overhead for simple key-value lookups.", timestamp: daysAgo(15) },

  // Blocked tasks
  { channel: "engineering", author: TEAM.frank, content: "The mobile app redesign is blocked by the design system v2 release. Can't start until the new components are available.", timestamp: daysAgo(7) },
  { channel: "design", author: TEAM.frank, content: "Design system v2 depends on the icon library update that Grace is working on.", timestamp: daysAgo(6) },
  { channel: "engineering", author: TEAM.grace, content: "Icon library update is 80% done. Should be ready by end of week. That will unblock design system v2.", timestamp: daysAgo(5) },

  // Cross-team knowledge
  { channel: "data-science", author: TEAM.carol, content: "We're training a classification model for the Eisenhower inbox. Using message metadata + knowledge graph embeddings as features.", timestamp: daysAgo(8) },
  { channel: "product", author: TEAM.eve, content: "The AI inbox classification accuracy is now at 87%. Target is 95% before GA launch.", timestamp: daysAgo(3) },

  // More messages to reach 200+
  ...generateAdditionalMessages(155),
];

function generateAdditionalMessages(count: number): typeof DEMO_MESSAGES {
  const messages: typeof DEMO_MESSAGES = [];
  const topics = [
    "authentication", "WebSocket connections", "file uploads", "user permissions",
    "workspace settings", "channel archiving", "message threading", "emoji reactions",
    "typing indicators", "presence system", "invitation flow", "SSO configuration",
    "rate limiting", "error monitoring", "CDN setup", "database migrations",
    "API versioning", "webhook delivery", "notification preferences", "search indexing",
    "audit logging", "data export", "GDPR compliance", "accessibility",
    "dark mode", "keyboard shortcuts", "mobile push notifications", "offline support",
    "message formatting", "code blocks", "file preview", "link unfurling",
  ];

  const teamMembers = Object.values(TEAM);
  const channels = ["engineering", "backend", "frontend", "product", "design", "devops", "general"];

  for (let i = 0; i < count; i++) {
    const topic = topics[i % topics.length];
    const author = teamMembers[i % teamMembers.length];
    const channel = channels[i % channels.length];
    const daysBack = 1 + Math.floor(Math.random() * 28);

    const templates = [
      `Working on ${topic} today. Making good progress on the implementation.`,
      `The ${topic} feature needs more testing. Found edge cases during manual QA.`,
      `Merged the ${topic} changes. All tests passing in CI.`,
      `Quick sync about ${topic}: we need to coordinate with the ${channels[(i + 1) % channels.length]} team.`,
      `Updated the documentation for ${topic}. Added examples and troubleshooting guide.`,
    ];

    messages.push({
      channel,
      author,
      content: templates[i % templates.length],
      timestamp: daysAgo(daysBack),
    });
  }

  return messages;
}

// --- Curated demo questions ---

const DEMO_QUESTIONS = [
  {
    question: "What database did the team choose for analytics, and why?",
    expectedTopics: ["PostgreSQL", "ClickHouse", "analytics"],
  },
  {
    question: "What is blocking the mobile app redesign?",
    expectedTopics: ["design system v2", "icon library", "Grace"],
  },
  {
    question: "What authentication approach did the team decide on?",
    expectedTopics: ["JWT", "refresh tokens", "session-based"],
  },
  {
    question: "Who is working on the ETL pipeline, and what issues did they face?",
    expectedTopics: ["Carol", "S3 credentials", "Temporal"],
  },
  {
    question: "What performance improvements were made to search?",
    expectedTopics: ["trigram index", "David", "10x faster", "45ms"],
  },
  {
    question: "Is there a contradiction about which cache system to use?",
    expectedTopics: ["Redis", "Memcached", "contradiction"],
  },
  {
    question: "What integrations are available and who built them?",
    expectedTopics: ["GitHub", "Linear", "Grace"],
  },
  {
    question: "What is the current state of the onboarding feature?",
    expectedTopics: ["onboarding", "March 15th", "design handoff"],
  },
  {
    question: "What security issues were found and fixed?",
    expectedTopics: ["PII", "logging", "redaction", "Bob"],
  },
  {
    question: "How is the knowledge graph performing and what improvements are planned?",
    expectedTopics: ["50,000 facts", "entity resolution", "temporal queries"],
  },
];

// --- Ingestion ---

async function ingestBatch(
  messages: typeof DEMO_MESSAGES,
  batchSize: number,
): Promise<{ success: number; failed: number }> {
  let success = 0;
  let failed = 0;

  for (let i = 0; i < messages.length; i += batchSize) {
    const batch = messages.slice(i, i + batchSize);
    const grouped = new Map<string, typeof batch>();

    for (const msg of batch) {
      const existing = grouped.get(msg.channel) ?? [];
      existing.push(msg);
      grouped.set(msg.channel, existing);
    }

    for (const [channel, channelMessages] of grouped) {
      try {
        const response = await fetch(`${GRAPHITI_URL}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            group_id: channel,
            messages: channelMessages.map((m) => ({
              content: m.content,
              role_type: "user",
              role: m.author,
              timestamp: m.timestamp,
              source_description: `channel:${m.channel}`,
              name: `${m.author} in #${m.channel}`,
            })),
          }),
        });

        if (response.ok) {
          success += channelMessages.length;
        } else {
          logger.warn(
            { channel, status: response.status },
            "Batch ingestion failed",
          );
          failed += channelMessages.length;
        }
      } catch (err) {
        logger.warn({ err, channel }, "Batch ingestion error");
        failed += channelMessages.length;
      }
    }

    logger.info(`Ingested ${Math.min(i + batchSize, messages.length)}/${messages.length} messages`);
  }

  return { success, failed };
}

// --- Main ---

async function main() {
  logger.info("=== Knowledge Engine Seed Script ===");
  logger.info({ graphitiUrl: GRAPHITI_URL, messageCount: DEMO_MESSAGES.length });

  // Check Graphiti health
  try {
    const health = await fetch(`${GRAPHITI_URL}/healthcheck`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!health.ok) {
      logger.error("Graphiti is not healthy. Start it with: docker compose up -d");
      process.exit(1);
    }
    logger.info("Graphiti is healthy");
  } catch {
    logger.error("Cannot reach Graphiti. Start it with: docker compose up -d");
    process.exit(1);
  }

  // Ingest demo messages
  logger.info(`Ingesting ${DEMO_MESSAGES.length} curated demo messages...`);
  const result = await ingestBatch(DEMO_MESSAGES, 20);
  logger.info({ ...result }, "Ingestion complete");

  // Print demo questions
  logger.info("=== Demo Questions ===");
  logger.info("Try these queries against the knowledge engine:");
  for (const { question, expectedTopics } of DEMO_QUESTIONS) {
    logger.info(`  Q: ${question}`);
    logger.info(`     Expected topics: ${expectedTopics.join(", ")}`);
  }

  logger.info("");
  logger.info("Seed complete. You can now query the knowledge engine.");
  logger.info(`Example: curl -X POST ${GRAPHITI_URL}/search -H 'Content-Type: application/json' -d '{"query": "What database did the team choose?"}'`);
}

main().catch((err) => {
  logger.error({ err }, "Seed script failed");
  process.exit(1);
});
