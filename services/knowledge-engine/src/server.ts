/**
 * Knowledge Engine Express server.
 *
 * Wraps Graphiti + Neo4j with endpoints for integration ingestion, batch
 * ingestion, and knowledge graph search with citations.
 */

import express from "express";
import { loadConfig } from "./config.js";
import { GraphitiClient } from "./graphiti-client.js";
import { createIngestRouter } from "./routes/ingest.js";
import { createQueryRouter } from "./routes/query.js";

const config = loadConfig();
const app = express();
const graphiti = new GraphitiClient(config);

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

app.use(express.json({ limit: "2mb" }));

// Request logging
app.use((req, _res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

// ---------------------------------------------------------------------------
// Health
// ---------------------------------------------------------------------------

app.get("/health", async (_req, res) => {
  const graphitiOk = await graphiti.healthcheck();
  const status = graphitiOk ? "healthy" : "degraded";

  res.status(graphitiOk ? 200 : 503).json({
    status,
    service: "knowledge-engine",
    graphiti: graphitiOk ? "connected" : "unreachable",
    uptime: process.uptime(),
  });
});

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

app.use("/ingest", createIngestRouter(graphiti));
app.use("/query", createQueryRouter(graphiti));

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------

app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    console.error("Unhandled error:", err);
    res.status(500).json({
      error: "Internal server error",
      message:
        process.env.NODE_ENV === "production"
          ? "An unexpected error occurred"
          : err.message,
    });
  },
);

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

app.listen(config.port, () => {
  console.log(`Knowledge Engine listening on port ${config.port}`);
  console.log(`Graphiti upstream: ${config.graphitiUrl}`);
  console.log(`Neo4j: ${config.neo4jUri}`);
});

export default app;
