import { getSession } from "../neo4j.js";
import { generateEmbedding } from "../openai.js";
import { getConfig } from "../config.js";
import type { QueryRequest, QueryResult } from "../types.js";

export async function searchKnowledge(
  params: QueryRequest,
): Promise<QueryResult[]> {
  const config = getConfig();
  const limit = Math.min(params.limit ?? config.VECTOR_SEARCH_TOP_K, 50);
  const topK = limit * 3; // Over-fetch since Neo4j vector has no pre-filtering

  const queryEmbedding = await generateEmbedding(params.query);

  const session = getSession("READ");
  try {
    const result = await session.executeRead(async (tx) => {
      return tx.run(
        `CALL db.index.vector.queryNodes('episode_embeddings', $topK, $queryEmbedding)
         YIELD node AS e, score
         WHERE ($channelId IS NULL OR e.channel = $channelId)
           AND ($workspaceId IS NULL OR e.workspaceId = $workspaceId)
           AND ($fromTs IS NULL OR e.timestamp >= $fromTs)
           AND ($toTs IS NULL OR e.timestamp <= $toTs)
         OPTIONAL MATCH (e)-[:MENTIONS]->(ent:Entity)
         RETURN e.sourceType AS sourceType,
                e.sourceId AS sourceId,
                e.content AS content,
                e.author AS author,
                e.timestamp AS timestamp,
                score,
                collect(DISTINCT ent.name) AS entities
         ORDER BY score DESC
         LIMIT $limit`,
        {
          topK,
          queryEmbedding,
          channelId: params.channelId ?? null,
          workspaceId: params.workspaceId ?? null,
          fromTs: params.temporalFilter?.from ?? null,
          toTs: params.temporalFilter?.to ?? null,
          limit,
        },
      );
    });

    return result.records.map((record) => {
      const content = record.get("content") as string;
      return {
        sourceType: record.get("sourceType") as QueryResult["sourceType"],
        sourceId: record.get("sourceId") as string,
        snippet: content.length > 200 ? content.slice(0, 200) + "..." : content,
        author: record.get("author") as string,
        timestamp: (record.get("timestamp") as number) ?? 0,
        relevanceScore: record.get("score") as number,
        entities: (record.get("entities") as string[]).filter(Boolean),
      };
    });
  } finally {
    await session.close();
  }
}
