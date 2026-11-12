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
  NO_PAINT, SPEC_DEFAULTS, SPEC_VOCABULARY, canonicalColor, canonicalValue, hashProps, hashString, lockNodesFromTree, lockProps,
  normalizeNode, normalizeSpecTree, specHash, stableStringify, type SpecType,
} from "../src/shared/spec";
import { MAX_SPEC_BYTES, SpecReadCache, exportSpec, readSpecProps } from "../src/llm2figma_plugin/src/spec";
import {
  applyDeferredFill, createNode, createNodeTree, createNodeTreeContext, resolveAndBind, updateNodeProperties,
} from "../src/llm2figma_plugin/src/node-tree";
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


// Figma's own creation paints: a new frame is white, a new rectangle #D9D9D9,
// new text black; vectors and the rest start with none.
const CREATION_FILLS: Record<string, () => any[]> = {
  FRAME: () => [{ type: "SOLID", color: { r: 1, g: 1, b: 1 }, opacity: 1 }],
  RECTANGLE: () => [{ type: "SOLID", color: { r: 0.85098, g: 0.85098, b: 0.85098 }, opacity: 1 }],
  TEXT: () => [{ type: "SOLID", color: { r: 0, g: 0, b: 0 }, opacity: 1 }],
};

function makeNode(type: string, extra: any = {}, parent: any = null): any {
  const node: any = {
    id: `${++nextId}:1`, type, name: type, parent: null, children: [], rotation: 0, visible: true,
    x: 0, y: 0, width: 100, height: 100, opacity: 1, fills: (CREATION_FILLS[type] || (() => []))(), strokes: [], effects: [],
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
      textDecoration: "NONE", height: 20, ...extra,
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
      mainCalls: 0,
      async getMainComponentAsync() { this.mainCalls++; return this.main ?? null; },
      swapComponent(target: any) { this.main = target; this.componentProperties = propertiesOf(target); },
      // Like Figma: a VARIANT value swaps the main component to that variant.
      setProperties(props: any) {
        for (const [key, value] of Object.entries(props)) {
          const existing = this.componentProperties[key];
          this.componentProperties[key] = { type: existing ? existing.type : "VARIANT", value };
        }
        const set = this.main && this.main.parent && this.main.parent.type === "COMPONENT_SET" ? this.main.parent : null;
        if (set) {
          const wanted = (variant: any) => Object.entries(variant.variantProperties).every(([k, v]) => this.componentProperties[k].value === v);
          const variant = set.children.find(wanted);
          if (variant) this.main = variant;
        }
      },
      ...extra,
    });
  }
  // Like Figma: FILL needs an auto-layout parent, HUG on a frame its own auto-layout.
  for (const key of ["layoutSizingHorizontal", "layoutSizingVertical"]) {
    let value = node[key];
    Object.defineProperty(node, key, {
      enumerable: true, configurable: true,
      get() { return value; },
      set(next: string) {
        if (next === "FILL" && !(this.parent && this.parent.layoutMode && this.parent.layoutMode !== "NONE")) throw new Error("FILL needs an auto-layout parent");
        if (next === "HUG" && this.type === "FRAME" && this.layoutMode === "NONE") throw new Error("HUG needs auto-layout");
        value = next;
      },
    });
  }
  nodes.set(node.id, node);
  if (parent) parent.appendChild(node);
  return node;
}

// The mock library: "plain" and "other" are components; "badge" is a component
// set with variants State=Off (default) and State=On, a TEXT and an
// INSTANCE_SWAP property.
function propertiesOf(main: any): Record<string, any> {
  if (!main.parent || main.parent.type !== "COMPONENT_SET") return {};
  return {
    ...Object.fromEntries(Object.entries(main.variantProperties).map(([k, v]) => [k, { type: "VARIANT", value: v }])),
    "Label#1:2": { type: "TEXT", value: "New" },
    "Icon#3:4": { type: "INSTANCE_SWAP", value: "9:9" },
  };
}

function withInstances(main: any): any {
  main.createInstance = () => makeNode("INSTANCE", { name: main.parent && main.parent.type === "COMPONENT_SET" ? main.parent.name : main.name, main, componentProperties: propertiesOf(main) });
  return main;
}

let library: Record<string, any> = {};
function component(key: string, remote = true): any {
  if (!library[key]) library[key] = withInstances({ id: "comp-" + key, key, remote, type: "COMPONENT", name: key, parent: null });
  return library[key];
}
function componentSet(key: string, remote = true): any {
  if (!library["set:" + key]) {
    const set: any = { id: "set-" + key, key, remote, type: "COMPONENT_SET", name: key, children: [] };
    for (const state of ["Off", "On"]) {
      set.children.push(withInstances({ id: `comp-${key}-${state}`, key: `${key}-${state}`, remote, type: "COMPONENT", name: `State=${state}`, parent: set, variantProperties: { State: state } }));
    }
    set.defaultVariant = set.children[0];
    library["set:" + key] = set;
  }
  return library["set:" + key];
}
// A local component and a local component set, on the page (they have node ids).
function localComponent(): any {
  const local = makeNode("COMPONENT", { name: "Local", key: "localkey", remote: false }, page);
  return withInstances(local);
}
function localSet(): any {
  const set = makeNode("COMPONENT_SET", { name: "Toggle", key: "localsetkey", remote: false }, page);
  for (const state of ["Off", "On"]) {
    const variant = makeNode("COMPONENT", { name: `State=${state}`, key: `toggle-${state}`, remote: false, variantProperties: { State: state } }, set);
    withInstances(variant);
  }
  set.defaultVariant = set.children[0];
  return set;
}

