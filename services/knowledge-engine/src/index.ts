import express from "express";
import pino from "pino";
import { createEntityResolutionRouter } from "./entity-resolution.js";
import { createProactiveQueriesRouter } from "./proactive-queries.js";
import { Neo4jClient } from "./neo4j-client.js";

const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
});

const app = express();
app.use(express.json({ limit: "10mb" }));

// CORS for frontend
app.use((_req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  next();
});

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "knowledge-engine", timestamp: new Date().toISOString() });
});

// Graphiti upstream URL — the Zep Graphiti container
const GRAPHITI_URL = process.env.GRAPHITI_API_URL ?? "http://localhost:8000";
const NEO4J_URI = process.env.NEO4J_URI ?? "bolt://localhost:7687";
const NEO4J_USER = process.env.NEO4J_USER ?? "neo4j";
const NEO4J_PASSWORD = process.env.NEO4J_PASSWORD;
if (!NEO4J_PASSWORD) throw new Error("NEO4J_PASSWORD environment variable is required");

const neo4j = new Neo4jClient(NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD, logger);

// Mount routers
app.use("/entities", createEntityResolutionRouter(neo4j, GRAPHITI_URL, logger));
app.use("/proactive", createProactiveQueriesRouter(neo4j, GRAPHITI_URL, logger));

// Graph visualization endpoint — returns nodes + edges for the frontend
app.get("/graph", async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 200, 500);
    const data = await neo4j.getGraphData(limit);
    res.json(data);
  } catch (err) {
    logger.error({ err }, "Failed to get graph data");
    res.status(500).json({ error: "Failed to fetch graph data" });
  }
});

// Proxy pass-through to Graphiti for standard endpoints
app.all("/graphiti/*", async (req, res) => {
  const targetPath = req.path.replace(/^\/graphiti\//, "");
  try {
    const response = await fetch(`${GRAPHITI_URL}/${targetPath}`, {
      method: req.method,
      headers: { "Content-Type": "application/json" },
      ...(req.method !== "GET" && req.method !== "HEAD"
        ? { body: JSON.stringify(req.body) }
        : {}),
    });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    logger.error({ err, targetPath }, "Graphiti proxy error");
    res.status(502).json({ error: "Graphiti upstream unavailable" });
  }
});

// Graceful shutdown
async function shutdown() {
  logger.info("Shutting down knowledge-engine...");
  await neo4j.close();
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

const PORT = parseInt(process.env.PORT ?? "8001", 10);
app.listen(PORT, () => {
  logger.info({ port: PORT, graphitiUrl: GRAPHITI_URL }, "Knowledge engine started");
});

export default app;
