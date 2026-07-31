/**
 * Unit tests for library index building, search scoring, and $lib: resolution.
 * Pure logic — no Figma, WebSocket, or network required:
 *   bun test tests/library.test.ts
 */

import { describe, test, expect } from "bun:test";
import {
  parseVariantProperties,
  buildLibraryIndex,
  scoreMatch,
  searchIndex,
  resolveLibraryRef,
  chooseVariant,
  LibraryRefError,
  getLibraryConfig,
  loadLibraryIndex,
  clearLibraryCache,
  LibraryConfigError,
  CONFIG_HELP,
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

  test("keeps standalone components with same name but different keys as separate sets", () => {
    const twoStandalone = [
      {
        key: "icon-share-v1",
        name: "Icon",
        description: "Share icon version 1",
        containing_frame: { pageName: "Icons" },
      },
      {
        key: "icon-share-v2",
        name: "Icon",
        description: "Share icon version 2",
        containing_frame: { pageName: "Icons" },
      },
    ];
    const index = buildLibraryIndex("FILEKEY", "QUIX v2", twoStandalone, []);
    expect(index.length).toBe(2);
    const v1 = index.find((s) => s.variants[0].key === "icon-share-v1")!;
    const v2 = index.find((s) => s.variants[0].key === "icon-share-v2")!;
    expect(v1.description).toBe("Share icon version 1");
    expect(v2.description).toBe("Share icon version 2");
  });
});

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

  test("empty variants array throws LibraryRefError", () => {
    const empty = makeSet("Empty", { variants: [] });
    expect(() => chooseVariant(empty)).toThrow(LibraryRefError);
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
