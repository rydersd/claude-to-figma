import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { SendCommandFn } from "../types.js";
import { logger } from "../helpers.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LibraryVariant {
  key: string;
  name: string;
  properties: Record<string, string>;
}

export interface LibraryComponentSet {
  setName: string;
  description: string;
  libraryFileKey: string;
  libraryName: string;
  thumbnailUrl?: string;
  variants: LibraryVariant[];
  // property name → all values seen across variants, e.g. { State: ["Default", "Success"] }
  propertyValues: Record<string, string[]>;
}

export type LibraryIndex = LibraryComponentSet[];

// ---------------------------------------------------------------------------
// Index building (pure)
// ---------------------------------------------------------------------------

/** Parse "State=Default, Size=MD" → { State: "Default", Size: "MD" }. Non-variant names → {}. */
export function parseVariantProperties(name: string): Record<string, string> {
  const props: Record<string, string> = {};
  if (!name || !name.includes("=")) return props;
  for (const part of name.split(",")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const key = part.slice(0, eq).trim();
    const value = part.slice(eq + 1).trim();
    if (key) props[key] = value;
  }
  return props;
}

/**
 * Merge the REST payloads of /components and /component_sets into set-grouped entries.
 * Variants carry a containing_frame.containingStateGroup pointing at their set;
 * components without one are standalone single-variant sets.
 */
export function buildLibraryIndex(
  fileKey: string,
  libraryName: string,
  components: any[],
  componentSets: any[]
): LibraryComponentSet[] {
  const setMetaByNodeId = new Map<string, { name: string; description: string }>();
  for (const cs of componentSets || []) {
    setMetaByNodeId.set(cs.node_id, { name: cs.name, description: cs.description || "" });
  }

  const sets = new Map<string, LibraryComponentSet>();
  for (const comp of components || []) {
    const group = comp.containing_frame?.containingStateGroup;
    const setName = group?.name || comp.name;
    // Key by unique identifier: nodeId for variants, comp.key for standalones
    const setKey = group ? group.nodeId : comp.key;
    const setMeta = group ? setMetaByNodeId.get(group.nodeId) : undefined;
    const properties = group ? parseVariantProperties(comp.name) : {};

    let entry = sets.get(setKey);
    if (!entry) {
      entry = {
        setName,
        description: setMeta?.description || comp.description || "",
        libraryFileKey: fileKey,
        libraryName,
        thumbnailUrl: comp.thumbnail_url,
        variants: [],
        propertyValues: {},
      };
      sets.set(setKey, entry);
    }
    entry.variants.push({ key: comp.key, name: comp.name, properties });
    for (const [prop, value] of Object.entries(properties)) {
      const values = entry.propertyValues[prop] || (entry.propertyValues[prop] = []);
      if (!values.includes(value)) values.push(value);
    }
  }
  return Array.from(sets.values());
}

// ---------------------------------------------------------------------------
// Search scoring (pure) — tiers from the design spec
// ---------------------------------------------------------------------------

export function scoreMatch(query: string, set: LibraryComponentSet): number {
  const q = query.trim().toLowerCase();
  if (!q) return 0;
  const name = set.setName.toLowerCase();

  let score = 0;
  if (name === q) {
    score = 100;
  } else if (name.startsWith(q)) {
    score = 80;
  } else if (name.includes(q)) {
    score = 60;
  } else {
    const tokens = q.split(/\s+/).filter(Boolean);
    const hits = tokens.filter((t) => name.includes(t)).length;
    if (tokens.length > 0 && hits === tokens.length) {
      score = 50;
    } else if (hits > 0) {
      score = Math.round((30 * hits) / tokens.length);
    }
  }

  if (score < 60 && set.description.toLowerCase().includes(q)) {
    score = Math.max(score, 20);
  }

  const valueHit = Object.values(set.propertyValues).some((values) =>
    values.some((v) => v.toLowerCase() === q)
  );
  if (valueHit) score += 10;

  return score;
}

export function searchIndex(
  index: LibraryIndex,
  query: string,
  limit: number = 5
): Array<{ set: LibraryComponentSet; score: number }> {
  return index
    .map((set) => ({ set, score: scoreMatch(query, set) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
