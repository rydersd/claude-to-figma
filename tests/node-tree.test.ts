import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { applyDeferredFill, createNode, createNodeTree, createNodeTreeContext, resolveAndBind, updateNodeProperties } from "../src/llm2figma_plugin/src/node-tree";

// Characterisation tests for create_node_tree on a recording figma mock. Every
// property write and mutating method call on a node is journaled, so a refactor
// that changes what gets written, or in what order, shows up as a snapshot diff.
// The variable world mirrors tests/plugin-library.test.ts exactly, because the
// plugin's variable index is module state shared across test files.

const originalFigma = (globalThis as any).figma;
let nextId = 0;
let nodes = new Map<string, any>();
let journal: string[] = [];
let progress: any[] = [];

const color = { id: "color", name: "Primary", resolvedType: "COLOR", valuesByMode: { mode: { r: 1, g: 0, b: 0 } } };
const wrongType = { id: "float", name: "Spacing", resolvedType: "FLOAT", valuesByMode: { mode: 8 } };
const duplicate = { ...color, id: "other", name: "Primary" };

function fmt(value: any): string {
  return JSON.stringify(value, (_k, v) => {
    if (v && typeof v === "object" && v.__node) return "#" + v.id;
    return v;
  });
}

function makeNode(type: string, extra: any = {}): any {
  const target: any = {
    __node: true, id: String(++nextId), type, name: type, children: [], parent: null,
    x: 0, y: 0, width: 100, height: 100, opacity: 1, fills: [], strokes: [], effects: [],
    strokeWeight: 1, strokeAlign: "INSIDE", layoutMode: "NONE", layoutWrap: "NO_WRAP",
    layoutPositioning: "AUTO", layoutSizingHorizontal: "FIXED", layoutSizingVertical: "FIXED",
    clipsContent: true, itemReverseZIndex: false, itemSpacing: 0, counterAxisSpacing: 0,
    paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0,
    primaryAxisAlignItems: "MIN", counterAxisAlignItems: "MIN",
    cornerRadius: 0, topLeftRadius: 0, topRightRadius: 0, bottomLeftRadius: 0, bottomRightRadius: 0,
    ...extra,
  };
  const proxy: any = new Proxy(target, {
    set(t, prop, value) {
      // `throwsOn: {prop: message}` makes that setter throw without writing
      if (t.throwsOn && t.throwsOn[prop]) throw new Error(t.throwsOn[prop]);
      if (prop !== "parent") journal.push(`${t.id}.${String(prop)} = ${fmt(value)}`);
      t[prop] = value;
      return true;
    },
  });
  target.resize = (w: number, h: number) => { journal.push(`${target.id}.resize(${w}, ${h})`); target.width = w; target.height = h; };
  target.appendChild = (child: any) => {
    journal.push(`${target.id}.appendChild(#${child.id})`);
    child.parent = proxy;
    target.children.push(child);
  };
  target.insertChild = (index: number, child: any) => {
    journal.push(`${target.id}.insertChild(${index}, #${child.id})`);
    child.parent = proxy;
    target.children.splice(index, 0, child);
  };
  target.remove = () => {
    journal.push(`${target.id}.remove()`);
    target.removed = true;
    nodes.delete(target.id);
    if (target.parent) target.parent.children.splice(target.parent.children.indexOf(proxy), 1);
  };
  if (type === "INSTANCE") {
    target.setProperties = (props: any) => {
      journal.push(`${target.id}.setProperties(${fmt(props)})`);
      if (props.Invalid) throw new Error("Invalid component property");
      target.properties = { ...target.properties, ...props };
    };
    target.getMainComponentAsync = async () => component(target.componentKey);
    target.swapComponent = (c: any) => { journal.push(`${target.id}.swapComponent(${c.key})`); target.componentKey = c.key; };
  }
  if (type === "VECTOR") {
    target.setVectorNetworkAsync = async (network: any) => {
      journal.push(`${target.id}.setVectorNetworkAsync(${fmt(network)})`);
      target.vectorNetwork = network;
    };
  }
  nodes.set(target.id, proxy);
  return proxy;
}

function component(key: string): any {
  return { id: "component-" + key, key, createInstance: () => makeNode("INSTANCE", { componentKey: key, properties: {} }) };
}

