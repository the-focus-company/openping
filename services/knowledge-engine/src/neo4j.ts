import neo4j, { Driver, Session } from "neo4j-driver";
import type { Config } from "./config.js";
import { logger } from "./logger.js";

let driver: Driver | null = null;

export function initDriver(config: Config): Driver {
  driver = neo4j.driver(
    config.NEO4J_URI,
    neo4j.auth.basic(config.NEO4J_USER, config.NEO4J_PASSWORD),
  );
  return driver;
}

export function getSession(mode: "READ" | "WRITE" = "WRITE"): Session {
  if (!driver) throw new Error("Neo4j driver not initialized");
  return driver.session({
    defaultAccessMode:
      mode === "READ" ? neo4j.session.READ : neo4j.session.WRITE,
  });
}

export async function setupSchema(dimensions: number): Promise<void> {
  const session = getSession("WRITE");
  try {
    await session.executeWrite(async (tx) => {
      await tx.run(
        "CREATE CONSTRAINT episode_source_id IF NOT EXISTS FOR (e:Episode) REQUIRE e.sourceId IS UNIQUE",
      );
      await tx.run(
        "CREATE CONSTRAINT entity_name_type IF NOT EXISTS FOR (e:Entity) REQUIRE (e.name, e.type) IS UNIQUE",
      );
    });

    await session.executeWrite(async (tx) => {
      await tx.run(
        `CREATE VECTOR INDEX episode_embeddings IF NOT EXISTS
         FOR (e:Episode) ON (e.embedding)
         OPTIONS {
           indexConfig: {
             \`vector.dimensions\`: $dimensions,
             \`vector.similarity_function\`: 'cosine'
           }
         }`,
        { dimensions: neo4j.int(dimensions) },
      );
    });

    await session.executeWrite(async (tx) => {
      await tx.run(
        "CREATE INDEX episode_channel IF NOT EXISTS FOR (e:Episode) ON (e.channel)",
      );
      await tx.run(
        "CREATE INDEX episode_timestamp IF NOT EXISTS FOR (e:Episode) ON (e.timestamp)",
      );
      await tx.run(
        "CREATE INDEX episode_source_type IF NOT EXISTS FOR (e:Episode) ON (e.sourceType)",
      );
      await tx.run(
        "CREATE INDEX entity_type IF NOT EXISTS FOR (e:Entity) ON (e.type)",
      );
    });

    logger.info("Neo4j schema initialized");
  } finally {
    await session.close();
  }
}

export async function checkHealth(): Promise<boolean> {
  if (!driver) return false;
  try {
    await driver.verifyConnectivity();
    return true;
  } catch {
    return false;
  }
}

export async function closeDriver(): Promise<void> {
  if (driver) {
    await driver.close();
    driver = null;
  }
}
