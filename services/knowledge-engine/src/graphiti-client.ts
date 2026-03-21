/**
 * Client for the upstream Graphiti REST API (zepai/graphiti service).
 *
 * Handles connection pooling via keep-alive, retries on transient errors, and
 * translates responses into our internal types.
 */

import type { Config } from "./config.js";
import type { GraphitiEpisode, GraphitiSearchResult } from "./types.js";

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 500;

export class GraphitiClient {
  private baseUrl: string;

  constructor(config: Config) {
    this.baseUrl = config.graphitiUrl.replace(/\/$/, "");
  }

  // ---------------------------------------------------------------------------
  // Episodes
  // ---------------------------------------------------------------------------

  /**
   * Create a new episode in Graphiti. Returns the episode UUID.
   */
  async createEpisode(params: {
    name: string;
    content: string;
    source: string;
    sourceDescription: string;
    groupId?: string;
  }): Promise<GraphitiEpisode> {
    const body = {
      name: params.name,
      episode_body: params.content,
      source: params.source,
      source_description: params.sourceDescription,
      group_id: params.groupId ?? "default",
      reference_time: new Date().toISOString(),
    };

    const res = await this.request<GraphitiEpisode>(
      "POST",
      "/v1/episodes",
      body,
    );
    return res;
  }

  /**
   * Get an episode by UUID.
   */
  async getEpisode(uuid: string): Promise<GraphitiEpisode | null> {
    try {
      return await this.request<GraphitiEpisode>(
        "GET",
        `/v1/episodes/${uuid}`,
      );
    } catch (err) {
      if (err instanceof GraphitiError && err.status === 404) {
        return null;
      }
      throw err;
    }
  }

  // ---------------------------------------------------------------------------
  // Search
  // ---------------------------------------------------------------------------

  /**
   * Search the knowledge graph. Returns ranked results.
   */
  async search(params: {
    query: string;
    groupId?: string;
    limit?: number;
  }): Promise<GraphitiSearchResult[]> {
    const body = {
      query: params.query,
      group_ids: params.groupId ? [params.groupId] : undefined,
      num_results: params.limit ?? 10,
    };

    const res = await this.request<{ edges: GraphitiSearchResult[] }>(
      "POST",
      "/v1/search",
      body,
    );

    return res.edges ?? [];
  }

  // ---------------------------------------------------------------------------
  // Health
  // ---------------------------------------------------------------------------

  async healthcheck(): Promise<boolean> {
    try {
      await this.request("GET", "/healthcheck");
      return true;
    } catch {
      return false;
    }
  }

  // ---------------------------------------------------------------------------
  // HTTP helpers
  // ---------------------------------------------------------------------------

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const url = `${this.baseUrl}${path}`;
        const init: RequestInit = {
          method,
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          keepalive: true,
        };

        if (body !== undefined) {
          init.body = JSON.stringify(body);
        }

        const res = await fetch(url, init);

        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new GraphitiError(
            `Graphiti ${method} ${path} failed: ${res.status} ${text}`,
            res.status,
          );
        }

        // Some endpoints return 204 with no body.
        if (res.status === 204) {
          return undefined as unknown as T;
        }

        return (await res.json()) as T;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));

        // Only retry on network / 5xx errors.
        const isRetryable =
          !(err instanceof GraphitiError) ||
          (err instanceof GraphitiError && err.status >= 500);

        if (!isRetryable || attempt === MAX_RETRIES) {
          throw lastError;
        }

        await sleep(RETRY_DELAY_MS * (attempt + 1));
      }
    }

    throw lastError ?? new Error("Unexpected retry loop exit");
  }
}

export class GraphitiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "GraphitiError";
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
