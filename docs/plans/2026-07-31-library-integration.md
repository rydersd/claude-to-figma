# Figma Library Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let Claude discover, search, and place published Figma library components (e.g. QUIX Component Library v2), and route unfillable gaps into a rationalized component/pattern proposal workflow.

**Architecture:** A new MCP-server-side module (`tools/library.ts`) fetches published components from the Figma REST API, builds a searchable in-memory index, and exposes two tools plus a `$lib:` resolution pass that runs inside `create_node_tree` before dispatch. The plugin gains one new tree node type (`instance`) that reuses the existing `createComponentInstance`. Prompts and a proposal frame template encode the gap workflow.

**Tech Stack:** Bun, TypeScript, Zod, `@modelcontextprotocol/sdk`, Figma REST API (`api.figma.com`), Figma Plugin API. No new dependencies.

**Spec:** [2026-07-31-library-integration-design.md](../specs/2026-07-31-library-integration-design.md)

## Global Constraints

- No new npm dependencies — use built-in `fetch`, plain scoring functions.
- All server logs to stderr via `logger` from `helpers.ts`; stdout is MCP protocol only.
- All tool parameters validated with Zod.
- Config via env: `FIGMA_API_TOKEN` (PAT, scopes **File content: read** + **Library content: read**), `FIGMA_LIBRARY_FILE_KEYS` (comma-separated file keys). Missing config is a soft failure returning setup instructions — never a crash.
- `$lib:` resolution thresholds (from spec): top score ≥ 60 AND lead ≥ 20 over runner-up; a unique exact name match always wins; multiple exact matches are ambiguous. Ambiguity/no-match fails the whole `create_node_tree` call with candidates listed.
- Plugin changes require `bun run build` (rebuilds `src/claude_figma_plugin/code.js`); plugin code style avoids modern syntax that breaks the IIFE build (match surrounding code).
- Unit tests must run with `bun test tests/library.test.ts` with **no** Figma or WebSocket connection.
- Commits: use the `/commit` skill (repo rule — never raw `git commit`).

---

### Task 1: Library index core — variant parsing and set grouping

**Files:**
- Create: `src/claude_to_figma_mcp/tools/library.ts`
- Create: `tests/library.test.ts`

**Interfaces:**
- Consumes: nothing (pure logic).
- Produces (later tasks rely on these exact shapes):
  ```ts
  export interface LibraryVariant { key: string; name: string; properties: Record<string, string> }
  export interface LibraryComponentSet {
    setName: string; description: string;
    libraryFileKey: string; libraryName: string;
    thumbnailUrl?: string;
    variants: LibraryVariant[];
    propertyValues: Record<string, string[]>;
  }
  export type LibraryIndex = LibraryComponentSet[];
  export function parseVariantProperties(name: string): Record<string, string>
  export function buildLibraryIndex(fileKey: string, libraryName: string, components: any[], componentSets: any[]): LibraryComponentSet[]
  ```

- [ ] **Step 1: Write the failing tests**

```ts
/**
 * Unit tests for library index building, search scoring, and $lib: resolution.
 * Pure logic — no Figma, WebSocket, or network required:
 *   bun test tests/library.test.ts
 */

import { describe, test, expect } from "bun:test";
import {
  parseVariantProperties,
  buildLibraryIndex,
} from "../src/claude_to_figma_mcp/tools/library";

describe("parseVariantProperties", () => {
  test("parses State=Default, Size=MD variant names", () => {
    expect(parseVariantProperties("State=Default, Size=MD")).toEqual({
      State: "Default",
      Size: "MD",
    });
  });

  test("returns empty map for standalone component names", () => {
    expect(parseVariantProperties("Badge")).toEqual({});
    expect(parseVariantProperties("")).toEqual({});
  });

  test("trims whitespace around keys and values", () => {
    expect(parseVariantProperties(" State = Hover ,Size= LG ")).toEqual({
      State: "Hover",
      Size: "LG",
    });
  });
});

// REST fixtures shaped like GET /v1/files/:key/components and /component_sets responses
const FIXTURE_COMPONENTS = [
  {
    key: "badge-default-key",
    name: "State=Default",
    description: "",
    containing_frame: { pageName: "Components", containingStateGroup: { name: "Badge", nodeId: "1:100" } },
  },
  {
    key: "badge-success-key",
    name: "State=Success",
    description: "",
    containing_frame: { pageName: "Components", containingStateGroup: { name: "Badge", nodeId: "1:100" } },
  },
  {
    key: "divider-key",
    name: "Divider",
    description: "A horizontal rule",
    containing_frame: { pageName: "Components" },
  },
];

const FIXTURE_SETS = [
  { key: "badge-set-key", node_id: "1:100", name: "Badge", description: "Status indicator chip" },
];

describe("buildLibraryIndex", () => {
  test("groups variants under their component set with merged property values", () => {
    const index = buildLibraryIndex("FILEKEY", "QUIX v2", FIXTURE_COMPONENTS, FIXTURE_SETS);
    const badge = index.find((s) => s.setName === "Badge")!;
    expect(badge.variants.length).toBe(2);
    expect(badge.description).toBe("Status indicator chip");
    expect(badge.propertyValues).toEqual({ State: ["Default", "Success"] });
    expect(badge.variants[0].key).toBe("badge-default-key");
    expect(badge.libraryName).toBe("QUIX v2");
    expect(badge.libraryFileKey).toBe("FILEKEY");
  });

  test("treats components without a state group as single-variant sets", () => {
    const index = buildLibraryIndex("FILEKEY", "QUIX v2", FIXTURE_COMPONENTS, FIXTURE_SETS);
    const divider = index.find((s) => s.setName === "Divider")!;
    expect(divider.variants.length).toBe(1);
    expect(divider.variants[0].key).toBe("divider-key");
    expect(divider.variants[0].properties).toEqual({});
    expect(divider.description).toBe("A horizontal rule");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test tests/library.test.ts`
Expected: FAIL — cannot resolve `../src/claude_to_figma_mcp/tools/library`.

