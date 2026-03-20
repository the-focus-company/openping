# Dev 4 — Knowledge Engine: Graphiti Service, Ingestion Pipeline, Graph Queries

**Scope:** Standalone Express.js service wrapping Graphiti + Neo4j. REST API for message/integration ingestion and Graph-RAG queries. Bulk ingestion for "Memory Magic". Demo data seeding. Performance testing.

**Key directory:** `services/knowledge-engine/`

```
services/knowledge-engine/
├── package.json
├── tsconfig.json
├── Dockerfile
├── docker-compose.yml        # Neo4j + app
├── .env.example
├── src/
│   ├── index.ts              # Express server
│   ├── graphiti-client.ts    # Graphiti SDK init + Neo4j connection
│   ├── ingest.ts             # Ingestion handlers
│   ├── query.ts              # Graph-RAG query interface
│   ├── types.ts              # Entity/episode types
│   └── seed.ts               # Demo data seeding
└── __tests__/
    └── *.test.ts
```

---

## REST API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/ingest/message` | Ingest a chat message as Graphiti episode |
| POST | `/ingest/integration` | Ingest a GitHub PR or Linear ticket |
| POST | `/ingest/bulk` | Bulk ingest historical data ("Memory Magic") |
| POST | `/query` | Graph-RAG query: returns episodes + entities with citations |
| GET | `/health` | Health check |

---

## Data Flow

### Ingestion (called by Convex `ingest.processMessage` action):
1. Receive message data: `{ content, author, channel, timestamp, messageId }`
2. Create Graphiti episode with metadata
3. Extract entities: People, Topics, Decisions, Technologies, Components
4. Build relationships: author → message, message → channel, message → topic
5. Return `{ episodeId }` to Convex

### Query (called by Convex `bot.respond` action):
1. Receive question: `{ query, channelId?, temporalFilter? }`
2. Graphiti search with natural language
3. Return ranked results with structured citations:
```json
{
  "results": [
    {
      "sourceType": "message",
      "sourceId": "conv_abc123",
      "snippet": "We should use composite indexes because...",
      "author": "Sarah Chen",
      "timestamp": 1707753300,
      "relevanceScore": 0.95
    }
  ]
}
```

---

## Entity Types for the Graph

```typescript
// types.ts
type EntityType = "Person" | "Channel" | "Topic" | "Decision" | "Technology" | "Component" | "PullRequest" | "Ticket";

// Relationships:
// Person --authored--> Message
// Person --reviewed--> PullRequest
// Person --assigned--> Ticket
// Message --discusses--> Topic
// Message --references--> PullRequest
// Message --contains--> Decision
// PullRequest --modifies--> Component
// Ticket --blocks--> Ticket
// Decision --affects--> Technology
```

---

## Sprint-by-Sprint Tasks

### Phase 0 (Day 0)
- **Graphiti SDK spike** (critical validation):
  - Install `@getzep/graphiti` and `neo4j-driver`
  - Start Neo4j in Docker, connect Graphiti
  - Test: create episode, extract entities, run search query
  - Document any SDK limitations, version compatibility issues
  - Confirm Neo4j APOC plugin requirements
- Docker compose (`docker-compose.yml`):
  - Neo4j 5.x with APOC plugins
  - Knowledge engine Express app
  - Health check endpoints

### Sprint 1 (Days 1-3)

**Day 1:**
- Express server skeleton (`src/index.ts`):
  - CORS, JSON body parser, error handler
  - GET `/health` endpoint
  - Port from env var (default 4000)
- Graphiti client initialization (`src/graphiti-client.ts`):
  - Neo4j connection with env vars (NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD)
  - Graphiti SDK initialization
  - Connection retry logic
- Docker compose finalized and tested

**Day 2:**
- POST `/ingest/message` (`src/ingest.ts`):
  - Accept: `{ content, author, channel, timestamp, messageId }`
  - Create Graphiti episode with full metadata
  - Return: `{ episodeId }`
- Define entity types (`src/types.ts`):
  - Person, Channel, Message, Decision, Topic, Technology, Component

**Day 3:**
- POST `/ingest/integration` (`src/ingest.ts`):
  - Accept: `{ type, externalId, title, status, url, author, metadata }`
  - Create Graphiti episode for PR/ticket
  - Extract entities: PR author, repo, labels → graph nodes
  - Build relationships: author→PR, PR→component
- Basic POST `/query` (`src/query.ts`):
  - Accept: `{ query }`
  - Simple Graphiti search
  - Return raw results (will be refined later)
- **Verify end-to-end**: ingest a message via curl, query for it, get results

---

### Sprint 2 (Days 4-7)

