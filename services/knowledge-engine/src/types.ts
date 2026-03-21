export interface IngestMessageRequest {
  content: string;
  author: string;
  channel: string;
  timestamp: number;
  messageId: string;
  workspaceId?: string;
}

export interface IngestIntegrationRequest {
  type: "github_pr" | "linear_ticket";
  externalId: string;
  title: string;
  status: string;
  url: string;
  author: string;
  metadata: Record<string, unknown>;
  workspaceId?: string;
}

export interface IngestBulkRequest {
  messages?: IngestMessageRequest[];
  integrations?: IngestIntegrationRequest[];
}

export interface IngestResponse {
  episodeId: string;
}

export interface BulkIngestResponse {
  processed: number;
  episodeIds: string[];
}

export interface QueryRequest {
  query: string;
  channelId?: string;
  workspaceId?: string;
  temporalFilter?: {
    from?: number;
    to?: number;
  };
  limit?: number;
}

export interface QueryResult {
  sourceType: "message" | "github_pr" | "linear_ticket";
  sourceId: string;
  snippet: string;
  author: string;
  timestamp: number;
  relevanceScore: number;
  entities?: string[];
}

export interface QueryResponse {
  results: QueryResult[];
}

export interface HealthResponse {
  status: "ok" | "degraded";
  neo4j: "connected" | "disconnected";
  timestamp: number;
}

export interface ExtractedEntity {
  name: string;
  type: "Person" | "Topic" | "Technology" | "Component" | "Decision";
}
