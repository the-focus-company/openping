/**
 * POST /query — search the knowledge graph with ranked results and citations.
 */

import { Router } from "express";
import type { GraphitiClient } from "../graphiti-client.js";
import { extractEntities } from "../entities.js";
import { QuerySchema } from "../validation.js";
import type {
  SearchResult,
  QueryResponse,
  ExtractedEntity,
  EntityType,
} from "../types.js";

export function createQueryRouter(graphiti: GraphitiClient): Router {
  const router = Router();

  router.post("/", async (req, res) => {
    const parsed = QuerySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      });
      return;
    }

    const data = parsed.data;
    const startTime = Date.now();

    try {
      const rawResults = await graphiti.search({
        query: data.query,
        groupId: data.groupId,
        limit: data.limit,
      });

      // Transform Graphiti results into our ranked citation format
      const results: SearchResult[] = rawResults.map((r, index) => {
        const entities = extractEntities(r.content || r.fact || "");

        // Parse source info from the source_description or name
        const sourceInfo = parseSourceInfo(r.source_description, r.name);

        return {
          content: r.fact || r.content,
          score: r.score ?? computeFallbackScore(index, rawResults.length),
          source: {
            type: sourceInfo.type,
            externalId: r.uuid,
            title: sourceInfo.title || r.name || "Unknown",
            url: sourceInfo.url,
            author: sourceInfo.author,
            timestamp: r.created_at,
          },
          entities,
        };
      });

      // Sort by score descending
      results.sort((a, b) => b.score - a.score);

      // Filter by entity types if requested
      let filtered = results;
      if (data.entityTypes && data.entityTypes.length > 0) {
        const allowedTypes = new Set<EntityType>(data.entityTypes);
        filtered = results.filter((r) =>
          r.entities.some((e) => allowedTypes.has(e.type)),
        );
      }

      // Aggregate entities across all results
      const entityMap = new Map<string, ExtractedEntity>();
      for (const r of filtered) {
        for (const e of r.entities) {
          const key = `${e.type}:${e.name.toLowerCase()}`;
          const existing = entityMap.get(key);
          if (!existing || existing.confidence < e.confidence) {
            entityMap.set(key, e);
          }
        }
      }

      const response: QueryResponse = {
        results: filtered,
        entities: Array.from(entityMap.values()).sort(
          (a, b) => b.confidence - a.confidence,
        ),
        durationMs: Date.now() - startTime,
      };

      res.json(response);
    } catch (err) {
      console.error("Query failed:", err);
      res.status(502).json({
        error: "Failed to query Graphiti",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  });

  return router;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface SourceInfo {
  type: "github_pr" | "linear_ticket" | "message";
  title?: string;
  url?: string;
  author?: string;
}

function parseSourceInfo(
  sourceDescription?: string,
  name?: string,
): SourceInfo {
  const desc = sourceDescription ?? "";
  const n = name ?? "";

  if (n.startsWith("github_pr:") || desc.includes("github_pr")) {
    return { type: "github_pr" };
  }
  if (n.startsWith("linear_ticket:") || desc.includes("linear_ticket")) {
    return { type: "linear_ticket" };
  }
  return { type: "message" };
}

/**
 * When Graphiti doesn't return a score, compute a fallback based on result
 * position (first result gets highest score).
 */
function computeFallbackScore(index: number, total: number): number {
  if (total <= 1) return 1;
  return Math.round((1 - index / total) * 100) / 100;
}
