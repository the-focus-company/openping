/**
 * Temporal filter utilities for date-range scoping of knowledge graph facts.
 * Supports filtering facts by valid_at/invalid_at date ranges.
 */

import type { Fact } from "./types.js";

interface DateRange {
  from?: Date;
  to?: Date;
}

/**
 * Parse optional ISO date strings into a DateRange.
 * Returns undefined fields if the string is missing or invalid.
 */
export function parseDateRange(
  dateFrom?: string,
  dateTo?: string,
): DateRange {
  const range: DateRange = {};

  if (dateFrom) {
    const parsed = new Date(dateFrom);
    if (!isNaN(parsed.getTime())) {
      range.from = parsed;
    }
  }

  if (dateTo) {
    const parsed = new Date(dateTo);
    if (!isNaN(parsed.getTime())) {
      range.to = parsed;
    }
  }

  return range;
}

/**
 * Filter facts by a temporal date range.
 *
 * A fact passes the filter if:
 * - Its valid_at date is >= range.from (if from is specified)
 * - Its valid_at date is <= range.to (if to is specified)
 * - It has not been superseded (invalid_at is null) OR
 *   its invalid_at date is >= range.from (it was valid during the range)
 *
 * Facts without a valid_at always pass the temporal filter (undated facts).
 */
export function filterByDateRange(facts: Fact[], range: DateRange): Fact[] {
  if (!range.from && !range.to) return facts;

  return facts.filter((fact) => {
    // Undated facts always pass
    if (!fact.valid_at) return true;

    const validAt = new Date(fact.valid_at);
    if (isNaN(validAt.getTime())) return true;

    // Check if valid_at is within the range
    if (range.from && validAt < range.from) {
      // The fact became valid before the range start.
      // Still include it if it was valid through the range
      // (i.e., it wasn't invalidated before range.from).
      if (fact.invalid_at) {
        const invalidAt = new Date(fact.invalid_at);
        if (!isNaN(invalidAt.getTime()) && invalidAt < range.from) {
          return false;
        }
      }
    }

    if (range.to && validAt > range.to) {
      return false;
    }

    return true;
  });
}
