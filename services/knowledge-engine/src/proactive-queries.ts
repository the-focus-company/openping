import { Router, type Request, type Response } from "express";
import type { Logger } from "pino";
import type { Neo4jClient } from "./neo4j-client";

export function createProactiveQueriesRouter(
  neo4j: Neo4jClient,
  graphitiUrl: string,
  logger: Logger,
): Router {
  const router = Router();
  const log = logger.child({ component: "proactive-queries" });

  /**
   * POST /proactive/fact-check
   * Check a claim against known facts in the knowledge graph.
   * Body: { claim: string, maxFacts?: number }
   *
   * Returns matching facts that may support or contradict the claim.
   */
  router.post("/fact-check", async (req: Request, res: Response) => {
    const { claim, maxFacts = 10 } = req.body;

    if (!claim) {
      res.status(400).json({ error: "claim is required" });
      return;
    }

    try {
      // First, search Graphiti for relevant facts
      const graphitiResults = await searchGraphiti(graphitiUrl, claim, maxFacts, log);

      // Then, search Neo4j directly for entity-level contradictions
      const entityFacts = await neo4j.searchWithRelevance(claim, { limit: maxFacts });

      // Combine results, deduplicate by fact text
      const seen = new Set<string>();
      const allFacts: Array<Record<string, unknown>> = [];

      for (const fact of graphitiResults) {
        const key = String(fact.fact ?? fact.name ?? "");
        if (key && !seen.has(key)) {
          seen.add(key);
          allFacts.push({ ...fact, source: "graphiti" });
        }
      }

      for (const fact of entityFacts) {
        const key = String(fact.fact ?? "");
        if (key && !seen.has(key)) {
          seen.add(key);
          allFacts.push({ ...fact, source: "neo4j-direct" });
        }
      }

      res.json({
        claim,
        factCount: allFacts.length,
        facts: allFacts,
      });
    } catch (err) {
      log.error({ err, claim }, "Fact-check query failed");
      res.status(500).json({ error: "Fact-check query failed" });
    }
  });

  /**
   * POST /proactive/decision-history
   * Retrieve the history of decisions related to a topic or entity.
   * Body: { topic: string, limit?: number }
   */
  router.post("/decision-history", async (req: Request, res: Response) => {
    const { topic, limit = 20 } = req.body;

    if (!topic) {
      res.status(400).json({ error: "topic is required" });
      return;
    }

    const session = neo4j.session();
    try {
      const result = await session.run(
        `
        MATCH (a:Entity)-[r]->(b:Entity)
        WHERE (toLower(r.fact) CONTAINS toLower($topic)
           OR toLower(a.name) CONTAINS toLower($topic)
           OR toLower(b.name) CONTAINS toLower($topic))
          AND (toLower(r.fact) CONTAINS 'decided'
            OR toLower(r.fact) CONTAINS 'agreed'
            OR toLower(r.fact) CONTAINS 'approved'
            OR toLower(r.fact) CONTAINS 'chose'
            OR toLower(r.fact) CONTAINS 'selected'
            OR toLower(r.fact) CONTAINS 'committed'
            OR toLower(r.fact) CONTAINS 'plan'
            OR toLower(r.fact) CONTAINS 'will use'
            OR toLower(r.fact) CONTAINS 'switched'
            OR type(r) = 'DECIDED'
            OR type(r) = 'APPROVED'
            OR type(r) = 'COMMITTED_TO')
        RETURN a.name AS actor, type(r) AS relationship, b.name AS subject,
               r.fact AS decision, r.created_at AS decidedAt
        ORDER BY r.created_at DESC
        LIMIT $limit
        `,
        { topic, limit: parseInt(String(limit), 10) },
      );

      const decisions = result.records.map((record) => ({
        actor: record.get("actor"),
        relationship: record.get("relationship"),
        subject: record.get("subject"),
        decision: record.get("decision"),
        decidedAt: record.get("decidedAt")?.toString(),
      }));

      res.json({ topic, count: decisions.length, decisions });
    } catch (err) {
      log.error({ err, topic }, "Decision history query failed");
      res.status(500).json({ error: "Decision history query failed" });
    } finally {
      await session.close();
    }
  });

  /**
   * POST /proactive/cross-team-sync
   * Find knowledge overlap and gaps between teams/channels.
   * Body: { teams: string[], limit?: number }
   */
  router.post("/cross-team-sync", async (req: Request, res: Response) => {
    const { teams, limit = 30 } = req.body;

    if (!teams || !Array.isArray(teams) || teams.length < 2) {
      res.status(400).json({ error: "teams array with at least 2 entries is required" });
      return;
    }

    const session = neo4j.session();
    try {
      // Find entities that appear in edges from multiple team contexts
      const result = await session.run(
        `
        MATCH (a:Entity)-[r]->(b:Entity)
        WHERE r.source_description IS NOT NULL
        WITH a, b, r,
          [team IN $teams WHERE toLower(r.source_description) CONTAINS toLower(team)] AS matchingTeams
        WHERE size(matchingTeams) >= 1
        WITH a.name AS entity, collect(DISTINCT r.source_description) AS sources,
             collect(DISTINCT r.fact) AS facts,
             collect(DISTINCT matchingTeams) AS teamMatches
        WHERE size(teamMatches) >= 2
        RETURN entity, sources, facts[..5] AS sampleFacts, size(facts) AS totalFacts
        ORDER BY totalFacts DESC
        LIMIT $limit
        `,
        { teams, limit: parseInt(String(limit), 10) },
      );

      const sharedEntities = result.records.map((record) => ({
        entity: record.get("entity"),
        sources: record.get("sources"),
        sampleFacts: record.get("sampleFacts"),
        totalFacts: (record.get("totalFacts") as { toNumber?: () => number })?.toNumber?.() ?? record.get("totalFacts"),
      }));

      // Also find entities unique to each team (potential gaps)
      const teamGaps: Record<string, string[]> = {};
      for (const team of teams) {
        const gapResult = await session.run(
          `
          MATCH (a:Entity)-[r]->(b:Entity)
          WHERE r.source_description IS NOT NULL
            AND toLower(r.source_description) CONTAINS toLower($team)
          WITH a.name AS entity, collect(DISTINCT r.source_description) AS allSources
          WHERE NONE(src IN allSources WHERE
            ANY(otherTeam IN $otherTeams WHERE toLower(src) CONTAINS toLower(otherTeam)))
          RETURN entity
          LIMIT 10
          `,
          { team, otherTeams: teams.filter((t) => t !== team) },
        );
        teamGaps[team] = gapResult.records.map((r) => r.get("entity"));
      }

      res.json({
        teams,
        sharedEntities: { count: sharedEntities.length, entities: sharedEntities },
        teamGaps,
      });
    } catch (err) {
      log.error({ err, teams }, "Cross-team sync query failed");
      res.status(500).json({ error: "Cross-team sync query failed" });
    } finally {
      await session.close();
    }
  });

  /**
   * POST /proactive/blocked-tasks
   * Find dependency chains and blocked tasks from the knowledge graph.
   * Body: { project?: string, person?: string, limit?: number }
   */
  router.post("/blocked-tasks", async (req: Request, res: Response) => {
    const { project, person, limit = 20 } = req.body;

    const session = neo4j.session();
    try {
      const conditions: string[] = [
        `(toLower(r.fact) CONTAINS 'blocked'
          OR toLower(r.fact) CONTAINS 'waiting'
          OR toLower(r.fact) CONTAINS 'depends on'
          OR toLower(r.fact) CONTAINS 'dependency'
          OR toLower(r.fact) CONTAINS 'stuck'
          OR toLower(r.fact) CONTAINS 'need'
          OR type(r) = 'BLOCKED_BY'
          OR type(r) = 'DEPENDS_ON'
          OR type(r) = 'WAITING_FOR')`,
      ];
      const params: Record<string, unknown> = { limit: parseInt(String(limit), 10) };

      if (project) {
        conditions.push(
          "(toLower(a.name) CONTAINS toLower($project) OR toLower(b.name) CONTAINS toLower($project))",
        );
        params.project = project;
      }

      if (person) {
        conditions.push(
          "(toLower(a.name) CONTAINS toLower($person) OR toLower(b.name) CONTAINS toLower($person))",
        );
        params.person = person;
      }

      const result = await session.run(
        `
        MATCH (a:Entity)-[r]->(b:Entity)
        WHERE ${conditions.join(" AND ")}
        RETURN a.name AS blocker, type(r) AS relationship, b.name AS blocked,
               r.fact AS detail, r.created_at AS since
        ORDER BY r.created_at DESC
        LIMIT $limit
        `,
        params,
      );

      const blockers = result.records.map((record) => ({
        blocker: record.get("blocker"),
        relationship: record.get("relationship"),
        blocked: record.get("blocked"),
        detail: record.get("detail"),
        since: record.get("since")?.toString(),
      }));

      // Try to find dependency chains (2-hop)
      const chainResult = await session.run(
        `
        MATCH path = (a:Entity)-[r1]->(b:Entity)-[r2]->(c:Entity)
        WHERE (type(r1) IN ['BLOCKED_BY', 'DEPENDS_ON', 'WAITING_FOR']
            OR toLower(r1.fact) CONTAINS 'blocked'
            OR toLower(r1.fact) CONTAINS 'depends on')
          AND (type(r2) IN ['BLOCKED_BY', 'DEPENDS_ON', 'WAITING_FOR']
            OR toLower(r2.fact) CONTAINS 'blocked'
            OR toLower(r2.fact) CONTAINS 'depends on')
        RETURN a.name AS start, r1.fact AS step1, b.name AS middle,
               r2.fact AS step2, c.name AS end
        LIMIT 10
        `,
      );

      const chains = chainResult.records.map((record) => ({
        start: record.get("start"),
        step1: record.get("step1"),
        middle: record.get("middle"),
        step2: record.get("step2"),
        end: record.get("end"),
      }));

      res.json({
        blockers: { count: blockers.length, items: blockers },
        dependencyChains: { count: chains.length, chains },
      });
    } catch (err) {
      log.error({ err }, "Blocked tasks query failed");
      res.status(500).json({ error: "Blocked tasks query failed" });
    } finally {
      await session.close();
    }
  });

  return router;
}

/**
 * Search Graphiti upstream for facts. Gracefully degrades if Graphiti is unavailable.
 */
async function searchGraphiti(
  graphitiUrl: string,
  query: string,
  maxFacts: number,
  log: Logger,
): Promise<Array<Record<string, unknown>>> {
  try {
    const response = await fetch(`${graphitiUrl}/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, max_facts: maxFacts }),
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      log.warn({ status: response.status }, "Graphiti search returned non-OK status");
      return [];
    }

    const data = await response.json();
    return (data.facts as Array<Record<string, unknown>>) ?? [];
  } catch (err) {
    log.warn({ err }, "Graphiti search unavailable, falling back to Neo4j-only");
    return [];
  }
}
