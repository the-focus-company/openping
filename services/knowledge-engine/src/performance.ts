/**
 * Performance testing utilities for measuring query latency
 * with large episode counts.
 */

import { searchFacts } from "./graphiti-client.js";
import type { PerformanceResult } from "./types.js";

const SAMPLE_QUERIES = [
  "What are the recent changes?",
  "Who is working on what?",
  "What decisions were made last week?",
  "Are there any blockers?",
  "What was discussed in the last meeting?",
];

/**
 * Run a performance test suite against the knowledge graph.
 * Measures query latency and reports results.
 */
export async function runPerformanceTest(options?: {
  queries?: string[];
  group_ids?: string[];
  max_facts?: number;
  iterations?: number;
}): Promise<{
  results: PerformanceResult[];
  summary: {
    avg_latency_ms: number;
    p50_latency_ms: number;
    p95_latency_ms: number;
    max_latency_ms: number;
    min_latency_ms: number;
    total_queries: number;
  };
}> {
  const queries = options?.queries ?? SAMPLE_QUERIES;
  const iterations = options?.iterations ?? 3;
  const results: PerformanceResult[] = [];

  for (const query of queries) {
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      const { facts } = await searchFacts({
        query,
        group_ids: options?.group_ids,
        max_facts: options?.max_facts ?? 10,
      });
      const latency = performance.now() - start;

      results.push({
        query,
        latency_ms: Math.round(latency * 100) / 100,
        episode_count: 0, // Not available from search response
        fact_count: facts.length,
      });
    }
  }

  const latencies = results.map((r) => r.latency_ms).sort((a, b) => a - b);
  const sum = latencies.reduce((a, b) => a + b, 0);

  return {
    results,
    summary: {
      avg_latency_ms: Math.round((sum / latencies.length) * 100) / 100,
      p50_latency_ms: latencies[Math.floor(latencies.length * 0.5)],
      p95_latency_ms: latencies[Math.floor(latencies.length * 0.95)],
      max_latency_ms: latencies[latencies.length - 1],
      min_latency_ms: latencies[0],
      total_queries: results.length,
    },
  };
}