- [ ] **Step 3: Write the implementation**

```ts
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
    const setMeta = group ? setMetaByNodeId.get(group.nodeId) : undefined;
    const properties = group ? parseVariantProperties(comp.name) : {};

    let entry = sets.get(setName);
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
      sets.set(setName, entry);
    }
    entry.variants.push({ key: comp.key, name: comp.name, properties });
    for (const [prop, value] of Object.entries(properties)) {
      const values = entry.propertyValues[prop] || (entry.propertyValues[prop] = []);
      if (!values.includes(value)) values.push(value);
    }
  }
  return Array.from(sets.values());
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test tests/library.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit** — via the `/commit` skill: "feat: library index core (variant parsing, set grouping)"

---

### Task 2: Search scoring

**Files:**
- Modify: `src/claude_to_figma_mcp/tools/library.ts`
- Modify: `tests/library.test.ts`

**Interfaces:**
- Consumes: `LibraryComponentSet`, `LibraryIndex` from Task 1.
- Produces:
  ```ts
  export function scoreMatch(query: string, set: LibraryComponentSet): number
  export function searchIndex(index: LibraryIndex, query: string, limit?: number): Array<{ set: LibraryComponentSet; score: number }>
  ```

- [ ] **Step 1: Write the failing tests** (append to `tests/library.test.ts`; add `scoreMatch, searchIndex` to the import)

```ts
function makeSet(setName: string, extra: Partial<import("../src/claude_to_figma_mcp/tools/library").LibraryComponentSet> = {}) {
  return {
    setName,
    description: "",
    libraryFileKey: "F",
    libraryName: "QUIX v2",
    variants: [{ key: setName.toLowerCase() + "-key", name: setName, properties: {} }],
    propertyValues: {},
    ...extra,
  };
}

describe("scoreMatch", () => {
  test("scoring tiers: exact > prefix > substring > all tokens > partial tokens > description", () => {
    expect(scoreMatch("badge", makeSet("Badge"))).toBe(100);
    expect(scoreMatch("badge", makeSet("Badge Group"))).toBe(80);
    expect(scoreMatch("badge", makeSet("Status Badge"))).toBe(60);
    expect(scoreMatch("action list", makeSet("List of Actions"))).toBe(50);
    expect(scoreMatch("action list", makeSet("Action Bar"))).toBe(15); // 1 of 2 tokens
    expect(scoreMatch("chip", makeSet("Badge", { description: "A chip for statuses" }))).toBe(20);
    expect(scoreMatch("table", makeSet("Badge"))).toBe(0);
  });

  test("variant property value match adds +10", () => {
    const set = makeSet("Badge", { propertyValues: { State: ["Success", "Error"] } });
    expect(scoreMatch("success", set)).toBe(10); // no name match, value only
  });

  test("empty query scores 0", () => {
    expect(scoreMatch("  ", makeSet("Badge"))).toBe(0);
  });
});

