import { Router } from "express";
import { z } from "zod";
import { searchKnowledge } from "../services/search.js";

const router = Router();

const querySchema = z.object({
  query: z.string().min(1),
  channelId: z.string().optional(),
  workspaceId: z.string().optional(),
  temporalFilter: z
    .object({
      from: z.number().optional(),
      to: z.number().optional(),
    })
    .optional(),
  limit: z.number().min(1).max(50).default(10),
});

router.post("/query", async (req, res, next) => {
  try {
    const params = querySchema.parse(req.body);
    const results = await searchKnowledge(params);
    res.json({ results });
  } catch (err) {
    next(err);
  }
});

export default router;
