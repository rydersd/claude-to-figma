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

// ---------------------------------------------------------------------------
// $lib: resolution (pure)
// ---------------------------------------------------------------------------

export class LibraryRefError extends Error {}

/** Pick the variant whose parsed properties best match the requested ones; first variant otherwise. */
export function chooseVariant(
  set: LibraryComponentSet,
  properties?: Record<string, string | boolean>
): LibraryVariant {
  if (!properties || Object.keys(properties).length === 0 || set.variants.length === 1) {
    return set.variants[0];
  }
  let best = set.variants[0];
  let bestHits = -1;
  for (const variant of set.variants) {
    const hits = Object.entries(properties).filter(
      ([prop, value]) =>
        (variant.properties[prop] || "").toLowerCase() === String(value).toLowerCase()
    ).length;
    if (hits > bestHits) {
      best = variant;
      bestHits = hits;
    }
  }
  return best;
}

/**
 * Resolve "$lib:<name>" to a concrete component key.
 * A unique exact name match always wins. Otherwise the top score must be ≥ 60
 * with a ≥ 20 lead over the runner-up — anything else throws with candidates,
 * so a wrong component is never silently placed.
 */
export function resolveLibraryRef(
  ref: string,
  index: LibraryIndex,
  properties?: Record<string, string | boolean>
): { componentKey: string; setName: string; variantName: string } {
  const query = ref.replace(/^\$lib:/, "").trim();
  const scored = index
    .map((set) => ({ set, score: scoreMatch(query, set) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) {
    throw new LibraryRefError(
      `No library component matches "${query}". Use search_library_components to explore, ` +
        `or — if nothing in the library fits — follow the component_proposal_guide prompt ` +
        `instead of imitating a component with raw shapes.`
    );
  }

  const describe = (r: { set: LibraryComponentSet; score: number }) =>
    `"${r.set.setName}" (${r.set.libraryName}, score ${r.score})`;

  const exactMatches = scored.filter((r) => r.set.setName.toLowerCase() === query.toLowerCase());
  if (exactMatches.length > 1) {
    throw new LibraryRefError(
      `"${query}" exists in multiple libraries: ${exactMatches.map(describe).join(", ")}. ` +
        `Use a raw componentKey from search_library_components instead.`
    );
  }

  let winner: LibraryComponentSet;
  if (exactMatches.length === 1) {
    winner = exactMatches[0].set;
  } else {
    const top = scored[0];
    const second = scored[1];
    if (top.score < 60 || (second && top.score - second.score < 20)) {
      throw new LibraryRefError(
        `Ambiguous library reference "${query}". Candidates: ` +
          `${scored.slice(0, 5).map(describe).join(", ")}. ` +
          `Use the exact set name or a raw componentKey from search_library_components.`
      );
    }
    winner = top.set;
  }

  const variant = chooseVariant(winner, properties);
  return { componentKey: variant.key, setName: winner.setName, variantName: variant.name };
}
