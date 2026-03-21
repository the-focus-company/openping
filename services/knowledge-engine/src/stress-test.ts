/**
 * Stress test for the knowledge engine.
 *
 * Targets:
 *   - Ingest 5000 messages + 200 PRs + 300 tickets
 *   - p50 < 500ms, p95 < 2s for search queries
 *
 * Usage:
 *   pnpm stress-test
 *
 * Environment:
 *   GRAPHITI_API_URL  — Graphiti upstream (default http://localhost:8000)
 *   ENGINE_URL        — Knowledge engine (default http://localhost:8001)
 *   NEO4J_URI         — Neo4j bolt URI (default bolt://localhost:7687)
 */

import pino from "pino";

const logger = pino({ level: "info", transport: { target: "pino-pretty" } });

const GRAPHITI_URL = process.env.GRAPHITI_API_URL ?? "http://localhost:8000";
const ENGINE_URL = process.env.ENGINE_URL ?? "http://localhost:8001";

// --- Data generators ---

const TEAM_MEMBERS = [
  "Alice Chen", "Bob Martinez", "Carol Davis", "David Kim", "Eve Johnson",
  "Frank Li", "Grace Wang", "Henry Brown", "Iris Patel", "Jack Wilson",
  "Kate Thompson", "Liam Garcia", "Mia Rodriguez", "Noah Anderson", "Olivia Taylor",
  "Peter Nguyen", "Quinn Thomas", "Rachel Moore", "Sam Jackson", "Tina White",
];

const CHANNELS = [
  "engineering", "product", "design", "backend", "frontend",
  "devops", "mobile", "data-science", "qa", "general",
];

const TOPICS = [
  "API migration", "database schema", "auth refactor", "CI/CD pipeline",
  "performance optimization", "security audit", "onboarding flow", "search feature",
  "notification system", "analytics dashboard", "payment integration", "cache layer",
  "rate limiting", "error handling", "logging infrastructure", "deployment strategy",
  "code review process", "testing framework", "documentation", "monitoring",
];

const PR_REPOS = [
  "platform", "web-app", "mobile-app", "shared-libs", "infra",
];

const TICKET_PROJECTS = [
  "PING", "CORE", "INFRA", "MOBILE", "DATA",
];

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateMessage(index: number): {
  content: string;
  role: string;
  channel: string;
  timestamp: string;
} {
  const author = randomItem(TEAM_MEMBERS);
  const channel = randomItem(CHANNELS);
  const topic = randomItem(TOPICS);
  const days = Math.floor(Math.random() * 90);
  const timestamp = new Date(Date.now() - days * 86400000).toISOString();

  const templates = [
    `I've been working on ${topic} and found an issue with the current approach. We should consider an alternative.`,
    `Quick update on ${topic}: made good progress today. Should be ready for review tomorrow.`,
    `@${randomItem(TEAM_MEMBERS)} can you take a look at the ${topic} changes? I need a second opinion.`,
    `Decided to go with the new approach for ${topic}. It's simpler and more maintainable.`,
    `The ${topic} is blocked by the dependency on ${randomItem(TOPICS)}. Need help resolving this.`,
    `Great news — ${topic} is now live in staging. Please test when you get a chance.`,
    `We agreed in the meeting to prioritize ${topic} over ${randomItem(TOPICS)} this sprint.`,
    `Found a bug in ${topic} that affects ${randomItem(CHANNELS)} workflows. Looking into it now.`,
    `The ${topic} PR is ready. It addresses the concerns from the last review.`,
    `I think we should revisit the ${topic} decision. New data suggests a different approach.`,
  ];

  return {
    content: `[msg-${index}] ${randomItem(templates)}`,
    role: author,
    channel,
    timestamp,
  };
}

function generatePR(index: number): Record<string, unknown> {
  const author = randomItem(TEAM_MEMBERS);
  const repo = randomItem(PR_REPOS);
  const topic = randomItem(TOPICS);
  return {
    title: `[PR-${index}] ${topic}: implement ${["fix", "feature", "refactor", "update"][index % 4]}`,
    author,
    repo,
    state: ["open", "merged", "closed"][index % 3],
    created_at: new Date(Date.now() - Math.floor(Math.random() * 60) * 86400000).toISOString(),
  };
}

function generateTicket(index: number): Record<string, unknown> {
  const assignee = randomItem(TEAM_MEMBERS);
  const project = randomItem(TICKET_PROJECTS);
  const topic = randomItem(TOPICS);
  return {
    key: `${project}-${1000 + index}`,
    title: `${topic}: ${["investigate", "implement", "fix", "improve", "document"][index % 5]}`,
    assignee,
    status: ["todo", "in_progress", "in_review", "done", "blocked"][index % 5],
    priority: ["low", "medium", "high", "urgent"][index % 4],
    created_at: new Date(Date.now() - Math.floor(Math.random() * 90) * 86400000).toISOString(),
  };
}

