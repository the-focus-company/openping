/**
 * Request validation schemas using Zod.
 */

import { z } from "zod";

export const IngestIntegrationSchema = z.object({
  workspaceId: z.string().min(1, "workspaceId is required"),
  type: z.enum(["github_pr", "linear_ticket", "message"]),
  externalId: z.string().min(1, "externalId is required"),
  title: z.string().min(1, "title is required"),
  status: z.string().min(1, "status is required"),
  url: z.string().url("url must be a valid URL"),
  author: z.string().min(1, "author is required"),
  body: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const IngestBatchItemSchema = z.object({
  type: z.enum(["github_pr", "linear_ticket", "message"]),
  externalId: z.string().min(1),
  title: z.string().min(1),
  body: z.string().min(1),
  author: z.string().min(1),
  timestamp: z.string().datetime({ message: "timestamp must be ISO-8601" }),
  metadata: z.record(z.unknown()).optional(),
});

export const IngestBatchSchema = z.object({
  workspaceId: z.string().min(1, "workspaceId is required"),
  groupId: z.string().min(1, "groupId is required"),
  items: z
    .array(IngestBatchItemSchema)
    .min(1, "items must contain at least one item")
    .max(100, "items must contain at most 100 items"),
});

export const QuerySchema = z.object({
  query: z.string().min(1, "query is required"),
  workspaceId: z.string().optional(),
  groupId: z.string().optional(),
  limit: z.number().int().min(1).max(50).optional().default(10),
  entityTypes: z
    .array(z.enum(["Person", "Topic", "Decision", "Technology"]))
    .optional(),
});