describe("searchIndex", () => {
  const index = [makeSet("Badge"), makeSet("Badge Group"), makeSet("Banner"), makeSet("Avatar")];

  test("returns matches sorted by score, capped at limit", () => {
    const results = searchIndex(index, "badge", 1);
    expect(results.length).toBe(1);
    expect(results[0].set.setName).toBe("Badge");
    expect(results[0].score).toBe(100);
  });

  test("excludes zero-score sets", () => {
    const names = searchIndex(index, "badge", 10).map((r) => r.set.setName);
    expect(names).toEqual(["Badge", "Badge Group"]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test tests/library.test.ts`
Expected: FAIL — `scoreMatch` is not exported.

- [ ] **Step 3: Write the implementation** (append to `library.ts`)

```ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test tests/library.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit** — via `/commit`: "feat: library search scoring"

---

### Task 3: `$lib:` reference resolution and variant selection

**Files:**
- Modify: `src/claude_to_figma_mcp/tools/library.ts`
- Modify: `tests/library.test.ts`

**Interfaces:**
- Consumes: `scoreMatch`, `LibraryIndex` from Tasks 1-2.
- Produces:
  ```ts
  export class LibraryRefError extends Error {}
  export function chooseVariant(set: LibraryComponentSet, properties?: Record<string, string | boolean>): LibraryVariant
  export function resolveLibraryRef(ref: string, index: LibraryIndex, properties?: Record<string, string | boolean>): { componentKey: string; setName: string; variantName: string }
  ```

- [ ] **Step 1: Write the failing tests** (append; extend import with `resolveLibraryRef, chooseVariant, LibraryRefError`)

```ts
describe("chooseVariant", () => {
  const badge = makeSet("Badge", {
    variants: [
      { key: "k-default", name: "State=Default, Size=MD", properties: { State: "Default", Size: "MD" } },
      { key: "k-success", name: "State=Success, Size=MD", properties: { State: "Success", Size: "MD" } },
      { key: "k-success-lg", name: "State=Success, Size=LG", properties: { State: "Success", Size: "LG" } },
    ],
    propertyValues: { State: ["Default", "Success"], Size: ["MD", "LG"] },
  });

  test("no properties → first variant", () => {
    expect(chooseVariant(badge).key).toBe("k-default");
  });

  test("picks the variant with the most matching property values (case-insensitive)", () => {
    expect(chooseVariant(badge, { State: "success", Size: "LG" }).key).toBe("k-success-lg");
    expect(chooseVariant(badge, { State: "Success" }).key).toBe("k-success");
  });
});

describe("resolveLibraryRef", () => {
  const index = [
    makeSet("Badge"),
    makeSet("Badge Group"),
    makeSet("Banner"),
  ];

  test("unique exact match wins even with close runner-up", () => {
    const r = resolveLibraryRef("$lib:Badge", index);
    expect(r.componentKey).toBe("badge-key");
    expect(r.setName).toBe("Badge");
  });

  test("no match throws with proposal-workflow directive", () => {
    expect(() => resolveLibraryRef("$lib:Data Table", index)).toThrow(LibraryRefError);
    expect(() => resolveLibraryRef("$lib:Data Table", index)).toThrow(/component_proposal_guide/);
  });

  test("ambiguous (low lead) throws listing candidates", () => {
    // "ba" prefixes Badge, Badge Group, and Banner — all score 80, no exact match
    expect(() => resolveLibraryRef("$lib:ba", index)).toThrow(/Candidates:.*Badge.*Banner/s);
  });

  test("duplicate exact names across libraries are ambiguous", () => {
    const dup = [...index, makeSet("Badge", { libraryName: "Other Lib" })];
    expect(() => resolveLibraryRef("$lib:Badge", dup)).toThrow(/multiple libraries|Candidates:/);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test tests/library.test.ts`
Expected: FAIL — `resolveLibraryRef` is not exported.

- [ ] **Step 3: Write the implementation** (append to `library.ts`)

```ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test tests/library.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit** — via `/commit`: "feat: $lib: resolution with ambiguity guards"

---

### Task 4: REST fetch, cache, and config

**Files:**
- Modify: `src/claude_to_figma_mcp/tools/library.ts`
- Modify: `tests/library.test.ts`
- Create: `tests/library-live.test.ts`

**Interfaces:**
- Consumes: `buildLibraryIndex` from Task 1.
- Produces:
  ```ts
  export function getLibraryConfig(env?: NodeJS.ProcessEnv): { token?: string; fileKeys: string[] }
  export const CONFIG_HELP: string
  export async function loadLibraryIndex(opts?: { refresh?: boolean }): Promise<LibraryIndex>  // throws LibraryConfigError / Error with status hint
  export class LibraryConfigError extends Error {}
  export function clearLibraryCache(): void  // test hook
  ```

- [ ] **Step 1: Write the failing tests** (append to `tests/library.test.ts`)

```ts
import {
  getLibraryConfig,
  loadLibraryIndex,
  clearLibraryCache,
  LibraryConfigError,
  CONFIG_HELP,
} from "../src/claude_to_figma_mcp/tools/library";

describe("getLibraryConfig", () => {
  test("splits and trims comma-separated file keys", () => {
    const cfg = getLibraryConfig({ FIGMA_API_TOKEN: "figd_x", FIGMA_LIBRARY_FILE_KEYS: " abc , def ,, " } as any);
    expect(cfg.token).toBe("figd_x");
    expect(cfg.fileKeys).toEqual(["abc", "def"]);
  });

  test("empty env yields no token and no keys", () => {
    const cfg = getLibraryConfig({} as any);
    expect(cfg.token).toBeUndefined();
    expect(cfg.fileKeys).toEqual([]);
  });
});

describe("loadLibraryIndex", () => {
  const realFetch = globalThis.fetch;
  const realToken = process.env.FIGMA_API_TOKEN;
  const realKeys = process.env.FIGMA_LIBRARY_FILE_KEYS;

  function restore() {
    globalThis.fetch = realFetch;
    if (realToken === undefined) delete process.env.FIGMA_API_TOKEN; else process.env.FIGMA_API_TOKEN = realToken;
    if (realKeys === undefined) delete process.env.FIGMA_LIBRARY_FILE_KEYS; else process.env.FIGMA_LIBRARY_FILE_KEYS = realKeys;
    clearLibraryCache();
  }

  test("throws LibraryConfigError with setup help when unconfigured", async () => {
    delete process.env.FIGMA_API_TOKEN;
    delete process.env.FIGMA_LIBRARY_FILE_KEYS;
    clearLibraryCache();
    try {
      await expect(loadLibraryIndex()).rejects.toBeInstanceOf(LibraryConfigError);
    } finally { restore(); }
  });

  test("fetches components + component_sets per file key and caches the result", async () => {
    process.env.FIGMA_API_TOKEN = "figd_test";
    process.env.FIGMA_LIBRARY_FILE_KEYS = "KEY1";
    clearLibraryCache();
    let calls: string[] = [];
    globalThis.fetch = (async (url: any) => {
      calls.push(String(url));
      const path = String(url);
      const body = path.includes("/component_sets")
        ? { meta: { component_sets: FIXTURE_SETS } }
        : path.includes("/components")
        ? { meta: { components: FIXTURE_COMPONENTS } }
        : { name: "QUIX v2" }; // /v1/files/KEY1/meta
      return new Response(JSON.stringify(body), { status: 200 });
    }) as any;
    try {
      const index = await loadLibraryIndex();
      expect(index.find((s) => s.setName === "Badge")).toBeTruthy();
      const callCount = calls.length;
      await loadLibraryIndex(); // second call served from cache
      expect(calls.length).toBe(callCount);
      await loadLibraryIndex({ refresh: true }); // refresh refetches
      expect(calls.length).toBeGreaterThan(callCount);
    } finally { restore(); }
  });

  test("maps HTTP errors to actionable hints", async () => {
    process.env.FIGMA_API_TOKEN = "figd_bad";
    process.env.FIGMA_LIBRARY_FILE_KEYS = "KEY1";
    clearLibraryCache();
    globalThis.fetch = (async () => new Response("{}", { status: 403 })) as any;
    try {
      await expect(loadLibraryIndex()).rejects.toThrow(/scopes|token/i);
    } finally { restore(); }
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test tests/library.test.ts`
Expected: FAIL — `getLibraryConfig` is not exported.

- [ ] **Step 3: Write the implementation** (append to `library.ts`)

```ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test tests/library.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the live smoke test** (`tests/library-live.test.ts`)

```ts
/**
 * Live REST smoke test — hits api.figma.com with real credentials.
 * Runs only when FIGMA_API_TOKEN and FIGMA_LIBRARY_FILE_KEYS are set:
 *   bun test tests/library-live.test.ts
 */

import { describe, test, expect } from "bun:test";
import { loadLibraryIndex, getLibraryConfig } from "../src/claude_to_figma_mcp/tools/library";

const configured = (() => {
  const { token, fileKeys } = getLibraryConfig();
  return Boolean(token && fileKeys.length > 0);
})();

describe("live library fetch", () => {
  test.skipIf(!configured)("indexes at least one component set with keys", async () => {
    const index = await loadLibraryIndex({ refresh: true });
    expect(index.length).toBeGreaterThan(0);
    expect(index[0].variants[0].key).toBeTruthy();
    console.error(`Indexed ${index.length} sets from ${index[0].libraryName}`);
  });
});
```

- [ ] **Step 6: Run the live test**

Run: `bun test tests/library-live.test.ts`
Expected: PASS if env vars are set locally; SKIP otherwise. Both are acceptable here — the gate is that it does not FAIL.

- [ ] **Step 7: Commit** — via `/commit`: "feat: library REST fetch, cache, config"

---

### Task 5: MCP tools — `get_library_components` and `search_library_components`

**Files:**
- Modify: `src/claude_to_figma_mcp/tools/library.ts`
- Modify: `src/claude_to_figma_mcp/server.ts`
- Modify: `tests/library.test.ts`

**Interfaces:**
- Consumes: `loadLibraryIndex`, `searchIndex`, `chooseVariant`, `CONFIG_HELP`, `LibraryConfigError`.
- Produces:
  ```ts
  export function formatLibraryList(index: LibraryIndex, verbose: boolean): any
  export function formatSearchResults(results: Array<{ set: LibraryComponentSet; score: number }>): any
  export function registerTools(server: McpServer, sendCommandToFigma: SendCommandFn): void
  ```

- [ ] **Step 1: Write the failing tests for the formatters** (append; extend import)

```ts
describe("formatLibraryList", () => {
  const index = [
    makeSet("Badge", { description: "Status chip", propertyValues: { State: ["Default", "Success"] } }),
  ];

  test("compact mode lists set name, variant count, library", () => {
    const out = formatLibraryList(index, false);
    expect(out.totalSets).toBe(1);
    expect(out.sets[0]).toEqual({
      name: "Badge",
      variants: 1,
      description: "Status chip",
      library: "QUIX v2",
    });
    expect(out.sets[0].keys).toBeUndefined();
  });

  test("verbose mode includes variant names, keys, and property values", () => {
    const out = formatLibraryList(index, true);
    expect(out.sets[0].propertyValues).toEqual({ State: ["Default", "Success"] });
    expect(out.sets[0].variantList[0].key).toBe("badge-key");
  });
});

describe("formatSearchResults", () => {
  test("returns ready-to-place componentKey plus variants and thumbnail", () => {
    const set = makeSet("Badge", { thumbnailUrl: "https://thumb", propertyValues: { State: ["Default"] } });
    const out = formatSearchResults([{ set, score: 100 }]);
    expect(out.results[0].componentKey).toBe("badge-key");
    expect(out.results[0].score).toBe(100);
    expect(out.results[0].thumbnailUrl).toBe("https://thumb");
    expect(out.results[0].propertyValues).toEqual({ State: ["Default"] });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test tests/library.test.ts`
Expected: FAIL — `formatLibraryList` is not exported.

- [ ] **Step 3: Write formatters + tool registration** (append to `library.ts`)

```ts
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
```

- [ ] **Step 4: Register in `server.ts`** — add with the other imports and registrations:

```ts
import { registerTools as registerLibraryTools } from "./tools/library.js";
```

after `registerImageTools(server, sendCommandToFigma);`:

```ts
registerLibraryTools(server, sendCommandToFigma);
```

- [ ] **Step 5: Run tests and build**

Run: `bun test tests/library.test.ts && bun run build`
Expected: tests PASS; build succeeds with no TypeScript errors.

- [ ] **Step 6: Commit** — via `/commit`: "feat: get_library_components + search_library_components MCP tools"

---

### Task 6: `instance` node type in the tree schema + server-side `$lib:` resolution

**Files:**
- Modify: `src/claude_to_figma_mcp/tools/node-tree.ts`
- Modify: `tests/library.test.ts`

**Interfaces:**
- Consumes: `resolveLibraryRef`, `loadLibraryIndex`, `LibraryIndex`, `LibraryRefError` from `./library.js`.
- Produces (exported from `tools/node-tree.ts` for tests):
  ```ts
  export function treeHasLibraryRefs(tree: any): boolean
  export function resolveTreeLibraryRefs(tree: any, index: LibraryIndex | null): void  // mutates in place; throws LibraryRefError
  ```
  Plus the wire contract Task 7 implements: instance specs arrive at the plugin as `{ type: "instance", componentKey, x?, y?, name?, properties?, textOverrides? }` (the `component` field is consumed server-side and never crosses the WebSocket).

- [ ] **Step 1: Write the failing tests** (append to `tests/library.test.ts`)

```ts
import { treeHasLibraryRefs, resolveTreeLibraryRefs } from "../src/claude_to_figma_mcp/tools/node-tree";

describe("resolveTreeLibraryRefs", () => {
  const index = [
    makeSet("Badge", {
      variants: [
        { key: "k-default", name: "State=Default", properties: { State: "Default" } },
        { key: "k-success", name: "State=Success", properties: { State: "Success" } },
      ],
      propertyValues: { State: ["Default", "Success"] },
    }),
  ];

  test("treeHasLibraryRefs finds $lib: refs, including inside $repeat templates", () => {
    expect(treeHasLibraryRefs({ type: "instance", component: "$lib:Badge" })).toBe(true);
    expect(
      treeHasLibraryRefs({
        type: "frame", width: 100, height: 100,
        children: [{ $repeat: { data: [["a"]], template: { type: "instance", component: "$lib:Badge" } } }],
      })
    ).toBe(true);
    expect(treeHasLibraryRefs({ type: "frame", width: 100, height: 100, children: [{ type: "text", text: "hi" }] })).toBe(false);
    expect(treeHasLibraryRefs({ type: "instance", component: "raw-key-123" })).toBe(false);
  });

  test("rewrites $lib: refs to componentKey using instance properties for variant choice", () => {
    const tree: any = {
      type: "frame", width: 200, height: 100,
      children: [{ type: "instance", component: "$lib:Badge", properties: { State: "Success" } }],
    };
    resolveTreeLibraryRefs(tree, index);
    expect(tree.children[0].componentKey).toBe("k-success");
    expect(tree.children[0].component).toBeUndefined();
  });

  test("passes raw keys through without needing an index", () => {
    const tree: any = { type: "instance", component: "raw-key-123" };
    resolveTreeLibraryRefs(tree, null);
    expect(tree.componentKey).toBe("raw-key-123");
  });

  test("unresolvable ref fails the whole tree with candidates", () => {
    const tree: any = { type: "instance", component: "$lib:Data Table" };
    expect(() => resolveTreeLibraryRefs(tree, index)).toThrow(/No library component matches/);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test tests/library.test.ts`
Expected: FAIL — `treeHasLibraryRefs` is not exported from `node-tree.ts`.

- [ ] **Step 3: Implement in `tools/node-tree.ts`**

Add to the imports:

```ts
import { resolveLibraryRef, loadLibraryIndex, type LibraryIndex } from "./library.js";
```

Add the schema after `VectorNodeSchema` (`node-tree.ts:142`):

```ts
const InstanceNodeSchema = z.object({
  type: z.literal("instance"),
  component: z.string().describe(
    "Library component to place: \"$lib:<Name>\" (resolved against the configured team libraries — see search_library_components) or a raw published componentKey"
  ),
  x: z.number().optional().describe("X position (default 0)"),
  y: z.number().optional().describe("Y position (default 0)"),
  name: z.string().optional().describe("Rename the placed instance (default: component name)"),
  properties: z.record(z.union([z.string(), z.boolean()])).optional().describe(
    "Variant/component properties, e.g. {\"State\": \"Success\"} — also used to pick the variant for $lib: refs"
  ),
  textOverrides: z.record(z.string()).optional().describe("Text replacements keyed by child text-node name"),
});
```

Extend the `NodeTree` type union and the discriminated union:

```ts
type NodeTree =
  | (z.infer<typeof BaseFrameSchema> & { children?: NodeTreeChild[] })
  | z.infer<typeof TextNodeSchema>
  | z.infer<typeof RectangleNodeSchema>
  | z.infer<typeof VectorNodeSchema>
  | z.infer<typeof InstanceNodeSchema>;
```

```ts
const NodeTreeSchema: z.ZodType<NodeTree> = z.discriminatedUnion("type", [
  BaseFrameSchema.extend({
    children: z.lazy(() => z.array(NodeTreeChildSchema)).optional(),
  }),
  TextNodeSchema,
  RectangleNodeSchema,
  VectorNodeSchema,
  InstanceNodeSchema,
]);
```

Add the resolution walk next to `prefetchTreeImages`:

```ts
/** True if any instance node in the tree (including $repeat templates) uses a $lib: ref. */
export function treeHasLibraryRefs(tree: any): boolean {
  if (!tree || typeof tree !== "object") return false;
  if (tree.$repeat) return treeHasLibraryRefs(tree.$repeat.template);
  if (tree.type === "instance" && typeof tree.component === "string" && tree.component.startsWith("$lib:")) {
    return true;
  }
  if (Array.isArray(tree.children)) {
    return tree.children.some((child: any) => treeHasLibraryRefs(child));
  }
  return false;
}

/**
 * Rewrite instance nodes in place: `component` ("$lib:Name" or raw key) → `componentKey`.
 * $lib: refs need a loaded index; ambiguous or unmatched refs throw (fail the whole
 * tree) so a wrong component is never silently placed. Runs before $repeat expansion,
 * so `component` must not contain $[N]/$key placeholders.
 */
export function resolveTreeLibraryRefs(tree: any, index: LibraryIndex | null): void {
  if (!tree || typeof tree !== "object") return;
  if (tree.$repeat) {
    resolveTreeLibraryRefs(tree.$repeat.template, index);
    return;
  }
  if (tree.type === "instance" && typeof tree.component === "string") {
    if (tree.component.startsWith("$lib:")) {
      if (!index) throw new Error("Library index not loaded for $lib: resolution");
      const resolved = resolveLibraryRef(tree.component, index, tree.properties);
      tree.componentKey = resolved.componentKey;
      logger.info(`Resolved ${tree.component} → ${resolved.setName} / ${resolved.variantName}`);
    } else {
      tree.componentKey = tree.component;
    }
    delete tree.component;
  }
  if (Array.isArray(tree.children)) {
    for (const child of tree.children) {
      resolveTreeLibraryRefs(child, index);
    }
  }
}
```

Wire into the `create_node_tree` handler, immediately before the `prefetchTreeImages` call (`node-tree.ts:334`):

```ts
        // Resolve $lib: component refs to concrete keys before anything crosses the WebSocket
        const libIndex = treeHasLibraryRefs(tree) ? await loadLibraryIndex() : null;
        resolveTreeLibraryRefs(tree, libIndex);
```

(Errors propagate to the existing catch and return as `Error creating node tree: ...` with the candidate list — the fail-fast behavior the spec requires.)

Update the tool description string (`node-tree.ts:318`) to:

```
"Create (or sync) an entire node hierarchy in one call from a nested JSON tree of frames, text, rectangles, vectors, and library component instances. Supports $repeat, $var: variable binding, $lib: library component refs, hex/gradient/image fills, effects, per-corner radii, and absolute positioning. Pass rootId (instead of parentId) to reconcile an existing tree in place. Returns a compact summary; pass verbose:true for the full node map. For the full spec format, call the 'node_tree_guide' prompt."
```

- [ ] **Step 4: Run tests and build**

Run: `bun test tests/library.test.ts && bun run build`
Expected: tests PASS; build succeeds.

- [ ] **Step 5: Commit** — via `/commit`: "feat: instance node type with server-side $lib: resolution"

---

### Task 7: Plugin — create and sync instance nodes

**Files:**
- Modify: `src/claude_figma_plugin/src/components.ts`
- Modify: `src/claude_figma_plugin/src/node-tree.ts`

**Interfaces:**
- Consumes: the wire contract from Task 6 (`{ type: "instance", componentKey, x?, y?, name?, properties?, textOverrides? }`); existing `createComponentInstance(params)` from `components.ts:102`.
- Produces:
  ```ts
  // components.ts
  export async function applyTextOverrides(node: any, overrides: Record<string, string>): Promise<void>
  // createComponentInstance additionally honors params.name (renames the instance)
  ```

- [ ] **Step 1: Extract `applyTextOverrides` in `components.ts`**

The text-override walker is currently a function nested inside `createComponentInstance`. Lift it to a module-level export (above `createComponentInstance`), and call it from `createComponentInstance`:

```ts
export async function applyTextOverrides(node: any, overrides: Record<string, string>): Promise<void> {
  if (node.type === "TEXT" && overrides[node.name] !== undefined) {
    await loadAllFonts(node);
    await setCharacters(node, String(overrides[node.name]));
  }
  if ("children" in node && node.children) {
    for (var i = 0; i < node.children.length; i++) {
      await applyTextOverrides(node.children[i], overrides);
    }
  }
}
```

In `createComponentInstance`, replace the nested `applyTextOverrides` definition and its call with:

```ts
    if (params.textOverrides && typeof params.textOverrides === "object") {
      await applyTextOverrides(instance, params.textOverrides);
    }
```

- [ ] **Step 2: Honor `name` in `createComponentInstance`**

Immediately after `instance.y = y;` add:

```ts
    if (params.name) {
      instance.name = params.name;
    }
```

- [ ] **Step 3: Handle `instance` in the plugin's tree creation** (`src/claude_figma_plugin/src/node-tree.ts`)

Add to the imports:

```ts
import { createComponentInstance, applyTextOverrides } from './components';
```

In `createNode`'s switch (after `case "vector":`, `node-tree.ts:620`):

```ts
        case "instance":
          result = await createComponentInstance(createParams);
          break;
```

(`createParams` already carries `componentKey`, `x`, `y`, `name`, `properties`, `textOverrides`, and `parentId`; `createComponentInstance` appends to the parent itself via `appendOrInsertChild`, applies properties non-fatally, and returns `{ id, name, ... }` — exactly what the node-tracking code after the switch expects. The COLOR_FIELDS resolution loop is a no-op for instances since the schema has no color fields.)

- [ ] **Step 4: Handle `instance` in sync mode** — in `updateNodeProperties` (after the vector branch, `node-tree.ts:396`):

```ts
    // --- Instance properties ---
    if (type === "instance") {
      if (spec.properties !== undefined) {
        try {
          existingNode.setProperties(spec.properties);
          changedProps.push("properties");
        } catch (e) {
          console.error("Error setting component properties during sync:", e);
        }
      }
      if (spec.textOverrides !== undefined) {
        await applyTextOverrides(existingNode, spec.textOverrides);
        changedProps.push("textOverrides");
      }
    }
```

(Common name/x/y updates already apply via the shared block at the top of `updateNodeProperties`. Matched instances are never re-imported — `componentKey` is ignored in sync mode; swapping an instance to a different component remains the job of `swap_instance_variant`.)

- [ ] **Step 5: Build and verify**

Run: `bun run build`
Expected: build succeeds; `src/claude_figma_plugin/code.js` is regenerated and contains `case "instance"` (verify: `grep -c '"instance"' src/claude_figma_plugin/code.js` ≥ 1).

Plugin logic cannot be unit-tested without a live Figma (`figma` global). End-to-end verification happens in Task 10.

- [ ] **Step 6: Commit** — via `/commit`: "feat: plugin instance creation and sync in node trees"

---

### Task 8: Prompts — library-first directive and `component_proposal_guide`

**Files:**
- Modify: `src/claude_to_figma_mcp/tools/prompts.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: MCP prompts `component_proposal_guide` (new) and updated `node_tree_guide` / `design_strategy` text.

- [ ] **Step 1: Add the instance node type + library-first rule to `node_tree_guide`** (`prompts.ts:646`)

Inside the guide's node-type documentation, add:

```
INSTANCE (library component):
{ "type": "instance", "component": "$lib:Badge", "properties": { "State": "Success" }, "textOverrides": { "Label": "Active" }, "name": "status-badge" }
- component: "$lib:<Name>" resolves against the configured team libraries (see search_library_components), or pass a raw componentKey directly.
- properties picks the variant and sets component properties; textOverrides replaces text by child node name.
- component must be a static string — never build it from $repeat placeholders ($[N]/$key).

LIBRARY-FIRST RULE: before drawing any standard UI element (buttons, badges, inputs, banners, breadcrumbs, tables...) with raw frames/rectangles, call search_library_components. If a library component exists, place it as an instance node. If nothing adequate exists, follow the component_proposal_guide prompt — never imitate a library component with raw shapes.
```

- [ ] **Step 2: Add the same library-first directive to `design_strategy`** (`prompts.ts:5`) — append as a new numbered practice at the end of its list:

```
N. Use the design system first:
   - Call search_library_components before drawing any standard UI element from scratch
   - Place real library instances (create_component_instance, or instance nodes in create_node_tree)
   - If no library component or pattern fits, follow component_proposal_guide — never fake one with raw shapes
```

(Replace `N` with the next number in that list.)

- [ ] **Step 3: Register `component_proposal_guide`** — add a new `server.prompt` alongside the others:

```ts
  server.prompt(
    "component_proposal_guide",
    "Workflow for proposing a new design-system component or pattern when no library match exists",
    (extra) => {
      return {
        messages: [
          {
            role: "assistant",
            content: {
              type: "text",
              text: `When a design needs a component or pattern the team library does not provide, the gap becomes a deliverable — a rationalized proposal — never a silent imitation built from raw shapes.

1. Confirm the gap:
   - Run search_library_components with several phrasings of the need
   - A "component" is a single control (badge, input); a "pattern" is a reusable composition of existing components (filter bar, empty state)
   - If a near-match can be stretched to fit (via properties, overrides, or composition), USE IT — new components must earn their existence

2. Rationalize:
   - Name the nearest existing components/patterns considered
   - State specifically why each fails the need (wrong anatomy, missing state, cannot hold the content, wrong interaction model)

3. Build the proposal in Figma using the component_proposal section template (build_page_section), then fill it in:
   - Name, type (Component | Pattern), and the rationale from step 2
   - Anatomy: labeled diagram of the parts
   - Properties/variants following the library's conventions (e.g. State=, Size=)
   - State grid: every interactive state
   - 2-3 visual explorations (genuinely different directions, not color swaps)
   - Use cases: the proposal in context of the current design, plus other anticipated placements
   - Pattern proposals additionally document their composition from existing library components; if a pattern needs a missing component, spawn a nested component proposal

4. Mark it proposed:
   - The leading exploration placed in the working design keeps the layer name prefix "⚠️ PROPOSED / " so it can never be mistaken for a published component
   - Tell the user a proposal exists and needs design-system review before it ships`,
            },
          },
        ],
      };
    }
  );
```

- [ ] **Step 4: Build**

Run: `bun run build`
Expected: build succeeds.

- [ ] **Step 5: Commit** — via `/commit`: "feat: component_proposal_guide prompt + library-first directives"

---

### Task 9: `component_proposal` section template

**Files:**
- Modify: `src/claude_to_figma_mcp/templates/pcp-sections.ts` (new entry in `SECTION_TEMPLATES` at `pcp-sections.ts:311` and in `TEMPLATE_PROPS` at `pcp-sections.ts:1753`)

**Interfaces:**
- Consumes: `SectionTemplate` interface (`pcp-sections.ts:52`), local `textNode` helper.
- Produces: template `component_proposal` usable via `build_page_section { template: "component_proposal", props: {...} }`.

- [ ] **Step 1: Add the template entry to `SECTION_TEMPLATES`**

```ts
  component_proposal: {
    zone: "no_brand",
    description:
      "Design-system proposal frame for a new component or pattern: rationale, anatomy, properties, state grid, exploration slots, and use cases. Fill the placeholder areas with real content after generating.",
    defaultWidth: 1440,
    buildTree(props: Record<string, any>, width?: number): any {
      const w = width ?? this.defaultWidth;
      const proposalType = props.proposalType === "Pattern" ? "Pattern" : "Component";
      const rationale: Array<{ candidate: string; reason: string }> = props.rationale || [];
      const properties: Array<{ property: string; values: string[] }> = props.properties || [];
      const useCases: string[] = props.useCases || [];
      const composition: string[] = props.composition || [];

      const sectionTitle = (text: string) =>
        textNode({ text, fontSize: 20, fontWeight: 700, fontColor: "#1a1a1a", name: "Section Title" });

      const placeholderArea = (name: string, height: number) => ({
        type: "frame",
        name,
        width: w - 128,
        height,
        fillColor: "#fafafa",
        strokeColor: "#d9d9d9",
        strokeWeight: 1,
        cornerRadius: 8,
        layoutMode: "VERTICAL",
        primaryAxisAlignItems: "CENTER",
        counterAxisAlignItems: "CENTER",
        children: [
          textNode({ text: "Fill in: " + name, fontSize: 13, fontWeight: 400, fontColor: "#8c8c8c" }),
        ],
      });

      const section = (title: string, children: any[]) => ({
        type: "frame",
        name: title,
        width: w - 128,
        height: 100,
        layoutMode: "VERTICAL",
        itemSpacing: 16,
        layoutSizingVertical: "HUG",
        children: [sectionTitle(title), ...children],
      });

      const children: any[] = [
        // Header
        {
          type: "frame",
          name: "Header",
          width: w - 128,
          height: 100,
          layoutMode: "VERTICAL",
          itemSpacing: 8,
          layoutSizingVertical: "HUG",
          children: [
            textNode({
              text: "⚠️ PROPOSED " + proposalType.toUpperCase() + " — NOT IN LIBRARY",
              fontSize: 13,
              fontWeight: 700,
              fontColor: "#b45309",
              name: "Status",
            }),
            textNode({ text: props.name, fontSize: 40, fontWeight: 700, fontColor: "#1a1a1a", name: "Proposal Name" }),
          ],
        },
        // Rationale
        section(
          "Rationale — rejected near-matches",
          rationale.length > 0
            ? rationale.map((r) =>
                textNode({
                  text: r.candidate + " — " + r.reason,
                  fontSize: 15,
                  fontWeight: 400,
                  fontColor: "#404040",
                  name: "Rationale: " + r.candidate,
                  width: w - 128,
                })
              )
            : [placeholderArea("Nearest existing components and why each fails the need", 120)]
        ),
        // Anatomy
        section("Anatomy", [placeholderArea("Labeled anatomy diagram", 320)]),
        // Properties
        section(
          "Properties & Variants",
          properties.length > 0
            ? properties.map((p) =>
                textNode({
                  text: p.property + " = " + p.values.join(" | "),
                  fontSize: 15,
                  fontWeight: 500,
                  fontColor: "#404040",
                  name: "Property: " + p.property,
                })
              )
            : [placeholderArea("Property list following library conventions (State=, Size=...)", 120)]
        ),
        // State grid
        section("State Grid", [placeholderArea("Every interactive state", 280)]),
        // Explorations
        section("Explorations", [
          {
            type: "frame",
            name: "Exploration Row",
            width: w - 128,
            height: 360,
            layoutMode: "HORIZONTAL",
            itemSpacing: 24,
            children: ["A", "B", "C"].map((label) => ({
              type: "frame",
              name: "Exploration " + label,
              width: Math.floor((w - 128 - 48) / 3),
              height: 360,
              fillColor: "#fafafa",
              strokeColor: "#d9d9d9",
              strokeWeight: 1,
              cornerRadius: 8,
              layoutMode: "VERTICAL",
              primaryAxisAlignItems: "CENTER",
              counterAxisAlignItems: "CENTER",
              children: [
                textNode({ text: "Exploration " + label, fontSize: 13, fontWeight: 600, fontColor: "#8c8c8c" }),
              ],
            })),
          },
        ]),
        // Use cases
        section(
          "Use Cases",
          useCases.length > 0
            ? useCases.map((uc, i) =>
                textNode({
                  text: (i + 1) + ". " + uc,
                  fontSize: 15,
                  fontWeight: 400,
                  fontColor: "#404040",
                  name: "Use Case " + (i + 1),
                  width: w - 128,
                })
              )
            : [placeholderArea("Proposal in context of the current design + other anticipated placements", 240)]
        ),
      ];

      // Pattern proposals document their composition from existing components
      if (proposalType === "Pattern") {
        children.splice(2, 0, section(
          "Composition",
          composition.length > 0
            ? composition.map((c) =>
                textNode({ text: "• " + c, fontSize: 15, fontWeight: 400, fontColor: "#404040", name: "Uses: " + c })
              )
            : [placeholderArea("Existing library components this pattern is composed from", 120)]
        ));
      }

      return {
        type: "frame",
        name: "⚠️ PROPOSED / " + props.name,
        width: w,
        height: 1200,
        fillColor: "#ffffff",
        layoutMode: "VERTICAL",
        paddingTop: 64,
        paddingBottom: 64,
        paddingLeft: 64,
        paddingRight: 64,
        itemSpacing: 48,
        layoutSizingVertical: "HUG",
        children,
      };
    },
  },
```

- [ ] **Step 2: Add the props entry to `TEMPLATE_PROPS`**

```ts
  component_proposal: {
    required: ["name"],
    optional: [
      "proposalType: 'Component' | 'Pattern' (default Component)",
      "rationale: Array<{candidate, reason}>",
      "properties: Array<{property, values: string[]}>",
      "composition: string[] (Pattern only)",
      "useCases: string[]",
    ],
  },
```

- [ ] **Step 3: Build**

Run: `bun run build`
Expected: build succeeds; no TypeScript errors.

- [ ] **Step 4: Commit** — via `/commit`: "feat: component_proposal section template"

---

### Task 10: Config wiring, docs, and end-to-end verification

**Files:**
- Modify: `.mcp.json`
- Modify: `README.md`, `CLAUDE.md`
- Modify: `docs/Tools-Components.md`, `docs/Tool-Reference.md`, `docs/Getting-Started.md`, `docs/Architecture.md`, `docs/Create-Node-Tree.md`, `docs/Roadmap.md`

**Interfaces:**
- Consumes: everything above.
- Produces: working env config and accurate docs.

- [ ] **Step 1: Add env passthrough to `.mcp.json`** — in the `ClaudeToFigma` server entry, add (or extend) the `env` block:

```json
"env": {
  "FIGMA_API_TOKEN": "${FIGMA_API_TOKEN}",
  "FIGMA_LIBRARY_FILE_KEYS": "${FIGMA_LIBRARY_FILE_KEYS}"
}
```

- [ ] **Step 2: End-to-end verification with the live plugin** (requires: relay running, plugin joined to a channel, env vars set, MCP server restarted)

1. `get_library_components` → returns the QUIX set list (Accordion, Badge, Banner...).
2. `search_library_components {query: "badge"}` → Badge with score 100, componentKey, `State` values.
3. `create_node_tree` with `{ "type": "frame", "width": 400, "height": 200, "layoutMode": "VERTICAL", "children": [{ "type": "instance", "component": "$lib:Badge", "properties": { "State": "Success" } }] }` → real QUIX Badge instance appears in the frame.
4. `create_node_tree` with `"component": "$lib:zzz-nonexistent"` → error listing candidates/proposal directive, nothing placed.
5. `build_page_section {template: "component_proposal", props: {name: "Metric Tile", rationale: [{candidate: "Badge", reason: "cannot hold a KPI value + trend"}]}}` → proposal frame renders with all sections.

Capture the tool outputs as evidence — the repo's done-means-evidence rule applies.

- [ ] **Step 3: Update docs**

- `docs/Tools-Components.md`: document `get_library_components`, `search_library_components` (params, example outputs), and the library-first rule.
- `docs/Create-Node-Tree.md`: document the `instance` node type and `$lib:` refs (example from Step 2.3), including the "no $repeat placeholders in component" caveat.
- `docs/Tool-Reference.md`: add both tools to the index.
- `docs/Getting-Started.md`: PAT creation (scopes: File content read, Library content read), `~/.zshrc` export, `FIGMA_LIBRARY_FILE_KEYS` from the library file URL, `.mcp.json` passthrough.
- `docs/Architecture.md`: note the REST discovery path (MCP server → api.figma.com) alongside the WebSocket path.
- `docs/Roadmap.md`: mark library integration done; list phase 2 (published styles, teamLibrary variables, team_id enumeration, PROPOSED-frame lint).
- `README.md`: env setup section.
- `CLAUDE.md`: add `tools/library.ts` to the architecture notes and the env vars to Setup.

(Wiki pages use this wiki's established conventions; keep `Home.md`/`_Sidebar.md` consistent if they index tool pages.)

- [ ] **Step 4: Run the full non-integration test suite**

Run: `bun test tests/gradients.test.ts tests/images.test.ts tests/library.test.ts && bun run build`
Expected: all PASS, build clean.

- [ ] **Step 5: Commit** — via `/commit`: "docs: library integration setup + reference; wire env passthrough"

---

## Coverage map (spec → tasks)

| Spec section | Tasks |
|---|---|
| 1. Architecture (fetch/index/cache) | 1, 4 |
| 2. Configuration & auth | 4, 10 |
| 3. New MCP tools | 2, 5 |
| 4. Tree-spec integration | 3, 6, 7 |
| 5. Error handling | 3, 4, 5, 6 |
| 6. Gap workflow | 8, 9 |
| 7. Testing | 1-6 (unit), 4 (live), 10 (e2e) |
| 8. Documentation | 10 |
