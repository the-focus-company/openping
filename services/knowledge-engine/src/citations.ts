/**
 * Citation formatting with relevance scores.
 * Transforms raw Graphiti facts into structured citations
 * suitable for display in the PING frontend.
 */

import type { Citation, Fact } from "./types.js";

/**
 * Simple relevance scoring based on keyword overlap between the query
 * and a fact's text. Returns a score between 0 and 1.
 */
export function computeRelevanceScore(query: string, fact: Fact): number {
  const queryTerms = tokenize(query);
  if (queryTerms.length === 0) return 0;

  const factTerms = new Set(tokenize(fact.fact));
  const nameTerms = new Set(tokenize(fact.name));

  let matchCount = 0;
  for (const term of queryTerms) {
    if (factTerms.has(term) || nameTerms.has(term)) {
      matchCount++;
    }
  }

  return matchCount / queryTerms.length;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2);
}

/**
 * Convert facts into citations with relevance scores, sorted by relevance.
 */
export function formatCitations(
  facts: Fact[],
  query: string,
  includeScores: boolean,
): Citation[] {
  const scored = facts.map((fact) => {
    const score = computeRelevanceScore(query, fact);
    return {
      fact,
      score,
    };
  });

  // Sort by relevance (highest first)
  scored.sort((a, b) => b.score - a.score);

  return scored.map(({ fact, score }) => {
    const citation: Citation = {
      text: fact.fact,
      source_title: fact.name,
    };

    if (includeScores) {
      citation.relevance_score = Math.round(score * 1000) / 1000;
    }

    return citation;
  });
}

/**
 * Return a copy of facts with relevance scores attached, sorted by relevance.
 */
export function scoreFacts(facts: Fact[], query: string): Fact[] {
  return facts
    .map((fact) => ({
      ...fact,
      relevance_score: Math.round(computeRelevanceScore(query, fact) * 1000) / 1000,
    }))
    .sort((a, b) => (b.relevance_score ?? 0) - (a.relevance_score ?? 0));
}