// --- Latency tracking ---

interface LatencyResult {
  operation: string;
  latencyMs: number;
  success: boolean;
  error?: string;
}

function percentile(values: number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil(sorted.length * (p / 100)) - 1;
  return sorted[Math.max(0, index)];
}

// --- Ingestion ---

async function ingestMessages(count: number): Promise<LatencyResult[]> {
  const results: LatencyResult[] = [];
  const batchSize = 50;

  for (let i = 0; i < count; i += batchSize) {
    const batch = Array.from({ length: Math.min(batchSize, count - i) }, (_, j) =>
      generateMessage(i + j),
    );

    const start = performance.now();
    try {
      const response = await fetch(`${GRAPHITI_URL}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          group_id: batch[0].channel,
          messages: batch.map((m) => ({
            content: m.content,
            role_type: "user",
            role: m.role,
            timestamp: m.timestamp,
            source_description: `channel:${m.channel}`,
            name: `${m.role} in #${m.channel}`,
          })),
        }),
      });

      const latencyMs = performance.now() - start;
      results.push({
        operation: `ingest-messages-batch-${i}`,
        latencyMs,
        success: response.ok,
        ...(!response.ok && { error: `HTTP ${response.status}` }),
      });
    } catch (err) {
      results.push({
        operation: `ingest-messages-batch-${i}`,
        latencyMs: performance.now() - start,
        success: false,
        error: String(err),
      });
    }

    if ((i + batchSize) % 500 === 0) {
      logger.info(`Ingested ${Math.min(i + batchSize, count)}/${count} messages`);
    }
  }

  return results;
}

async function ingestIntegrations(
  type: "pr" | "ticket",
  count: number,
): Promise<LatencyResult[]> {
  const results: LatencyResult[] = [];

  for (let i = 0; i < count; i++) {
    const item = type === "pr" ? generatePR(i) : generateTicket(i);
    const content =
      type === "pr"
        ? `PR "${item.title}" by ${item.author} in ${item.repo} — ${item.state}`
        : `Ticket ${item.key}: "${item.title}" assigned to ${item.assignee} — ${item.status} (${item.priority})`;

    const start = performance.now();
    try {
      const response = await fetch(`${GRAPHITI_URL}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          group_id: `integration-${type}`,
          messages: [
            {
              content,
              role_type: "system",
              role: type === "pr" ? "github" : "linear",
              timestamp: String(item.created_at),
              source_description: `integration:${type}`,
              name: type === "pr" ? `GitHub PR #${i}` : `Linear ${item.key}`,
            },
          ],
        }),
      });

      results.push({
        operation: `ingest-${type}-${i}`,
        latencyMs: performance.now() - start,
        success: response.ok,
        ...(!response.ok && { error: `HTTP ${response.status}` }),
      });
    } catch (err) {
      results.push({
        operation: `ingest-${type}-${i}`,
        latencyMs: performance.now() - start,
        success: false,
        error: String(err),
      });
    }

    if ((i + 1) % 50 === 0) {
      logger.info(`Ingested ${i + 1}/${count} ${type}s`);
    }
  }

  return results;
}

// --- Search benchmarks ---

