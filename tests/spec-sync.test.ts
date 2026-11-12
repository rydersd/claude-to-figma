/**
 * Spec sync, PR 11b (L2F_SPEC_SYNC): the shared normaliser, the plugin's
 * export_spec and the pull_spec tool, against a mocked `figma` global and temp
 * directories. No Figma or relay needed:
 *   bun test tests/spec-sync.test.ts
 *
 * The plugin's variable indexes are module state shared by every test file in
 * the run, so this file resets them before and after its tests: it builds them
 * from its own mock (which adds variableCollectionId and ids in no local
 * collection), and the next file builds them from its own.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  NO_PAINT, SPEC_DEFAULTS, canonicalColor, hashProps, lockNodesFromTree, normalizeNode, normalizeSpecTree, specHash, stableStringify,
} from "../src/shared/spec";
import { exportSpec } from "../src/llm2figma_plugin/src/spec";
import { createNodeTree } from "../src/llm2figma_plugin/src/node-tree";
import { resetVariableIndexesForTests } from "../src/llm2figma_plugin/src/utils";
import { allowedEditors, assertEditorAllowed } from "../src/llm2figma_plugin/src/editor-gate";
import { pullSpec, registerTools as registerSpecTools, EXPORT_TIMEOUT_MS } from "../src/llm2figma_mcp/tools/spec";
import { resolveSpecPaths, specBaseDir } from "../src/llm2figma_mcp/spec-files";
import { FEATURES, isEnabled, registerWhenEnabled } from "../src/shared/flags";
import { FLAG_ENV_KEYS, SETTING_ENV_KEYS, makeMcpConfig } from "../scripts/write-mcp-config";

const originalFigma = (globalThis as any).figma;
let nextId = 0;
let nodes = new Map<string, any>();
let page: any;
let progress: any[] = [];

const color = { id: "color", name: "Primary", resolvedType: "COLOR", valuesByMode: { mode: { r: 1, g: 0, b: 0 } }, variableCollectionId: "c-colors" };
const wrongType = { id: "float", name: "Spacing", resolvedType: "FLOAT", valuesByMode: { mode: 8 }, variableCollectionId: "c-colors" };
const duplicate = { ...color, id: "other", name: "Primary", variableCollectionId: "c-other" };
// In no local collection: a library variable, and one whose Collection/Name
// ("Colors/Primary") resolves to a different variable.
const libraryAccent = { id: "a-token", name: "Accent", resolvedType: "COLOR", valuesByMode: { mode: { r: 0, g: 1, b: 0 } }, variableCollectionId: "lib-a" };
const shadowed = { id: "shadowed", name: "Primary", resolvedType: "COLOR", valuesByMode: { mode: { r: 0, g: 0, b: 1 } }, variableCollectionId: "lib-colors" };
const variablesById: Record<string, any> = { color, float: wrongType, other: duplicate, "a-token": libraryAccent, shadowed };
const collectionsById: Record<string, any> = {
  "c-colors": { id: "c-colors", name: "Colors" }, "c-other": { id: "c-other", name: "Other" },
  "lib-a": { id: "lib-a", name: "Library A", remote: true }, "lib-colors": { id: "lib-colors", name: "Colors", remote: true },
};

function makeNode(type: string, extra: any = {}, parent: any = null): any {
  const node: any = {
    id: `${++nextId}:1`, type, name: type, parent: null, children: [], rotation: 0,
    x: 0, y: 0, width: 100, height: 100, opacity: 1, fills: [], strokes: [], effects: [],
    strokeWeight: 1, strokeAlign: type === "VECTOR" ? "CENTER" : "INSIDE", layoutMode: "NONE", layoutWrap: "NO_WRAP",
    layoutPositioning: "AUTO", layoutSizingHorizontal: "FIXED", layoutSizingVertical: "FIXED",
    clipsContent: true, itemReverseZIndex: false, itemSpacing: 0, counterAxisSpacing: 0,
    paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, primaryAxisAlignItems: "MIN", counterAxisAlignItems: "MIN",
    cornerRadius: 0, topLeftRadius: 0, topRightRadius: 0, bottomLeftRadius: 0, bottomRightRadius: 0,
    resize(w: number, h: number) { this.width = w; this.height = h; },
    appendChild(child: any) {
      if (child.parent) child.parent.children = child.parent.children.filter((c: any) => c !== child);
      child.parent = this;
      this.children.push(child);
    },
    insertChild(index: number, child: any) { child.parent = this; this.children.splice(index, 0, child); },
    remove() { this.removed = true; nodes.delete(this.id); if (this.parent) this.parent.children = this.parent.children.filter((c: any) => c !== this); },
    ...extra,
  };
  if (type === "TEXT") {
    Object.assign(node, {
      fontName: { family: "Inter", style: "Regular" }, fontSize: 12, characters: "", textAutoResize: "WIDTH_AND_HEIGHT",
      textAlignHorizontal: "LEFT", lineHeight: { unit: "AUTO" }, letterSpacing: { unit: "PERCENT", value: 0 }, textCase: "ORIGINAL",
      fills: [{ type: "SOLID", color: { r: 0, g: 0, b: 0 }, opacity: 1 }], height: 20, ...extra,
    });
  }
  if (type === "VECTOR") {
    Object.assign(node, {
      vectorNetwork: { vertices: [{ x: 0, y: 0 }, { x: 1, y: 1 }], segments: [] },
      async setVectorNetworkAsync(network: any) { this.vectorNetwork = network; },
      ...extra,
    });
  }
  if (type === "INSTANCE") {
    Object.assign(node, {
      async getMainComponentAsync() { return this.main ?? null; },
      setProperties(props: any) {
        for (const [key, value] of Object.entries(props)) {
          const existing = this.componentProperties[key];
          this.componentProperties[key] = { type: existing ? existing.type : "VARIANT", value };
        }
      },
    });
  }
  nodes.set(node.id, node);
  if (parent) parent.appendChild(node);
  return node;
}

function component(key: string, remote = true): any {
  const main: any = {
    id: "comp-" + key, key, remote, type: "COMPONENT", name: key,
    createInstance: () => makeNode("INSTANCE", {
      name: key, main, componentProperties: key === "badge" ? {
        State: { type: "VARIANT", value: "Off" },
        "Label#1:2": { type: "TEXT", value: "New" },
        "Icon#3:4": { type: "INSTANCE_SWAP", value: "9:9" },
      } : {},
    }),
  };
  return main;
}

function freshFigma(overrides: any = {}) {
  nextId = 0;
  nodes = new Map();
  progress = [];
  page = makeNode("PAGE", { name: "Page 1", async loadAsync() { this.loaded = true; } });
  (globalThis as any).figma = {
    mixed: Symbol("mixed"),
    editorType: "figma",
    fileKey: undefined,
    root: { name: "Test file" },
    currentPage: page,
    ui: { postMessage: (message: any) => { progress.push(message); } },
    getNodeByIdAsync: async (id: string) => nodes.get(id) || null,
    importComponentByKeyAsync: async (key: string) => component(key),
    loadFontAsync: async () => {},
    createFrame: () => makeNode("FRAME"),
    createRectangle: () => makeNode("RECTANGLE"),
    createText: () => makeNode("TEXT"),
    createVector: () => makeNode("VECTOR"),
    createImage: () => ({ hash: "image" }),
    variables: {
      getLocalVariableCollectionsAsync: async () => [{ name: "Colors", variableIds: ["color", "float"] }, { name: "Other", variableIds: ["other"] }],
      getVariableByIdAsync: async (id: string) => variablesById[id] ?? null,
      getVariableCollectionByIdAsync: async (id: string) => collectionsById[id] ?? null,
      importVariableByKeyAsync: async (key: string) => ({ ...color, id: key }),
      setBoundVariableForPaint: (paint: any, field: string, variable: any) => {
        if (paint.type !== "SOLID" || field !== "color") throw new Error("Invalid paint binding");
        return { ...paint, boundVariables: { color: { type: "VARIABLE_ALIAS", id: variable.id } } };
      },
    },
    teamLibrary: {
      getAvailableLibraryVariableCollectionsAsync: async () => [{ key: "a", name: "Library A" }, { key: "b", name: "Library B" }],
      getVariablesInLibraryCollectionAsync: async (key: string) => [{ key: key + "-token", name: "Accent", resolvedType: "COLOR" }],
    },
    ...overrides,
  };
}

describe("spec sync (PR 11b)", () => {
  beforeAll(() => resetVariableIndexesForTests());
  beforeEach(() => freshFigma());
  afterAll(() => {
    resetVariableIndexesForTests();
    (globalThis as any).figma = originalFigma;
  });

  const bound = (id: string, rgb = { r: 1, g: 0, b: 0 }) => [{ type: "SOLID", color: rgb, opacity: 1, boundVariables: { color: { type: "VARIABLE_ALIAS", id } } }];
  const solid = (r: number, g: number, b: number, opacity = 1) => [{ type: "SOLID", color: { r, g, b }, opacity }];

  function stripIds(node: any): any {
    const { id: _id, children, ...rest } = node;
    return children ? { ...rest, children: children.map(stripIds) } : rest;
  }

  async function create(tree: any): Promise<any> {
    const result: any = await createNodeTree({ tree });
    expect(result.errors).toBeUndefined();
    return nodes.get(result.nodes[0].id);
  }

  async function exportOf(node: any, extra: any = {}) {
    return exportSpec({ nodeId: node.id, ...extra });
  }

  // Find a node in an exported tree by name.
  function find(tree: any, name: string): any {
    if (tree.name === name) return tree;
    for (const child of tree.children || []) {
      const hit = find(child, name);
      if (hit) return hit;
    }
    return null;
  }

  describe("normaliser", () => {
    test("every colour form create accepts gives one canonical hex", () => {
      expect(canonicalColor("#3d6daa")).toBe("#3D6DAA");
      expect(canonicalColor("#fff")).toBe("#FFFFFF");
      expect(canonicalColor({ r: 1, g: 1, b: 1, a: 1 })).toBe("#FFFFFF");
      expect(canonicalColor({ r: 0, g: 0, b: 1, a: 0.5 })).toBe("#0000FF80");
      expect(canonicalColor("#0000ff80")).toBe("#0000FF80");
      expect(canonicalColor({ r: 0.3, g: 0.2, b: 0.1, a: 0 })).toBe(NO_PAINT);
      expect(canonicalColor("$var:Colors/Primary")).toBe("$var:Colors/Primary");
    });

    test("numbers are rounded to 2 decimals on both sides, and key order never matters", () => {
      const a = normalizeNode({ type: "rectangle", name: "R", width: 10.004, height: "20", fillColor: "#ff0000" });
      const b = normalizeNode({ fillColor: { r: 1, g: 0, b: 0 }, height: 20, width: 10, name: "R", type: "rectangle" });
      expect(a).toEqual(b);
      expect(hashProps(a)).toBe(hashProps(b));
      expect(hashProps({ ...a, width: 11 })).not.toBe(hashProps(a));
      expect(stableStringify({ b: 1.005e0, a: [0.123] })).toBe('{"a":[0.12],"b":1}');
    });

    test("create's shorthands resolve the way create resolves them", () => {
      expect(normalizeNode({ type: "text", text: "Hi", fontWeight: 700, width: 120 }))
        .toEqual({ type: "text", name: "Hi", text: "Hi", width: 120, fontStyle: "Bold", textAutoResize: "HEIGHT" });
      expect(normalizeNode({ type: "frame" })).toEqual({ type: "frame", name: "Frame" });
      expect(() => normalizeNode({ type: "ellipse" })).toThrow("Unknown Spec node type");
    });

    test("properties outside a type's vocabulary are dropped", () => {
      expect(normalizeNode({ type: "text", text: "a", fills: [], cornerRadius: 4 })).toEqual({ type: "text", name: "a", text: "a", textAutoResize: "WIDTH_AND_HEIGHT" });
    });

    test("lock nodes carry props, hash, parent and child order, and refuse duplicate ids", () => {
      const tree = { id: "1", type: "frame", name: "A", children: [{ id: "2", type: "text", name: "t", text: "t", textAutoResize: "WIDTH_AND_HEIGHT" }, { id: "3", type: "$opaque", name: "g", nodeType: "GROUP" }] };
      const lock = lockNodesFromTree(tree, "0:1");
      expect(lock["1"]).toEqual({ props: { type: "frame", name: "A" }, propsHash: hashProps({ type: "frame", name: "A" }), parentId: "0:1", children: ["2", "3"] });
      expect(lock["3"].children).toEqual([]);
      expect(() => lockNodesFromTree({ ...tree, children: [tree.children[0], tree.children[0]] }, null)).toThrow("Duplicate node id");
    });
  });

  describe("export_spec round trip (1): create_node_tree(tree) then export equals the normalised tree", () => {
    test("auto-layout frame with text, rectangle, vector, instance and a nested frame", async () => {
      const tree = {
        type: "frame", name: "Card", x: 40, y: 24, width: 320, height: 200, layoutMode: "VERTICAL", itemSpacing: 8,
        paddingTop: 16, paddingRight: 16, paddingBottom: 16, paddingLeft: 16, primaryAxisAlignItems: "CENTER", counterAxisAlignItems: "MAX",
        fillColor: "#ffffff", strokeColor: "$var:Colors/Primary", strokeWeight: 2, strokeAlign: "OUTSIDE",
        cornerRadius: 12, clipsContent: false, opacity: 0.9, effects: [{ type: "DROP_SHADOW", offset: { x: 0, y: 2 }, radius: 6 }],
        children: [
          { type: "text", name: "Title", text: "Hello", fontFamily: "Roboto", fontWeight: 700, fontSize: "16",
            fontColor: "#333333", lineHeight: 20, letterSpacing: 0.5, textCase: "UPPER", textAlignHorizontal: "CENTER", width: 200 },
          { type: "rectangle", name: "Swatch", width: 40, height: 40, fillColor: "$var:Colors/Primary", cornerRadius: 4,
            strokeColor: { r: 0, g: 0, b: 1, a: 0.5 }, strokeWeight: 3, opacity: 0.5, layoutPositioning: "ABSOLUTE", x: 5, y: 6 },
          { type: "vector", name: "Icon", pathData: "M 0 0 L 10 10", width: 10, height: 10, strokeColor: "#000000", strokeCap: "ROUND" },
          { type: "instance", name: "Badge", componentKey: "badge", properties: { State: "On", "Label#1:2": "Hot" }, layoutSizingHorizontal: "FILL" },
          { type: "frame", name: "Row", layoutMode: "HORIZONTAL", layoutSizingHorizontal: "FILL", layoutSizingVertical: "HUG", itemSpacing: 4,
            fillColor: "#00000000", children: [{ type: "rectangle", name: "Dot", width: 4, height: 4, fillColor: "#ff0000" }] },
        ],
      };
      const root = await create(tree);
      const exported = await exportOf(root);
      expect(stripIds(exported.tree)).toEqual(normalizeSpecTree(tree));
      // Spot-check the canonical forms the comparison relied on.
      expect(find(exported.tree, "Card").strokeColor).toBe("$var:Colors/Primary");
      expect(find(exported.tree, "Swatch")).toMatchObject({ strokeColor: "#0000FF80", x: 5, y: 6, layoutPositioning: "ABSOLUTE" });
      expect(find(exported.tree, "Title")).toMatchObject({ fontStyle: "Bold", fontSize: 16, width: 200, textAutoResize: "HEIGHT" });
      expect(find(exported.tree, "Title").x).toBeUndefined();
      expect(exported).toMatchObject({ nodeCount: 7, opaqueCount: 0, truncated: false, fileName: "Test file", pageId: page.id, rootId: root.id, rootParentId: page.id });
    });

    test("absolute-layout frame keeps child x/y; local component instance exports componentId", async () => {
      const local = makeNode("COMPONENT", { name: "Local", key: "localkey", remote: false }, page);
      local.createInstance = () => makeNode("INSTANCE", { name: "Local", main: local, componentProperties: {} });
      const tree = {
        type: "frame", name: "Board", width: 400, height: 300, fillColor: "#F0F0F0",
        children: [
          { type: "text", name: "Note", text: "free text", x: 12, y: 30, fontColor: "#123456", fontSize: 18 },
          { type: "instance", name: "Mine", componentId: local.id, x: 100, y: 50 },
        ],
      };
      const root = await create(tree);
      const exported = await exportOf(root);
      expect(stripIds(exported.tree)).toEqual(normalizeSpecTree(tree));
      expect(find(exported.tree, "Mine")).toEqual({ id: expect.any(String), type: "instance", name: "Mine", componentId: local.id, x: 100, y: 50 });
    });
  });

  describe("defaults (2): what export drops is what create applies", () => {
    const cases: Array<[string, any, any]> = [
      ["frame", { type: "frame" }, { type: "frame", name: "Frame", children: [] }],
      ["auto-layout frame", { type: "frame", layoutMode: "VERTICAL" }, { type: "frame", name: "Frame", layoutMode: "VERTICAL", children: [] }],
      ["rectangle", { type: "rectangle" }, { type: "rectangle", name: "Rectangle" }],
      ["text", { type: "text" }, { type: "text", name: "Text", text: "Text", textAutoResize: "WIDTH_AND_HEIGHT" }],
      ["vector", { type: "vector", pathData: "M 0 0 L 1 1", width: 10, height: 10 }, { type: "vector", name: "Vector", width: 10, height: 10, pathData: "M 0 0 L 1 1" }],
      ["instance", { type: "instance", componentKey: "plain" }, { type: "instance", name: "plain", componentKey: "plain" }],
    ];
    for (const [label, spec, expected] of cases) {
      test(`a minimal ${label} exports nothing but its identity`, async () => {
        const exported = await exportOf(await create(spec));
        expect(stripIds(exported.tree)).toEqual(expected);
      });
    }

    test("parity: the dropped values are the ones create actually wrote", async () => {
      const frame = await create({ type: "frame", layoutMode: "VERTICAL" });
      expect([frame.x, frame.y, frame.width, frame.height]).toEqual([0, 0, 100, 100]);
      expect([frame.paddingTop, frame.paddingRight, frame.paddingBottom, frame.paddingLeft]).toEqual([10, 10, 10, 10]);
      expect(frame.itemReverseZIndex).toBe(true);
      expect(SPEC_DEFAULTS.frame).toMatchObject({ paddingTop: 10, itemReverseZIndex: true, x: 0, y: 0, width: 100, height: 100 });
      const text = await create({ type: "text" });
      expect([text.fontName, text.fontSize, text.fills[0].color]).toEqual([{ family: "Inter", style: "Regular" }, 14, { r: 0, g: 0, b: 0 }]);
      expect(SPEC_DEFAULTS.text).toMatchObject({ fontFamily: "Inter", fontStyle: "Regular", fontSize: 14, fontColor: "#000000" });
    });

    test("a non-default value is kept, including padding 0 that create would have made 10", async () => {
      const al = makeNode("FRAME", { name: "AL", layoutMode: "HORIZONTAL", itemReverseZIndex: false }, page);
      const exported = await exportOf(al);
      expect(exported.tree).toMatchObject({ paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, itemReverseZIndex: false });
    });
  });

  describe("omission list (3): each row has a fixture", () => {
    test("x and y inside auto-layout are left out unless the node is ABSOLUTE", async () => {
      const parent = makeNode("FRAME", { name: "P", layoutMode: "VERTICAL" }, page);
      makeNode("RECTANGLE", { name: "Flow", x: 7, y: 9 }, parent);
      makeNode("RECTANGLE", { name: "Abs", x: 7, y: 9, layoutPositioning: "ABSOLUTE" }, parent);
      const tree = (await exportOf(parent)).tree;
      expect(find(tree, "Flow").x).toBeUndefined();
      expect(find(tree, "Flow").y).toBeUndefined();
      expect(find(tree, "Abs")).toMatchObject({ x: 7, y: 9 });
    });

    test("width or height on a HUG or FILL axis is left out", async () => {
      const parent = makeNode("FRAME", { name: "P", layoutMode: "HORIZONTAL", width: 500, height: 80 }, page);
      makeNode("FRAME", { name: "Hug", layoutMode: "VERTICAL", layoutSizingHorizontal: "HUG", width: 33, height: 44 }, parent);
      makeNode("RECTANGLE", { name: "Fill", layoutSizingVertical: "FILL", width: 33, height: 80 }, parent);
      const tree = (await exportOf(parent)).tree;
      expect(find(tree, "Hug")).toMatchObject({ height: 44, layoutSizingHorizontal: "HUG" });
      expect(find(tree, "Hug").width).toBeUndefined();
      expect(find(tree, "Fill")).toMatchObject({ width: 33, layoutSizingVertical: "FILL" });
      expect(find(tree, "Fill").height).toBeUndefined();
    });

    test("text: height never, width only with textAutoResize HEIGHT, textAutoResize always", async () => {
      const parent = makeNode("FRAME", { name: "P" }, page);
      makeNode("TEXT", { name: "Auto", characters: "a", width: 50, height: 20, textAutoResize: "WIDTH_AND_HEIGHT" }, parent);
      makeNode("TEXT", { name: "Wrap", characters: "b", width: 150, height: 60, textAutoResize: "HEIGHT" }, parent);
      makeNode("TEXT", { name: "Fixed", characters: "c", width: 150, height: 60, textAutoResize: "NONE" }, parent);
      const tree = (await exportOf(parent)).tree;
      expect(find(tree, "Auto")).toEqual({ id: expect.any(String), type: "text", name: "Auto", text: "a", fontSize: 12, textAutoResize: "WIDTH_AND_HEIGHT" });
      expect(find(tree, "Wrap")).toMatchObject({ width: 150, textAutoResize: "HEIGHT" });
      expect(find(tree, "Fixed").width).toBeUndefined();
      expect(find(tree, "Fixed").textAutoResize).toBe("NONE");
      for (const name of ["Auto", "Wrap", "Fixed"]) expect(find(tree, name).height).toBeUndefined();
    });

    test("figma.mixed values are left out; mixed text emits only its text", async () => {
      const mixed = (globalThis as any).figma.mixed;
      const parent = makeNode("FRAME", { name: "P" }, page);
      makeNode("RECTANGLE", { name: "Corners", cornerRadius: mixed, strokeWeight: mixed, fills: solid(1, 0, 0) }, parent);
      makeNode("TEXT", { name: "Rich", characters: "bold and plain", fontName: mixed, fontSize: 20, textAlignHorizontal: "CENTER" }, parent);
      const tree = (await exportOf(parent)).tree;
      expect(find(tree, "Corners")).toEqual({ id: expect.any(String), type: "rectangle", name: "Corners", fillColor: "#FF0000" });
      expect(find(tree, "Rich")).toEqual({ id: expect.any(String), type: "text", name: "Rich", text: "bold and plain", textAlignHorizontal: "CENTER", textAutoResize: "WIDTH_AND_HEIGHT" });
    });

    test("line height not in pixels, fractional font size and percent letter spacing are left out", async () => {
      const parent = makeNode("FRAME", { name: "P" }, page);
      makeNode("TEXT", { name: "Pct", characters: "x", lineHeight: { unit: "PERCENT", value: 150 }, fontSize: 13.5, letterSpacing: { unit: "PERCENT", value: 5 } }, parent);
      makeNode("TEXT", { name: "Px", characters: "y", lineHeight: { unit: "PIXELS", value: 22 }, fontSize: 16, letterSpacing: { unit: "PIXELS", value: 1.25 } }, parent);
      const tree = (await exportOf(parent)).tree;
      const pct = find(tree, "Pct");
      expect([pct.lineHeight, pct.fontSize, pct.letterSpacing]).toEqual([undefined, undefined, undefined]);
      expect(find(tree, "Px")).toMatchObject({ lineHeight: 22, fontSize: 16, letterSpacing: 1.25 });
    });

    test("paint lists: several visible paints, a non-solid, a hidden or blended paint are left out; none is #00000000", async () => {
      const parent = makeNode("FRAME", { name: "P" }, page);
      makeNode("RECTANGLE", { name: "Two", fills: [...solid(1, 0, 0), ...solid(0, 1, 0)] }, parent);
      makeNode("RECTANGLE", { name: "Gradient", fills: [{ type: "GRADIENT_LINEAR", gradientStops: [] }] }, parent);
      makeNode("RECTANGLE", { name: "Hidden", fills: [{ ...solid(1, 0, 0)[0], visible: false }] }, parent);
      makeNode("RECTANGLE", { name: "Blend", fills: [{ ...solid(1, 0, 0)[0], blendMode: "MULTIPLY" }] }, parent);
      makeNode("TEXT", { name: "Clear", characters: "z", fills: [] }, parent);
      makeNode("FRAME", { name: "White", fills: solid(1, 1, 1) }, parent);
      const tree = (await exportOf(parent)).tree;
      for (const name of ["Two", "Gradient", "Hidden", "Blend"]) expect(find(tree, name).fillColor).toBeUndefined();
      expect(find(tree, "Clear").fontColor).toBe(NO_PAINT);
      expect(find(tree, "White").fillColor).toBe("#FFFFFF");
    });

    test("strokeCap only when every vertex agrees; pathData as Figma reads it back, single NONZERO path only", async () => {
      const parent = makeNode("FRAME", { name: "P" }, page);
      const path = (data: string, windingRule = "NONZERO") => ({ windingRule, data });
      makeNode("VECTOR", { name: "Agree", vectorPaths: [path("M 0 0 L 5 5 Z")], vectorNetwork: { vertices: [{ strokeCap: "ROUND" }, { strokeCap: "ROUND" }] } }, parent);
      makeNode("VECTOR", { name: "Disagree", vectorPaths: [path("M 0 0 L 5 5")], vectorNetwork: { vertices: [{ strokeCap: "ROUND" }, { strokeCap: "ARROW_LINES" }] } }, parent);
      makeNode("VECTOR", { name: "TwoPaths", vectorPaths: [path("M 0 0 L 1 1"), path("M 2 2 L 3 3")] }, parent);
      makeNode("VECTOR", { name: "EvenOdd", vectorPaths: [path("M 0 0 L 1 1", "EVENODD")] }, parent);
      const tree = (await exportOf(parent)).tree;
      expect(find(tree, "Agree")).toMatchObject({ strokeCap: "ROUND", pathData: "M 0 0 L 5 5 Z" });
      expect(find(tree, "Disagree").strokeCap).toBeUndefined();
      expect(find(tree, "TwoPaths").pathData).toBeUndefined();
      expect(find(tree, "EvenOdd").pathData).toBeUndefined();
    });

    test("effects the write path cannot reproduce are left out", async () => {
      const parent = makeNode("FRAME", { name: "P" }, page);
      const shadow = { type: "DROP_SHADOW", visible: true, color: { r: 0, g: 0, b: 0, a: 0.25 }, offset: { x: 0, y: 4 }, radius: 4, spread: 0, blendMode: "NORMAL" };
      makeNode("RECTANGLE", { name: "Plain", effects: [shadow] }, parent);
      makeNode("RECTANGLE", { name: "Bound", effects: [{ ...shadow, boundVariables: { radius: { type: "VARIABLE_ALIAS", id: "float" } } }] }, parent);
      makeNode("RECTANGLE", { name: "Noise", effects: [{ type: "NOISE" }] }, parent);
      const tree = (await exportOf(parent)).tree;
      expect(find(tree, "Plain").effects).toEqual([{ ...shadow, color: "#00000040" }]);
      expect(find(tree, "Bound").effects).toBeUndefined();
      expect(find(tree, "Noise").effects).toBeUndefined();
    });

    test("auto-layout-only properties are left out of a frame without auto-layout", async () => {
      const frame = makeNode("FRAME", { name: "Plain", paddingTop: 3, itemSpacing: 9, primaryAxisAlignItems: "CENTER" }, page);
      expect((await exportOf(frame)).tree).toEqual({ id: frame.id, type: "frame", name: "Plain", children: [] });
    });
  });

  describe("variables (4)", () => {
    test("a bound colour comes back as $var:, local or library; one whose name resolves elsewhere is left out", async () => {
      const parent = makeNode("FRAME", { name: "P" }, page);
      makeNode("RECTANGLE", { name: "Local", fills: bound("color") }, parent);
      makeNode("RECTANGLE", { name: "Library", fills: bound("a-token") }, parent);
      makeNode("RECTANGLE", { name: "Shadowed", fills: bound("shadowed") }, parent);
      makeNode("RECTANGLE", { name: "Gone", fills: bound("missing") }, parent);
      const tree = (await exportOf(parent)).tree;
      expect(find(tree, "Local").fillColor).toBe("$var:Colors/Primary");
      expect(find(tree, "Library").fillColor).toBe("$var:Library A/Accent");
      // "Colors/Primary" names the local variable, so writing it back would bind a different one.
      expect(find(tree, "Shadowed").fillColor).toBeUndefined();
      expect(find(tree, "Gone").fillColor).toBeUndefined();
    });

    test("each variable is looked up once per run", async () => {
      const parent = makeNode("FRAME", { name: "P" }, page);
      for (let i = 0; i < 5; i++) makeNode("RECTANGLE", { name: `R${i}`, fills: bound("color"), strokes: bound("color") }, parent);
      let lookups = 0;
      const variables = (globalThis as any).figma.variables;
      const original = variables.getVariableByIdAsync;
      variables.getVariableByIdAsync = async (id: string) => { lookups++; return original(id); };
      await exportOf(parent);
      expect(lookups).toBe(1);
    });
  });

  describe("OpaqueNodes and instances (5)", () => {
    test("group, ellipse, section, rotated frame and grid frame come back opaque with their subtree absent", async () => {
      const parent = makeNode("FRAME", { name: "P" }, page);
      const group = makeNode("GROUP", { name: "G" }, parent);
      const hidden = makeNode("RECTANGLE", { name: "InGroup" }, group);
      makeNode("ELLIPSE", { name: "E" }, parent);
      const section = makeNode("SECTION", { name: "S" }, parent);
      makeNode("FRAME", { name: "InSection" }, section);
      const rotated = makeNode("FRAME", { name: "Tilted", rotation: 15 }, parent);
      makeNode("TEXT", { name: "InTilted", characters: "t" }, rotated);
      makeNode("FRAME", { name: "Grid", layoutMode: "GRID" }, parent);
      const exported = await exportOf(parent);
      const opaque = exported.tree.children;
      expect(opaque.map((n: any) => [n.type, n.name, n.nodeType])).toEqual([
        ["$opaque", "G", "GROUP"], ["$opaque", "E", "ELLIPSE"], ["$opaque", "S", "SECTION"], ["$opaque", "Tilted", "FRAME"], ["$opaque", "Grid", "FRAME"],
      ]);
      for (const node of opaque) expect(Object.keys(node).sort()).toEqual(["id", "name", "nodeType", "type"]);
      expect(JSON.stringify(exported.tree)).not.toContain(hidden.id);
      expect(JSON.stringify(exported.tree)).not.toContain("InSection");
      expect(exported.opaqueCount).toBe(5);
    });

    test("an instance is a leaf with flattened properties; its children are never walked", async () => {
      const parent = makeNode("FRAME", { name: "P" }, page);
      const instance = (await (globalThis as any).figma.importComponentByKeyAsync("badge")).createInstance();
      parent.appendChild(instance);
      const inner = makeNode("TEXT", { id: `I${instance.id};5:6`, name: "Label", characters: "New" }, instance);
      const exported = await exportOf(parent);
      expect(exported.tree.children[0]).toEqual({
        id: instance.id, type: "instance", name: "badge", componentKey: "badge", properties: { State: "Off", "Label#1:2": "New" },
      });
      expect(JSON.stringify(exported.tree)).not.toContain(inner.id);
    });

    test("an instance whose main component is gone is opaque", async () => {
      const parent = makeNode("FRAME", { name: "P" }, page);
      makeNode("INSTANCE", { name: "Orphan", main: null, componentProperties: {} }, parent);
      expect((await exportOf(parent)).tree.children[0]).toMatchObject({ type: "$opaque", nodeType: "INSTANCE" });
    });

    test("a root the format cannot write, or an id inside an instance, is refused", async () => {
      const group = makeNode("GROUP", { name: "G" }, page);
      await expect(exportOf(group)).rejects.toThrow("a Spec root must be a frame");
      await expect(exportSpec({ nodeId: "I1:2;3:4" })).rejects.toThrow("inside an instance");
    });
  });

  // A frame of `width` children, each a frame holding `depth` nested frames.
  function buildWide(width: number, inner: number) {
    const root = makeNode("FRAME", { name: "Root" }, page);
    const kids = [];
    for (let i = 0; i < width; i++) {
      const kid = makeNode("FRAME", { name: `K${i}` }, root);
      for (let j = 0; j < inner; j++) makeNode("RECTANGLE", { name: `K${i}R${j}` }, kid);
      kids.push(kid);
    }
    return { root, kids };
  }

  describe("node budget (6)", () => {
    test("a frame whose children were cut off is a truncated OpaqueNode, and none of its visited children leak", async () => {
      const { root, kids } = buildWide(2, 3);
      // Pre-order: Root, K0, K0R0..2, K1, K1R0 -> budget of 6 cuts K1's children.
      const exported = await exportOf(root, { maxNodes: 6 });
      expect(exported.truncated).toBe(true);
      expect(exported.tree.children[0].children).toHaveLength(3);
      expect(exported.tree.children[1]).toEqual({ id: kids[1].id, type: "$opaque", name: "K1", nodeType: "FRAME", truncated: true });
      expect(JSON.stringify(exported.tree)).not.toContain("K1R0");
    });

    test("the depth limit truncates the same way", async () => {
      const { root } = buildWide(1, 2);
      const exported = await exportOf(root, { maxDepth: 1 });
      expect(exported.tree.children[0]).toMatchObject({ type: "$opaque", truncated: true });
    });

    test("a budget too small to read the root's children is an error, not an empty Spec", async () => {
      const { root } = buildWide(1, 1);
      await expect(exportOf(root, { maxDepth: 0 })).rejects.toThrow("too small");
    });

    test("progress goes out every 50 nodes", async () => {
      const { root } = buildWide(1, 120);
      await exportOf(root, { commandId: "cmd" });
      const inProgress = progress.filter(m => m.type === "command_progress" && m.status === "in_progress");
      expect(inProgress.map(m => m.processedItems)).toEqual([50, 100]);
      expect(progress.at(-1)).toMatchObject({ status: "completed", commandType: "export_spec" });
    });
  });

  describe("expected file and page", () => {
    test("a wrong file name or page is refused; the file key wins when both sides have one", async () => {
      const frame = makeNode("FRAME", { name: "F" }, page);
      await expect(exportOf(frame, { expect: { fileName: "Other file" } })).rejects.toThrow("Wrong file");
      const other = makeNode("PAGE", { name: "Page 2", async loadAsync() { this.loaded = true; } });
      await expect(exportOf(frame, { expect: { pageId: other.id } })).rejects.toThrow("Wrong page");
      expect(other.loaded).toBe(true);
      (globalThis as any).figma.fileKey = "KEYAAAAAAAAA";
      await expect(exportOf(frame, { expect: { fileKey: "KEYBBBBBBBBB", fileName: "Test file" } })).rejects.toThrow("Wrong file");
      // Same key, renamed file: the key decides.
      expect((await exportOf(frame, { expect: { fileKey: "KEYAAAAAAAAA", fileName: "Renamed" } })).rootId).toBe(frame.id);
    });

    test("the node's page is loaded by id, never taken from currentPage", async () => {
      const other = makeNode("PAGE", { name: "Page 2", async loadAsync() { this.loaded = true; } });
      const frame = makeNode("FRAME", { name: "Elsewhere" }, other);
      const exported = await exportOf(frame);
      expect(other.loaded).toBe(true);
      expect(exported.pageId).toBe(other.id);
    });
  });

  // --- pull_spec on disk ---

  let dir: string;
  let base: string;
  let outside: string;
  let sent: any[];

  const send = async (command: string, params: any, timeoutMs?: number) => {
    sent.push({ command, params, timeoutMs });
    if (command !== "export_spec") throw new Error("unexpected command " + command);
    return exportSpec(params);
  };
  const opts = (extra: any = {}) => ({ env: { L2F_SPEC_DIR: base }, userFileKey: () => undefined, now: () => new Date("2026-11-12T10:00:00.000Z"), ...extra });
  const readJson = (path: string) => JSON.parse(readFileSync(path, "utf8"));

  function seedDesign() {
    const root = makeNode("FRAME", { name: "Screen", layoutMode: "VERTICAL", fills: solid(1, 1, 1) }, page);
    makeNode("TEXT", { name: "Heading", characters: "Hello" }, root);
    makeNode("GROUP", { name: "Logo" }, root);
    return root;
  }

  beforeEach(() => {
    dir = realpathSync(mkdtempSync(join(tmpdir(), "l2f-spec-")));
    base = join(dir, "base");
    outside = join(dir, "outside");
    mkdirSync(base);
    mkdirSync(outside);
    sent = [];
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  describe("pull_spec writes a Spec and SpecLock", () => {
    test("files, header, lock entries and a small result", async () => {
      const root = seedDesign();
      const result = await pullSpec({ nodeId: root.id, path: "screen.l2f.json" }, send as any, opts());
      expect(result).toEqual({ path: join(base, "screen.l2f.json"), lockPath: join(base, "screen.l2f.lock.json"), nodeCount: 3, opaqueCount: 1, truncated: false });
      expect(sent).toEqual([{ command: "export_spec", params: { nodeId: root.id, expect: {}, maxNodes: undefined, maxDepth: undefined }, timeoutMs: EXPORT_TIMEOUT_MS }]);
      expect(EXPORT_TIMEOUT_MS).toBe(120000);

      const spec = readJson(result.path);
      const lock = readJson(result.lockPath);
      expect(spec).toMatchObject({ l2fSpec: 1, fileKey: null, fileName: "Test file", pageId: page.id, rootId: root.id });
      expect(Object.keys(spec)).toEqual(["l2fSpec", "fileKey", "fileName", "pageId", "rootId", "tree"]);
      expect(lock).toMatchObject({
        l2fLock: 1, fileKey: null, fileName: "Test file", pageId: page.id, rootId: root.id, pulledAt: "2026-11-12T10:00:00.000Z",
        specHash: specHash(spec), supersededFrameId: null, pendingApply: null,
      });
      // Lock props are exactly the Spec node without id and children.
      const { id: _id, children, ...rootProps } = spec.tree;
      expect(lock.nodes[root.id]).toEqual({ props: rootProps, propsHash: hashProps(rootProps), parentId: page.id, children: children.map((c: any) => c.id) });
      expect(Object.keys(lock.nodes)).toHaveLength(3);
      expect(readdirSync(base).sort()).toEqual(["screen.l2f.json", "screen.l2f.lock.json"]);
    });

    test("the tool returns paths and counts only, never the tree", async () => {
      const root = seedDesign();
      const tools: Record<string, any> = {};
      registerSpecTools({ tool: (name: string, _d: string, _s: any, run: any) => { tools[name] = run; } } as any, send as any, opts());
      const response = await tools.pull_spec({ nodeId: root.id, path: "s.l2f.json" });
      const parsed = JSON.parse(response.content[0].text);
      expect(Object.keys(parsed).sort()).toEqual(["lockPath", "nodeCount", "opaqueCount", "path", "truncated"]);
      expect(response.content[0].text).not.toContain("Heading");
      const failed = await tools.pull_spec({ nodeId: root.id, path: "s.json" });
      expect(failed.isError).toBe(true);
    });

    test("a truncated pull says so, and the lock holds no entries under the cut-off parent", async () => {
      const { root, kids } = buildWide(2, 3);
      const result = await pullSpec({ nodeId: root.id, path: "wide.l2f.json", maxNodes: 6 }, send as any, opts());
      expect(result.truncated).toBe(true);
      expect(result.note).toContain("truncated: true");
      const lock = readJson(result.lockPath);
      expect(lock.nodes[kids[1].id]).toMatchObject({ children: [], props: { type: "$opaque", truncated: true } });
      expect(Object.values(lock.nodes).some((n: any) => n.parentId === kids[1].id)).toBe(false);
    });

    test("the channel's file key is recorded when the plugin has none", async () => {
      const root = seedDesign();
      const result = await pullSpec({ nodeId: root.id, path: "k.l2f.json" }, send as any, opts({ userFileKey: () => "USERKEY12345" }));
      expect(readJson(result.path).fileKey).toBe("USERKEY12345");
    });
  });

  describe("file safety (7)", () => {
    const refuse = async (path: string, message: string, extra: any = {}) => {
      const root = seedDesign();
      await expect(pullSpec({ nodeId: root.id, path }, send as any, opts(extra))).rejects.toThrow(message);
      expect(sent).toEqual([]);
    };

    test("wrong extension", async () => {
      await refuse("x.json", "must name a file ending in");
      await refuse("x.l2f.lock.json", "must name a file ending in");
      await refuse(".l2f.json", "must name a file ending in");
    });

    test("escape through .. or an absolute path outside the base", async () => {
      await refuse("../outside/x.l2f.json", "outside the Spec directory");
      await refuse(join(outside, "x.l2f.json"), "outside the Spec directory");
    });

    test("escape through a symlinked parent directory", async () => {
      symlinkSync(outside, join(base, "link"));
      await refuse("link/x.l2f.json", "outside the Spec directory");
      expect(readdirSync(outside)).toEqual([]);
    });

    test("a symlink inside the base and an absolute path inside the base are accepted", async () => {
      mkdirSync(join(base, "real"));
      symlinkSync(join(base, "real"), join(base, "inlink"));
      const root = seedDesign();
      const viaLink = await pullSpec({ nodeId: root.id, path: "inlink/a.l2f.json" }, send as any, opts());
      expect(viaLink.path).toBe(join(base, "real", "a.l2f.json"));
      const absolute = await pullSpec({ nodeId: root.id, path: join(base, "b.l2f.json") }, send as any, opts());
      expect(absolute.path).toBe(join(base, "b.l2f.json"));
    });

    test("a Spec or SpecLock that is a symlink is refused and its target untouched", async () => {
      writeFileSync(join(outside, "target.json"), "keep");
      symlinkSync(join(outside, "target.json"), join(base, "s.l2f.json"));
      await refuse("s.l2f.json", "symbolic link");
      symlinkSync(join(outside, "target.json"), join(base, "t.l2f.lock.json"));
      await refuse("t.l2f.json", "symbolic link");
      expect(readFileSync(join(outside, "target.json"), "utf8")).toBe("keep");
    });

    test("an existing file that is not a Spec is never overwritten, even with replaceEdited", async () => {
      writeFileSync(join(base, "notes.l2f.json"), '{"hello": 1}');
      await refuse("notes.l2f.json", "is not a Spec");
      writeFileSync(join(base, "junk.l2f.json"), "not json");
      await refuse("junk.l2f.json", "not valid JSON");
      const root = seedDesign();
      await expect(pullSpec({ nodeId: root.id, path: "notes.l2f.json", replaceEdited: true }, send as any, opts())).rejects.toThrow("is not a Spec");
      expect(readFileSync(join(base, "notes.l2f.json"), "utf8")).toBe('{"hello": 1}');
    });

    test("a missing directory and a relative L2F_SPEC_DIR are refused", async () => {
      await refuse("nowhere/x.l2f.json", "does not exist");
      expect(() => specBaseDir({ L2F_SPEC_DIR: "relative/dir" })).toThrow("absolute path");
    });

    test("writes leave no temp files and replace the file whole", async () => {
      const root = seedDesign();
      await pullSpec({ nodeId: root.id, path: "w.l2f.json" }, send as any, opts());
      await pullSpec({ nodeId: root.id, path: "w.l2f.json" }, send as any, opts());
      expect(readdirSync(base).filter(f => f.endsWith(".tmp"))).toEqual([]);
    });
  });

  describe("unapplied edits and unfinished applies (8)", () => {
    test("an edited Spec is refused and left as it was; reformatting is not an edit", async () => {
      const root = seedDesign();
      const { path } = await pullSpec({ nodeId: root.id, path: "e.l2f.json" }, send as any, opts());
      writeFileSync(path, JSON.stringify(readJson(path)));
      await pullSpec({ nodeId: root.id, path: "e.l2f.json" }, send as any, opts());
      const edited = readJson(path);
      edited.tree.children[0].text = "Changed";
      writeFileSync(path, JSON.stringify(edited, null, 2));
      await expect(pullSpec({ nodeId: root.id, path: "e.l2f.json" }, send as any, opts())).rejects.toThrow("edits that were never applied");
      expect(readJson(path).tree.children[0].text).toBe("Changed");
    });

    test("pendingApply is refused; replaceEdited backs the pair up and pulls fresh", async () => {
      const root = seedDesign();
      const { path, lockPath } = await pullSpec({ nodeId: root.id, path: "p.l2f.json" }, send as any, opts());
      const lock = readJson(lockPath);
      writeFileSync(lockPath, JSON.stringify({ ...lock, pendingApply: "plan-7" }));
      await expect(pullSpec({ nodeId: root.id, path: "p.l2f.json" }, send as any, opts())).rejects.toThrow("plan plan-7");
      const result = await pullSpec({ nodeId: root.id, path: "p.l2f.json", replaceEdited: true }, send as any, opts());
      expect(result.backups).toEqual([`${path}.2026-11-12T10-00-00-000Z.bak`, `${lockPath}.2026-11-12T10-00-00-000Z.bak`]);
      expect(readJson(`${lockPath}.2026-11-12T10-00-00-000Z.bak`).pendingApply).toBe("plan-7");
      expect(readJson(lockPath).pendingApply).toBeNull();
    });

    test("a Spec with no SpecLock beside it is refused", async () => {
      const root = seedDesign();
      const { lockPath } = await pullSpec({ nodeId: root.id, path: "n.l2f.json" }, send as any, opts());
      rmSync(lockPath);
      await expect(pullSpec({ nodeId: root.id, path: "n.l2f.json" }, send as any, opts())).rejects.toThrow("no SpecLock");
    });

    test("re-pulling the same root sends the Spec's file and page as the expectation", async () => {
      const root = seedDesign();
      await pullSpec({ nodeId: root.id, path: "r.l2f.json" }, send as any, opts());
      (globalThis as any).figma.root = { name: "Copy of Test file" };
      await expect(pullSpec({ nodeId: root.id, path: "r.l2f.json" }, send as any, opts())).rejects.toThrow("Wrong file");
      expect(sent.at(-1).params.expect).toEqual({ fileKey: null, fileName: "Test file", pageId: page.id });
    });

    test("a recorded user file key that differs from the connected one is refused", async () => {
      const root = seedDesign();
      await pullSpec({ nodeId: root.id, path: "u.l2f.json" }, send as any, opts({ userFileKey: () => "USERKEY12345" }));
      await expect(pullSpec({ nodeId: root.id, path: "u.l2f.json" }, send as any, opts({ userFileKey: () => "OTHERKEY1234" }))).rejects.toThrow("Wrong file");
    });
  });

  describe("flag and launch paths (9)", () => {
    test("SPEC_SYNC is a feature; pull_spec is registered only when it is on", () => {
      expect(FEATURES).toContain("SPEC_SYNC");
      expect(isEnabled("SPEC_SYNC", { L2F_ALL: "1" })).toBe(true);
      const names = (env: Record<string, string>) => {
        const tools: string[] = [];
        registerWhenEnabled("SPEC_SYNC", registerSpecTools, { tool: (name: string) => tools.push(name) } as any, send as any, env);
        return tools;
      };
      expect(names({})).toEqual([]);
      expect(names({ L2F_SPEC_SYNC: "1" })).toEqual(["pull_spec", "plan_spec"]);
      const server = readFileSync("src/llm2figma_mcp/server.ts", "utf8");
      expect(server).toContain('registerFeature("SPEC_SYNC", registerSpecTools)');
      expect(server.match(/registerSpecTools/g)).toHaveLength(2);
    });

    test("L2F_SPEC_DIR reaches both launch paths as a setting, not a flag", () => {
      expect(SETTING_ENV_KEYS).toEqual(["L2F_SPEC_DIR"]);
      expect(FLAG_ENV_KEYS).not.toContain("L2F_SPEC_DIR");
      expect(makeMcpConfig({}, "/bun", "/repo", {}).mcpServers.LLM2Figma.env.L2F_SPEC_DIR).toBe("${L2F_SPEC_DIR:-}");
      const manifest = JSON.parse(readFileSync("plugin/.claude-plugin/plugin.json", "utf8"));
      expect(manifest.mcpServers.LLM2Figma.env.L2F_SPEC_DIR).toBe("${L2F_SPEC_DIR:-}");
      expect(manifest.mcpServers.LLM2Figma.env.L2F_SPEC_SYNC).toBe("${L2F_SPEC_SYNC:-}");
    });

    test("relative paths resolve against L2F_SPEC_DIR, or the working directory when it is unset or empty", async () => {
      expect((await resolveSpecPaths("a.l2f.json", specBaseDir({ L2F_SPEC_DIR: base }))).specPath).toBe(join(base, "a.l2f.json"));
      expect(specBaseDir({ L2F_SPEC_DIR: "" }, () => outside)).toBe(outside);
      const root = seedDesign();
      const result = await pullSpec({ nodeId: root.id, path: "c.l2f.json" }, send as any, opts({ env: {}, cwd: () => outside }));
      expect(result.path).toBe(join(outside, "c.l2f.json"));
      expect(existsSync(join(base, "c.l2f.json"))).toBe(false);
    });
  });

  describe("editor gate and dispatch", () => {
    test("export_spec is a read: Dev Mode allows it", () => {
      expect(() => assertEditorAllowed("export_spec", "dev")).not.toThrow();
      expect(allowedEditors("export_spec")).toContain("dev");
    });
    test("main.ts routes export_spec to exportSpec", () => {
      const main = readFileSync("src/llm2figma_plugin/src/main.ts", "utf8");
      expect(main).toMatch(/case "export_spec":\s*\n\s*return await exportSpec\(params\);/);
    });
  });
});
