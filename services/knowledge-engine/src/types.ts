/**
 * Types for the Knowledge Engine service.
 */

// ---------------------------------------------------------------------------
// Integration ingestion (8LI-73 + 8LI-74)
// ---------------------------------------------------------------------------

export type IntegrationType = "github_pr" | "linear_ticket" | "message";

/** Metadata attached to a GitHub PR. */
export interface GitHubPRMetadata {
  repo: string;
  prNumber: number;
  baseBranch: string;
  headBranch: string;
  reviewers?: string[];
  labels?: string[];
  additions?: number;
  deletions?: number;
  filesChanged?: number;
  comments?: Array<{ author: string; body: string; createdAt: string }>;
}

/** Metadata attached to a Linear ticket. */
export interface LinearTicketMetadata {
  teamKey: string;
  identifier: string;
  priority: number;
  assignee?: string;
  labels?: string[];
  estimate?: number;
  project?: string;
  cycle?: string;
  comments?: Array<{ author: string; body: string; createdAt: string }>;
}

/** Payload for POST /ingest/integration */
export interface IngestIntegrationPayload {
  workspaceId: string;
  type: IntegrationType;
  externalId: string;
  title: string;
  status: string;
  url: string;
  author: string;
  body?: string;
  metadata?: Record<string, unknown>;
}

/** Payload for POST /ingest/batch — a burst of messages / items. */
export interface IngestBatchPayload {
  workspaceId: string;
  groupId: string; // e.g. channelId or conversationId
  items: IngestBatchItem[];
}

export interface IngestBatchItem {
  type: IntegrationType;
  externalId: string;
  title: string;
  body: string;
  author: string;
  timestamp: string; // ISO-8601
  metadata?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Entity extraction (8LI-74)
// ---------------------------------------------------------------------------

export type EntityType = "Person" | "Topic" | "Decision" | "Technology";

export interface ExtractedEntity {
  name: string;
  type: EntityType;
  confidence: number;
}

// ---------------------------------------------------------------------------
// Query & citations (8LI-73 + 8LI-74)
// ---------------------------------------------------------------------------

/** Payload for POST /query */
export interface QueryPayload {
  query: string;
  workspaceId?: string;
  groupId?: string;
  limit?: number;
  entityTypes?: EntityType[];
}

/** A single search result with citation info. */
export interface SearchResult {
  /** Content snippet. */
  content: string;
  /** Relevance score 0-1. */
  score: number;
  /** Source info for citations. */
  source: {
    type: IntegrationType;
    externalId: string;
    title: string;
    url?: string;
    author?: string;
    timestamp?: string;
  };
  /** Entities extracted from this result. */
  entities: ExtractedEntity[];
}

/** Response from POST /query */
export interface QueryResponse {
  results: SearchResult[];
  /** Entities aggregated across all results. */
  entities: ExtractedEntity[];
  /** Time taken in ms. */
  durationMs: number;
}

// ---------------------------------------------------------------------------
// Graphiti upstream API shapes (the zepai/graphiti service)
// ---------------------------------------------------------------------------

export interface GraphitiEpisode {
  uuid: string;
  name: string;
  content: string;
  source: string;
  source_description: string;
  created_at: string;
}

export interface GraphitiSearchResult {
  uuid: string;
  content: string;
  fact: string;
  name?: string;
  created_at: string;
  source_description?: string;
  score?: number;
  episodes?: string[];
}
