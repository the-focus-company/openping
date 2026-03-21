import neo4j, { Driver, Integer, Session, type Record as Neo4jRecord } from "neo4j-driver";
import type { Logger } from "pino";

export interface EntityNode {
  uuid: string;
  name: string;
  labels: string[];
  properties: Record<string, unknown>;
  createdAt?: string;
}

export interface MergeResult {
  survivorUuid: string;
  mergedUuids: string[];
  mergedEdgeCount: number;
}

export class Neo4jClient {
  private driver: Driver;
  private logger: Logger;

  constructor(uri: string, user: string, password: string, logger: Logger) {
    this.driver = neo4j.driver(uri, neo4j.auth.basic(user, password), {
      maxConnectionPoolSize: 50,
      connectionAcquisitionTimeout: 30_000,
      maxTransactionRetryTime: 15_000,
    });
    this.logger = logger.child({ component: "neo4j" });
  }

  session(database = "neo4j"): Session {
    return this.driver.session({ database });
  }

  async close(): Promise<void> {
    await this.driver.close();
    this.logger.info("Neo4j driver closed");
  }

  async verifyConnectivity(): Promise<boolean> {
    try {
      await this.driver.verifyConnectivity();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Find candidate duplicate entities by name similarity.
   * Uses case-insensitive comparison and Levenshtein distance for fuzzy matching.
   */
  async findDuplicateEntities(
    threshold = 0.8,
    limit = 100,
  ): Promise<Array<{ entity1: EntityNode; entity2: EntityNode; similarity: number }>> {
    const session = this.session();
    try {
      const result = await session.run(
        `
        MATCH (a:Entity), (b:Entity)
        WHERE id(a) < id(b)
          AND a.name IS NOT NULL
          AND b.name IS NOT NULL
        WITH a, b,
          CASE
            WHEN toLower(a.name) = toLower(b.name) THEN 1.0
            WHEN toLower(a.name) CONTAINS toLower(b.name)
              OR toLower(b.name) CONTAINS toLower(a.name) THEN 0.9
            ELSE apoc.text.sorensenDiceSimilarity(toLower(a.name), toLower(b.name))
          END AS similarity
        WHERE similarity >= $threshold
        RETURN a, b, similarity
        ORDER BY similarity DESC
        LIMIT $limit
        `,
        { threshold, limit: neo4j.int(limit) },
      );

      return result.records.map((record: Neo4jRecord) => ({
        entity1: this.nodeToEntity(record.get("a")),
        entity2: this.nodeToEntity(record.get("b")),
        similarity: record.get("similarity"),
      }));
    } finally {
      await session.close();
    }
  }

  /**
   * Merge two entity nodes: transfer all relationships from source to target,
   * then delete the source node.
   */
  async mergeEntities(
    survivorUuid: string,
    duplicateUuid: string,
  ): Promise<MergeResult> {
    const session = this.session();
    try {
      const result = await session.executeWrite(async (tx) => {
        // Transfer incoming relationships
        await tx.run(
          `
          MATCH (dup:Entity {uuid: $duplicateUuid})<-[r]-(other)
          WHERE other.uuid <> $survivorUuid
          MATCH (survivor:Entity {uuid: $survivorUuid})
          CALL apoc.refactor.to(r, survivor) YIELD input, output
          RETURN count(*) as moved
          `,
          { duplicateUuid, survivorUuid },
        );

        // Transfer outgoing relationships
        await tx.run(
          `
          MATCH (dup:Entity {uuid: $duplicateUuid})-[r]->(other)
          WHERE other.uuid <> $survivorUuid
          MATCH (survivor:Entity {uuid: $survivorUuid})
          CALL apoc.refactor.from(r, survivor) YIELD input, output
          RETURN count(*) as moved
          `,
          { duplicateUuid, survivorUuid },
        );

        // Merge properties (keep survivor's values for conflicts)
        await tx.run(
          `
          MATCH (dup:Entity {uuid: $duplicateUuid}), (survivor:Entity {uuid: $survivorUuid})
          SET survivor += dup { .*, uuid: survivor.uuid, name: survivor.name }
          SET survivor.merged_from = coalesce(survivor.merged_from, []) + [$duplicateUuid]
          `,
          { duplicateUuid, survivorUuid },
        );

        // Count edges transferred
        const countResult = await tx.run(
          `
          MATCH (survivor:Entity {uuid: $survivorUuid})-[r]-()
          RETURN count(r) as edgeCount
          `,
          { survivorUuid },
        );

        // Delete the duplicate
        await tx.run(
          `MATCH (dup:Entity {uuid: $duplicateUuid}) DETACH DELETE dup`,
          { duplicateUuid },
        );

        return {
          edgeCount: (countResult.records[0]?.get("edgeCount") as Integer)?.toNumber() ?? 0,
        };
      });

      this.logger.info(
        { survivorUuid, duplicateUuid, edgeCount: result.edgeCount },
        "Entities merged",
      );

      return {
        survivorUuid,
        mergedUuids: [duplicateUuid],
        mergedEdgeCount: result.edgeCount,
      };
    } finally {
      await session.close();
    }
  }

  /**
   * Auto-resolve: find and merge all duplicates above threshold.
   */
  async autoResolveEntities(threshold = 0.85): Promise<MergeResult[]> {
    const duplicates = await this.findDuplicateEntities(threshold, 500);
    const results: MergeResult[] = [];
    const alreadyMerged = new Set<string>();

    for (const { entity1, entity2 } of duplicates) {
      if (alreadyMerged.has(entity1.uuid) || alreadyMerged.has(entity2.uuid)) {
        continue;
      }

      try {
        const result = await this.mergeEntities(entity1.uuid, entity2.uuid);
        results.push(result);
        alreadyMerged.add(entity2.uuid);
      } catch (err) {
        this.logger.warn(
          { err, entity1: entity1.uuid, entity2: entity2.uuid },
          "Failed to merge entities",
        );
      }
    }

    return results;
  }

  /**
   * Temporal query: find facts/edges that were valid at a specific point in time.
   */
  async queryTemporal(params: {
    entityName?: string;
    before?: string;
    after?: string;
    limit?: number;
  }): Promise<Array<Record<string, unknown>>> {
    const session = this.session();
    try {
      const conditions: string[] = [];
      const queryParams: Record<string, unknown> = {
        limit: neo4j.int(params.limit ?? 50),
      };

      if (params.entityName) {
        conditions.push("(toLower(a.name) CONTAINS toLower($entityName) OR toLower(b.name) CONTAINS toLower($entityName))");
        queryParams.entityName = params.entityName;
      }
      if (params.before) {
        conditions.push("r.created_at <= datetime($before)");
        queryParams.before = params.before;
      }
      if (params.after) {
        conditions.push("r.created_at >= datetime($after)");
        queryParams.after = params.after;
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

      const result = await session.run(
        `
        MATCH (a)-[r]->(b)
        ${whereClause}
        RETURN a.name AS source, type(r) AS relationship, b.name AS target,
               r.created_at AS createdAt, r.fact AS fact
        ORDER BY r.created_at DESC
        LIMIT $limit
        `,
        queryParams,
      );

      return result.records.map((record: Neo4jRecord) => ({
        source: record.get("source"),
        relationship: record.get("relationship"),
        target: record.get("target"),
        createdAt: record.get("createdAt")?.toString(),
        fact: record.get("fact"),
      }));
    } finally {
      await session.close();
    }
  }

  /**
   * Relevance-tuned search: boost recent edges and frequently-referenced entities.
   */
  async searchWithRelevance(
    query: string,
    options: { recencyBoost?: number; limit?: number } = {},
  ): Promise<Array<Record<string, unknown>>> {
    const session = this.session();
    const recencyBoost = options.recencyBoost ?? 0.3;
    const limit = options.limit ?? 20;

    try {
      const result = await session.run(
        `
        MATCH (a:Entity)-[r]->(b:Entity)
        WHERE toLower(a.name) CONTAINS toLower($query)
           OR toLower(b.name) CONTAINS toLower($query)
           OR toLower(r.fact) CONTAINS toLower($query)
        WITH a, r, b,
          CASE
            WHEN r.created_at IS NOT NULL
            THEN 1.0 + $recencyBoost * (1.0 / (1.0 + duration.inDays(r.created_at, datetime()).days))
            ELSE 1.0
          END AS relevanceScore
        RETURN a.name AS source, type(r) AS relationship, b.name AS target,
               r.fact AS fact, r.created_at AS createdAt,
               relevanceScore
        ORDER BY relevanceScore DESC
        LIMIT $limit
        `,
        { query, recencyBoost, limit: neo4j.int(limit) },
      );

      return result.records.map((record: Neo4jRecord) => ({
        source: record.get("source"),
        relationship: record.get("relationship"),
        target: record.get("target"),
        fact: record.get("fact"),
        createdAt: record.get("createdAt")?.toString(),
        relevanceScore: record.get("relevanceScore"),
      }));
    } finally {
      await session.close();
    }
  }

  /**
   * Get entity count and edge count for diagnostics.
   */
  async getStats(): Promise<{ entityCount: number; edgeCount: number }> {
    const session = this.session();
    try {
      const result = await session.run(`
        MATCH (n:Entity) WITH count(n) AS entityCount
        OPTIONAL MATCH ()-[r]->() WITH entityCount, count(r) AS edgeCount
        RETURN entityCount, edgeCount
      `);
      const record = result.records[0];
      return {
        entityCount: (record?.get("entityCount") as Integer)?.toNumber() ?? 0,
        edgeCount: (record?.get("edgeCount") as Integer)?.toNumber() ?? 0,
      };
    } finally {
      await session.close();
    }
  }

  private nodeToEntity(node: { properties: Record<string, unknown>; labels: string[] }): EntityNode {
    return {
      uuid: String(node.properties.uuid ?? ""),
      name: String(node.properties.name ?? ""),
      labels: [...node.labels],
      properties: { ...node.properties },
    };
  }
}
