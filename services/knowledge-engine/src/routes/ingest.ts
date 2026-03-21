/**
 * POST /ingest/integration — single integration item ingestion
 * POST /ingest/batch      — batch ingestion for message bursts
 */

import { Router } from "express";
import type { GraphitiClient } from "../graphiti-client.js";
import { extractEntities } from "../entities.js";
import {
  IngestIntegrationSchema,
  IngestBatchSchema,
} from "../validation.js";
import type { ExtractedEntity } from "../types.js";

export function createIngestRouter(graphiti: GraphitiClient): Router {
  const router = Router();

  // -------------------------------------------------------------------------
  // POST /ingest/integration
  // -------------------------------------------------------------------------
  router.post("/integration", async (req, res) => {
    const parsed = IngestIntegrationSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      });
      return;
    }

    const data = parsed.data;

    // Build rich content string for Graphiti episode
    const contentParts: string[] = [
      `[${data.type}] ${data.title}`,
      `Status: ${data.status}`,
      `Author: ${data.author}`,
      `URL: ${data.url}`,
    ];

    if (data.body) {
      contentParts.push("", data.body);
    }

    // Include select metadata fields for richer context
    if (data.metadata) {
      const meta = data.metadata;
      if (meta.repo) contentParts.push(`Repository: ${meta.repo as string}`);
      if (meta.baseBranch)
        contentParts.push(
          `Branch: ${meta.headBranch as string} -> ${meta.baseBranch as string}`,
        );
      if (meta.reviewers)
        contentParts.push(
          `Reviewers: ${(meta.reviewers as string[]).join(", ")}`,
        );
      if (meta.labels)
        contentParts.push(`Labels: ${(meta.labels as string[]).join(", ")}`);
      if (meta.teamKey)
        contentParts.push(`Team: ${meta.teamKey as string}`);
      if (meta.priority != null)
        contentParts.push(`Priority: ${meta.priority}`);
      if (meta.assignee)
        contentParts.push(`Assignee: ${meta.assignee as string}`);

      // Include comments for deeper context
      if (Array.isArray(meta.comments)) {
        contentParts.push("", "--- Comments ---");
        for (const c of meta.comments.slice(0, 20)) {
          const comment = c as { author: string; body: string };
          contentParts.push(`${comment.author}: ${comment.body}`);
        }
      }
    }

    const content = contentParts.join("\n");

    // Extract entities locally
    const entities: ExtractedEntity[] = extractEntities(content);

    try {
      const episode = await graphiti.createEpisode({
        name: `${data.type}:${data.externalId}`,
        content,
        source: data.type,
        sourceDescription: `${data.type} from workspace ${data.workspaceId}`,
        groupId: data.workspaceId,
      });

      res.status(201).json({
        episodeId: episode.uuid,
        entities,
        contentLength: content.length,
      });
    } catch (err) {
      console.error("Failed to ingest integration:", err);
      res.status(502).json({
        error: "Failed to create episode in Graphiti",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  });

  // -------------------------------------------------------------------------
  // POST /ingest/batch
  // -------------------------------------------------------------------------
  router.post("/batch", async (req, res) => {
    const parsed = IngestBatchSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      });
      return;
    }

    const data = parsed.data;

    // Concatenate items into a single coherent episode for the burst
    const contentParts: string[] = [
      `Batch of ${data.items.length} items in group ${data.groupId}`,
      `Workspace: ${data.workspaceId}`,
      "",
    ];

    const allEntities: Map<string, ExtractedEntity> = new Map();
    const results: Array<{
      externalId: string;
      status: "ok" | "error";
      episodeId?: string;
      error?: string;
    }> = [];

    // Process items in chunks of 10 to avoid overwhelming Graphiti
    const CHUNK_SIZE = 10;
    for (let i = 0; i < data.items.length; i += CHUNK_SIZE) {
      const chunk = data.items.slice(i, i + CHUNK_SIZE);

      const promises = chunk.map(async (item) => {
        const itemContent = [
          `[${item.type}] ${item.title}`,
          `Author: ${item.author}`,
          `Time: ${item.timestamp}`,
          "",
          item.body,
        ].join("\n");

        // Extract entities per item
        const entities = extractEntities(itemContent);
        for (const e of entities) {
          const key = `${e.type}:${e.name.toLowerCase()}`;
          const existing = allEntities.get(key);
          if (!existing || existing.confidence < e.confidence) {
            allEntities.set(key, e);
          }
        }

        try {
          const episode = await graphiti.createEpisode({
            name: `${item.type}:${item.externalId}`,
            content: itemContent,
            source: item.type,
            sourceDescription: `Batch item from workspace ${data.workspaceId}`,
            groupId: data.groupId,
          });

          return {
            externalId: item.externalId,
            status: "ok" as const,
            episodeId: episode.uuid,
          };
        } catch (err) {
          console.error(
            `Failed to ingest batch item ${item.externalId}:`,
            err,
          );
          return {
            externalId: item.externalId,
            status: "error" as const,
            error: err instanceof Error ? err.message : String(err),
          };
        }
      });

      const chunkResults = await Promise.allSettled(promises);
      for (const r of chunkResults) {
        if (r.status === "fulfilled") {
          results.push(r.value);
        } else {
          results.push({
            externalId: "unknown",
            status: "error",
            error: r.reason instanceof Error ? r.reason.message : String(r.reason),
          });
        }
      }
    }

    const succeeded = results.filter((r) => r.status === "ok").length;
    const failed = results.filter((r) => r.status === "error").length;

    res.status(failed === results.length ? 502 : 201).json({
      total: results.length,
      succeeded,
      failed,
      results,
      entities: Array.from(allEntities.values()).sort(
        (a, b) => b.confidence - a.confidence,
      ),
    });
  });

  return router;
}
