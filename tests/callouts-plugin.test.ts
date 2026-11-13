/**
 * place_callouts (L2F_CALLOUTS): the plugin builder against a mocked figma
 * global, and the server tool against a fake server.tool capture. Contract
 * mocks exercise the plugin logic; they do not replace a live Figma check.
 *   bun test tests/callouts-plugin.test.ts
 */
import { afterAll, beforeEach, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { z } from "zod";
import { annotationKey, annotationMarkdown, FACING_MAGNET, NO_CONNECTOR_TEMPLATE, placeCallouts, upsertAnnotation } from "../src/llm2figma_plugin/src/callouts";
import { assertEditorAllowed } from "../src/llm2figma_plugin/src/editor-gate";
import { registerTools } from "../src/llm2figma_mcp/tools/callouts";
import { registerWhenEnabled } from "../src/shared/flags";
import { ANCHOR } from "../src/shared/callouts";

const originalFigma = (globalThis as any).figma;
let nextId: number;
let nodes: Map<string, any>;
let page: any, section: any, frame: any, sibling: any;
let storage: Record<string, any>;
// Failure switches for the rollback and archive tests.
let failGroup: (children: any[]) => boolean;
let refuseConnectors: boolean; // groups refuse connectors, as Figma Design might

// --- Mock node model ---------------------------------------------------------
// x/y are relative to the nearest non-group ancestor, as in Figma.

function originOf(container: any): { x: number; y: number } {
  let c = container;
  while (c && c.type === "GROUP") c = c.parent;
  if (!c || c.type === "PAGE") return { x: 0, y: 0 };
  const o = originOf(c.parent);
  return { x: o.x + c.x, y: o.y + c.y };
}

function detach(n: any) {
  if (n.parent) n.parent.children = n.parent.children.filter((c: any) => c !== n);
}

function makeNode(type: string, name = type): any {
  const data = new Map<string, string>();
  let w = 100, h = 100;
  const n: any = {
    id: `${++nextId}:1`, type, name, parent: null, children: [], x: 0, y: 0, visible: true,
    fills: [], strokes: [],
    setPluginData(k: string, v: string) { data.set(k, v); },
    getPluginData(k: string) { return data.get(k) ?? ""; },
    appendChild(child: any) {
      if (child.type === "CONNECTOR" && this.type === "GROUP" && refuseConnectors) throw new Error("connectors cannot go in this group");
      detach(child); child.parent = this; this.children.push(child);
    },
    insertChild(index: number, child: any) { detach(child); child.parent = this; this.children.splice(index, 0, child); },
    remove() {
      detach(this);
      const mark = (n: any) => { n.removed = true; nodes.delete(n.id); n.children.forEach(mark); };
      mark(this);
    },
    resize(width: number, height: number) { w = width; h = height; },
  };
  Object.defineProperty(n, "width", { get: () => w, configurable: true });
  Object.defineProperty(n, "height", {
    get: () => {
      // A HUG-height vertical auto-layout frame grows with its children.
      if (n.layoutMode === "VERTICAL" && n.primaryAxisSizingMode === "AUTO") {
        return (n.paddingTop ?? 0) + (n.paddingBottom ?? 0) + n.children.reduce((s: number, c: any) => s + c.height, 0);
      }
      return h;
    },
    configurable: true,
  });
  Object.defineProperty(n, "absoluteTransform", {
    get: () => { const o = originOf(n.parent); return [[1, 0, o.x + n.x], [0, 1, o.y + n.y]]; },
  });
  Object.defineProperty(n, "absoluteBoundingBox", {
    get: () => {
      if (n.type === "GROUP") {
        const boxes = n.children.map((c: any) => c.absoluteBoundingBox);
        const x = Math.min(...boxes.map((b: any) => b.x)), y = Math.min(...boxes.map((b: any) => b.y));
        return { x, y, width: Math.max(...boxes.map((b: any) => b.x + b.width)) - x, height: Math.max(...boxes.map((b: any) => b.y + b.height)) - y };
      }
      const o = originOf(n.parent);
      return { x: o.x + n.x, y: o.y + n.y, width: n.width, height: n.height };
    },
  });
  nodes.set(n.id, n);
  return n;
}

function makeText(): any {
  const t = makeNode("TEXT");
  t.characters = "";
  // About 6px per character, 16px lines, wrapping at the label's inner width.
  Object.defineProperty(t, "height", {
    get: () => Math.max(1, Math.ceil((t.characters.length * 6) / Math.max(1, (t.parent ? t.parent.width : 200) - 20))) * 16,
  });
  return t;
}

function withAnnotations(n: any, initial: any[] = []) {
  let list = initial;
  Object.defineProperty(n, "annotations", {
    get: () => list,
    set: (value: any[]) => {
      for (const a of value) if (a.label !== undefined && a.labelMarkdown !== undefined) throw new Error("label and labelMarkdown are mutually exclusive");
      list = value.map(a => ({ ...a }));
    },
    enumerable: true,
  });
  return n;
}

function child(parent: any, type: string, name: string, x: number, y: number, w: number, h: number): any {
  const n = makeNode(type, name);
  parent.appendChild(n);
  n.x = x; n.y = y; n.resize(w, h);
  return n;
}

function makeConnector(parent: any): any {
  const c = makeNode("CONNECTOR", "Connector");
  c.connectorStart = { position: { x: 0, y: 0 } };
  c.connectorEnd = { position: { x: 10, y: 0 } };
  c.connectorLineType = "STRAIGHT";
  c.clone = function () {
    const copy = makeConnector(this.parent);
    copy.name = this.name;
    return copy;
  };
  parent.appendChild(c);
  return c;
}

beforeEach(() => {
  nextId = 0;
  nodes = new Map();
  storage = {};
  failGroup = () => false;
  refuseConnectors = false;
  page = makeNode("PAGE", "Design");
  section = child(page, "SECTION", "Review", 1000, 500, 2000, 1600);
  frame = child(section, "FRAME", "Checkout", 600, 300, 400, 600);
  sibling = child(section, "FRAME", "Cart", 100, 300, 200, 600);
  withAnnotations(child(frame, "FRAME", "Email", 20, 50, 100, 30));       // 5:1
  withAnnotations(child(frame, "FRAME", "Pay", 300, 400, 80, 30));        // 6:1
  withAnnotations(child(frame, "FRAME", "Terms", 30, 500, 120, 20));      // 7:1
  const created: any[] = [];
  (globalThis as any).figma = {
    editorType: "figma",
    currentPage: page,
    mixed: Symbol("mixed"),
    getNodeByIdAsync: async (id: string) => nodes.get(id) ?? null,
    loadFontAsync: async () => {},
    clientStorage: { getAsync: async (k: string) => storage[k], setAsync: async (k: string, v: any) => { storage[k] = v; } },
    createFrame: () => { const n = makeNode("FRAME"); created.push(n); return n; },
    createText: () => makeText(),
    createEllipse: () => makeNode("ELLIPSE"),
    createVector: () => {
      const v = makeNode("VECTOR");
      Object.defineProperty(v, "vectorPaths", {
        set(paths: any[]) {
          const nums = paths[0].data.match(/-?\d+(\.\d+)?/g)!.map(Number);
          const xs = nums.filter((_: number, i: number) => i % 2 === 0), ys = nums.filter((_: number, i: number) => i % 2 === 1);
          v.x = 0; v.y = 0;
          v.resize(Math.max(...xs), Math.max(...ys));
          v._paths = paths;
        },
        get() { return v._paths; },
      });
      return v;
    },
    group: (children: any[], parent: any) => {
      if (failGroup(children)) throw new Error("group failed");
      const g = makeNode("GROUP");
      parent.appendChild(g);
      for (const c of children) g.appendChild(c);
      return g;
    },
    showUI: () => {},
    on: () => {},
    ui: { postMessage: () => {} },
  };
  page.findAllWithCriteria = ({ types }: { types: string[] }) => {
    const out: any[] = [];
    const walk = (n: any) => { for (const c of n.children) { if (types.includes(c.type)) out.push(c); walk(c); } };
    walk(page);
    return out;
  };
});
afterAll(() => { (globalThis as any).figma = originalFigma; });

const CALLOUTS = [
  { targetId: "5:1", text: "Validate the email on blur, not on submit." },
  { key: "pay", targetId: "6:1", text: "Disable until the form is valid." },
  { targetId: "7:1", text: "Link the terms." },
];
const named = (root: any, prefix: string): any[] => {
  const out: any[] = [];
  const walk = (n: any) => { for (const c of n.children) { if (c.name.startsWith(prefix)) out.push(c); walk(c); } };
  walk(root);
  return out;
};

describe("place_callouts builder (leaders mode)", () => {
  test("one named group in the section: rails, labels in rails, vector leaders and dots, all off the frame", async () => {
    const result = await placeCallouts({ frameId: frame.id, callouts: CALLOUTS, leaderStyle: "vector" });
    expect(result.mode).toBe("leaders");
    expect(result.leaderStyle).toBe("vector");
    expect(result.overflow).toEqual([]);
    expect(result.verification).toEqual({ ok: true, problems: [] });
    const group = nodes.get(result.groupId);
    expect(group.type).toBe("GROUP");
    expect(group.name).toBe("callouts/Checkout");
    expect(group.parent).toBe(section);
    expect(JSON.parse(group.getPluginData("l2f-callouts"))).toMatchObject({ frameId: frame.id, annotated: { "5:1": "5:1", pay: "6:1", "7:1": "7:1" } });
    expect(group.children.map((c: any) => c.name).sort()).toEqual([
      "dot/5:1", "dot/7:1", "dot/pay", "leader/5:1", "leader/7:1", "leader/pay", "rail/left", "rail/right",
    ]);
    const left = named(group, "rail/left")[0];
    expect(left.children.map((c: any) => c.name)).toEqual(["callout/5:1", "callout/7:1"]);
    expect(named(group, "rail/right")[0].children.map((c: any) => c.name)).toEqual(["callout/pay"]);
    expect(named(group, "callout/5:1/text")[0].characters).toBe(CALLOUTS[0].text);
    // Section children are relative to the section: the left rail is railOffset + width left of the frame.
    expect(left.x).toBe(600 - 48 - 240);
    expect(left.absoluteBoundingBox).toEqual({ x: 1000 + 600 - 288, y: 800, width: 240, height: 600 });
    // The first label starts level with its target (frame y 800 + 50 + 15 centre - anchor).
    const email = named(left, "callout/5:1")[0];
    expect(email.absoluteBoundingBox.y).toBe(800 + 65 - ANCHOR);
    expect(result.placed[0]).toEqual({ key: "5:1", rail: "left", x: -288, y: 65 - ANCHOR, labelId: email.id, leaderId: named(group, "leader/5:1")[0].id });
    // Labels never overlap the frame or the sibling.
    for (const label of named(group, "callout/").filter((n: any) => n.type === "FRAME")) {
      const b = label.absoluteBoundingBox;
      for (const o of [frame.absoluteBoundingBox, sibling.absoluteBoundingBox]) {
        expect(b.x < o.x + o.width && o.x < b.x + b.width && b.y < o.y + o.height && o.y < b.y + b.height).toBe(false);
      }
    }
    // The leader is a stroked, round-capped vector; the dot sits on the target's near edge.
    const leader = named(group, "leader/5:1")[0];
    expect(leader.type).toBe("VECTOR");
    expect(leader.strokeCap).toBe("ROUND");
    expect(leader.vectorPaths[0].windingRule).toBe("NONE");
    const dot = named(group, "dot/5:1")[0];
    expect(dot.absoluteBoundingBox).toEqual({ x: 1600 + 20 - 3, y: 865 - 3, width: 6, height: 6 });
    // Parts carry their key for re-runs.
    expect(JSON.parse(email.getPluginData("l2f-callout"))).toEqual({ key: "5:1", part: "label", targetId: "5:1", frameId: frame.id });
  });

  test("a sibling in the left band sends callouts to the right rail", async () => {
    sibling.x = 400; // abs 1400..1600: inside the left band
    const result = await placeCallouts({ frameId: frame.id, callouts: CALLOUTS, leaderStyle: "vector" });
    expect(result.placed.map((p: any) => p.rail)).toEqual(["right", "right", "right"]);
    expect(result.verification.ok).toBe(true);
  });

  test("the section edge counts as an obstacle, so the section never has to grow", async () => {
    frame.x = 1700; frame.y = 50; // right rail would leave the 2000-wide section
    const result = await placeCallouts({ frameId: frame.id, callouts: CALLOUTS, leaderStyle: "vector", rails: ["right"] });
    expect(result.placed).toEqual([]);
    expect(result.groupId).toBeNull();
    expect(result.overflow.map((o: any) => o.key)).toEqual(["5:1", "pay", "7:1"]);
    // Labels made only to be measured are gone; nothing else was added.
    expect(section.children.map((c: any) => c.name)).toEqual(["Checkout", "Cart"]);
  });

  test("missing targets and targets outside the frame are reported in overflow", async () => {
    const result = await placeCallouts({
      frameId: frame.id, leaderStyle: "vector",
      callouts: [...CALLOUTS, { targetId: "99:1", text: "x" }, { key: "cart", targetId: sibling.id, text: "y" }],
    });
    expect(result.overflow).toEqual([{ key: "99:1", reason: "target not found" }, { key: "cart", reason: "target not in frame" }]);
    expect(result.placed).toHaveLength(3);
  });

  test("refusals: duplicate keys, a frame not on a page or in a section", async () => {
    await expect(placeCallouts({ frameId: frame.id, callouts: [CALLOUTS[0], { ...CALLOUTS[0], text: "again" }] })).rejects.toThrow("duplicate callout key: 5:1");
    await expect(placeCallouts({ frameId: "5:1", callouts: CALLOUTS })).rejects.toThrow("directly on a page or in a section");
  });
});

describe("connector leaders", () => {
  test("auto uses vectors when the file has no connector", async () => {
    const result = await placeCallouts({ frameId: frame.id, callouts: CALLOUTS });
    expect(result.leaderStyle).toBe("vector");
    expect(named(page, "leader/")[0].type).toBe("VECTOR");
  });

  test("auto clones a connector on the page: elbowed, start on the label's frame-facing side, end on the target, dot cap", async () => {
    const template = makeConnector(page);
    const result = await placeCallouts({ frameId: frame.id, callouts: CALLOUTS });
    expect(result.leaderStyle).toBe("connector");
    const leaders = named(page, "leader/");
    expect(leaders.map((l: any) => [l.name, l.type]).sort()).toEqual([["leader/5:1", "CONNECTOR"], ["leader/7:1", "CONNECTOR"], ["leader/pay", "CONNECTOR"]]);
    expect(named(page, "dot/")).toEqual([]);
    const email = named(page, "callout/5:1")[0], pay = named(page, "callout/pay")[0];
    const l1 = named(page, "leader/5:1")[0], l2 = named(page, "leader/pay")[0];
    expect(l1.connectorStart).toEqual({ endpointNodeId: email.id, magnet: "RIGHT" });
    expect(l1.connectorEnd).toEqual({ endpointNodeId: "5:1", magnet: "AUTO" });
    expect(l2.connectorStart).toEqual({ endpointNodeId: pay.id, magnet: "LEFT" });
    expect(l2.connectorEnd).toEqual({ endpointNodeId: "6:1", magnet: "AUTO" });
    for (const l of leaders) {
      expect(l.connectorLineType).toBe("ELBOWED");
      expect(l.connectorEndStrokeCap).toBe("CIRCLE_FILLED");
      expect(l.connectorStartStrokeCap).toBe("NONE");
      expect(l.parent.name).toBe("callouts/Checkout");
    }
    expect(result.placed.find((p: any) => p.key === "pay").leaderId).toBe(l2.id);
    // The template itself is untouched.
    expect(template.name).toBe("Connector");
    expect(FACING_MAGNET).toEqual({ left: "RIGHT", right: "LEFT", top: "BOTTOM", bottom: "TOP" });
  });

  test("the default connector from set_default_connector is preferred over one found on the page", async () => {
    makeConnector(page).name = "found";
    const preferred = makeConnector(section);
    preferred.name = "preferred";
    storage.defaultConnectorId = preferred.id;
    await placeCallouts({ frameId: frame.id, callouts: CALLOUTS });
    // Clones start in the template's parent and are then moved into the callout group.
    expect(named(page, "leader/")).toHaveLength(3);
    expect(page.children.filter((c: any) => c.type === "CONNECTOR").map((c: any) => c.name)).toEqual(["found"]);
  });

  test('"connector" without a template is refused before anything is created', async () => {
    await expect(placeCallouts({ frameId: frame.id, callouts: CALLOUTS, leaderStyle: "connector" })).rejects.toThrow(NO_CONNECTOR_TEMPLATE);
    expect(NO_CONNECTOR_TEMPLATE).toContain("set_default_connector");
    expect(section.children.map((c: any) => c.name)).toEqual(["Checkout", "Cart"]);
  });

  test('"vector" ignores an available connector', async () => {
    makeConnector(page);
    expect((await placeCallouts({ frameId: frame.id, callouts: CALLOUTS, leaderStyle: "vector" })).leaderStyle).toBe("vector");
  });
});

describe("numbered mode", () => {
  test("above denseThreshold: badges on the targets, numbered list entries, no leaders, no template needed", async () => {
    const targets = Array.from({ length: 14 }, (_, i) => withAnnotations(child(frame, "FRAME", `Item ${i}`, 20 + (i % 2) * 200, 20 + Math.floor(i / 2) * 80, 120, 30)));
    const result = await placeCallouts({ frameId: frame.id, leaderStyle: "connector", callouts: targets.map((t, i) => ({ targetId: t.id, text: `Note ${i}` })).reverse() });
    expect(result.mode).toBe("numbered");
    expect(result.leaderStyle).toBeNull();
    const group = nodes.get(result.groupId);
    expect(named(group, "leader/")).toEqual([]);
    const badges = named(group, "badge/").filter((b: any) => b.type === "FRAME");
    expect(badges.map((b: any) => b.name).sort((a: string, b: string) => Number(a.slice(6)) - Number(b.slice(6)))).toEqual(Array.from({ length: 14 }, (_, i) => `badge/${i + 1}`));
    expect(named(group, "badge/1/number")[0].characters).toBe("1");
    // Reading order: Item 0 is first although it was passed last.
    expect(named(group, `callout/${targets[0].id}/text`)[0].characters).toBe("1. Note 0");
    expect(named(group, `callout/${targets[1].id}/text`)[0].characters).toBe("2. Note 1");
    // The badge sits on its target's top-left corner.
    const b1 = named(group, "badge/1").find((b: any) => b.name === "badge/1");
    expect(b1.absoluteBoundingBox).toEqual({ x: 1600 + 20 - 10, y: 800 + 20 - 10, width: 20, height: 20 });
    expect(result.placed.find((p: any) => p.key === targets[0].id).number).toBe(1);
  });
});

describe("native annotations", () => {
  test("appended next to the node's other annotations, then updated in place", async () => {
    const email = nodes.get("5:1");
    email.annotations = [{ labelMarkdown: "Designer note" }, { label: "Plain", categoryId: "c1", properties: [{ type: "width" }] }];
    const first = await placeCallouts({ frameId: frame.id, callouts: CALLOUTS });
    expect(first.annotations).toEqual({ added: 3, updated: 0, unchanged: 0, removed: 0, skipped: [] });
    expect(email.annotations).toEqual([
      { labelMarkdown: "Designer note" },
      { label: "Plain", categoryId: "c1", properties: [{ type: "width" }] },
      { labelMarkdown: annotationMarkdown("5:1", CALLOUTS[0].text) },
    ]);
    expect(nodes.get("6:1").annotations).toEqual([{ labelMarkdown: "**Callout pay:** Disable until the form is valid." }]);

    expect(upsertAnnotation(email, "5:1", CALLOUTS[0].text)).toBe("unchanged");
    // Figma may return the label as plain text; the key still matches and the category survives.
    email.annotations = [email.annotations[0], { label: "Callout 5:1: old text", categoryId: "review" }];
    expect(upsertAnnotation(email, "5:1", "new text")).toBe("updated");
    expect(email.annotations).toEqual([{ labelMarkdown: "Designer note" }, { labelMarkdown: "**Callout 5:1:** new text", categoryId: "review" }]);
  });

  test("native: false writes no annotations", async () => {
    const result = await placeCallouts({ frameId: frame.id, callouts: CALLOUTS, native: false });
    expect(result.annotations).toBeNull();
    expect(nodes.get("5:1").annotations).toEqual([]);
  });

  test("a target without annotation support is skipped with the reason", async () => {
    const plain = child(frame, "VECTOR", "Icon", 200, 200, 10, 10);
    const result = await placeCallouts({ frameId: frame.id, callouts: [{ targetId: plain.id, text: "x" }] });
    expect(result.annotations.skipped).toEqual([{ key: plain.id, reason: "VECTOR does not support annotations" }]);
  });

  test("annotationKey reads the marker with or without bold, and ignores other labels", () => {
    expect(annotationKey({ labelMarkdown: "**Callout 12:34:** text" })).toBe("12:34");
    expect(annotationKey({ label: "Callout pay: text" })).toBe("pay");
    expect(annotationKey({ labelMarkdown: "Callouts are great" })).toBeNull();
    expect(annotationKey({})).toBeNull();
  });
});

describe("gates and the server tool", () => {
  test("place_callouts writes, so Dev Mode refuses it", () => {
    expect(() => assertEditorAllowed("place_callouts", "dev")).toThrow("place_callouts is not available in the dev editor");
    expect(() => assertEditorAllowed("place_callouts", "figma")).not.toThrow();
  });

  test("dispatch through main.ts", async () => {
    const fig = (globalThis as any).figma;
    (globalThis as any).__html__ = "";
    await import("../src/llm2figma_plugin/src/main.ts?callouts-test");
    const onmessage = fig.ui.onmessage;
    const posted: any[] = [];
    fig.ui = { postMessage: (m: any) => posted.push(m) };
    await onmessage({ type: "execute-command", id: "c1", command: "place_callouts", params: { frameId: frame.id } });
    expect(posted.find(m => m.id === "c1").error).toContain("Missing required parameters: frameId and callouts");
    await onmessage({ type: "execute-command", id: "c2", command: "place_callouts", params: { frameId: frame.id, callouts: CALLOUTS } });
    expect(posted.find(m => m.id === "c2").result.mode).toBe("leaders");
  });

  type Tool = { schema: Record<string, z.ZodTypeAny>; run: (args: any) => Promise<any> };
  const capture = (send: (c: string, p?: any, t?: number) => Promise<any>) => {
    const tools: Record<string, Tool> = {};
    registerTools({ tool: (name: string, _d: string, schema: any, run: any) => { tools[name] = { schema, run }; } } as any, send as any);
    return tools;
  };

  test("registered only with L2F_CALLOUTS (or L2F_ALL), through registerFeature in server.ts", () => {
    const names = (env: Record<string, string>) => {
      const out: string[] = [];
      registerWhenEnabled("CALLOUTS", registerTools, { tool: (name: string) => out.push(name) } as any, (async () => ({})) as any, env);
      return out;
    };
    expect(names({})).toEqual([]);
    expect(names({ L2F_CALLOUTS: "1" })).toEqual(["place_callouts"]);
    expect(names({ L2F_ALL: "1" })).toEqual(["place_callouts"]);
    const server = readFileSync("src/llm2figma_mcp/server.ts", "utf8");
    expect(server).toContain('registerFeature("CALLOUTS", registerCalloutTools)');
    expect(server).not.toMatch(/^registerCalloutTools\(/m);
  });

  test("the schema refuses duplicate keys and bad options; valid calls are sent with a 60s timeout", async () => {
    const sent: any[] = [];
    const tools = capture(async (c, p, t) => { sent.push([c, p, t]); return { mode: "leaders" }; });
    const schema = z.object(tools.place_callouts.schema);
    expect(schema.safeParse({ frameId: "1:1", callouts: [{ targetId: "2:1", text: "a" }, { targetId: "2:1", text: "b" }] }).success).toBe(false);
    expect(schema.safeParse({ frameId: "1:1", callouts: [{ targetId: "2:1", text: "a" }, { key: "b", targetId: "2:1", text: "b" }] }).success).toBe(true);
    expect(schema.safeParse({ frameId: "1:1", callouts: [] }).success).toBe(false);
    expect(schema.safeParse({ frameId: "1:1", callouts: [{ targetId: "2:1", text: "a" }], rails: ["middle"] }).success).toBe(false);
    expect(schema.safeParse({ frameId: "1:1", callouts: [{ targetId: "2:1", text: "a" }], leaderStyle: "curved" }).success).toBe(false);
    const args = { frameId: "1:1", callouts: [{ targetId: "2:1", text: "a" }], leaderStyle: "connector" };
    expect(JSON.parse((await tools.place_callouts.run(args)).content[0].text)).toEqual({ mode: "leaders" });
    expect(sent).toEqual([["place_callouts", args, 60000]]);
    const failing = capture(async () => { throw new Error(NO_CONNECTOR_TEMPLATE); });
    const out = await failing.place_callouts.run(args);
    expect(out.isError).toBe(true);
    expect(out.content[0].text).toBe(`Error placing callouts: ${NO_CONNECTOR_TEMPLATE}`);
  });
});

describe("re-runs", () => {
  const ids = (root: any): string[] => {
    const out: string[] = [];
    const walk = (n: any) => { for (const c of n.children) { out.push(c.id); walk(c); } };
    walk(root);
    return out.sort();
  };
  const boxes = (root: any) => named(root, "").map((n: any) => [n.name, n.absoluteBoundingBox, n.visible]);

  test("the same input again finds the group by plugin data and changes nothing", async () => {
    const first = await placeCallouts({ frameId: frame.id, callouts: CALLOUTS, leaderStyle: "vector" });
    const before = { ids: ids(section), boxes: boxes(section) };
    const second = await placeCallouts({ frameId: frame.id, callouts: CALLOUTS, leaderStyle: "vector" });
    expect(second.groupId).toBe(first.groupId);
    expect(second.placed).toEqual(first.placed);
    expect(second.rerun).toEqual({ updated: 3, hidden: [], superseded: [] });
    expect(second.annotations).toMatchObject({ added: 0, updated: 0, unchanged: 3, removed: 0 });
    expect(ids(section)).toEqual(before.ids);
    expect(boxes(section)).toEqual(before.boxes);
    expect(second.verification.ok).toBe(true);
  });

  test("changed text updates in place; a dropped callout is superseded, hidden, archived and loses only its annotation", async () => {
    nodes.get("7:1").annotations = [{ labelMarkdown: "Keep me" }];
    const first = await placeCallouts({ frameId: frame.id, callouts: CALLOUTS, leaderStyle: "vector" });
    const group = nodes.get(first.groupId);
    const emailLabel = named(group, "callout/5:1")[0];
    const termsParts = ["callout/7:1", "leader/7:1", "dot/7:1"].map(n => named(group, n)[0]);
    const second = await placeCallouts({
      frameId: frame.id, leaderStyle: "vector",
      callouts: [{ ...CALLOUTS[0], text: "Validate on blur." }, CALLOUTS[1]],
    });
    expect(second.rerun).toEqual({ updated: 2, hidden: [], superseded: ["7:1"] });
    // Updated in place: same node, new text.
    expect(named(group, "callout/5:1")[0]).toBe(emailLabel);
    expect(named(emailLabel, "callout/5:1/text")[0].characters).toBe("Validate on blur.");
    // Superseded: same nodes, renamed, hidden, inside the archive group. Nothing removed.
    const archive = group.children.find((c: any) => c.name === "callouts/Checkout/archive");
    expect(archive.type).toBe("GROUP");
    expect(archive.visible).toBe(false);
    for (const n of termsParts) {
      expect(n.removed).toBeUndefined();
      expect(n.visible).toBe(false);
      expect(n.parent).toBe(archive);
      expect(n.name.endsWith(" (superseded)")).toBe(true);
    }
    // Archived nodes kept their place on the canvas.
    expect(termsParts[2].absoluteBoundingBox).toEqual({ x: 1600 + 30 - 3, y: 800 + 510 - 3, width: 6, height: 6 });
    // Annotations follow: updated for 5:1, removed for 7:1 (its other annotation stays).
    expect(nodes.get("5:1").annotations).toEqual([{ labelMarkdown: "**Callout 5:1:** Validate on blur." }]);
    expect(nodes.get("7:1").annotations).toEqual([{ labelMarkdown: "Keep me" }]);
    expect(second.annotations).toMatchObject({ updated: 1, unchanged: 1, removed: 1 });
    // A later run finds the archive again instead of making a second one.
    await placeCallouts({ frameId: frame.id, leaderStyle: "vector", callouts: [CALLOUTS[1]] });
    expect(group.children.filter((c: any) => c.name.endsWith("/archive"))).toHaveLength(1);
    expect(named(archive, "callout/5:1 (superseded)")).toHaveLength(1);
    // Bringing a superseded key back makes new parts; the archived ones stay archived.
    await placeCallouts({ frameId: frame.id, leaderStyle: "vector", callouts: CALLOUTS });
    expect(named(archive, "callout/7:1 (superseded)")).toHaveLength(1);
    expect(group.children.filter((c: any) => c.name === "leader/7:1")).toHaveLength(1);
  });

  test("connectors are reused for each key; switching from vectors supersedes the vector and its dot", async () => {
    const first = await placeCallouts({ frameId: frame.id, callouts: CALLOUTS, leaderStyle: "vector" });
    const group = nodes.get(first.groupId);
    const oldLeader = named(group, "leader/pay")[0];
    makeConnector(page);
    const second = await placeCallouts({ frameId: frame.id, callouts: CALLOUTS });
    expect(second.leaderStyle).toBe("connector");
    expect(oldLeader.name).toBe("leader/pay (superseded)");
    const connector = group.children.find((c: any) => c.name === "leader/pay");
    expect(connector.type).toBe("CONNECTOR");
    expect(named(group, "dot/pay (superseded)")).toHaveLength(1);
    const third = await placeCallouts({ frameId: frame.id, callouts: CALLOUTS, leaderStyle: "connector" });
    expect(third.placed.find((p: any) => p.key === "pay").leaderId).toBe(connector.id);
    expect(group.children.filter((c: any) => c.type === "CONNECTOR")).toHaveLength(3);
    expect(connector.connectorStart.endpointNodeId).toBe(named(group, "callout/pay")[0].id);
  });

  test("switching to numbered mode supersedes leaders and dots and numbers the reused labels", async () => {
    const first = await placeCallouts({ frameId: frame.id, callouts: CALLOUTS, leaderStyle: "vector" });
    const group = nodes.get(first.groupId);
    const emailLabel = named(group, "callout/5:1")[0];
    const extra = Array.from({ length: 11 }, (_, i) => withAnnotations(child(frame, "FRAME", `Row ${i}`, 200, 100 + i * 25, 60, 20)));
    const second = await placeCallouts({ frameId: frame.id, callouts: [...CALLOUTS, ...extra.map((t, i) => ({ targetId: t.id, text: `Row ${i}` }))] });
    expect(second.mode).toBe("numbered");
    expect(named(group, "callout/5:1")[0]).toBe(emailLabel);
    expect(named(emailLabel, "callout/5:1/text")[0].characters).toMatch(/^\d+\. Validate the email/);
    expect(group.children.filter((c: any) => c.name.startsWith("leader/") || c.name.startsWith("dot/"))).toEqual([]);
    expect(named(group, "leader/5:1 (superseded)")).toHaveLength(1);
    expect(group.children.filter((c: any) => /^badge\/\d+$/.test(c.name))).toHaveLength(14);
  });

  test("an existing callout with no room this time is hidden in place, not superseded", async () => {
    const first = await placeCallouts({ frameId: frame.id, callouts: CALLOUTS, leaderStyle: "vector", rails: ["left"] });
    const group = nodes.get(first.groupId);
    const pay = named(group, "callout/pay")[0];
    // A sibling now fills most of the left band: two of the three labels still fit,
    // and the one whose target is furthest from the rail gives way.
    child(section, "FRAME", "Promo", 300, 400, 250, 600);
    const second = await placeCallouts({ frameId: frame.id, callouts: CALLOUTS, leaderStyle: "vector", rails: ["left"] });
    expect(second.overflow).toEqual([{ key: "pay", reason: "no room" }]);
    expect(second.rerun.hidden).toEqual(["pay"]);
    expect(pay.visible).toBe(false);
    expect(pay.name).toBe("callout/pay");
    expect(pay.removed).toBeUndefined();
    expect(named(group, "leader/pay")[0].visible).toBe(false);
    expect(second.verification.ok).toBe(true);
  });
});

describe("review fixes", () => {
  const tree = (root: any): any[] => {
    const out: any[] = [];
    const walk = (n: any) => { for (const c of n.children) { out.push([c.id, c.name, c.visible, c.parent.id, c.x, c.y]); walk(c); } };
    walk(root);
    return out;
  };
  const record = (groupId: string) => JSON.parse(nodes.get(groupId).getPluginData("l2f-callouts")).annotated;

  test("an overflowed callout gets no annotation, and loses the one it had", async () => {
    const first = await placeCallouts({ frameId: frame.id, callouts: CALLOUTS, leaderStyle: "vector", rails: ["left"] });
    expect(nodes.get("6:1").annotations).toHaveLength(1);
    child(section, "FRAME", "Promo", 300, 400, 250, 600); // leaves room for two labels on the left
    const second = await placeCallouts({ frameId: frame.id, callouts: CALLOUTS, leaderStyle: "vector", rails: ["left"] });
    expect(second.overflow).toEqual([{ key: "pay", reason: "no room" }]);
    expect(nodes.get("6:1").annotations).toEqual([]);
    expect(record(first.groupId)).toEqual({ "5:1": "5:1", "7:1": "7:1" });
    // On a first run, an overflowed callout is never annotated.
    const other = child(section, "FRAME", "Other", 1200, 300, 300, 200);
    const target = withAnnotations(child(other, "FRAME", "Field", 10, 10, 50, 20));
    const fresh = await placeCallouts({ frameId: other.id, callouts: [{ targetId: target.id, text: "x" }], rails: ["top"], leaderStyle: "vector", width: 400 });
    expect(fresh.overflow).toEqual([{ key: target.id, reason: "no room" }]);
    expect(target.annotations).toEqual([]);
  });

  test("a retargeted key moves its annotation: the old target keeps only its other annotations", async () => {
    nodes.get("5:1").annotations = [{ labelMarkdown: "Designer note" }];
    const first = await placeCallouts({ frameId: frame.id, callouts: [{ key: "email", targetId: "5:1", text: "Check" }], leaderStyle: "vector" });
    expect(nodes.get("5:1").annotations).toHaveLength(2);
    const second = await placeCallouts({ frameId: frame.id, callouts: [{ key: "email", targetId: "7:1", text: "Check" }], leaderStyle: "vector" });
    expect(nodes.get("5:1").annotations).toEqual([{ labelMarkdown: "Designer note" }]);
    expect(nodes.get("7:1").annotations).toEqual([{ labelMarkdown: "**Callout email:** Check" }]);
    expect(second.annotations).toMatchObject({ added: 1, removed: 1 });
    expect(record(first.groupId)).toEqual({ email: "7:1" });
  });

  test("only recorded keys are touched: a look-alike annotation the tool did not write is left alone", async () => {
    nodes.get("5:1").annotations = [{ labelMarkdown: "**Callout 5:1:** written by a person" }];
    nodes.get("7:1").annotations = [{ labelMarkdown: "**Callout gone:** also a person" }];
    await placeCallouts({ frameId: frame.id, callouts: CALLOUTS, leaderStyle: "vector" });
    // Not recorded, so not updated in place: the tool's own is appended beside it.
    expect(nodes.get("5:1").annotations).toEqual([
      { labelMarkdown: "**Callout 5:1:** written by a person" },
      { labelMarkdown: annotationMarkdown("5:1", CALLOUTS[0].text) },
    ]);
    // Re-running with 5:1 dropped removes only the tool's one.
    await placeCallouts({ frameId: frame.id, callouts: CALLOUTS.slice(1), leaderStyle: "vector" });
    expect(nodes.get("5:1").annotations).toEqual([{ labelMarkdown: "**Callout 5:1:** written by a person" }]);
    expect(nodes.get("7:1").annotations[0]).toEqual({ labelMarkdown: "**Callout gone:** also a person" });
  });

  test("a throw on a first run removes every layer the run made", async () => {
    const before = tree(page);
    const nodeCount = nodes.size;
    failGroup = () => true;
    const error = await placeCallouts({ frameId: frame.id, callouts: CALLOUTS, leaderStyle: "vector" }).catch(e => e);
    expect(error.message).toContain("group failed");
    expect(error.message).toContain("rolled back: removed");
    expect(error.message).not.toContain("left behind");
    expect(tree(page)).toEqual(before);
    expect(nodes.size).toBe(nodeCount);
    expect(nodes.get("5:1").annotations).toEqual([]);
  });

  test("a throw on a re-run removes new layers and restores the existing ones", async () => {
    const first = await placeCallouts({ frameId: frame.id, callouts: CALLOUTS, leaderStyle: "vector" });
    const before = tree(page);
    const ids = new Set(nodes.keys());
    // Dropping 7:1 and adding a callout: the archive group is the step that fails.
    const extra = withAnnotations(child(frame, "FRAME", "Promo code", 250, 200, 100, 30));
    const beforeWithExtra = tree(page);
    failGroup = (children) => children.some((c: any) => c.name.endsWith("(superseded)"));
    const error = await placeCallouts({
      frameId: frame.id, leaderStyle: "vector",
      callouts: [{ ...CALLOUTS[0], text: "Changed" }, CALLOUTS[1], { targetId: extra.id, text: "New" }],
    }).catch(e => e);
    expect(error.message).toContain("rolled back");
    expect(tree(page)).toEqual(beforeWithExtra);
    expect([...nodes.keys()].filter(id => !ids.has(id))).toEqual([extra.id]);
    expect(named(nodes.get(first.groupId), "callout/5:1/text")[0].characters).toBe(CALLOUTS[0].text);
    expect(before.length + 1).toBe(beforeWithExtra.length);
  });

  test("a target inside an instance is refused before anything changes", async () => {
    const instance = child(frame, "INSTANCE", "Button", 100, 100, 80, 30);
    const inner = child(instance, "TEXT", "Label", 4, 4, 40, 12);
    const before = tree(page);
    await expect(placeCallouts({ frameId: frame.id, callouts: [CALLOUTS[0], { targetId: inner.id, text: "x" }] }))
      .rejects.toThrow(`target ${inner.id} is inside an instance`);
    expect(tree(page)).toEqual(before);
    // The instance itself is a fine target.
    expect((await placeCallouts({ frameId: frame.id, callouts: [{ targetId: instance.id, text: "x" }], leaderStyle: "vector" })).placed).toHaveLength(1);
  });

  test("a connector that cannot go in the group is archived beside it: hidden, renamed and reported", async () => {
    refuseConnectors = true;
    makeConnector(page);
    const first = await placeCallouts({ frameId: frame.id, callouts: CALLOUTS });
    expect(first.connectorsOutsideGroup).toBe(true);
    const pay = section.children.find((c: any) => c.name === "leader/pay");
    expect(pay.type).toBe("CONNECTOR");
    const second = await placeCallouts({ frameId: frame.id, callouts: [CALLOUTS[0], CALLOUTS[2]] });
    expect(second.archivedBesideGroup).toEqual([pay.id]);
    expect(pay.parent).toBe(section);
    expect(pay.visible).toBe(false);
    expect(pay.name).toBe("leader/pay (superseded)");
    expect(pay.removed).toBeUndefined();
    // The label went to the archive as usual.
    expect(named(nodes.get(first.groupId), "callout/pay (superseded)")[0].parent.name).toBe("callouts/Checkout/archive");
  });

  test("a target outside the frame's bounds is overflow, not a dot on the frame edge; a rotated frame warns", async () => {
    const outside = withAnnotations(child(frame, "FRAME", "Offcanvas", 450, 100, 60, 30));
    const result = await placeCallouts({ frameId: frame.id, callouts: [...CALLOUTS, { targetId: outside.id, text: "x" }], leaderStyle: "vector" });
    expect(result.overflow).toEqual([{ key: outside.id, reason: "target outside frame" }]);
    expect(named(page, `dot/${outside.id}`)).toEqual([]);
    expect(outside.annotations).toEqual([]);
    expect(result.warnings).toEqual([]);
    frame.rotation = 15;
    const rotated = await placeCallouts({ frameId: frame.id, callouts: CALLOUTS, leaderStyle: "vector" });
    expect(rotated.warnings[0]).toContain("rotated 15");
  });

  test("a rail left with no labels is archived", async () => {
    const first = await placeCallouts({ frameId: frame.id, callouts: CALLOUTS, leaderStyle: "vector" });
    const group = nodes.get(first.groupId);
    const right = group.children.find((c: any) => c.name === "rail/right");
    await placeCallouts({ frameId: frame.id, callouts: [CALLOUTS[0], CALLOUTS[2]], leaderStyle: "vector" });
    expect(right.name).toBe("rail/right (superseded)");
    expect(right.visible).toBe(false);
    expect(right.parent.name).toBe("callouts/Checkout/archive");
    expect(group.children.find((c: any) => c.name === "rail/left").visible).toBe(true);
  });

  test("every created node is tagged the moment it exists", async () => {
    const result = await placeCallouts({ frameId: frame.id, callouts: CALLOUTS, leaderStyle: "vector" });
    const group = nodes.get(result.groupId);
    for (const n of named(group, "").filter((n: any) => n.type !== "TEXT")) {
      expect(JSON.parse(n.getPluginData("l2f-callout")).frameId).toBe(frame.id);
    }
  });
});
