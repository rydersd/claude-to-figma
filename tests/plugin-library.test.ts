import { afterAll, beforeEach, describe, expect, test } from "bun:test";
import { bindVariableToColor, buildFigmaEffects, customBase64Decode, getVariableByName } from "../src/llm2figma_plugin/src/utils";
import { createComponentInstance } from "../src/llm2figma_plugin/src/components";
import { createNodeTree } from "../src/llm2figma_plugin/src/node-tree";

// Contract mocks exercise plugin logic without pretending to replace live Figma QA.
const originalFigma = (globalThis as any).figma;
let nextId = 0;
let nodes = new Map<string, any>();
let importCount = 0;
const color = { id: "color", name: "Primary", resolvedType: "COLOR", valuesByMode: { mode: { r: 1, g: 0, b: 0 } } };
const wrongType = { id: "float", name: "Spacing", resolvedType: "FLOAT", valuesByMode: { mode: 8 } };
const duplicate = { ...color, id: "other", name: "Primary" };
let localReads = 0;
let libraryReads = 0;
let failBinding = false;

function makeNode(type: string): any {
  const node: any = {
    id: String(++nextId), type, name: type, children: [], x: 0, y: 0,
    width: 100, height: 100, opacity: 1, fills: [], strokes: [], effects: [],
    layoutMode: "NONE", cornerRadius: 0, topLeftRadius: 0,
    topRightRadius: 0, bottomLeftRadius: 0, bottomRightRadius: 0,
    resize(width: number, height: number) { this.width = width; this.height = height; },
    appendChild(child: any) { child.parent = this; this.children.push(child); },
    remove() {
      this.removed = true;
      nodes.delete(this.id);
      if (this.parent) this.parent.children = this.parent.children.filter((n: any) => n !== this);
    },
  };
  const corners = ["topLeftRadius", "topRightRadius", "bottomLeftRadius", "bottomRightRadius"];
  Object.defineProperty(node, "cornerRadius", {
    get() { return corners.every(c => node[c] === node[corners[0]]) ? node[corners[0]] : (globalThis as any).figma.mixed; },
    set(value) { for (const corner of corners) node[corner] = value; },
    configurable: true,
  });
  nodes.set(node.id, node);
  return node;
}

function component(key: string): any {
  return {
    id: "component-" + key, key,
    createInstance() {
      const node = makeNode("INSTANCE");
      node.componentKey = key;
      node.properties = {};
      node.setProperties = function (properties: any) {
        if (properties.Invalid) throw new Error("Invalid component property");
        this.properties = properties;
      };
      node.getMainComponentAsync = async function () { return component(this.componentKey); };
      node.swapComponent = function (target: any) { this.componentKey = target.key; };
      return node;
    },
  };
}

(globalThis as any).figma = {
  mixed: Symbol("mixed"),
  getNodeByIdAsync: async (id: string) => nodes.get(id) || null,
  importComponentByKeyAsync: async (key: string) => component(key),
  createFrame: () => makeNode("FRAME"),
  createImage: () => ({ hash: "image" }),
  variables: {
    getLocalVariableCollectionsAsync: async () => {
      localReads++;
      await Promise.resolve();
      return [{ name: "Colors", variableIds: ["color", "float"] }, { name: "Other", variableIds: ["other"] }];
    },
    getVariableByIdAsync: async (id: string) => ({ color, float: wrongType, other: duplicate } as any)[id],
    importVariableByKeyAsync: async (key: string) => { importCount++; return { ...color, id: key }; },
    setBoundVariableForPaint: (paint: any, field: string, variable: any) => {
      if (failBinding) throw new Error("binding rejected");
      if (paint.type !== "SOLID" || field !== "color") throw new Error("Invalid paint binding");
      return { ...paint, boundVariables: { color: { type: "VARIABLE_ALIAS", id: variable.id } } };
    },
  },
  teamLibrary: {
    getAvailableLibraryVariableCollectionsAsync: async () => {
      libraryReads++;
      await Promise.resolve();
      return [{ key: "a", name: "Library A" }, { key: "b", name: "Library B" }];
    },
    getVariablesInLibraryCollectionAsync: async (key: string) => [{ key: key + "-token", name: "Accent", resolvedType: "COLOR" }],
  },
};

beforeEach(() => {
  nodes = new Map();
  failBinding = false;
  (globalThis as any).figma.currentPage = makeNode("PAGE");
});
afterAll(() => { (globalThis as any).figma = originalFigma; });