async function benchmarkSearches(iterations: number): Promise<LatencyResult[]> {
  const results: LatencyResult[] = [];
  const queries = [
    ...TEAM_MEMBERS.slice(0, 5).map((name) => `What is ${name} working on?`),
    ...TOPICS.slice(0, 5).map((topic) => `What decisions were made about ${topic}?`),
    "Who is blocked?",
    "What PRs need review?",
    "What happened last week?",
    "Which teams are working on similar things?",
    "Are there any contradictions in recent discussions?",
  ];

  for (let i = 0; i < iterations; i++) {
    const query = queries[i % queries.length];

    // Benchmark Graphiti search
    const graphitiStart = performance.now();
    try {
      const response = await fetch(`${GRAPHITI_URL}/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, max_facts: 10 }),
      });
      results.push({
        operation: `graphiti-search-${i}`,
        latencyMs: performance.now() - graphitiStart,
        success: response.ok,
      });
    } catch (err) {
      results.push({
        operation: `graphiti-search-${i}`,
        latencyMs: performance.now() - graphitiStart,
        success: false,
        error: String(err),
      });
    }

    // Benchmark engine proactive queries
    const engineStart = performance.now();
    try {
      const response = await fetch(`${ENGINE_URL}/proactive/fact-check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ claim: query, maxFacts: 5 }),
      });
      results.push({
        operation: `engine-fact-check-${i}`,
        latencyMs: performance.now() - engineStart,
        success: response.ok,
      });
    } catch (err) {
      results.push({
        operation: `engine-fact-check-${i}`,
        latencyMs: performance.now() - engineStart,
        success: false,
        error: String(err),
      });
    }

    // Benchmark entity search
    const entityStart = performance.now();
    try {
      const response = await fetch(`${ENGINE_URL}/entities/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: randomItem(TEAM_MEMBERS), limit: 10 }),
      });
      results.push({
        operation: `engine-entity-search-${i}`,
        latencyMs: performance.now() - entityStart,
        success: response.ok,
      });
    } catch (err) {
      results.push({
        operation: `engine-entity-search-${i}`,
        latencyMs: performance.now() - entityStart,
        success: false,
        error: String(err),
      });
    }
  }

  return results;
}

// --- Main ---

async function main() {
  logger.info("=== Knowledge Engine Stress Test ===");
  logger.info({ graphitiUrl: GRAPHITI_URL, engineUrl: ENGINE_URL });

  const allResults: LatencyResult[] = [];

  // Phase 1: Ingest
  logger.info("--- Phase 1: Ingesting 5000 messages ---");
  const msgResults = await ingestMessages(5000);
  allResults.push(...msgResults);

  logger.info("--- Phase 1: Ingesting 200 PRs ---");
  const prResults = await ingestIntegrations("pr", 200);
  allResults.push(...prResults);

  logger.info("--- Phase 1: Ingesting 300 tickets ---");
  const ticketResults = await ingestIntegrations("ticket", 300);
  allResults.push(...ticketResults);

  // Phase 2: Search benchmarks
  logger.info("--- Phase 2: Running 100 search iterations ---");
  const searchResults = await benchmarkSearches(100);
  allResults.push(...searchResults);

  // Phase 3: Entity resolution benchmark
  logger.info("--- Phase 3: Entity resolution ---");
  const resolveStart = performance.now();
  try {
    const response = await fetch(`${ENGINE_URL}/entities/duplicates?threshold=0.8&limit=50`);
    allResults.push({
      operation: "find-duplicates",
      latencyMs: performance.now() - resolveStart,
      success: response.ok,
    });
  } catch (err) {
    allResults.push({
      operation: "find-duplicates",
      latencyMs: performance.now() - resolveStart,
      success: false,
      error: String(err),
    });
  }

  // --- Report ---
  logger.info("=== Results ===");

  const successful = allResults.filter((r) => r.success);
  const failed = allResults.filter((r) => !r.success);

  logger.info(`Total operations: ${allResults.length}`);
  logger.info(`Successful: ${successful.length}`);
  logger.info(`Failed: ${failed.length}`);

  if (failed.length > 0) {
    logger.warn(
      { firstErrors: failed.slice(0, 5).map((f) => ({ op: f.operation, err: f.error })) },
      "Sample failures",
    );
  }

  // Search latency breakdown
  const searchLatencies = allResults
    .filter((r) => r.operation.includes("search") || r.operation.includes("fact-check"))
    .map((r) => r.latencyMs);

  if (searchLatencies.length > 0) {
    const p50 = percentile(searchLatencies, 50);
    const p95 = percentile(searchLatencies, 95);
    const p99 = percentile(searchLatencies, 99);

    logger.info("--- Search Latency ---");
    logger.info(`p50: ${p50.toFixed(1)}ms (target: <500ms) ${p50 < 500 ? "PASS" : "FAIL"}`);
    logger.info(`p95: ${p95.toFixed(1)}ms (target: <2000ms) ${p95 < 2000 ? "PASS" : "FAIL"}`);
    logger.info(`p99: ${p99.toFixed(1)}ms`);
  }

  // Ingest latency breakdown
  const ingestLatencies = allResults
    .filter((r) => r.operation.startsWith("ingest"))
    .map((r) => r.latencyMs);

  if (ingestLatencies.length > 0) {
    logger.info("--- Ingest Latency ---");
    logger.info(`p50: ${percentile(ingestLatencies, 50).toFixed(1)}ms`);
    logger.info(`p95: ${percentile(ingestLatencies, 95).toFixed(1)}ms`);
  }

  // Exit with error if targets not met
  if (searchLatencies.length > 0) {
    const p50 = percentile(searchLatencies, 50);
    const p95 = percentile(searchLatencies, 95);
    if (p50 >= 500 || p95 >= 2000) {
      logger.error("Performance targets NOT met");
      process.exit(1);
    }
  }

  logger.info("Stress test complete");
}

main().catch((err) => {
  logger.error({ err }, "Stress test failed");
  process.exit(1);
});
