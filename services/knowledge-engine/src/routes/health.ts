import { Router } from "express";
import { checkHealth } from "../neo4j.js";
import type { HealthResponse } from "../types.js";

const router = Router();

router.get("/health", async (_req, res) => {
  const neo4jConnected = await checkHealth();
  const response: HealthResponse = {
    status: neo4jConnected ? "ok" : "degraded",
    neo4j: neo4jConnected ? "connected" : "disconnected",
    timestamp: Date.now(),
  };
  res.status(neo4jConnected ? 200 : 503).json(response);
});

export default router;