function freshFigma(overrides: any = {}) {
  nextId = 0;
  nodes = new Map();
  progress = [];
  library = {};
  page = makeNode("PAGE", { name: "Page 1", async loadAsync() { this.loaded = true; } });
  (globalThis as any).figma = {
    mixed: Symbol("mixed"),
    editorType: "figma",
    fileKey: undefined,
    root: { name: "Test file" },
    currentPage: page,
    ui: { postMessage: (message: any) => { progress.push(message); } },
    getNodeByIdAsync: async (id: string) => nodes.get(id) || null,
    importComponentByKeyAsync: async (key: string) => {
      const variant = /^(.*)-(Off|On)$/.exec(key);
      return variant ? componentSet(variant[1]).children.find((v: any) => v.key === key) : component(key);
    },
    importComponentSetByKeyAsync: async (key: string) => componentSet(key),
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

  const bound = (id: string, opacity = 1) => [{ type: "SOLID", color: { r: 1, g: 0, b: 0 }, opacity, boundVariables: { color: { type: "VARIABLE_ALIAS", id } } }];
  const solid = (r: number, g: number, b: number, opacity = 1) => [{ type: "SOLID", color: { r, g, b }, opacity }];

  function stripIds(node: any): any {
    const { id: _id, children, ...rest } = node;
    return children ? { ...rest, children: children.map(stripIds) } : rest;
  }

  async function create(tree: any, parentId?: string): Promise<any> {
    const result: any = await createNodeTree({ tree, parentId });
    expect(result.errors).toBeUndefined();
    return nodes.get(result.nodes[0].id);
  }

  async function exportOf(node: any, extra: any = {}) {
    return exportSpec({ nodeId: node.id, ...extra });
  }

  // The 11d write path for one existing node: resolve colours, update only the
  // named keys, FILL on a frame through its parent, then bind.
  async function applyUpdate(node: any, spec: any, only: Set<string>) {
    const colors = await resolveAndBind(spec, only);
    const result = await updateNodeProperties(node, colors.resolved, only);
    const deferred = applyDeferredFill(node, colors.resolved, only, { checkParent: true });
    await colors.bind(node);
    return { ...result, unhandled: result.unhandled.filter(key => !deferred.includes(key) && !(node.type === "FRAME" && spec[key] === "FILL")) };
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
    test("every colour form create accepts gives one canonical form", () => {
      expect(canonicalColor("#3d6daa")).toBe("#3D6DAA");
      expect(canonicalColor("#fff")).toBe("#FFFFFF");
      expect(canonicalColor({ r: 1, g: 1, b: 1, a: 1 })).toBe("#FFFFFF");
      expect(canonicalColor({ r: 0, g: 0, b: 1, a: 0.5 })).toBe("#0000FF80");
      expect(canonicalColor("#0000ff80")).toBe("#0000FF80");
      expect(canonicalColor({ r: 0.3, g: 0.2, b: 0.1, a: 0 })).toBe(NO_PAINT);
      expect(canonicalColor("$var:Colors/Primary")).toBe("$var:Colors/Primary");
      // A bound paint below full opacity keeps its opacity; at 1 it is the plain reference.
      expect(canonicalColor({ $var: "Colors/Primary", opacity: 0.304 })).toEqual({ $var: "Colors/Primary", opacity: 0.3 });
      expect(canonicalColor({ $var: "$var:Colors/Primary", opacity: 0.3 })).toEqual({ $var: "Colors/Primary", opacity: 0.3 });
      expect(canonicalColor({ $var: "Colors/Primary", opacity: 1 })).toBe("$var:Colors/Primary");
      expect(canonicalColor({ $var: "Colors/Primary" })).toBe("$var:Colors/Primary");
    });

    test("numbers are rounded to 2 decimals on both sides, and key order never matters", () => {
      const a = normalizeNode({ type: "rectangle", name: "R", width: 10.004, height: "20", fillColor: "#ff0000" });
      const b = normalizeNode({ fillColor: { r: 1, g: 0, b: 0 }, height: 20, width: 10, name: "R", type: "rectangle" });
      expect(a).toEqual(b);
      expect(hashProps(a)).toBe(hashProps(b));
      expect(hashProps({ ...a, width: 11 })).not.toBe(hashProps(a));
      expect(stableStringify({ b: 1.005e0, a: [0.123] })).toBe('{"a":[0.12],"b":1}');
    });

    test("create's shorthands resolve the way create resolves them; text gets no name default", () => {
      expect(normalizeNode({ type: "text", text: "Hi", fontWeight: 700, width: 120 }))
        .toEqual({ type: "text", text: "Hi", width: 120, fontStyle: "Bold", textAutoResize: "HEIGHT" });
      expect(normalizeNode({ type: "frame" })).toEqual({ type: "frame", name: "Frame" });
      expect(() => normalizeNode({ type: "ellipse" })).toThrow("Unknown Spec node type");
    });

    test("properties outside a type's vocabulary are dropped", () => {
      expect(normalizeNode({ type: "text", text: "a", fills: [], cornerRadius: 4 })).toEqual({ type: "text", text: "a", textAutoResize: "WIDTH_AND_HEIGHT" });
    });

    test("rule D: x/y, FIXED width/height, and padding, spacing and itemReverseZIndex under auto-layout are kept at their defaults", () => {
      expect(normalizeNode({ type: "rectangle", name: "R", x: 0, y: 0, width: 100, height: 100 }))
        .toEqual({ type: "rectangle", name: "R", x: 0, y: 0, width: 100, height: 100 });
      const al = { type: "frame", name: "F", layoutMode: "HORIZONTAL", paddingTop: 10, paddingRight: 10, paddingBottom: 10, paddingLeft: 10, itemSpacing: 0, itemReverseZIndex: true };
      expect(normalizeNode(al)).toEqual(al);
      // Without auto-layout they mean nothing and are dropped; inside an auto-layout parent x/y are derived.
      expect(normalizeNode({ ...al, layoutMode: "NONE" })).toEqual({ type: "frame", name: "F" });
      expect(normalizeNode({ type: "rectangle", name: "R", x: 0, y: 0 }, { layoutMode: "VERTICAL" })).toEqual({ type: "rectangle", name: "R" });
      // HUG / FILL axes and text boxes still derive their size.
      expect(normalizeNode({ type: "frame", name: "F", layoutMode: "VERTICAL", layoutSizingVertical: "HUG", width: 100, height: 37, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, itemSpacing: 0, itemReverseZIndex: false }).height).toBeUndefined();
      expect(normalizeNode({ type: "text", text: "t", textAutoResize: "NONE", width: 80, height: 30 })).toMatchObject({ width: 80, height: 30 });
      expect(normalizeNode({ type: "text", text: "t", textAutoResize: "TRUNCATE", width: 80, height: 30 })).toMatchObject({ width: 80, height: 30 });
      expect(normalizeNode({ type: "text", text: "t", textAutoResize: "HEIGHT", width: 80, height: 30 }).height).toBeUndefined();
      // A default that is not one of these is still left out.
      expect(normalizeNode({ type: "rectangle", name: "R", opacity: 1, visible: true, cornerRadius: 0, fillColor: "#D9D9D9" })).toEqual({ type: "rectangle", name: "R" });
    });

    test("lock nodes carry props, hash, parent and child order, and refuse duplicate ids", () => {
      const tree = { id: "1", type: "frame", name: "A", children: [{ id: "2", type: "text", name: "t", text: "t", textAutoResize: "WIDTH_AND_HEIGHT" }, { id: "3", type: "$opaque", name: "g", nodeType: "GROUP", reason: "unsupported type" }] };
      const lock = lockNodesFromTree(tree, "0:1");
      expect(lock["1"]).toEqual({ props: { type: "frame", name: "A" }, propsHash: hashProps({ type: "frame", name: "A" }), parentId: "0:1", children: ["2", "3"] });
      expect(lock["3"].children).toEqual([]);
      expect(() => lockNodesFromTree({ ...tree, children: [tree.children[0], tree.children[0]] }, null)).toThrow("Duplicate node id");
    });

    test("a SpecLock stores a vector's path as pathHash, and propsHash is over that form", () => {
      const vector = { type: "vector", name: "V", width: 10, height: 10, pathData: "M 0 0 L 10 10" };
      const lock = lockNodesFromTree({ id: "1", ...vector }, null);
      expect(lock["1"].props).toEqual({ type: "vector", name: "V", width: 10, height: 10, pathHash: hashString("M 0 0 L 10 10") });
      expect(lock["1"].props).toEqual(lockProps(vector));
      expect(lock["1"].propsHash).toBe(hashProps(lockProps(vector)));
      expect(lockProps({ ...vector, pathData: "M 0 0 L 9 9" }).pathHash).not.toBe(lock["1"].props.pathHash);
      expect(lockProps({ type: "frame", name: "F" })).toEqual({ type: "frame", name: "F" });
    });
  });

  describe("export_spec round trip (1): create_node_tree(tree) then export equals the normalised tree", () => {
    test("auto-layout frame with text, rectangle, vector, variant instance and a nested frame", async () => {
      const tree = {
        type: "frame", name: "Card", x: 40, y: 24, width: 320, height: 200, layoutMode: "VERTICAL", itemSpacing: 8, itemReverseZIndex: true,
        paddingTop: 16, paddingRight: 16, paddingBottom: 16, paddingLeft: 16, primaryAxisAlignItems: "CENTER", counterAxisAlignItems: "MAX",
        fillColor: "#ffffff", strokeColor: "$var:Colors/Primary", strokeWeight: 2, strokeAlign: "OUTSIDE",
        cornerRadius: 12, clipsContent: false, opacity: 0.9, effects: [{ type: "DROP_SHADOW", offset: { x: 0, y: 2 }, radius: 6 }],
        children: [
          { type: "text", name: "Title", text: "Hello", fontFamily: "Roboto", fontWeight: 700, fontSize: "16",
            fontColor: "#333333", lineHeight: 20, letterSpacing: 0.5, textCase: "UPPER", textAlignHorizontal: "CENTER", width: 200 },
          { type: "rectangle", name: "Swatch", width: 40, height: 40, fillColor: { $var: "Colors/Primary", opacity: 0.4 }, cornerRadius: 4,
            strokeColor: { r: 0, g: 0, b: 1, a: 0.5 }, strokeWeight: 3, opacity: 0.5, layoutPositioning: "ABSOLUTE", x: 5, y: 6 },
          { type: "vector", name: "Icon", pathData: "M 0 0 L 10 10", width: 10, height: 10, strokeColor: "#000000", strokeCap: "ROUND" },
          { type: "instance", name: "Badge", componentSetKey: "badge", properties: { State: "On", "Label#1:2": "Hot" }, layoutSizingHorizontal: "FILL", height: 24 },
          { type: "frame", name: "Row", layoutMode: "HORIZONTAL", layoutSizingHorizontal: "FILL", layoutSizingVertical: "HUG", itemSpacing: 4,
            paddingTop: 10, paddingRight: 10, paddingBottom: 10, paddingLeft: 10, itemReverseZIndex: true,
            fillColor: "#00000000", children: [{ type: "rectangle", name: "Dot", width: 4, height: 4, fillColor: "#ff0000" }] },
          { type: "frame", name: "Stretch", layoutSizingHorizontal: "FILL", height: 30 },
        ],
      };
      const root = await create(tree);
      const exported = await exportOf(root);
      expect(stripIds(exported.tree)).toEqual(normalizeSpecTree(tree));
      // Spot-check the canonical forms the comparison relied on.
      expect(find(exported.tree, "Card").strokeColor).toBe("$var:Colors/Primary");
      expect(find(exported.tree, "Swatch")).toMatchObject({ fillColor: { $var: "Colors/Primary", opacity: 0.4 }, strokeColor: "#0000FF80", x: 5, y: 6, layoutPositioning: "ABSOLUTE" });
      expect(find(exported.tree, "Title")).toMatchObject({ fontStyle: "Bold", fontSize: 16, width: 200, textAutoResize: "HEIGHT" });
      expect(find(exported.tree, "Title").x).toBeUndefined();
      expect(find(exported.tree, "Badge")).toEqual({ id: expect.any(String), type: "instance", name: "Badge", componentSetKey: "badge", height: 24, layoutSizingHorizontal: "FILL", properties: { State: "On", "Label#1:2": "Hot" } });
      // A frame without auto-layout of its own fills its auto-layout parent.
      expect(find(exported.tree, "Stretch")).toMatchObject({ layoutSizingHorizontal: "FILL", height: 30 });
      expect(exported).toMatchObject({ nodeCount: 8, opaqueCount: 0, truncated: false, fileName: "Test file", pageId: page.id, rootId: root.id, rootParentId: page.id });
    });

    test("absolute-layout frame keeps child x/y; local component and local variant instances export by id", async () => {
      const local = localComponent();
      const toggle = localSet();
      const tree = {
        type: "frame", name: "Board", x: 0, y: 0, width: 400, height: 300, fillColor: "#F0F0F0",
        children: [
          { type: "text", name: "Note", text: "free text", x: 12, y: 30, fontColor: "#123456", fontSize: 18 },
          { type: "instance", name: "Mine", componentId: local.id, x: 100, y: 50, width: 100, height: 100 },
          { type: "instance", name: "Switch", componentSetId: toggle.id, properties: { State: "On", "Label#1:2": "New" }, x: 0, y: 0, width: 60, height: 20 },
        ],
      };
      const root = await create(tree);
      const exported = await exportOf(root);
      expect(stripIds(exported.tree)).toEqual(normalizeSpecTree(tree));
      expect(find(exported.tree, "Mine")).toEqual({ id: expect.any(String), type: "instance", name: "Mine", componentId: local.id, x: 100, y: 50, width: 100, height: 100 });
      expect(find(exported.tree, "Switch")).toMatchObject({ componentSetId: toggle.id, properties: { State: "On" } });
      expect(find(exported.tree, "Switch").componentId).toBeUndefined();
    });

    test("a variant edit round-trips: the swap setProperties makes is not a change of key (R2)", async () => {
      const root = await create({ type: "frame", name: "Root", children: [{ type: "instance", componentSetKey: "badge" }] });
      const instance = root.children[0];
      const before = (await exportOf(root)).tree.children[0];
      expect(before.componentSetKey).toBe("badge");
      expect(before.componentKey).toBeUndefined();
      // The model edits only State; Figma swaps the main component to the On variant.
      const edited = { ...before, properties: { ...before.properties, State: "On" } };
      const { id: _id, ...spec } = edited;
      const result = await applyUpdate(instance, spec, new Set(["properties"]));
      expect(result.unhandled).toEqual([]);
      expect(instance.main.key).toBe("badge-On");
      const after = (await exportOf(root)).tree.children[0];
      expect(after).toEqual(edited);
      expect(hashProps(normalizeNode(spec))).toBe(hashProps(normalizeNode(after)));
    });

    test("a set edit swaps to the new set's default variant; a same-set key never swaps", async () => {
      const root = await create({ type: "frame", name: "Root", children: [{ type: "instance", componentKey: "plain" }] });
      const instance = root.children[0];
      await applyUpdate(instance, { componentSetKey: "badge" }, new Set(["componentSetKey"]));
      expect(instance.main.key).toBe("badge-Off");
      await applyUpdate(instance, { componentSetKey: "badge", properties: { State: "On" } }, new Set(["componentSetKey", "properties"]));
      expect(instance.main.key).toBe("badge-On");
      const swaps: any[] = [];
      instance.swapComponent = (c: any) => swaps.push(c);
      const unchanged = await applyUpdate(instance, { componentSetKey: "badge" }, new Set(["componentSetKey"]));
      expect(swaps).toEqual([]);
      expect(unchanged.changed).toBe(false);
    });
  });

  describe("defaults (2): what export drops is what create applies", () => {
    const cases: Array<[string, any, any]> = [
      ["frame", { type: "frame" }, { type: "frame", name: "Frame", x: 0, y: 0, width: 100, height: 100, children: [] }],
      ["auto-layout frame", { type: "frame", layoutMode: "VERTICAL" }, {
        type: "frame", name: "Frame", x: 0, y: 0, width: 100, height: 100, layoutMode: "VERTICAL",
        paddingTop: 10, paddingRight: 10, paddingBottom: 10, paddingLeft: 10, itemSpacing: 0, itemReverseZIndex: true, children: [],
      }],
      ["rectangle", { type: "rectangle" }, { type: "rectangle", name: "Rectangle", x: 0, y: 0, width: 100, height: 100 }],
      ["text", { type: "text" }, { type: "text", name: "Text", text: "Text", x: 0, y: 0, textAutoResize: "WIDTH_AND_HEIGHT" }],
      ["vector", { type: "vector", pathData: "M 0 0 L 1 1", width: 10, height: 10 }, { type: "vector", name: "Vector", x: 0, y: 0, width: 10, height: 10, pathData: "M 0 0 L 1 1" }],
      ["instance", { type: "instance", componentKey: "plain" }, { type: "instance", name: "plain", componentKey: "plain", x: 0, y: 0, width: 100, height: 100 }],
    ];
    for (const [label, spec, expected] of cases) {
      test(`a minimal ${label} exports its identity and geometry only, though Figma gave it a creation paint`, async () => {
        const exported = await exportOf(await create(spec));
        expect(stripIds(exported.tree)).toEqual(expected);
      });
    }

    test("parity: every default is the value a node created without that property holds", async () => {
      const minimal: Array<[SpecType, any, string[]]> = [
        ["frame", { type: "frame" }, ["layoutWrap", "paddingTop", "paddingRight", "paddingBottom", "paddingLeft", "primaryAxisAlignItems", "counterAxisAlignItems", "itemSpacing", "counterAxisSpacing", "itemReverseZIndex"]],
        ["frame", { type: "frame", layoutMode: "VERTICAL" }, ["layoutMode"]],
        ["rectangle", { type: "rectangle" }, []],
        ["text", { type: "text" }, []],
        ["vector", { type: "vector", pathData: "M 0 0 L 1 1" }, []],
        ["instance", { type: "instance", componentKey: "plain" }, []],
      ];
      let checked = 0;
      for (const [type, spec, skip] of minimal) {
        const node = await create(spec);
        const raw: any = await readSpecProps(node, new SpecReadCache());
        for (const [key, value] of Object.entries(SPEC_DEFAULTS[type])) {
          if (skip.includes(key)) continue;
          expect([type, key, stableStringify(canonicalValue(key, raw[key]))]).toEqual([type, key, stableStringify(value)]);
          checked++;
        }
      }
      expect(checked).toBeGreaterThan(60);
      // The creation paints really are Figma's, not "no paint".
      expect(SPEC_DEFAULTS.frame.fillColor).toBe("#FFFFFF");
      expect(SPEC_DEFAULTS.rectangle.fillColor).toBe("#D9D9D9");
    });

    test("a non-default value is kept, including padding 0 that create would have made 10", async () => {
      const al = makeNode("FRAME", { name: "AL", layoutMode: "HORIZONTAL", itemReverseZIndex: false }, page);
      const exported = await exportOf(al);
      expect(exported.tree).toMatchObject({ paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, itemSpacing: 0, itemReverseZIndex: false });
      const clear = makeNode("FRAME", { name: "Clear", fills: [] }, page);
      expect((await exportOf(clear)).tree.fillColor).toBe(NO_PAINT);
    });
  });

  describe("omission list (3): each row has a fixture", () => {
    test("x and y inside auto-layout are left out unless the node is ABSOLUTE; elsewhere they are kept, even at 0", async () => {
      const parent = makeNode("FRAME", { name: "P", layoutMode: "VERTICAL" }, page);
      makeNode("RECTANGLE", { name: "Flow", x: 7, y: 9 }, parent);
      makeNode("RECTANGLE", { name: "Abs", x: 7, y: 9, layoutPositioning: "ABSOLUTE" }, parent);
      const free = makeNode("FRAME", { name: "Free" }, page);
      makeNode("RECTANGLE", { name: "Origin" }, free);
      const tree = (await exportOf(parent)).tree;
      expect(find(tree, "Flow").x).toBeUndefined();
      expect(find(tree, "Flow").y).toBeUndefined();
      expect(find(tree, "Abs")).toMatchObject({ x: 7, y: 9 });
      expect(find((await exportOf(free)).tree, "Origin")).toMatchObject({ x: 0, y: 0 });
    });

    test("width or height on a HUG or FILL axis is left out; a FIXED axis is kept", async () => {
      const parent = makeNode("FRAME", { name: "P", layoutMode: "HORIZONTAL", width: 500, height: 80 }, page);
      makeNode("FRAME", { name: "Hug", layoutMode: "VERTICAL", layoutSizingHorizontal: "HUG", width: 33, height: 44 }, parent);
      makeNode("RECTANGLE", { name: "Fill", layoutSizingVertical: "FILL", width: 33, height: 80 }, parent);
      const instance = component("plain").createInstance();
      parent.appendChild(instance);
      Object.assign(instance, { name: "Sized", width: 333, height: 77 });
      const tree = (await exportOf(parent)).tree;
      expect(find(tree, "Hug")).toMatchObject({ height: 44, layoutSizingHorizontal: "HUG" });
      expect(find(tree, "Hug").width).toBeUndefined();
      expect(find(tree, "Fill")).toMatchObject({ width: 33, layoutSizingVertical: "FILL" });
      expect(find(tree, "Fill").height).toBeUndefined();
      // A resized instance keeps its size (R7).
      expect(find(tree, "Sized")).toMatchObject({ width: 333, height: 77 });
    });

    test("text: width with HEIGHT, width and height with NONE or TRUNCATE, neither with WIDTH_AND_HEIGHT; textAutoResize always", async () => {
      const parent = makeNode("FRAME", { name: "P" }, page);
      makeNode("TEXT", { name: "Auto", characters: "a", width: 50, height: 20, textAutoResize: "WIDTH_AND_HEIGHT" }, parent);
      makeNode("TEXT", { name: "Wrap", characters: "b", width: 150, height: 60, textAutoResize: "HEIGHT" }, parent);
      makeNode("TEXT", { name: "Fixed", characters: "c", width: 150, height: 60, textAutoResize: "NONE" }, parent);
      makeNode("TEXT", { name: "Cut", characters: "d", width: 150, height: 60, textAutoResize: "TRUNCATE" }, parent);
      const tree = (await exportOf(parent)).tree;
      expect(find(tree, "Auto")).toEqual({ id: expect.any(String), type: "text", name: "Auto", text: "a", x: 0, y: 0, fontSize: 12, textAutoResize: "WIDTH_AND_HEIGHT" });
      expect(find(tree, "Wrap")).toMatchObject({ width: 150, textAutoResize: "HEIGHT" });
      expect(find(tree, "Wrap").height).toBeUndefined();
      expect(find(tree, "Fixed")).toMatchObject({ width: 150, height: 60, textAutoResize: "NONE" });
      expect(find(tree, "Cut")).toMatchObject({ width: 150, height: 60, textAutoResize: "TRUNCATE" });
    });

    test("text whose characters carry more than one style is an OpaqueNode (B)", async () => {
      const mixed = (globalThis as any).figma.mixed;
      const parent = makeNode("FRAME", { name: "P" }, page);
      const keys = ["fontName", "fontSize", "fills", "letterSpacing", "lineHeight", "textDecoration", "textCase"];
      for (const key of keys) makeNode("TEXT", { name: `Mixed ${key}`, characters: "bold and plain", [key]: mixed }, parent);
      makeNode("RECTANGLE", { name: "Corners", cornerRadius: mixed, strokeWeight: mixed, fills: solid(1, 0, 0) }, parent);
      const exported = await exportOf(parent);
      for (const key of keys) {
        expect(find(exported.tree, `Mixed ${key}`)).toEqual({ id: expect.any(String), type: "$opaque", name: `Mixed ${key}`, nodeType: "TEXT", reason: "mixed-style text" });
      }
      expect(exported.opaqueCount).toBe(keys.length);
      // Other figma.mixed values are left out of an editable node.
      expect(find(exported.tree, "Corners")).toEqual({ id: expect.any(String), type: "rectangle", name: "Corners", x: 0, y: 0, width: 100, height: 100, fillColor: "#FF0000" });
      const root = makeNode("TEXT", { name: "Rich root", characters: "x", fontSize: mixed }, page);
      await expect(exportOf(root)).rejects.toThrow("mixed-style text");
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
      makeNode("FRAME", { name: "Black", fills: solid(0, 0, 0) }, parent);
      const tree = (await exportOf(parent)).tree;
      for (const name of ["Two", "Gradient", "Hidden", "Blend"]) expect(find(tree, name).fillColor).toBeUndefined();
      expect(find(tree, "Clear").fontColor).toBe(NO_PAINT);
      expect(find(tree, "Black").fillColor).toBe("#000000");
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
      expect((await exportOf(frame)).tree).toEqual({ id: frame.id, type: "frame", name: "Plain", x: 0, y: 0, width: 100, height: 100, children: [] });
    });

    test("text with autoRename has no name; a renamed text keeps its name (F, R8)", async () => {
      const parent = makeNode("FRAME", { name: "P" }, page);
      makeNode("TEXT", { name: "Hello", characters: "Hello", autoRename: true }, parent);
      makeNode("TEXT", { name: "Greeting", characters: "Hello", autoRename: false }, parent);
      const tree = (await exportOf(parent)).tree;
      expect(tree.children[0].name).toBeUndefined();
      expect(tree.children[0].text).toBe("Hello");
      expect(tree.children[1].name).toBe("Greeting");
    });

    test("a hidden node says so; a visible one does not (H, R7)", async () => {
      const parent = makeNode("FRAME", { name: "P" }, page);
      makeNode("RECTANGLE", { name: "Hidden", visible: false }, parent);
      makeNode("RECTANGLE", { name: "Shown" }, parent);
      const tree = (await exportOf(parent)).tree;
      expect(find(tree, "Hidden").visible).toBe(false);
      expect(find(tree, "Shown").visible).toBeUndefined();
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

    test("a bound paint below full opacity keeps its opacity, and an opacity change changes the hash (G, R5)", async () => {
      const parent = makeNode("FRAME", { name: "P" }, page);
      makeNode("RECTANGLE", { name: "Full", fills: bound("color", 1) }, parent);
      makeNode("RECTANGLE", { name: "Faint", fills: bound("color", 0.3) }, parent);
      const tree = (await exportOf(parent)).tree;
      expect(find(tree, "Full").fillColor).toBe("$var:Colors/Primary");
      expect(find(tree, "Faint").fillColor).toEqual({ $var: "Colors/Primary", opacity: 0.3 });
      expect(hashProps(stripIds(find(tree, "Full")))).not.toBe(hashProps(stripIds({ ...find(tree, "Faint"), name: "Full" })));
    });

    test("create and update write {$var, opacity}: the paint is bound and keeps the opacity", async () => {
      const parent = makeNode("FRAME", { name: "P" }, page);
      const created = await create({ type: "rectangle", name: "R", fillColor: { $var: "Colors/Primary", opacity: 0.3 } }, parent.id);
      expect(created.fills).toEqual([{ type: "SOLID", color: { r: 1, g: 0, b: 0 }, opacity: 0.3, boundVariables: { color: { type: "VARIABLE_ALIAS", id: "color" } } }]);
      const other = await create({ type: "rectangle", name: "S", fillColor: "#00FF00" }, parent.id);
      await applyUpdate(other, { fillColor: { $var: "Colors/Primary", opacity: 0.5 } }, new Set(["fillColor"]));
      expect(other.fills[0]).toMatchObject({ opacity: 0.5, boundVariables: { color: { id: "color" } } });
      const tree = (await exportOf(parent)).tree;
      expect(find(tree, "R").fillColor).toEqual({ $var: "Colors/Primary", opacity: 0.3 });
      expect(find(tree, "S").fillColor).toEqual({ $var: "Colors/Primary", opacity: 0.5 });
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
    test("group, ellipse, section, rotated frame and grid frame come back opaque with a reason and their subtree absent", async () => {
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
      expect(opaque.map((n: any) => [n.type, n.name, n.nodeType, n.reason])).toEqual([
        ["$opaque", "G", "GROUP", "unsupported type"], ["$opaque", "E", "ELLIPSE", "unsupported type"], ["$opaque", "S", "SECTION", "unsupported type"],
        ["$opaque", "Tilted", "FRAME", "rotated"], ["$opaque", "Grid", "FRAME", "grid layout"],
      ]);
      for (const node of opaque) expect(Object.keys(node).sort()).toEqual(["id", "name", "nodeType", "reason", "type"]);
      expect(JSON.stringify(exported.tree)).not.toContain(hidden.id);
      expect(JSON.stringify(exported.tree)).not.toContain("InSection");
      expect(exported.opaqueCount).toBe(5);
    });

    test("an instance is a leaf with flattened properties; its children are never walked", async () => {
      const parent = makeNode("FRAME", { name: "P" }, page);
      const instance = componentSet("badge").defaultVariant.createInstance();
      parent.appendChild(instance);
      const inner = makeNode("TEXT", { id: `I${instance.id};5:6`, name: "Label", characters: "New" }, instance);
      const exported = await exportOf(parent);
      expect(exported.tree.children[0]).toEqual({
        id: instance.id, type: "instance", name: "badge", componentSetKey: "badge", x: 0, y: 0, width: 100, height: 100,
        properties: { State: "Off", "Label#1:2": "New" },
      });
      expect(JSON.stringify(exported.tree)).not.toContain(inner.id);
    });

    test("a variant instance is named by its set, never by a variant key (A)", async () => {
      const parent = makeNode("FRAME", { name: "P" }, page);
      const remote = componentSet("badge").children[1].createInstance();
      const local = localSet().children[1].createInstance();
      const plain = component("plain").createInstance();
      for (const node of [remote, local, plain]) parent.appendChild(node);
      const [a, b, c] = (await exportOf(parent)).tree.children;
      expect(a).toMatchObject({ componentSetKey: "badge", properties: { State: "On" } });
      expect(b).toMatchObject({ componentSetId: local.main.parent.id, properties: { State: "On" } });
      expect(c).toMatchObject({ componentKey: "plain" });
      for (const node of [a, b]) expect([node.componentKey, node.componentId]).toEqual([undefined, undefined]);
      expect([c.componentSetKey, c.componentSetId]).toEqual([undefined, undefined]);
    });

    test("an instance whose main component is gone is opaque", async () => {
      const parent = makeNode("FRAME", { name: "P" }, page);
      makeNode("INSTANCE", { name: "Orphan", main: null, componentProperties: {} }, parent);
      expect((await exportOf(parent)).tree.children[0]).toMatchObject({ type: "$opaque", nodeType: "INSTANCE", reason: "main component missing" });
    });

    test("getMainComponentAsync runs once per instance per run, and a component's source is worked out once (L)", async () => {
      const parent = makeNode("FRAME", { name: "P" }, page);
      const instances = [0, 1, 2].map(() => { const node = component("plain").createInstance(); parent.appendChild(node); return node; });
      await exportOf(parent);
      expect(instances.map(node => node.mainCalls)).toEqual([1, 1, 1]);
      const cache = new SpecReadCache();
      await cache.mainComponent(instances[0]);
      await cache.mainComponent(instances[0]);
      expect(instances[0].mainCalls).toBe(2);
      let parentReads = 0;
      const main = { id: "m", key: "k", remote: true, get parent() { parentReads++; return null; } };
      expect(cache.componentSource(main)).toEqual({ componentKey: "k" });
      expect(cache.componentSource(main)).toEqual({ componentKey: "k" });
      expect(parentReads).toBe(1);
    });

    test("a root the format cannot write, or an id inside an instance, is refused", async () => {
      const group = makeNode("GROUP", { name: "G" }, page);
      await expect(exportOf(group)).rejects.toThrow("a Spec root must be a frame");
      await expect(exportSpec({ nodeId: "I1:2;3:4" })).rejects.toThrow("inside an instance");
    });
  });

  // A frame of `width` children, each a frame holding `inner` rectangles.
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

  const truncatedOf = (node: any, reason: string) => ({ id: node.id, type: "$opaque", name: node.name, nodeType: node.type, truncated: true, reason });

  describe("budgets (6, C, I): breadth-first, the rest as truncated placeholders, never a failed pull", () => {
    test("a cut inside a child that is not the last does not fail the pull (R1); every child list stays complete", async () => {
      const { root, kids } = buildWide(3, 5);
      // Breadth-first: Root, K0, K1, K2, K0R0..4 = 9 read; the 10th is K1R0.
      const exported = await exportOf(root, { maxNodes: 10 });
      expect(exported.truncated).toBe(true);
      expect(exported.tree.children.map((k: any) => [k.type, k.name])).toEqual([["frame", "K0"], ["frame", "K1"], ["frame", "K2"]]);
      expect(exported.tree.children[0].children.map((n: any) => n.type)).toEqual(Array(5).fill("rectangle"));
      expect(exported.tree.children[1].children[0]).toMatchObject({ type: "rectangle", name: "K1R0" });
      expect(exported.tree.children[1].children.slice(1)).toEqual(kids[1].children.slice(1).map((n: any) => truncatedOf(n, "node budget")));
      expect(exported.tree.children[2].children).toEqual(kids[2].children.map((n: any) => truncatedOf(n, "node budget")));
      expect(exported.opaqueCount).toBe(9);
      expect(exported.nodeCount).toBe(19);
    });

    test("a cut among the root's own children, before its last child", async () => {
      const root = makeNode("FRAME", { name: "Root" }, page);
      const kids = [0, 1, 2, 3, 4].map(i => makeNode("RECTANGLE", { name: `R${i}` }, root));
      const exported = await exportOf(root, { maxNodes: 3 });
      expect(exported.tree.children.slice(0, 2).map((n: any) => n.name)).toEqual(["R0", "R1"]);
      expect(exported.tree.children.slice(2)).toEqual(kids.slice(2).map(n => truncatedOf(n, "node budget")));
    });

    test("the depth limit truncates the same way, and maxDepth 0 still reads the root", async () => {
      const { root, kids } = buildWide(1, 2);
      const exported = await exportOf(root, { maxDepth: 1 });
      expect(exported.tree.children[0]).toMatchObject({ type: "frame", name: "K0" });
      expect(exported.tree.children[0].children).toEqual(kids[0].children.map((n: any) => truncatedOf(n, "depth limit")));
      const shallow = await exportOf(root, { maxDepth: 0 });
      expect(shallow.tree.children).toEqual([truncatedOf(kids[0], "depth limit")]);
    });

    test("the serialised Spec stops at 8 MB; the rest is truncated the same way", async () => {
      const root = makeNode("FRAME", { name: "Icons" }, page);
      const path = "M 0 0 " + Array.from({ length: 120 }, (_, i) => "C " + [i, i + 0.5, i + 1, i + 1.5, i + 2, i + 2.5].join(" ")).join(" ") + " Z";
      for (let i = 0; i < 9999; i++) makeNode("VECTOR", { name: "v" + i, x: i, vectorPaths: [{ windingRule: "NONZERO", data: path }] }, root);
      const exported = await exportOf(root, { maxNodes: 10000 });
      const read = exported.tree.children.filter((n: any) => n.type === "vector");
      const cut = exported.tree.children.filter((n: any) => n.type === "$opaque");
      expect(exported.truncated).toBe(true);
      expect(read.length + cut.length).toBe(9999);
      expect(read.length).toBeGreaterThan(1000);
      expect(cut.every((n: any) => n.truncated === true && n.reason === "byte budget")).toBe(true);
      // The whole tree, placeholders included, fits; reading stopped when the next node would not.
      const total = JSON.stringify(exported.tree).length;
      expect(total).toBeLessThanOrEqual(MAX_SPEC_BYTES);
      expect(total).toBeGreaterThan(MAX_SPEC_BYTES - 2 * (path.length + 300));
    });

    test("a smaller maxBytes is honoured; a root larger than the budget is the only failure", async () => {
      const { root } = buildWide(1, 3);
      const exported = await exportOf(root, { maxBytes: 250 });
      expect(exported.truncated).toBe(true);
      expect(JSON.stringify(exported.tree)).toContain('"reason":"byte budget"');
      await expect(exportOf(root, { maxBytes: 20 })).rejects.toThrow("larger than the 20-byte Spec budget");
    });

    test("progress goes out every 50 nodes", async () => {
      const { root } = buildWide(1, 120);
      await exportOf(root, { commandId: "cmd" });
      const inProgress = progress.filter(m => m.type === "command_progress" && m.status === "in_progress");
      expect(inProgress.map(m => m.processedItems)).toEqual([50, 100]);
      expect(progress.at(-1)).toMatchObject({ status: "completed", commandType: "export_spec" });
    });
  });

  describe("writable vocabulary parity (E): every key the export may emit is written by createNode and by updateNodeProperties", () => {
    const effects = [{ type: "LAYER_BLUR", radius: 3 }];
    type Sample = { value: any; with?: any; parent?: "auto" | "none"; base?: any };
    const common = (): Record<string, Sample> => ({
      name: { value: "Renamed" },
      visible: { value: false },
      x: { value: 12, parent: "none" },
      y: { value: 34, parent: "none" },
      opacity: { value: 0.5 },
      layoutPositioning: { value: "ABSOLUTE", parent: "auto" },
      layoutSizingHorizontal: { value: "FILL", parent: "auto" },
      layoutSizingVertical: { value: "FILL", parent: "auto" },
    });
    const painted = (): Record<string, Sample> => ({
      fillColor: { value: "#123456" }, strokeColor: { value: "#654321" }, strokeWeight: { value: 3 },
      strokeAlign: { value: "OUTSIDE" }, effects: { value: effects },
    });
    const al = { layoutMode: "HORIZONTAL" };
    const SAMPLES: Record<SpecType, { base: any; keys: Record<string, Sample> }> = {
      frame: { base: { type: "frame" }, keys: {
        ...common(), ...painted(), width: { value: 240, with: { height: 100 } }, height: { value: 160, with: { width: 100 } },
        cornerRadius: { value: 8 }, clipsContent: { value: false }, layoutMode: { value: "HORIZONTAL" },
        layoutWrap: { value: "WRAP", with: al }, paddingTop: { value: 7, with: al }, paddingRight: { value: 7, with: al },
        paddingBottom: { value: 7, with: al }, paddingLeft: { value: 7, with: al }, primaryAxisAlignItems: { value: "CENTER", with: al },
        counterAxisAlignItems: { value: "MAX", with: al }, itemSpacing: { value: 5, with: al },
        counterAxisSpacing: { value: 6, with: { ...al, layoutWrap: "WRAP" } }, itemReverseZIndex: { value: false, with: al },
      } },
      rectangle: { base: { type: "rectangle" }, keys: {
        ...common(), ...painted(), width: { value: 240, with: { height: 100 } }, height: { value: 160, with: { width: 100 } }, cornerRadius: { value: 8 },
      } },
      vector: { base: { type: "vector", pathData: "M 0 0 L 10 10", width: 10, height: 10 }, keys: {
        ...common(), ...painted(), strokeAlign: { value: "INSIDE" }, width: { value: 24 }, height: { value: 16 },
        strokeCap: { value: "ROUND", with: { strokeColor: "#000000" } }, pathData: { value: "M 0 0 L 20 20" },
      } },
      text: { base: { type: "text", text: "T" }, keys: {
        ...common(), text: { value: "Changed" }, fontFamily: { value: "Roboto" }, fontStyle: { value: "Bold" }, fontSize: { value: 20 },
        fontColor: { value: "#FF0000" }, lineHeight: { value: 24 }, letterSpacing: { value: 1 }, textCase: { value: "UPPER" },
        textAlignHorizontal: { value: "CENTER" }, textAutoResize: { value: "NONE", with: { width: 120, height: 40 } },
        width: { value: 150 }, height: { value: 44, with: { textAutoResize: "NONE", width: 120 } }, effects: { value: effects },
      } },
      instance: { base: { type: "instance", componentKey: "plain" }, keys: {
        ...common(), componentKey: { value: "other" }, componentId: { value: "$local" }, componentSetKey: { value: "badge" },
        componentSetId: { value: "$localSet" }, properties: { value: { State: "On", "Label#1:2": "Hey" }, base: { type: "instance", componentSetKey: "badge" } },
        width: { value: 150 }, height: { value: 40 },
      } },
    };

    test("every vocabulary key has a sample, and no sample names a key outside the vocabulary", () => {
      for (const type of Object.keys(SPEC_VOCABULARY) as SpecType[]) {
        expect([type, Object.keys(SAMPLES[type].keys).sort()]).toEqual([type, [...SPEC_VOCABULARY[type]].sort()]);
      }
    });

    for (const type of Object.keys(SAMPLES) as SpecType[]) {
      for (const [key, sample] of Object.entries(SAMPLES[type].keys)) {
        test(`${type}.${key}`, async () => {
          const ids: Record<string, string> = { $local: localComponent().id, $localSet: localSet().id };
          const value = typeof sample.value === "string" && ids[sample.value] ? ids[sample.value] : sample.value;
          const parent = makeNode("FRAME", { name: "P", layoutMode: sample.parent === "auto" ? "VERTICAL" : "NONE" }, page);
          const base = { ...(sample.base || SAMPLES[type].base), ...(sample.with || {}) };
          const wanted = normalizeNode({ ...base, [key]: value }, { layoutMode: parent.layoutMode })[key];
          expect(wanted).toBeDefined();

          // createNode
          const ctx = createNodeTreeContext({ totalNodes: 1 });
          const made = await createNode({ ...base, [key]: value }, parent.id, 0, ctx, { path: [] });
          expect(ctx.errors).toEqual([]);
          const created = (await exportSpec({ nodeId: made[0].id })).tree;
          expect([type, key, "create", created[key]]).toEqual([type, key, "create", wanted]);

          // updateNodeProperties, on a node created without the key
          const [{ id }] = await createNode(base, parent.id, 0, createNodeTreeContext({ totalNodes: 1 }), { path: [] });
          const node = nodes.get(id);
          const before = (await exportSpec({ nodeId: id })).tree[key];
          expect(stableStringify(before)).not.toBe(stableStringify(wanted));
          const result = await applyUpdate(node, { ...base, [key]: value }, new Set([key]));
          expect(result.unhandled).toEqual([]);
          const updated = (await exportSpec({ nodeId: id })).tree;
          expect([type, key, "update", updated[key]]).toEqual([type, key, "update", wanted]);
        });
      }
    }

    test("applyDeferredFill with checkParent: FILL lands on a frame without auto-layout inside an auto-layout parent, not elsewhere", async () => {
      const auto = makeNode("FRAME", { name: "A", layoutMode: "VERTICAL" }, page);
      const plain = makeNode("FRAME", { name: "B" }, page);
      const inAuto = makeNode("FRAME", { name: "C" }, auto);
      const inPlain = makeNode("FRAME", { name: "D" }, plain);
      const spec = { layoutSizingHorizontal: "FILL", layoutSizingVertical: "FILL" };
      expect(applyDeferredFill(inAuto, spec, undefined, { checkParent: true })).toEqual(["layoutSizingHorizontal", "layoutSizingVertical"]);
      expect(applyDeferredFill(inPlain, spec, undefined, { checkParent: true })).toEqual([]);
      // Already FILL: not written again. Without checkParent, today's own-layoutMode test.
      expect(applyDeferredFill(inAuto, spec, undefined, { checkParent: true })).toEqual([]);
      expect(applyDeferredFill(makeNode("FRAME", { name: "E" }, auto), spec)).toEqual([]);
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

    test("a truncated pull says so; the lock lists every child of a cut parent, each placeholder without children", async () => {
      const { root, kids } = buildWide(2, 3);
      // Breadth-first: Root, K0, K1, K0R0..2 = 6 read; K1's children are placeholders.
      const result = await pullSpec({ nodeId: root.id, path: "wide.l2f.json", maxNodes: 6 }, send as any, opts());
      expect(result.truncated).toBe(true);
      expect(result.note).toContain("truncated: true");
      const lock = readJson(result.lockPath);
      expect(lock.nodes[kids[1].id]).toMatchObject({ props: { type: "frame", name: "K1" }, children: kids[1].children.map((n: any) => n.id) });
      for (const child of kids[1].children) {
        expect(lock.nodes[child.id]).toMatchObject({ parentId: kids[1].id, children: [], props: { type: "$opaque", truncated: true, reason: "node budget" } });
      }
    });

    test("a vector's path is a hash in the SpecLock and in full in the Spec (I)", async () => {
      const root = makeNode("FRAME", { name: "Icons" }, page);
      const icon = makeNode("VECTOR", { name: "Icon", vectorPaths: [{ windingRule: "NONZERO", data: "M 0 0 L 5 5 Z" }] }, root);
      const result = await pullSpec({ nodeId: root.id, path: "icons.l2f.json" }, send as any, opts());
      expect(readJson(result.path).tree.children[0].pathData).toBe("M 0 0 L 5 5 Z");
      const entry = readJson(result.lockPath).nodes[icon.id];
      expect(entry.props.pathData).toBeUndefined();
      expect(entry.props.pathHash).toBe(hashString("M 0 0 L 5 5 Z"));
      expect(entry.propsHash).toBe(hashProps(entry.props));
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

    test("with replaceEdited and a matching file key, a renamed file and a node moved to another page re-pull (K)", async () => {
      const root = seedDesign();
      const keyed = opts({ userFileKey: () => "USERKEY12345" });
      await pullSpec({ nodeId: root.id, path: "k.l2f.json" }, send as any, keyed);
      (globalThis as any).figma.root = { name: "Renamed file" };
      const other = makeNode("PAGE", { name: "Page 2", async loadAsync() { this.loaded = true; } });
      other.appendChild(root);
      await expect(pullSpec({ nodeId: root.id, path: "k.l2f.json" }, send as any, keyed)).rejects.toThrow("Wrong file");
      const result = await pullSpec({ nodeId: root.id, path: "k.l2f.json", replaceEdited: true }, send as any, keyed);
      expect(sent.at(-1).params.expect).toEqual({ fileKey: "USERKEY12345" });
      expect(readJson(result.path)).toMatchObject({ fileKey: "USERKEY12345", fileName: "Renamed file", pageId: other.id });
      expect(readJson(result.lockPath)).toMatchObject({ fileName: "Renamed file", pageId: other.id });
      // A different key is still refused.
      await expect(pullSpec({ nodeId: root.id, path: "k.l2f.json", replaceEdited: true }, send as any, opts({ userFileKey: () => "OTHERKEY1234" }))).rejects.toThrow("Wrong file");
    });

    test("without a file key, replaceEdited still refuses a renamed file; a recorded key that cannot be checked is refused", async () => {
      const root = seedDesign();
      await pullSpec({ nodeId: root.id, path: "nk.l2f.json" }, send as any, opts());
      (globalThis as any).figma.root = { name: "Renamed file" };
      await expect(pullSpec({ nodeId: root.id, path: "nk.l2f.json", replaceEdited: true }, send as any, opts())).rejects.toThrow("Wrong file");
      (globalThis as any).figma.root = { name: "Test file" };
      await pullSpec({ nodeId: root.id, path: "rk.l2f.json" }, send as any, opts({ userFileKey: () => "USERKEY12345" }));
      await expect(pullSpec({ nodeId: root.id, path: "rk.l2f.json", replaceEdited: true }, send as any, opts())).rejects.toThrow("Cannot confirm");
    });

    test("a recorded user file key that differs from the connected one is refused", async () => {
      const root = seedDesign();
      await pullSpec({ nodeId: root.id, path: "u.l2f.json" }, send as any, opts({ userFileKey: () => "USERKEY12345" }));
      await expect(pullSpec({ nodeId: root.id, path: "u.l2f.json" }, send as any, opts({ userFileKey: () => "OTHERKEY1234" }))).rejects.toThrow("Wrong file");
    });
  });

  describe("concurrent pulls (J)", () => {
    test("pulls to one path are serialised: 40 races never leave a Spec from one pull and a SpecLock from the other", async () => {
      const a = makeNode("FRAME", { name: "A" }, page);
      for (let i = 0; i < 1500; i++) makeNode("RECTANGLE", { name: "r" + i, x: i }, a);
      const b = makeNode("FRAME", { name: "B" }, page);
      const ea = await exportSpec({ nodeId: a.id }), eb = await exportSpec({ nodeId: b.id });
      const delayed = (exported: any, ms: number) => async () => { await new Promise(r => setTimeout(r, ms)); return exported; };
      let mixed = 0;
      for (let i = 0; i < 40; i++) {
        rmSync(join(base, "q.l2f.json"), { force: true });
        rmSync(join(base, "q.l2f.lock.json"), { force: true });
        const results = await Promise.allSettled([
          pullSpec({ nodeId: a.id, path: "q.l2f.json" }, delayed(ea, 0) as any, opts()),
          pullSpec({ nodeId: b.id, path: "q.l2f.json" }, delayed(eb, i % 8) as any, opts()),
        ]);
        expect(results.map(r => r.status)).toEqual(["fulfilled", "fulfilled"]);
        const spec = readJson(join(base, "q.l2f.json"));
        const lock = readJson(join(base, "q.l2f.lock.json"));
        if (spec.rootId !== lock.rootId || specHash(spec) !== lock.specHash) mixed++;
      }
      expect(mixed).toBe(0);
    });

    test("a failed pull releases the path", async () => {
      const root = seedDesign();
      const failing = async () => { throw new Error("plugin gone"); };
      await expect(pullSpec({ nodeId: root.id, path: "f.l2f.json" }, failing as any, opts())).rejects.toThrow("plugin gone");
      expect((await pullSpec({ nodeId: root.id, path: "f.l2f.json" }, send as any, opts())).nodeCount).toBe(3);
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
