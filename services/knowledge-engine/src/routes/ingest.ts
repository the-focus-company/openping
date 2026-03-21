import { Router } from "express";
import { z } from "zod";
import {
  ingestMessage,
  ingestIntegration,
  ingestBulk,
} from "../services/ingestion.js";

const router = Router();

const messageSchema = z.object({
  content: z.string().min(1),
  author: z.string().min(1),
  channel: z.string().min(1),
  timestamp: z.number(),
  messageId: z.string().min(1),
  workspaceId: z.string().optional(),
});

const integrationSchema = z.object({
  type: z.enum(["github_pr", "linear_ticket"]),
  externalId: z.string().min(1),
  title: z.string().min(1),
  status: z.string(),
  url: z.string(),
  author: z.string(),
  metadata: z.record(z.unknown()),
  workspaceId: z.string().optional(),
});

const bulkSchema = z.object({
  messages: z.array(messageSchema).optional(),
  integrations: z.array(integrationSchema).optional(),
});

router.post("/ingest/message", async (req, res, next) => {
  try {
    const data = messageSchema.parse(req.body);
    const episodeId = await ingestMessage(data);
    res.json({ episodeId });
  } catch (err) {
    next(err);
  }
});

router.post("/ingest/integration", async (req, res, next) => {
  try {
    const data = integrationSchema.parse(req.body);
    const episodeId = await ingestIntegration(data);
    res.json({ episodeId });
  } catch (err) {
    next(err);
  }
});

router.post("/ingest/bulk", async (req, res, next) => {
  try {
    const data = bulkSchema.parse(req.body);
    const result = await ingestBulk(data);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