**Day 4-5:**
- Refine message ingestion:
  - Proper Graphiti episode creation with rich metadata (author name, channel name, timestamps)
  - Entity extraction configuration: tune to extract People (names, @mentions), Topics (technical terms), Decisions (statements of intent), Technologies (frameworks, tools)
- Batch ingestion: handle bursts of messages efficiently (queue or batch API if Graphiti supports it)

**Day 6-7:**
- Integration object ingestion refinement:
  - GitHub PRs: extract file paths, reviewers, labels as entities
  - Linear tickets: extract assignee, priority, cycle, project
  - Build cross-referencing relationships
- Query refinement:
  - Support natural language queries
  - Return ranked results with source metadata (type, author, timestamp, snippet)
  - Format citations for Convex to use directly
- **Test with 100+ messages**: verify graph structure in Neo4j browser (bolt://localhost:7687)
- Error handling, retry logic, connection pooling

---

### Sprint 3 (Days 8-12)

**Day 8-9:**
- Advanced query endpoint:
  - Follow-up question support (maintain context)
  - Temporal filters: "What happened last Tuesday?" → date range scoping
  - Channel-scoped queries: only search within a specific channel's knowledge
- Citation formatting:
  - Return structured `{ sourceType, sourceId, snippet, author, timestamp }` matching Convex schema
  - Include relevance scores for ranking
- **Bulk ingestion endpoint** POST `/ingest/bulk` ("Memory Magic"):
  - Accept arrays of messages/events
  - Process in batches (e.g., 50 at a time)
  - Return progress/status

**Day 10-12:**
- GitHub history ingestion:
  - Parse GitHub API format (commits, PRs, issues, review comments)
  - Map to graph entities with temporal metadata
- Linear history ingestion:
  - Parse Linear API format (issues, comments, labels, cycles)
  - Build relationship graph
- Cross-source entity mapping:
  - "Sarah Chen" in chat = "sarahchen" on GitHub = "sarah@company.com"
  - Fuzzy matching by name/email
- Performance testing: query latency with 1000+ episodes, optimize search parameters

---

### Sprint 4 (Days 13-16)

**Day 13-14:**
- Cross-source entity resolution improvement:
  - Entity deduplication (merge nodes representing same person across sources)
  - Weighted relationship scoring
- Temporal queries:
  - "What happened last Tuesday?" correctly scopes to date range
  - "How has our auth approach changed?" shows evolution over time
- Relevance tuning: adjust Graphiti search parameters for better precision/recall
- **Proactive query support** — new query patterns for AI agents:
  - "Who last modified file/component X?" (for incident routing)
  - "What was the fix for similar incident Y?" (for incident context)
  - "What dependencies does ticket Z have?" (for blocked task detection)

**Day 15-16:**
- **Stress test**: ingest 5000 messages + 200 PRs + 300 tickets
  - Measure query latency: target p50 < 500ms, p95 < 2s, p99 < 5s
  - Monitor Neo4j memory usage, optimize if needed
- Memory optimization: Neo4j JVM heap settings, connection pool tuning
- Relationship enrichment: when a message mentions "#142", create explicit edge to PR #142
- **Blocked task dependency queries**: detect if a blocking PR/ticket has been resolved since the task was last updated

---

### Sprint 5 (Days 17-20)

**Day 17-18:**
- Seed knowledge graph (`src/seed.ts`):
  - Ingest all demo messages (200+) into Graphiti
  - Ingest all demo PRs (10) and Linear tickets (15)
  - Verify all entities and relationships are correctly built
- Curate 10 demo questions with expected answers:
  1. "How did we decide on the database schema?"
  2. "Who has been working on the auth system?"
  3. "What was the CI fix that Alex merged?"
  4. "Why did we switch from Redis to Convex?"
  5. "What PRs are related to the migration?"
  ... (5 more targeting cross-source and temporal queries)
- Verify each demo question returns correct, well-cited results

**Day 19-20:**
- Performance benchmarks documented: p50/p95/p99 query latency
- Graceful degradation:
  - If Neo4j is down → service returns 503 with clear error
  - Convex bot.ts handles this: "Knowledge engine unavailable, please try again"
- Dockerfile optimization: multi-stage build, minimal image
- Production Neo4j configuration: auth, backup, monitoring
- API documentation: all endpoints with request/response examples

---

## Environment Variables

```
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=<password>
PORT=4000
LOG_LEVEL=info
```

---

## Dependencies on Other Devs

| I need | From | When |
|--------|------|------|
| Convex `ingest.processMessage` calls my API | Dev 3 | Day 7 |
| Message/integration data format alignment | Dev 3 | Day 2 |
| Proactive query requirements (what questions agents need to ask) | Dev 5 | Day 13 |
| Seed demo data (messages, PRs, tickets) | Dev 3 | Day 17 |
