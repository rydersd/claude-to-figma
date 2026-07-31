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
  if (set.variants.length === 0) {
    throw new LibraryRefError(
      `Component set "${set.setName}" has no variants.`
    );
  }
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

// ---------------------------------------------------------------------------
// Config + REST fetch + session cache
// ---------------------------------------------------------------------------

const FIGMA_API_BASE = "https://api.figma.com";

export class LibraryConfigError extends Error {}

export const CONFIG_HELP =
  "Library tools need two environment variables:\n" +
  "  FIGMA_API_TOKEN — a Figma personal access token (Figma → Settings → Security → " +
  "Personal access tokens) with scopes 'File content: read' and 'Library content: read'.\n" +
  "  FIGMA_LIBRARY_FILE_KEYS — comma-separated file keys of the libraries to index, " +
  "from each library file's URL: figma.com/design/<FILE_KEY>/...\n" +
  "Set them in your shell (e.g. ~/.zshrc) and reference them from .mcp.json as " +
  '"${FIGMA_API_TOKEN}", then restart the MCP server.';

export function getLibraryConfig(env: NodeJS.ProcessEnv = process.env): {
  token?: string;
  fileKeys: string[];
} {
  return {
    token: env.FIGMA_API_TOKEN || undefined,
    fileKeys: (env.FIGMA_LIBRARY_FILE_KEYS || "")
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean),
  };
}

async function figmaGet(path: string, token: string): Promise<any> {
  const response = await fetch(`${FIGMA_API_BASE}${path}`, {
    headers: { "X-Figma-Token": token },
  });
  if (!response.ok) {
    const hint =
      response.status === 401 || response.status === 403
        ? "check FIGMA_API_TOKEN and its scopes ('File content: read' + 'Library content: read')"
        : response.status === 404
          ? "check the file key in FIGMA_LIBRARY_FILE_KEYS (from the library file's URL)"
          : response.status === 429
            ? `rate limited — retry after ${response.headers.get("retry-after") || "a moment"}`
            : "unexpected Figma API error";
    throw new Error(`Figma API ${response.status} on ${path}: ${hint}`);
  }
  return response.json();
}

// Session-lifetime cache: file key → set entries. refresh:true refetches.
const indexCache = new Map<string, LibraryComponentSet[]>();

export function clearLibraryCache(): void {
  indexCache.clear();
}

async function fetchLibraryFile(fileKey: string, token: string): Promise<LibraryComponentSet[]> {
  let libraryName = fileKey;
  try {
    const meta = await figmaGet(`/v1/files/${fileKey}/meta`, token);
    libraryName = meta?.file?.name || meta?.name || fileKey;
  } catch (error) {
    logger.warn(`Could not fetch library name for ${fileKey}: ${error instanceof Error ? error.message : String(error)}`);
  }
  const [compRes, setRes] = await Promise.all([
    figmaGet(`/v1/files/${fileKey}/components`, token),
    figmaGet(`/v1/files/${fileKey}/component_sets`, token),
  ]);
  return buildLibraryIndex(
    fileKey,
    libraryName,
    compRes?.meta?.components || [],
    setRes?.meta?.component_sets || []
  );
}

export async function loadLibraryIndex(opts: { refresh?: boolean } = {}): Promise<LibraryIndex> {
  const { token, fileKeys } = getLibraryConfig();
  if (!token || fileKeys.length === 0) {
    throw new LibraryConfigError(CONFIG_HELP);
  }
  const index: LibraryIndex = [];
  for (const fileKey of fileKeys) {
    if (opts.refresh || !indexCache.has(fileKey)) {
      const sets = await fetchLibraryFile(fileKey, token);
      indexCache.set(fileKey, sets);
      logger.info(`Indexed library ${fileKey}: ${sets.length} component sets`);
    }
    index.push(...indexCache.get(fileKey)!);
  }
  return index;
}

// ---------------------------------------------------------------------------
// MCP tools
// ---------------------------------------------------------------------------

export function formatLibraryList(index: LibraryIndex, verbose: boolean): any {
  return {
    totalSets: index.length,
    sets: index.map((set) => ({
      name: set.setName,
      variants: set.variants.length,
      description: set.description.slice(0, 120),
      library: set.libraryName,
      ...(verbose
        ? {
            propertyValues: set.propertyValues,
            variantList: set.variants.map((v) => ({ name: v.name, key: v.key })),
          }
        : {}),
    })),
  };
}

export function formatSearchResults(
  results: Array<{ set: LibraryComponentSet; score: number }>
): any {
  return {
    results: results.map(({ set, score }) => ({
      name: set.setName,
      score,
      description: set.description.slice(0, 120),
      library: set.libraryName,
      componentKey: chooseVariant(set).key,
      propertyValues: set.propertyValues,
      variants: set.variants.map((v) => ({ name: v.name, key: v.key })),
      thumbnailUrl: set.thumbnailUrl,
    })),
  };
}

function asToolError(error: unknown) {
  const message =
    error instanceof LibraryConfigError
      ? `Library tools are not configured.\n${CONFIG_HELP}`
      : `Library error: ${error instanceof Error ? error.message : String(error)}`;
  return { content: [{ type: "text" as const, text: message }] };
}

export function registerTools(server: McpServer, _sendCommandToFigma: SendCommandFn) {
  server.tool(
    "get_library_components",
    "List every published component set available from the configured Figma team libraries (the Assets panel equivalent). Compact by default; verbose:true adds per-variant names, keys, and property values. Requires FIGMA_API_TOKEN + FIGMA_LIBRARY_FILE_KEYS.",
    {
      verbose: z.boolean().optional().describe("Include per-variant names, keys, and property values"),
      refresh: z.boolean().optional().describe("Refetch from the Figma API instead of the session cache"),
    },
    async ({ verbose, refresh }: any) => {
      try {
        const index = await loadLibraryIndex({ refresh });
        return { content: [{ type: "text", text: JSON.stringify(formatLibraryList(index, !!verbose)) }] };
      } catch (error) {
        return asToolError(error);
      }
    }
  );

  server.tool(
    "search_library_components",
    "Search the configured Figma team libraries for a component by name/description/variant values. Returns ready-to-use componentKeys for create_component_instance or create_node_tree instance nodes ($lib: refs). If nothing adequate matches, follow the component_proposal_guide prompt instead of imitating a component with raw shapes.",
    {
      query: z.string().describe("What to find, e.g. 'badge', 'breadcrumbs', 'bulk actions'"),
      limit: z.number().min(1).max(20).optional().describe("Max results (default 5)"),
      refresh: z.boolean().optional().describe("Refetch from the Figma API instead of the session cache"),
    },
    async ({ query, limit, refresh }: any) => {
      try {
        const index = await loadLibraryIndex({ refresh });
        const results = searchIndex(index, query, limit ?? 5);
        if (results.length === 0) {
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                results: [],
                note: `No match for "${query}" across ${index.length} component sets. If no existing component fits this need, follow the component_proposal_guide prompt (rationalized proposal with explorations and use cases) rather than drawing raw shapes.`,
              }),
            }],
          };
        }
        return { content: [{ type: "text", text: JSON.stringify(formatSearchResults(results)) }] };
      } catch (error) {
        return asToolError(error);
      }
    }
  );
}
