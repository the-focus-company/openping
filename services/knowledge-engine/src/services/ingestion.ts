import { getSession } from "../neo4j.js";
import { generateEmbedding, extractEntities } from "../openai.js";
import { getConfig } from "../config.js";
import { logger } from "../logger.js";
import type {
  IngestMessageRequest,
  IngestIntegrationRequest,
  IngestBulkRequest,
  BulkIngestResponse,
  ExtractedEntity,
} from "../types.js";

async function createEpisodeWithEntities(
  sourceId: string,
  sourceType: string,
  content: string,
  author: string,
  channel: string,
  timestamp: number,
  embedding: number[],
  entities: ExtractedEntity[],
  workspaceId?: string,
): Promise<string> {
  const session = getSession("WRITE");
  try {
    const result = await session.executeWrite(async (tx) => {
      const episodeResult = await tx.run(
        `MERGE (e:Episode {sourceId: $sourceId})
         SET e.sourceType = $sourceType,
             e.content = $content,
             e.author = $author,
             e.channel = $channel,
             e.timestamp = $timestamp,
             e.embedding = $embedding,
             e.workspaceId = $workspaceId,
             e.updatedAt = timestamp()
         RETURN elementId(e) AS episodeId`,
        {
          sourceId,
          sourceType,
          content,
          author,
          channel,
          timestamp,
          embedding,
          workspaceId: workspaceId ?? null,
        },
      );

      const episodeId = episodeResult.records[0].get("episodeId") as string;

      // Author relationship
      await tx.run(
        `MERGE (p:Entity {name: $author, type: 'Person'})
         ON CREATE SET p.createdAt = timestamp()
         WITH p
         MATCH (e:Episode {sourceId: $sourceId})
         MERGE (e)-[:AUTHORED_BY]->(p)`,
        { author, sourceId },
      );

      // Entity relationships
      for (const entity of entities) {
        await tx.run(
          `MERGE (ent:Entity {name: $name, type: $type})
           ON CREATE SET ent.createdAt = timestamp()
           WITH ent
           MATCH (e:Episode {sourceId: $sourceId})
           MERGE (e)-[:MENTIONS]->(ent)`,
          { name: entity.name, type: entity.type, sourceId },
        );
      }

      return episodeId;
    });

    return result;
  } finally {
    await session.close();
  }
}

export async function ingestMessage(
  data: IngestMessageRequest,
): Promise<string> {
  const embedding = await generateEmbedding(data.content);
  const entities = await extractEntities(data.content);

  return createEpisodeWithEntities(
    data.messageId,
    "message",
    data.content,
    data.author,
    data.channel,
    data.timestamp,
    embedding,
    entities,
    data.workspaceId,
  );
}

export async function ingestIntegration(
  data: IngestIntegrationRequest,
): Promise<string> {
  const content = `${data.title}\nStatus: ${data.status}\nAuthor: ${data.author}`;
  const embedding = await generateEmbedding(content);
  const entities = await extractEntities(data.title);

  return createEpisodeWithEntities(
    data.externalId,
    data.type,
    content,
    data.author,
    "",
    Date.now(),
    embedding,
    entities,
    data.workspaceId,
  );
}

export async function ingestBulk(
  data: IngestBulkRequest,
): Promise<BulkIngestResponse> {
  const config = getConfig();
  const items: Array<{ type: "message" | "integration"; data: IngestMessageRequest | IngestIntegrationRequest }> = [];

  for (const m of data.messages ?? []) items.push({ type: "message", data: m });
  for (const i of data.integrations ?? []) items.push({ type: "integration", data: i });

  const episodeIds: string[] = [];

  for (let i = 0; i < items.length; i += config.MAX_BATCH_SIZE) {
    const batch = items.slice(i, i + config.MAX_BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map((item) =>
        item.type === "message"
          ? ingestMessage(item.data as IngestMessageRequest)
          : ingestIntegration(item.data as IngestIntegrationRequest),
      ),
    );

    for (const result of results) {
      if (result.status === "fulfilled") {
        episodeIds.push(result.value);
      } else {
        logger.error({ err: result.reason }, "Batch item failed");
      }
    }
  }

  return { processed: episodeIds.length, episodeIds };
}
