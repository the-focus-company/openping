/**
 * Configuration loaded from environment variables.
 */

export interface Config {
  port: number;
  graphitiUrl: string;
  neo4jUri: string;
  neo4jUser: string;
  neo4jPassword: string;
}

export function loadConfig(): Config {
  return {
    port: parseInt(process.env.PORT ?? "3210", 10),
    graphitiUrl: process.env.GRAPHITI_URL ?? "http://localhost:8000",
    neo4jUri: process.env.NEO4J_URI ?? "bolt://localhost:7687",
    neo4jUser: process.env.NEO4J_USER ?? "neo4j",
    neo4jPassword: (() => {
      const p = process.env.NEO4J_PASSWORD;
      if (!p) throw new Error("NEO4J_PASSWORD environment variable is required");
      return p;
    })(),
  };
}
