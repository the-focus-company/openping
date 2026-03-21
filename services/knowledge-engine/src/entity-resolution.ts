import { Router, type Request, type Response } from "express";
import type { Logger } from "pino";
import type { Neo4jClient } from "./neo4j-client";

export function createEntityResolutionRouter(
  neo4j: Neo4jClient,
  graphitiUrl: string,
  logger: Logger,
): Router {
  const router = Router();
  const log = logger.child({ component: "entity-resolution" });

  /**
   * GET /entities/duplicates
   * Find candidate duplicate entities by name similarity.
   */
  router.get("/duplicates", async (req: Request, res: Response) => {
    const threshold = parseFloat(String(req.query.threshold ?? "0.8"));
    const limit = parseInt(String(req.query.limit ?? "100"), 10);

    try {
      const duplicates = await neo4j.findDuplicateEntities(threshold, limit);
      res.json({
        count: duplicates.length,
        threshold,
        duplicates: duplicates.map((d) => ({
          entity1: { uuid: d.entity1.uuid, name: d.entity1.name },
          entity2: { uuid: d.entity2.uuid, name: d.entity2.name },
          similarity: d.similarity,
        })),
      });
    } catch (err) {
      log.error({ err }, "Failed to find duplicates");
      res.status(500).json({ error: "Failed to find duplicate entities" });
    }
  });

  /**
   * POST /entities/merge
   * Merge two entities (transfer relationships, delete duplicate).
   * Body: { survivorUuid, duplicateUuid }
   */
  router.post("/merge", async (req: Request, res: Response) => {
    const { survivorUuid, duplicateUuid } = req.body;

    if (!survivorUuid || !duplicateUuid) {
      res.status(400).json({ error: "survivorUuid and duplicateUuid are required" });
      return;
    }

    try {
      const result = await neo4j.mergeEntities(survivorUuid, duplicateUuid);
      log.info({ result }, "Entities merged");
      res.json(result);
    } catch (err) {
      log.error({ err, survivorUuid, duplicateUuid }, "Merge failed");
      res.status(500).json({ error: "Failed to merge entities" });
    }
  });

  /**
   * POST /entities/auto-resolve
   * Automatically find and merge all duplicate entities above a similarity threshold.
   * Body: { threshold?: number }
   */
  router.post("/auto-resolve", async (req: Request, res: Response) => {
    const threshold = parseFloat(String(req.body.threshold ?? "0.85"));

    try {
      log.info({ threshold }, "Starting auto-resolution");
      const results = await neo4j.autoResolveEntities(threshold);
      log.info({ mergedCount: results.length }, "Auto-resolution complete");
      res.json({
        mergedCount: results.length,
        results,
      });
    } catch (err) {
      log.error({ err }, "Auto-resolve failed");
      res.status(500).json({ error: "Auto-resolve failed" });
    }
  });

  /**
   * GET /entities/temporal
   * Query facts/edges at a specific point in time or within a time range.
   * Query params: entityName, before (ISO date), after (ISO date), limit
   */
  router.get("/temporal", async (req: Request, res: Response) => {
    try {
      const results = await neo4j.queryTemporal({
        entityName: req.query.entityName as string | undefined,
        before: req.query.before as string | undefined,
        after: req.query.after as string | undefined,
        limit: req.query.limit ? parseInt(String(req.query.limit), 10) : undefined,
      });
      res.json({ count: results.length, results });
    } catch (err) {
      log.error({ err }, "Temporal query failed");
      res.status(500).json({ error: "Temporal query failed" });
    }
  });

  /**
   * POST /entities/search
   * Relevance-tuned search across the knowledge graph.
   * Body: { query, recencyBoost?, limit? }
   */
  router.post("/search", async (req: Request, res: Response) => {
    const { query, recencyBoost, limit } = req.body;

    if (!query) {
      res.status(400).json({ error: "query is required" });
      return;
    }

    try {
      const results = await neo4j.searchWithRelevance(query, { recencyBoost, limit });
      res.json({ count: results.length, results });
    } catch (err) {
      log.error({ err }, "Search failed");
      res.status(500).json({ error: "Search failed" });
    }
  });

  /**
   * GET /entities/stats
   * Get entity and edge counts.
   */
  router.get("/stats", async (_req: Request, res: Response) => {
    try {
      const stats = await neo4j.getStats();
      res.json(stats);
    } catch (err) {
      log.error({ err }, "Stats query failed");
      res.status(500).json({ error: "Failed to get stats" });
    }
  });

  return router;
}
