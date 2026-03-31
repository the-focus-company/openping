import { NextResponse } from "next/server";
import neo4j, { type Integer } from "neo4j-driver";
import * as Sentry from "@sentry/nextjs";

const NEO4J_URI = process.env.NEO4J_URI ?? "";
const NEO4J_USER = process.env.NEO4J_USER ?? "";
const NEO4J_PASSWORD = process.env.NEO4J_PASSWORD ?? "";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!NEO4J_URI) {
    return NextResponse.json(
      { error: "NEO4J_URI not configured" },
      { status: 500 },
    );
  }

  const driver = neo4j.driver(
    NEO4J_URI,
    neo4j.auth.basic(NEO4J_USER, NEO4J_PASSWORD),
  );

  try {
    const session = driver.session();
    try {
      // Get entity nodes with edge counts
      const nodesResult = await session.run(`
        MATCH (n:Entity)
        OPTIONAL MATCH (n)-[r:RELATES_TO]-(:Entity)
        WITH n, count(r) AS edgeCount
        ORDER BY edgeCount DESC
        LIMIT 200
        RETURN n.uuid AS uuid, n.name AS name, n.summary AS summary,
               n.group_id AS group_id, labels(n) AS labels, edgeCount
      `);

      const nodeUuids = nodesResult.records.map((r) => r.get("uuid") as string);

      // Get edges between visible nodes
      const edgesResult =
        nodeUuids.length > 0
          ? await session.run(
              `
              MATCH (a:Entity)-[r:RELATES_TO]->(b:Entity)
              WHERE a.uuid IN $uuids AND b.uuid IN $uuids
              RETURN DISTINCT a.uuid AS source, b.uuid AS target,
                     type(r) AS relationship, r.fact AS fact,
                     r.created_at AS created_at
              `,
              { uuids: nodeUuids },
            )
          : { records: [] };

      // Stats
      const statsResult = await session.run(`
        MATCH (n:Entity) WITH count(n) AS entityCount
        OPTIONAL MATCH (:Entity)-[r:RELATES_TO]->(:Entity)
        WITH entityCount, count(r) AS edgeCount
        OPTIONAL MATCH (e:Episodic) WITH entityCount, edgeCount, count(e) AS episodeCount
        RETURN entityCount, edgeCount, episodeCount
      `);
      const sr = statsResult.records[0];

      return NextResponse.json({
        nodes: nodesResult.records.map((r) => ({
          uuid: r.get("uuid"),
          name: r.get("name"),
          summary: r.get("summary"),
          group_id: r.get("group_id"),
          labels: r.get("labels"),
          edgeCount: (r.get("edgeCount") as Integer).toNumber(),
        })),
        edges: edgesResult.records.map((r) => ({
          source: r.get("source"),
          target: r.get("target"),
          relationship: r.get("relationship"),
          fact: r.get("fact"),
          created_at: r.get("created_at")?.toString(),
        })),
        stats: {
          entityCount: sr ? (sr.get("entityCount") as Integer).toNumber() : 0,
          edgeCount: sr ? (sr.get("edgeCount") as Integer).toNumber() : 0,
          episodeCount: sr ? (sr.get("episodeCount") as Integer).toNumber() : 0,
        },
      });
    } finally {
      await session.close();
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Neo4j query failed";
    Sentry.captureException(err);
    return NextResponse.json(
      { error: message },
      { status: 500 },
    );
  } finally {
    await driver.close();
  }
}
