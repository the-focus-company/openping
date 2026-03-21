/**
 * Entity extraction from integration content.
 *
 * Uses heuristic pattern matching to identify People, Topics, Decisions, and
 * Technologies from PR descriptions, ticket bodies, and messages. This runs
 * locally (no LLM call) for speed; Graphiti's own entity extraction handles
 * the deeper graph-level entities.
 */

import type { ExtractedEntity, EntityType } from "./types.js";

// ---------------------------------------------------------------------------
// Well-known technology terms (lowercase)
// ---------------------------------------------------------------------------

const KNOWN_TECHNOLOGIES = new Set([
  "react",
  "next.js",
  "nextjs",
  "typescript",
  "javascript",
  "node.js",
  "nodejs",
  "express",
  "graphql",
  "rest",
  "docker",
  "kubernetes",
  "k8s",
  "postgres",
  "postgresql",
  "redis",
  "neo4j",
  "graphiti",
  "convex",
  "vercel",
  "fly.io",
  "github",
  "linear",
  "tailwind",
  "tailwindcss",
  "radix",
  "zod",
  "prisma",
  "openai",
  "gpt",
  "python",
  "rust",
  "go",
  "java",
  "swift",
  "kotlin",
  "aws",
  "gcp",
  "azure",
  "terraform",
  "ci/cd",
  "webpack",
  "vite",
  "turbo",
  "turborepo",
  "pnpm",
  "npm",
  "yarn",
  "eslint",
  "prettier",
  "jest",
  "vitest",
  "cypress",
  "playwright",
  "storybook",
  "figma",
  "sentry",
  "datadog",
  "stripe",
  "workos",
  "auth0",
  "supabase",
  "firebase",
  "mongodb",
  "mysql",
  "sqlite",
  "s3",
  "cloudflare",
  "nginx",
  "astro",
  "svelte",
  "vue",
  "angular",
]);

// ---------------------------------------------------------------------------
// Decision-signal phrases
// ---------------------------------------------------------------------------

const DECISION_PATTERNS = [
  /\bdecided\s+to\b/i,
  /\bwe(?:'ll| will)\s+(?:go with|use|adopt|switch to|migrate to)\b/i,
  /\bagreed\s+(?:to|on|that)\b/i,
  /\bapproved\b/i,
  /\bchose\s+to\b/i,
  /\bgoing\s+(?:forward|ahead)\s+with\b/i,
  /\blet(?:'s|s)\s+(?:go with|use|switch)\b/i,
  /\bmerged\b.*\binto\s+main\b/i,
];

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Extract entities from a piece of text content. Returns a deduplicated list
 * sorted by confidence descending.
 */
export function extractEntities(text: string): ExtractedEntity[] {
  if (!text || text.trim().length === 0) return [];

  const entities: Map<string, ExtractedEntity> = new Map();

  function add(name: string, type: EntityType, confidence: number) {
    const key = `${type}:${name.toLowerCase()}`;
    const existing = entities.get(key);
    if (!existing || existing.confidence < confidence) {
      entities.set(key, { name, type, confidence });
    }
  }

  // --- People: @mentions and "Author: Name" patterns ---
  const mentionPattern = /@([a-zA-Z][a-zA-Z0-9_-]{1,38})/g;
  let match: RegExpExecArray | null;
  while ((match = mentionPattern.exec(text)) !== null) {
    add(match[1], "Person", 0.9);
  }

  const authorPattern =
    /(?:author|assignee|reviewer|assigned to|created by|reported by)[:\s]+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?)/gi;
  while ((match = authorPattern.exec(text)) !== null) {
    add(match[1].trim(), "Person", 0.85);
  }

  // --- Technologies ---
  const words = text.toLowerCase().split(/[\s,;:()\[\]{}|/\\]+/);
  for (const word of words) {
    const clean = word.replace(/[.'"!?]+$/, "");
    if (KNOWN_TECHNOLOGIES.has(clean) && clean.length > 1) {
      // Use the properly-cased version from the set iteration
      add(clean, "Technology", 0.8);
    }
  }

  // Also check multi-word technologies
  const lowerText = text.toLowerCase();
  for (const tech of KNOWN_TECHNOLOGIES) {
    if (tech.includes(".") || tech.includes("/") || tech.includes(" ")) {
      if (lowerText.includes(tech)) {
        add(tech, "Technology", 0.8);
      }
    }
  }

  // --- Decisions ---
  for (const pattern of DECISION_PATTERNS) {
    const decisionMatch = pattern.exec(text);
    if (decisionMatch) {
      // Extract the sentence containing the decision
      const idx = decisionMatch.index;
      const sentenceStart = text.lastIndexOf(".", idx - 1) + 1;
      const sentenceEnd = text.indexOf(".", idx + decisionMatch[0].length);
      const sentence = text
        .slice(
          sentenceStart,
          sentenceEnd > 0 ? sentenceEnd + 1 : idx + decisionMatch[0].length + 80,
        )
        .trim();

      if (sentence.length > 10 && sentence.length < 200) {
        add(sentence, "Decision", 0.7);
      }
    }
  }

  // --- Topics: extract hashtags and capitalized noun phrases ---
  const hashtagPattern = /#([a-zA-Z][a-zA-Z0-9_-]{2,30})/g;
  while ((match = hashtagPattern.exec(text)) !== null) {
    add(match[1], "Topic", 0.75);
  }

  return Array.from(entities.values()).sort(
    (a, b) => b.confidence - a.confidence,
  );
}
