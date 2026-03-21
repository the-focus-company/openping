/**
 * Bulk ingestion ("Memory Magic") — batch processing with progress tracking.
 * Processes items in configurable batch sizes, reports progress, and
 * tracks failures per item.
 */

import { v4 as uuidv4 } from "uuid";
import { ingestMessage } from "./graphiti-client.js";
import type {
  BulkIngestItem,
  BulkIngestRequest,
  BulkJobProgress,
} from "./types.js";

/** In-flight and completed bulk jobs. */
const jobs = new Map<string, BulkJobProgress>();

/** How many items to send to Graphiti per batch. */
const BATCH_SIZE = 10;

/** Max jobs to retain in memory. */
const MAX_RETAINED_JOBS = 100;

export function getJobProgress(jobId: string): BulkJobProgress | undefined {
  return jobs.get(jobId);
}

export function listJobs(): BulkJobProgress[] {
  return Array.from(jobs.values()).sort(
    (a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime(),
  );
}

/**
 * Start a bulk ingestion job. Returns the job ID immediately;
 * processing happens asynchronously.
 */
export function startBulkIngest(request: BulkIngestRequest): string {
  const jobId = uuidv4();

  const progress: BulkJobProgress = {
    job_id: jobId,
    status: "pending",
    total: request.items.length,
    processed: 0,
    failed: 0,
    errors: [],
    started_at: new Date().toISOString(),
  };

  jobs.set(jobId, progress);
  evictOldJobs();

  processBulkJob(jobId, request).catch((err) => {
    const job = jobs.get(jobId);
    if (job) {
      job.status = "failed";
      job.errors.push({ index: -1, error: String(err) });
      job.completed_at = new Date().toISOString();
    }
  });

  return jobId;
}

async function processBulkJob(
  jobId: string,
  request: BulkIngestRequest,
): Promise<void> {
  const job = jobs.get(jobId);
  if (!job) return;

  job.status = "processing";

  const { items, group_id } = request;

  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map((item, batchIdx) =>
        ingestSingleItem(item, group_id).then((result) => ({
          globalIdx: i + batchIdx,
          success: result.success,
          error: result.error,
        })),
      ),
    );

    for (const result of results) {
      job.processed++;
      if (result.status === "rejected") {
        job.failed++;
        job.errors.push({
          index: job.processed - 1,
          error: String(result.reason),
        });
      } else if (!result.value.success) {
        job.failed++;
        job.errors.push({
          index: result.value.globalIdx,
          error: result.value.error ?? "Unknown error",
        });
      }
    }
  }

  job.status = job.failed > 0 && job.failed === job.total ? "failed" : "completed";
  job.completed_at = new Date().toISOString();
}

async function ingestSingleItem(
  item: BulkIngestItem,
  defaultGroupId?: string,
): Promise<{ success: boolean; error?: string }> {
  const groupId = item.group_id ?? defaultGroupId ?? "default";

  const result = await ingestMessage({
    group_id: groupId,
    messages: [
      {
        content: item.content,
        role_type: item.role_type,
        role: item.role,
        timestamp: item.timestamp,
        source_description: item.source_description,
        uuid: item.uuid,
        name: item.name,
      },
    ],
  });

  return result;
}

function evictOldJobs(): void {
  if (jobs.size <= MAX_RETAINED_JOBS) return;

  const sorted = Array.from(jobs.entries()).sort(
    ([, a], [, b]) =>
      new Date(a.started_at).getTime() - new Date(b.started_at).getTime(),
  );

  const toRemove = sorted.slice(0, jobs.size - MAX_RETAINED_JOBS);
  for (const [id] of toRemove) {
    jobs.delete(id);
  }
}