describe("plugin library contracts", () => {
  test("concurrent local lookups wait for a complete index", async () => {
    const found = await Promise.all([getVariableByName("Colors/Primary"), getVariableByName("Colors/Spacing")]);
    expect(found).toEqual([color, wrongType]);
    expect(localReads).toBe(1);
  });

  test("local tokens win, and duplicate bare names fail explicitly", async () => {
    expect(await getVariableByName("Colors/Primary")).toBe(color);
    await expect(getVariableByName("Primary")).rejects.toThrow("Ambiguous local variable");
    expect(importCount).toBe(0);
  });

  test("concurrent library lookup shares enumeration; duplicate bare names fail", async () => {
    const found = await Promise.all([getVariableByName("Library A/Accent"), getVariableByName("Library B/Accent")]);
    expect(found.map(v => v.id)).toEqual(["a-token", "b-token"]);
    expect(libraryReads).toBe(1);
    await expect(getVariableByName("Accent")).rejects.toThrow("Ambiguous library variable");
  });

  test("binds a color through the paint API, including an empty fill", async () => {
    const node = makeNode("FRAME");
    node.setBoundVariable = () => { throw new Error("Node API cannot bind fills"); };
    expect(await bindVariableToColor(node, "fills", "Colors/Primary")).toBe(true);
    expect(node.fills[0].boundVariables.color.id).toBe("color");
    expect(await bindVariableToColor(node, "strokes", "Library A/Accent")).toBe(true);
    expect(node.strokes[0].boundVariables.color.id).toBe("a-token");
  });

  test("missing, non-color, and rejected bindings are errors", async () => {
    const node = makeNode("FRAME");
    await expect(bindVariableToColor(node, "fills", "Missing")).rejects.toThrow("Variable not found");
    await expect(bindVariableToColor(node, "fills", "Colors/Spacing")).rejects.toThrow("not a COLOR");
    failBinding = true;
    await expect(bindVariableToColor(node, "fills", "Colors/Primary")).rejects.toThrow("binding rejected");
  });

  test("failed instance overrides remove the partial instance", async () => {
    const before = nodes.size;
    await expect(createComponentInstance({ componentKey: "badge", properties: { Invalid: "x" } })).rejects.toThrow("Invalid component property");
    expect(nodes.size).toBe(before);
  });

  test("sync swaps the requested component while preserving instance identity", async () => {
    const created = await createComponentInstance({ componentKey: "old", name: "Badge" });
    const result = await createNodeTree({ rootId: created.id, tree: { type: "instance", componentKey: "new", name: "Badge", properties: { State: "Success" } } });
    expect(result.success).toBe(true);
    expect(result.nodes[0].id).toBe(created.id);
    expect(nodes.get(created.id).componentKey).toBe("new");
    expect(nodes.get(created.id).properties.State).toBe("Success");
  });

  test("sync reports rejected properties and root type mismatches", async () => {
    const created = await createComponentInstance({ componentKey: "badge" });
    const result = await createNodeTree({ rootId: created.id, tree: { type: "instance", componentKey: "badge", properties: { Invalid: "x" } } });
    expect(result.success).toBe(false);
    expect(result.errorCount).toBe(1);
    const mismatch = await createNodeTree({ rootId: created.id, tree: { type: "frame" } });
    expect(mismatch.success).toBe(false);
    expect(mismatch.errorCount).toBe(1);
  });

  test("failed tree binding reports the error and removes the new node", async () => {
    const before = nodes.size;
    const result = await createNodeTree({ tree: { type: "frame", fillColor: "$var:Missing" } });
    expect(result.success).toBe(false);
    expect(result.createdCount).toBe(0);
    expect(result.errors[0].nodeId).toBeDefined();
    expect(nodes.size).toBe(before);
  });

  test("lookup ambiguity stays in the tree error contract", async () => {
    const result = await createNodeTree({ tree: { type: "frame", fillColor: "$var:Primary" } });
    expect(result.success).toBe(false);
    expect(result.errors[0].error).toContain("Ambiguous local variable");
  });

  test("sync preserves image and per-corner precedence over general styling", async () => {
    const root = makeNode("FRAME");
    const result = await createNodeTree({ rootId: root.id, tree: { type: "frame", fillColor: "#ff0000", fillImage: { base64: "aGk=" }, cornerRadius: 10, topLeftRadius: 3 } });
    expect(result.success).toBe(true);
    expect(root.fills[0].type).toBe("IMAGE");
    expect(root.topLeftRadius).toBe(3);
  });

  test("shadow defaults include required blend mode and preserve zero offsets", () => {
    const effect = buildFigmaEffects([{ type: "DROP_SHADOW", offset: { x: 0, y: 0 } }])[0];
    expect(effect.blendMode).toBe("NORMAL");
    expect(effect.offset).toEqual({ x: 0, y: 0 });
  });

  test("base64 rejects invalid trailing characters and malformed padding", () => {
    for (const input of ["AA!!", "A===", "AAAA=", "AA=A", "AAA"]) {
      expect(() => customBase64Decode(input)).toThrow("Invalid base64 input");
    }
  });
});