beforeAll(() => {
  (globalThis as any).figma = {
    mixed: Symbol("mixed"),
    ui: { postMessage: (msg: any) => { const { timestamp, ...rest } = msg; progress.push(rest); } },
    getNodeByIdAsync: async (id: string) => nodes.get(id) || null,
    importComponentByKeyAsync: async (key: string) => component(key),
    loadFontAsync: async (font: any) => { if (font.family === "Missing") throw new Error("font not found"); },
    createFrame: () => makeNode("FRAME"),
    createRectangle: () => makeNode("RECTANGLE"),
    createText: () => makeNode("TEXT", { fontName: { family: "Inter", style: "Regular" }, fontSize: 12, characters: "", height: 20 }),
    createVector: () => makeNode("VECTOR", { vectorNetwork: { vertices: [{ x: 0, y: 0 }, { x: 1, y: 1 }], segments: [] } }),
    createImage: () => ({ hash: "image" }),
    variables: {
      getLocalVariableCollectionsAsync: async () => [{ name: "Colors", variableIds: ["color", "float"] }, { name: "Other", variableIds: ["other"] }],
      getVariableByIdAsync: async (id: string) => ({ color, float: wrongType, other: duplicate } as any)[id],
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
  };
});
afterAll(() => { (globalThis as any).figma = originalFigma; });

beforeEach(() => {
  nextId = 0;
  nodes = new Map();
  progress = [];
  (globalThis as any).figma.currentPage = makeNode("PAGE");
  journal = [];
});

// The observable outcome of one call: the result (minus wall-clock time), every
// write in order, and every progress message.
async function run(params: any, firstOnTop?: boolean) {
  const result: any = await createNodeTree(params, firstOnTop);
  delete result.stats.durationMs;
  return { result, journal: journal.slice(), progress: progress.slice() };
}

// A tree touching every create branch: all five node types, hex, rgba and $var:
// colours, effects, per-corner radii, layout, ABSOLUTE positioning, FILL sizing.
const fullTree = {
  type: "frame", name: "Card", width: 320, height: 200, layoutMode: "VERTICAL", itemSpacing: 8,
  paddingTop: 16, paddingRight: 16, paddingBottom: 16, paddingLeft: 16,
  fillColor: "#ffffff", strokeColor: "$var:Colors/Primary", strokeWeight: 2, strokeAlign: "OUTSIDE",
  cornerRadius: 12, topLeftRadius: 4, clipsContent: false, opacity: 0.9,
  effects: [{ type: "DROP_SHADOW", offset: { x: 0, y: 2 }, radius: 6 }],
  children: [
    { type: "text", name: "Title", text: "Hello", fontFamily: "Roboto", fontWeight: 700, fontSize: "16",
      fontColor: "#333333", lineHeight: 20, letterSpacing: 0.5, textCase: "UPPER", textAlignHorizontal: "CENTER", width: 200 },
    { type: "rectangle", name: "Swatch", width: 40, height: 40, fillColor: "$var:Colors/Primary",
      strokeColor: { r: 0, g: 0, b: 1, a: 0.5 }, strokeWeight: 1, opacity: 0.5, layoutPositioning: "ABSOLUTE", x: 5, y: 6 },
    { type: "vector", name: "Icon", pathData: "M0 0L10 10", width: 10, height: 10, strokeColor: "#000000", strokeCap: "ROUND" },
    { type: "instance", name: "Badge", componentKey: "badge", properties: { State: "On" }, layoutSizingHorizontal: "FILL" },
    { type: "frame", name: "Row", layoutMode: "HORIZONTAL", layoutSizingHorizontal: "FILL", layoutSizingVertical: "HUG",
      children: [{ type: "rectangle", name: "Dot", width: 4, height: 4, fillColor: { r: 0, g: 0, b: 0, a: 0 } }] },
  ],
};

describe("create_node_tree characterisation: create mode", () => {
  test("full tree, every node type and colour form, with progress", async () => {
    expect(await run({ tree: fullTree, commandId: "cmd-1" })).toMatchSnapshot();
  });

  test("$repeat expands, $-placeholders substitute, progress every 5 nodes", async () => {
    const tree = {
      type: "frame", name: "List", layoutMode: "VERTICAL",
      children: [{ $repeat: { data: [["a", 1], ["b", 2], ["c", 3], ["d", 4], ["e", 5], ["f", 6]], template: { type: "text", name: "Item $[0]", text: "Row $[0] = $[1]" } } }],
    };
    expect(await run({ tree, commandId: "cmd-2" })).toMatchSnapshot();
  });

  test("firstOnTop false and an explicit parent", async () => {
    const parent = makeNode("FRAME");
    journal = [];
    expect(await run({ tree: { type: "frame", name: "Inner", layoutMode: "HORIZONTAL" }, parentId: parent.id }, false)).toMatchSnapshot();
  });

  test("failures: unknown type, missing pathData, failed bind removes the node, siblings continue", async () => {
    const tree = {
      type: "frame", name: "Root",
      children: [
        { type: "ellipse", name: "Nope" },
        { type: "vector", name: "NoPath" },
        { type: "rectangle", name: "BadVar", fillColor: "$var:Missing" },
        { type: "frame", name: "BadFrame", strokeColor: "$var:Colors/Spacing", children: [{ type: "text", text: "never" }] },
        { type: "rectangle", name: "Fine" },
      ],
    };
    expect(await run({ tree })).toMatchSnapshot();
  });

  test("a frame that cannot be parented skips its children", async () => {
    expect(await run({ tree: { type: "frame", name: "Orphan", children: [{ type: "text", text: "x" }] }, parentId: "missing" })).toMatchSnapshot();
  });

  test("text font fallback when the family cannot load", async () => {
    expect(await run({ tree: { type: "text", text: "Fallback", fontFamily: "Missing", fontWeight: 600 } })).toMatchSnapshot();
  });

  test("missing tree throws", async () => {
    await expect(createNodeTree({})).rejects.toThrow("Missing tree parameter");
  });
});

describe("create_node_tree characterisation: sync mode", () => {
  async function seed() {
    await createNodeTree({
      tree: {
        type: "frame", name: "Root", layoutMode: "VERTICAL",
        children: [
          { type: "text", name: "Title", text: "Old", fontSize: 14 },
          { type: "rectangle", name: "Box", width: 10, height: 10, fillColor: "#00ff00" },
          { type: "vector", name: "Icon", pathData: "M0 0L5 5", width: 5, height: 5 },
          { type: "instance", name: "Badge", componentKey: "old" },
          { type: "rectangle", name: "Extra" },
          { type: "frame", name: "Panel", children: [{ type: "text", name: "Deep", text: "d" }] },
        ],
      },
    });
    journal = [];
    progress = [];
    return nodes.get("2");
  }

  test("updates every frame/text/rect/vector/instance branch, creates unmatched, prunes", async () => {
    const root = await seed();
    const tree = {
      type: "frame", name: "Root 2", x: 10, y: 20, width: 300, height: 400, opacity: 0.8,
      fillColor: "$var:Colors/Primary", strokeColor: "#112233", strokeWeight: 3, cornerRadius: 6, clipsContent: false,
      layoutMode: "HORIZONTAL", layoutWrap: "WRAP", paddingTop: 1, paddingRight: 2, paddingBottom: 3, paddingLeft: 4,
      primaryAxisAlignItems: "CENTER", counterAxisAlignItems: "MAX", itemSpacing: 5, counterAxisSpacing: 6,
      itemReverseZIndex: true, layoutSizingHorizontal: "HUG", layoutSizingVertical: "FILL", strokeAlign: "CENTER",
      effects: [{ type: "LAYER_BLUR", radius: 2 }], bottomLeftRadius: 9,
      children: [
        { type: "text", name: "Title", text: "New", fontFamily: "Roboto", fontStyle: "Bold", fontSize: 18, fontColor: "$var:Colors/Primary",
          textAlignHorizontal: "RIGHT", lineHeight: 22, letterSpacing: 1, textCase: "LOWER", width: 150 },
        { type: "rectangle", name: "Box", width: 10, height: 10 },
        { type: "vector", name: "Icon", width: 8, height: 8, pathData: "M0 0L8 8", strokeCap: "ROUND", fillColor: "#ff0000", strokeColor: "#00ff00", strokeWeight: 2 },
        { type: "instance", name: "Badge", componentKey: "new", properties: { State: "Off" }, textOverrides: {}, layoutSizingHorizontal: "FILL", layoutSizingVertical: "HUG" },
        { type: "rectangle", name: "Fresh", fillColor: "#0000ff" },
        { type: "frame", name: "Panel", fillImage: { base64: "aGk=" }, children: [{ type: "text", name: "Deep", text: "d" }] },
      ],
    };
    expect(await run({ rootId: root.id, tree, prune: true, commandId: "cmd-3" })).toMatchSnapshot();
  });

  test("without prune, unmatched existing children stay; unchanged nodes are counted", async () => {
    const root = await seed();
    const tree = { type: "frame", name: "Root", children: [{ type: "text", name: "Title", text: "Old" }] };
    expect(await run({ rootId: root.id, tree })).toMatchSnapshot();
  });

  test("errors: root type mismatch, failed update, failed bind skips that node's children", async () => {
    const root = await seed();
    expect(await run({ rootId: root.id, tree: { type: "text" } })).toMatchSnapshot();
    journal = [];
    progress = [];
    const tree = {
      type: "frame", name: "Root",
      children: [
        { type: "instance", name: "Badge", componentKey: "old", properties: { Invalid: "x" } },
        { type: "frame", name: "Panel", fillColor: "$var:Missing", children: [{ type: "text", name: "Deep", text: "changed" }] },
        { type: "rectangle", name: "Title" },
      ],
    };
    expect(await run({ rootId: root.id, tree })).toMatchSnapshot();
  });

  test("missing root throws", async () => {
    await expect(createNodeTree({ rootId: "nope", tree: { type: "frame" } })).rejects.toThrow("Root node not found: nope");
  });
});

// --- Lifted helpers (PR 11a): `only`, `onBindFailure`, index paths ---

// Property names written to `node` (and "child:<prop>" for its children) since the journal was cleared.
function writes(node: any): string[] {
  return journal.map(line => {
    const m = line.match(/^(\d+)\.(\w+)/)!;
    return (m[1] === node.id ? "" : "child:") + m[2];
  });
}

const common = { name: "N", x: 5, y: 6, opacity: 0.5, effects: [{ type: "LAYER_BLUR", radius: 1 }], strokeAlign: "CENTER", layoutPositioning: "ABSOLUTE" };
const paints = { fillColor: { r: 1, g: 0, b: 0 }, strokeColor: { r: 0, g: 1, b: 0 }, strokeWeight: 3 };
const corners = { topLeftRadius: 9, topRightRadius: 9, bottomRightRadius: 9, bottomLeftRadius: 9 };
const same = (spec: any) => Object.fromEntries(Object.keys(spec).map(k => [k, [k]]));
const paintWrites = { fillColor: ["fills"], strokeColor: ["strokes"] };

// For each node type: a spec in which every value differs from the mock's
// defaults, and the writes each single key is expected to cause.
const branches: Record<string, { make: () => any; spec: any; expected: Record<string, string[]> }> = {
  frame: {
    make: () => makeNode("FRAME"),
    spec: {
      ...common, ...paints, ...corners, width: 50, height: 60, cornerRadius: 4, clipsContent: false, layoutMode: "VERTICAL",
      layoutWrap: "WRAP", paddingTop: 1, paddingRight: 2, paddingBottom: 3, paddingLeft: 4, primaryAxisAlignItems: "CENTER",
      counterAxisAlignItems: "MAX", itemSpacing: 7, counterAxisSpacing: 8, itemReverseZIndex: true,
      layoutSizingHorizontal: "HUG", layoutSizingVertical: "HUG", fillImage: { base64: "aGk=" },
    },
    expected: { width: ["resize"], height: ["resize"], ...paintWrites, fillImage: ["fills"] },
  },
  text: {
    make: () => makeNode("TEXT", { fontName: { family: "Inter", style: "Regular" }, fontSize: 12, characters: "", height: 20 }),
    spec: {
      ...common, fontFamily: "Roboto", fontStyle: "Bold", fontWeight: 700, text: "Hi", fontSize: 20, fontColor: { r: 1, g: 0, b: 0 },
      textAlignHorizontal: "RIGHT", lineHeight: 22, letterSpacing: 1, textCase: "UPPER", width: 150,
    },
    expected: { fontFamily: ["fontName"], fontStyle: ["fontName"], fontWeight: ["fontName"], text: ["characters"], fontColor: ["fills"], width: ["resize", "textAutoResize"] },
  },
  rectangle: {
    make: () => makeNode("RECTANGLE"),
    spec: { ...common, ...paints, ...corners, width: 50, height: 60, cornerRadius: 4, fillImage: { base64: "aGk=" } },
    expected: { width: ["resize"], height: ["resize"], ...paintWrites, fillImage: ["fills"] },
  },
  vector: {
    make: () => makeNode("VECTOR", { vectorNetwork: { vertices: [{ x: 0, y: 0 }], segments: [] } }),
    spec: { ...common, ...paints, width: 50, height: 60, pathData: "M0 0L1 1", strokeCap: "ROUND" },
    // With `only` (the spec path) the network is written through setVectorNetworkAsync:
    // the vectorNetwork setter is not available with dynamic-page access.
    expected: { width: ["resize"], height: ["resize"], ...paintWrites, pathData: ["vectorPaths"], strokeCap: ["setVectorNetworkAsync"] },
  },
  instance: {
    make: () => {
      const node = makeNode("INSTANCE", { componentKey: "old", properties: {} });
      const label = makeNode("TEXT", { name: "Label", fontName: { family: "Inter", style: "Regular" }, characters: "a" });
      node.children.push(label);
      return node;
    },
    spec: { ...common, componentKey: "new", properties: { State: "On" }, textOverrides: { Label: "b" }, layoutSizingHorizontal: "HUG", layoutSizingVertical: "HUG" },
    expected: { componentKey: ["swapComponent"], properties: ["setProperties"], textOverrides: ["child:characters"] },
  },
};

describe("updateNodeProperties with `only`", () => {
  for (const [type, { make, spec, expected }] of Object.entries(branches)) {
    for (const key of Object.keys(spec)) {
      test(`${type}: only {${key}} writes ${(expected[key] || [key]).join(", ")} and nothing else`, async () => {
        const node = make();
        journal = [];
        const result = await updateNodeProperties(node, spec, new Set([key]));
        expect(writes(node)).toEqual(expected[key] || same({ [key]: 0 })[key]);
        expect(result.changed).toBe(true);
      });
    }
  }

  test("an empty `only` writes nothing on any type", async () => {
    for (const { make, spec } of Object.values(branches)) {
      const node = make();
      journal = [];
      expect((await updateNodeProperties(node, spec, new Set())).changed).toBe(false);
      expect(journal).toEqual([]);
    }
  });

  test("text content alone leaves a Roboto Bold font alone; without `only` it resets to Inter Regular (today's sync)", async () => {
    const node = makeNode("TEXT", { fontName: { family: "Roboto", style: "Bold" }, characters: "old" });
    journal = [];
    await updateNodeProperties(node, { text: "new" }, new Set(["text"]));
    expect(writes(node)).toEqual(["characters"]);
    expect(node.fontName).toEqual({ family: "Roboto", style: "Bold" });

    const other = makeNode("TEXT", { fontName: { family: "Roboto", style: "Bold" }, characters: "old" });
    journal = [];
    await updateNodeProperties(other, { text: "new" });
    expect(writes(other)).toEqual(["fontName", "characters"]);
    expect(other.fontName).toEqual({ family: "Inter", style: "Regular" });
  });

  test("x alone does not touch fills, even with fillColor in the spec", async () => {
    const node = makeNode("FRAME");
    journal = [];
    await updateNodeProperties(node, { x: 40, fillColor: { r: 0, g: 0, b: 1 } }, new Set(["x"]));
    expect(writes(node)).toEqual(["x"]);
  });
});

describe("resolveAndBind", () => {
  test("resolves hex in a copy, substitutes the first mode for $var:, binds after the write", async () => {
    const props = { fillColor: "$var:Colors/Primary", strokeColor: "#0000ff", name: "A" };
    const colors = await resolveAndBind(props);
    expect(props.fillColor).toBe("$var:Colors/Primary");
    expect(colors.resolved).toEqual({ fillColor: { r: 1, g: 0, b: 0 }, strokeColor: { r: 0, g: 0, b: 1, a: 1 }, name: "A" });
    expect(colors.bindings).toEqual([{ colorProp: "fillColor", figmaField: "fills", varRef: "Colors/Primary" }]);
    const node = makeNode("FRAME");
    await colors.bind(node);
    expect(node.fills[0].boundVariables.color.id).toBe("color");
  });

  test("an unresolvable $var: is dropped from the copy and bind throws", async () => {
    const colors = await resolveAndBind({ fontColor: "$var:Missing" });
    expect(colors.resolved).toEqual({});
    await expect(colors.bind(makeNode("TEXT"))).rejects.toThrow("Variable not found: Missing");
  });
});

describe("createNode options", () => {
  const ctx = () => createNodeTreeContext({ totalNodes: 10 });

  test("returns every created node with its spec index path, past a failed sibling", async () => {
    const c = ctx();
    const created = await createNode({
      type: "frame", name: "Root",
      children: [{ type: "ellipse", name: "Nope" }, { type: "rectangle", name: "R" }, { type: "frame", name: "F", children: [{ type: "text", text: "T" }] }],
    }, null, 0, c, { path: [2] });
    expect(created.map(e => [e.path, nodes.get(e.id).name])).toEqual([[[2], "Root"], [[2, 1], "R"], [[2, 2], "F"], [[2, 2, 0], "T"]]);
    expect(c.counters).toEqual({ created: 4, updated: 0, unchanged: 0, pruned: 0, errors: 1 });
  });

  test("onBindFailure default removes the node and returns nothing for it", async () => {
    const c = ctx();
    const created = await createNode({ type: "rectangle", name: "Swatch", fillColor: "$var:Missing" }, null, 0, c);
    expect(created).toEqual([]);
    expect(nodes.get(c.errors[0].nodeId)).toBeUndefined();
    expect(journal).toContain(`${c.errors[0].nodeId}.remove()`);
  });

  test('onBindFailure "keep" leaves the node renamed, reports it, and skips its children', async () => {
    const c = ctx();
    const created = await createNode(
      { type: "frame", name: "Panel", fillColor: "$var:Missing", children: [{ type: "text", text: "never" }] },
      null, 0, c, { onBindFailure: "keep", path: [0, 3] }
    );
    expect(created).toEqual([{ path: [0, 3], id: c.errors[0].nodeId, failed: true }]);
    expect(nodes.get(created[0].id).name).toBe("Panel (failed)");
    expect(c.errors[0].error).toContain("Variable binding failed");
    expect(c.counters.created).toBe(0);
    expect(c.nodes).toEqual([]);
    expect(journal.some(line => line.endsWith(".remove()"))).toBe(false);
    expect(nodes.get(created[0].id).children).toEqual([]);
  });
});

// --- Review fixes (PR 11a) ---

const byName = (name: string) => Array.from(nodes.values()).find(n => n.name === name);

describe("resolveAndBind with `only`", () => {
  test("a fill update leaves a $var: stroke unresolved, unbound and unwritten", async () => {
    const bound = { type: "SOLID", color: { r: 1, g: 0, b: 0 }, boundVariables: { color: { type: "VARIABLE_ALIAS", id: "color" } } };
    const node = makeNode("FRAME", { strokes: [bound] });
    journal = [];
    // "$var:Primary" is ambiguous, so getVariableByName throws if it is ever called for the stroke
    const spec = { fillColor: "#00ff00", strokeColor: "$var:Primary" };
    const only = new Set(["fillColor"]);
    const colors = await resolveAndBind(spec, only);
    expect(colors.bindings).toEqual([]);
    expect(colors.resolved).toEqual({ fillColor: { r: 0, g: 1, b: 0, a: 1 }, strokeColor: "$var:Primary" });
    await updateNodeProperties(node, colors.resolved, only);
    await colors.bind(node);
    expect(writes(node)).toEqual(["fills"]);
    expect(node.strokes).toEqual([bound]);
  });

  test("a named $var: colour is still resolved and bound", async () => {
    const colors = await resolveAndBind({ fillColor: "#00ff00", strokeColor: "$var:Colors/Primary" }, new Set(["strokeColor"]));
    expect(colors.resolved).toEqual({ fillColor: "#00ff00", strokeColor: { r: 1, g: 0, b: 0 } });
    expect(colors.bindings).toEqual([{ colorProp: "strokeColor", figmaField: "strokes", varRef: "Colors/Primary" }]);
  });
});

describe("updateNodeProperties: unhandled keys, deferred FILL, sizing branches", () => {
  test("FILL on a frame is reported unhandled and written by applyDeferredFill", async () => {
    const node = makeNode("FRAME", { layoutMode: "VERTICAL" });
    journal = [];
    const spec = { layoutSizingHorizontal: "FILL", layoutSizingVertical: "FILL" };
    const only = new Set(["layoutSizingHorizontal"]);
    const result = await updateNodeProperties(node, spec, only);
    expect(result).toEqual({ changed: false, changedProps: [], unhandled: ["layoutSizingHorizontal"] });
    expect(journal).toEqual([]);
    expect(applyDeferredFill(node, spec, only)).toEqual(["layoutSizingHorizontal"]);
    expect(journal).toEqual([`${node.id}.layoutSizingHorizontal = "FILL"`]);
  });

  test("applyDeferredFill without `only` sets both axes; skips non-auto-layout frames and other types; ignores a throwing setter", async () => {
    const spec = { layoutSizingHorizontal: "FILL", layoutSizingVertical: "FILL" };
    const frame = makeNode("FRAME", { layoutMode: "HORIZONTAL" });
    expect(applyDeferredFill(frame, spec)).toEqual(["layoutSizingHorizontal", "layoutSizingVertical"]);
    expect(applyDeferredFill(makeNode("FRAME"), spec)).toEqual([]);
    expect(applyDeferredFill(makeNode("RECTANGLE", { layoutMode: "VERTICAL" }), spec)).toEqual([]);
    const throwing = makeNode("FRAME", { layoutMode: "VERTICAL", throwsOn: { layoutSizingHorizontal: "no auto-layout parent" } });
    expect(applyDeferredFill(throwing, spec)).toEqual(["layoutSizingVertical"]);
  });

  test("keys with no branch for the node type are returned; without `only` unhandled is empty", async () => {
    const rect = makeNode("RECTANGLE");
    const result = await updateNodeProperties(rect, { text: "x", fillColor: { r: 0, g: 0, b: 1 } }, new Set(["text", "fillColor", "componentKey"]));
    expect(result.changedProps).toEqual(["fillColor"]);
    expect(result.unhandled).toEqual(["text", "componentKey"]);
    expect((await updateNodeProperties(makeNode("RECTANGLE"), { text: "x" })).unhandled).toEqual([]);
    // width and height both count as consumed by the one size branch
    expect((await updateNodeProperties(makeNode("FRAME"), { width: 5, height: 5 }, new Set(["width", "height"]))).unhandled).toEqual([]);
  });

  test("text: textAutoResize and layoutSizing* are written when named", async () => {
    const node = makeNode("TEXT", { fontName: { family: "Inter", style: "Regular" }, characters: "a", textAutoResize: "NONE" });
    journal = [];
    const result = await updateNodeProperties(node, { textAutoResize: "WIDTH_AND_HEIGHT", layoutSizingHorizontal: "FILL", layoutSizingVertical: "HUG" },
      new Set(["textAutoResize", "layoutSizingHorizontal", "layoutSizingVertical"]));
    expect(writes(node)).toEqual(["layoutSizingHorizontal", "layoutSizingVertical", "textAutoResize"]);
    expect(result.unhandled).toEqual([]);
  });

  for (const type of ["RECTANGLE", "VECTOR"]) {
    test(`${type.toLowerCase()}: layoutSizing* written when named; a throwing setter is skipped, not reported changed`, async () => {
      const node = makeNode(type, { throwsOn: { layoutSizingVertical: "parent has no auto-layout" } });
      journal = [];
      const result = await updateNodeProperties(node, { layoutSizingHorizontal: "FILL", layoutSizingVertical: "FILL" },
        new Set(["layoutSizingHorizontal", "layoutSizingVertical"]));
      expect(writes(node)).toEqual(["layoutSizingHorizontal"]);
      expect(result.changedProps).toEqual(["layoutSizingHorizontal"]);
      expect(result.unhandled).toEqual([]);
    });
  }

  test("without `only`, textAutoResize and layoutSizing* on text, rectangle and vector are not written (today's behaviour)", async () => {
    const spec = { textAutoResize: "WIDTH_AND_HEIGHT", layoutSizingHorizontal: "FILL", layoutSizingVertical: "HUG" };
    const text = makeNode("TEXT", { fontName: { family: "Inter", style: "Regular" }, characters: "a", textAutoResize: "NONE" });
    const rect = makeNode("RECTANGLE");
    const vector = makeNode("VECTOR");
    journal = [];
    for (const node of [text, rect, vector]) {
      expect((await updateNodeProperties(node, spec)).changed).toBe(false);
    }
    expect(journal).toEqual([]);
  });
});

describe("updateNodeProperties: text font with `only`", () => {
  const roboto = () => makeNode("TEXT", { fontName: { family: "Roboto", style: "Bold" }, characters: "a" });

  test("only fontFamily keeps the live style", async () => {
    const node = roboto();
    journal = [];
    await updateNodeProperties(node, { fontFamily: "Inter" }, new Set(["fontFamily"]));
    expect(node.fontName).toEqual({ family: "Inter", style: "Bold" });
    expect(writes(node)).toEqual(["fontName"]);
  });

  test("only fontWeight keeps the live family; only fontStyle likewise", async () => {
    const a = roboto();
    await updateNodeProperties(a, { fontFamily: "Inter", fontWeight: 400 }, new Set(["fontWeight"]));
    expect(a.fontName).toEqual({ family: "Roboto", style: "Regular" });
    const b = roboto();
    await updateNodeProperties(b, { fontStyle: "Medium" }, new Set(["fontStyle"]));
    expect(b.fontName).toEqual({ family: "Roboto", style: "Medium" });
  });

  test("a named part equal to the live font writes nothing", async () => {
    const node = roboto();
    journal = [];
    await updateNodeProperties(node, { fontFamily: "Roboto" }, new Set(["fontFamily"]));
    expect(journal).toEqual([]);
  });

  test("without `only`, a missing style still defaults to Regular (today's sync)", async () => {
    const node = roboto();
    await updateNodeProperties(node, { fontFamily: "Inter" });
    expect(node.fontName).toEqual({ family: "Inter", style: "Regular" });
  });
});

describe("createNode: error paths, skipped children, onBindFailure validation", () => {
  const ctx = () => createNodeTreeContext({ totalNodes: 10 });

  test("with `path`, every error entry carries the spec node's path", async () => {
    const c = ctx();
    await createNode({
      type: "frame", name: "Root",
      children: [{ type: "ellipse", name: "Bad" }, { type: "frame", name: "F", children: [{ type: "rectangle", name: "V", fillColor: "$var:Missing" }] }],
    }, null, 0, c, { path: [] });
    expect(c.errors.map(e => [e.name, e.path])).toEqual([["Bad", [0]], ["V", [1, 0]]]);
  });

  test("without `path`, error entries have no path key (create_node_tree's shape)", async () => {
    const c = ctx();
    await createNode({ type: "frame", name: "Root", children: [{ type: "ellipse", name: "Bad" }] }, null, 0, c);
    expect(c.errors).toEqual([{ type: "ellipse", name: "Bad", error: "Unknown node type: ellipse" }]);
  });

  test('"keep": a failed bind reports every skipped descendant with its path', async () => {
    const c = ctx();
    const created = await createNode({
      type: "frame", name: "P", fillColor: "$var:Missing",
      children: [{ type: "text", text: "x" }, { type: "frame", name: "Inner", children: [{ type: "rectangle", name: "R" }] }],
    }, null, 0, c, { onBindFailure: "keep", path: [1] });
    expect(created).toEqual([{ path: [1], id: c.errors[0].nodeId, failed: true }]);
    expect(c.errors.map(e => [e.path, e.error.startsWith("Variable binding failed") ? "bind" : e.error])).toEqual([
      [[1], "bind"], [[1, 0], "skipped: parent failed"], [[1, 1], "skipped: parent failed"], [[1, 1, 0], "skipped: parent failed"],
    ]);
    expect(c.errors[3]).toEqual({ type: "rectangle", name: "R", path: [1, 1, 0], error: "skipped: parent failed" });
    expect(c.counters.errors).toBe(4);
  });

  test('"keep": a failed create also reports its skipped children', async () => {
    const c = ctx();
    const created = await createNode({ type: "frame", name: "Orphan", children: [{ type: "text", text: "x" }] }, "missing", 0, c, { onBindFailure: "keep", path: [0] });
    expect(created).toEqual([]);
    expect(c.errors.map(e => e.path)).toEqual([[0], [0, 0]]);
    expect(c.errors[1].error).toBe("skipped: parent failed");
  });

  test('"remove" (default) does not report skipped children', async () => {
    const c = ctx();
    await createNode({ type: "frame", name: "P", fillColor: "$var:Missing", children: [{ type: "text", text: "x" }] }, null, 0, c, { path: [] });
    expect(c.errors.length).toBe(1);
  });

  test("an unknown onBindFailure throws before anything is created", async () => {
    const c = ctx();
    const before = nodes.size;
    await expect(createNode({ type: "rectangle" }, null, 0, c, { onBindFailure: "delete" as any })).rejects.toThrow('onBindFailure must be "remove" or "keep"');
    expect(nodes.size).toBe(before);
    expect(journal).toEqual([]);
  });
});

describe("progress label and interval on the context", () => {
  test("defaults are create_node_tree and every 5 nodes", () => {
    const c = createNodeTreeContext({ totalNodes: 1 });
    expect([c.progressLabel, c.progressEvery]).toEqual(["create_node_tree", 5]);
  });

  test("a caller can report under its own label at its own interval", async () => {
    const c = createNodeTreeContext({ totalNodes: 4, commandId: "cmd-p", progressLabel: "apply_spec_ops", progressEvery: 2 });
    await createNode({ type: "frame", name: "R", children: [{ type: "rectangle" }, { type: "rectangle" }, { type: "rectangle" }] }, null, 0, c);
    expect(progress.map(p => [p.commandType, p.processedItems])).toEqual([["apply_spec_ops", 2], ["apply_spec_ops", 4]]);
  });
});

// Characterisation of paths the refactor moved that had no coverage, recorded
// against today's behaviour through create_node_tree.
describe("create_node_tree characterisation: moved paths", () => {
  async function seed() {
    await createNodeTree({
      tree: {
        type: "frame", name: "Root", layoutMode: "VERTICAL",
        children: [
          { type: "text", name: "Title", text: "Old", fontSize: 14 },
          { type: "rectangle", name: "Box", width: 10, height: 10 },
          { type: "instance", name: "Badge", componentKey: "old" },
        ],
      },
    });
    journal = [];
    progress = [];
    return byName("Root");
  }

  test("sync: an instance sizing setter that throws is logged and skipped", async () => {
    const root = await seed();
    byName("Badge").throwsOn = { layoutSizingHorizontal: "parent is not auto-layout" };
    journal = [];
    const tree = { type: "frame", name: "Root", children: [{ type: "instance", name: "Badge", layoutSizingHorizontal: "FILL", layoutSizingVertical: "HUG" }] };
    expect(await run({ rootId: root.id, tree })).toMatchSnapshot();
  });

  test("create: getNodeByIdAsync returning null before bind skips the bind and still counts the node", async () => {
    const figmaMock = (globalThis as any).figma;
    const original = figmaMock.getNodeByIdAsync;
    figmaMock.getNodeByIdAsync = async (id: string) => {
      const node = nodes.get(id);
      return node && node.name === "Ghost" ? null : node || null;
    };
    try {
      expect(await run({ tree: { type: "frame", name: "Root", children: [{ type: "rectangle", name: "Ghost", fillColor: "$var:Colors/Primary" }] } })).toMatchSnapshot();
    } finally {
      figmaMock.getNodeByIdAsync = original;
    }
  });

  test("create and sync: an ambiguous $var: fails inside resolve", async () => {
    expect(await run({ tree: { type: "frame", name: "Root", children: [{ type: "rectangle", name: "Amb", fillColor: "$var:Primary" }, { type: "rectangle", name: "Next" }] } })).toMatchSnapshot();
    const root = await seed();
    expect(await run({ rootId: root.id, tree: { type: "frame", name: "Root", children: [{ type: "rectangle", name: "Box", fillColor: "$var:Primary" }] } })).toMatchSnapshot();
  });

  test("sync: a child whose spec type differs from the live node is created alongside, or fails as an unknown type", async () => {
    const root = await seed();
    const tree = { type: "frame", name: "Root", children: [{ type: "rectangle", name: "Title" }, { type: "TEXT", name: "Box", text: "x" }] };
    expect(await run({ rootId: root.id, tree })).toMatchSnapshot();
  });

  test("sync: a text font that cannot load falls back to Inter", async () => {
    const root = await seed();
    const tree = { type: "frame", name: "Root", children: [{ type: "text", name: "Title", text: "New", fontFamily: "Missing", fontWeight: 600 }] };
    expect(await run({ rootId: root.id, tree })).toMatchSnapshot();
  });
});
