/**
 * Cross-source entity mapping: fuzzy matching people by name/email
 * across GitHub, Linear, and PING sources.
 */

import type { EntityMapping, PersonEntity } from "./types.js";

/** In-memory entity registry. */
const entityRegistry: PersonEntity[] = [];
let cachedMappings: EntityMapping[] | null = null;

export function registerEntity(entity: PersonEntity): void {
  if (!isDuplicate(entity)) {
    entityRegistry.push(entity);
    cachedMappings = null;
  }
}

export function registerEntities(entities: PersonEntity[]): void {
  let added = false;
  for (const entity of entities) {
    if (!isDuplicate(entity)) {
      entityRegistry.push(entity);
      added = true;
    }
  }
  if (added) {
    cachedMappings = null;
  }
}

/** Skip exact duplicates (same name + source + emails). */
function isDuplicate(entity: PersonEntity): boolean {
  return entityRegistry.some(
    (e) =>
      e.name === entity.name &&
      e.source === entity.source &&
      e.emails.length === entity.emails.length &&
      e.emails.every((email, i) => entity.emails[i] === email),
  );
}

export function getEntityMappings(): EntityMapping[] {
  if (cachedMappings) return cachedMappings;

  cachedMappings = buildMappings(entityRegistry);
  return cachedMappings;
}

export function findEntity(
  nameOrEmail: string,
): EntityMapping | undefined {
  const mappings = getEntityMappings();
  const needle = nameOrEmail.toLowerCase().trim();

  return mappings.find(
    (m) =>
      m.canonical_name.toLowerCase() === needle ||
      m.aliases.some((a) => a.toLowerCase() === needle) ||
      m.emails.some((e) => e.toLowerCase() === needle),
  );
}

export function clearEntityRegistry(): void {
  entityRegistry.length = 0;
  cachedMappings = null;
}

function buildMappings(entities: PersonEntity[]): EntityMapping[] {
  const groups: Array<{
    names: Set<string>;
    emails: Set<string>;
    sources: Array<{ source: string; external_id?: string }>;
  }> = [];

  for (const entity of entities) {
    const matchIdx = findMatchingGroup(groups, entity);

    if (matchIdx >= 0) {
      const group = groups[matchIdx];
      group.names.add(entity.name);
      for (const email of entity.emails) {
        group.emails.add(email.toLowerCase());
      }
      group.sources.push({
        source: entity.source,
        external_id: entity.external_id,
      });
    } else {
      groups.push({
        names: new Set([entity.name]),
        emails: new Set(entity.emails.map((e) => e.toLowerCase())),
        sources: [
          { source: entity.source, external_id: entity.external_id },
        ],
      });
    }
  }

  return groups.map((group) => {
    const names = Array.from(group.names);
    const canonical = names.sort((a, b) => b.length - a.length)[0];
    const aliases = names.filter((n) => n !== canonical);

    const sourceCount = new Set(group.sources.map((s) => s.source)).size;
    const confidence = Math.min(
      1,
      0.5 + sourceCount * 0.2 + (group.emails.size > 0 ? 0.1 : 0),
    );

    return {
      canonical_name: canonical,
      aliases,
      emails: Array.from(group.emails),
      sources: group.sources,
      confidence: Math.round(confidence * 100) / 100,
    };
  });
}

function findMatchingGroup(
  groups: Array<{
    names: Set<string>;
    emails: Set<string>;
    sources: Array<{ source: string; external_id?: string }>;
  }>,
  entity: PersonEntity,
): number {
  for (let i = 0; i < groups.length; i++) {
    for (const email of entity.emails) {
      if (groups[i].emails.has(email.toLowerCase())) {
        return i;
      }
    }
  }

  for (let i = 0; i < groups.length; i++) {
    for (const existingName of groups[i].names) {
      if (fuzzyNameMatch(existingName, entity.name)) {
        return i;
      }
    }
  }

  return -1;
}

/**
 * Fuzzy name matching. Handles:
 * - Exact match (case-insensitive)
 * - One name is a substring of the other (e.g., "John" vs "John Smith")
 * - Normalized Levenshtein distance < 0.3 for short names
 */
function fuzzyNameMatch(a: string, b: string): boolean {
  const na = a.toLowerCase().trim();
  const nb = b.toLowerCase().trim();

  if (na === nb) return true;

  const aParts = na.split(/\s+/);
  const bParts = nb.split(/\s+/);

  const shorter = aParts.length <= bParts.length ? aParts : bParts;
  const longer = aParts.length <= bParts.length ? bParts : aParts;

  const allPartsMatch = shorter.every((part) =>
    longer.some(
      (lp) => lp === part || (part.length > 2 && lp.startsWith(part)),
    ),
  );

  if (allPartsMatch && shorter.length > 0) return true;

  if (aParts.length === 1 && bParts.length === 1 && na.length > 3) {
    const dist = levenshtein(na, nb);
    const maxLen = Math.max(na.length, nb.length);
    return dist / maxLen < 0.3;
  }

  return false;
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    Array(n + 1).fill(0) as number[],
  );

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost,
      );
    }
  }

  return dp[m][n];
}
