/**
 * Spec sync, PR 11d (L2F_SPEC_SYNC): apply_spec and the plugin's
 * apply_spec_ops, against a mocked `figma` global and temp directories. Each
 * case is pulled with the real pull_spec, edited on disk the way a model would,
 * planned with the real plan_spec and applied. No Figma or relay needed:
 *   bun test tests/spec-apply.test.ts
 *
 * Resets the plugin's variable indexes before and after, as the other spec
 * test files do.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { exportSpec, readSpecNodes } from "../src/llm2figma_plugin/src/spec";
import { applySpecOps, SUPERSEDED_NAME } from "../src/llm2figma_plugin/src/spec-apply";
import { createNodeTree } from "../src/llm2figma_plugin/src/node-tree";
import { resetVariableIndexesForTests } from "../src/llm2figma_plugin/src/utils";
import { allowedEditors, assertEditorAllowed } from "../src/llm2figma_plugin/src/editor-gate";
import { FigmaCommandError } from "../src/llm2figma_mcp/connection";
import { APPLY_TIMEOUT_MS, PlanStore, applySpec, planSpec, pullSpec, registerTools as registerSpecTools } from "../src/llm2figma_mcp/tools/spec";
import { registerWhenEnabled } from "../src/shared/flags";

const originalFigma = (globalThis as any).figma;
let nextId = 0;
let nodes = new Map<string, any>();
let page: any;
let undoCommits = 0;
let removeCalls = 0;
let reactionWrites: Array<{ id: string; reactions: any[] }> = [];

type M = [[number, number, number], [number, number, number]];
const mul = (a: M, b: M): M => [
  [a[0][0] * b[0][0] + a[0][1] * b[1][0], a[0][0] * b[0][1] + a[0][1] * b[1][1], a[0][0] * b[0][2] + a[0][1] * b[1][2] + a[0][2]],
  [a[1][0] * b[0][0] + a[1][1] * b[1][0], a[1][0] * b[0][1] + a[1][1] * b[1][1], a[1][0] * b[0][2] + a[1][1] * b[1][2] + a[1][2]],
];

function detach(child: any) {
  if (child.parent) child.parent.children = child.parent.children.filter((c: any) => c !== child);
}

const CREATION_FILLS: Record<string, () => any[]> = {
  FRAME: () => [{ type: "SOLID", color: { r: 1, g: 1, b: 1 }, opacity: 1 }],
  RECTANGLE: () => [{ type: "SOLID", color: { r: 0.85098, g: 0.85098, b: 0.85098 }, opacity: 1 }],
  TEXT: () => [{ type: "SOLID", color: { r: 0, g: 0, b: 0 }, opacity: 1 }],
};

// A node whose x/y live in a relative transform, so absoluteTransform composes
// up the parent chain like Figma's. `ignoreResize` makes resize a no-op (a
// constraint Figma would apply silently).
function makeNode(type: string, extra: any = {}, parent: any = null): any {
  const { x = 0, y = 0, ...rest } = extra;
  const node: any = {
    id: `${++nextId}:1`, type, name: type, parent: null, children: [], rotation: 0, visible: true,
    width: 100, height: 100, opacity: 1, fills: (CREATION_FILLS[type] || (() => []))(), strokes: [], effects: [],
    strokeWeight: 1, strokeAlign: type === "VECTOR" ? "CENTER" : "INSIDE", layoutMode: "NONE", layoutWrap: "NO_WRAP",
    layoutPositioning: "AUTO", layoutSizingHorizontal: "FIXED", layoutSizingVertical: "FIXED",
    clipsContent: true, itemReverseZIndex: false, itemSpacing: 0, counterAxisSpacing: 0,
    paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, primaryAxisAlignItems: "MIN", counterAxisAlignItems: "MIN",
    cornerRadius: 0, rel: [[1, 0, x], [0, 1, y]] as M, reactions: [],
    // Like Figma: a non-empty list replaces a non-empty one only after a clear
    // ("Reaction was invalid"), and the read-back carries the deprecated
    // singular `action`, fills a NODE action's reset/preserve fields and
    // stores numbers as float32. `reactionError` makes every call throw.
    async setReactionsAsync(list: any[]) {
      if (this.reactionError) throw new Error(this.reactionError);
      reactionWrites.push({ id: this.id, reactions: JSON.parse(JSON.stringify(list)) });
      if (this.reactions.length && list.length) throw new Error("Reaction was invalid");
      this.reactions = list.map((r: any) => {
        const actions = JSON.parse(JSON.stringify(r.actions), (_k, v) => (typeof v === "number" ? Math.fround(v) : v)).map((a: any) => (a.type === "NODE"
          ? { resetScrollPosition: false, resetInteractiveComponents: false, resetVideoPosition: false, preserveScrollPosition: false, transition: null, ...a }
          : a));
        return { action: actions[0], actions, trigger: { ...r.trigger } };
      });
    },
    resize(w: number, h: number) { if (!this.ignoreResize) { this.width = w; this.height = h; } },
    appendChild(child: any) { detach(child); child.parent = this; this.children.push(child); },
    insertChild(index: number, child: any) { detach(child); child.parent = this; this.children.splice(index, 0, child); },
    remove() { removeCalls++; detach(this); nodes.delete(this.id); this.removed = true; },
    ...rest,
  };
  Object.defineProperty(node, "x", { enumerable: true, configurable: true, get() { return this.rel[0][2]; }, set(v: number) { this.rel = [[this.rel[0][0], this.rel[0][1], v], this.rel[1]]; } });
  Object.defineProperty(node, "y", { enumerable: true, configurable: true, get() { return this.rel[1][2]; }, set(v: number) { this.rel = [this.rel[0], [this.rel[1][0], this.rel[1][1], v]]; } });
  Object.defineProperty(node, "relativeTransform", { enumerable: false, configurable: true, get() { return this.rel; }, set(m: M) { if (!this.lockTransform) this.rel = [[...m[0]], [...m[1]]] as M; } });
  Object.defineProperty(node, "absoluteTransform", {
    enumerable: false, configurable: true,
    get() { return this.parent && this.parent.type !== "PAGE" ? mul(this.parent.absoluteTransform, this.rel) : this.rel; },
  });
  if (type === "TEXT") {
    Object.assign(node, {
      fontName: { family: "Inter", style: "Regular" }, fontSize: 12, characters: "", textAutoResize: "WIDTH_AND_HEIGHT",
      textAlignHorizontal: "LEFT", lineHeight: { unit: "AUTO" }, letterSpacing: { unit: "PERCENT", value: 0 }, textCase: "ORIGINAL",
      textDecoration: "NONE", autoRename: false, height: 20, ...rest,
    });
  }
  // Like Figma: FILL needs an auto-layout parent.
  for (const key of ["layoutSizingHorizontal", "layoutSizingVertical"]) {
    let value = node[key];
    Object.defineProperty(node, key, {
      enumerable: true, configurable: true,
      get() { return value; },
      set(next: string) {
        if (next === "FILL" && !(this.parent && this.parent.layoutMode && this.parent.layoutMode !== "NONE")) throw new Error("FILL needs an auto-layout parent");
        value = next;
      },
    });
  }
  nodes.set(node.id, node);
  if (parent) parent.appendChild(node);
  return node;
}

const color = { id: "v-brand", name: "Brand", resolvedType: "COLOR", valuesByMode: { mode: { r: 0, g: 0, b: 1 } }, variableCollectionId: "c-colors" };

function freshFigma() {
  nextId = 0;
  nodes = new Map();
  undoCommits = 0;
  removeCalls = 0;
  reactionWrites = [];
  page = makeNode("PAGE", { name: "Page 1", async loadAsync() { this.loaded = true; } });
  (globalThis as any).figma = {
    mixed: Symbol("mixed"),
    editorType: "figma",
    fileKey: undefined,
    root: { name: "Test file" },
    currentPage: page,
    ui: { postMessage: () => {} },
    commitUndo: () => { undoCommits++; },
    triggerUndo: () => { throw new Error("triggerUndo must never be called"); },
    getNodeByIdAsync: async (id: string) => nodes.get(id) || null,
    loadFontAsync: async () => {},
    createFrame: () => makeNode("FRAME"),
    createRectangle: () => makeNode("RECTANGLE"),
    createText: () => makeNode("TEXT"),
    variables: {
      getLocalVariableCollectionsAsync: async () => [{ name: "Colors", variableIds: ["v-brand"] }],
      getVariableByIdAsync: async (id: string) => (id === "v-brand" ? color : null),
      getVariableCollectionByIdAsync: async (id: string) => (id === "c-colors" ? { id, name: "Colors" } : null),
      setBoundVariableForPaint: (paint: any, _field: string, variable: any) => ({ ...paint, boundVariables: { color: { type: "VARIABLE_ALIAS", id: variable.id } } }),
    },
    teamLibrary: { getAvailableLibraryVariableCollectionsAsync: async () => [] },
  };
}

const solid = (r: number, g: number, b: number) => [{ type: "SOLID", color: { r, g, b }, opacity: 1 }];

// Every node's plain fields, for "nothing was written" and "only these changed".
function snapshot(): Record<string, any> {
  const out: Record<string, any> = {};
  for (const node of nodes.values()) {
    const plain: any = {};
    for (const [key, value] of Object.entries(node)) {
      if (typeof value === "function" || key === "parent") continue;
      plain[key] = key === "children" ? (value as any[]).map(c => c.id) : JSON.parse(JSON.stringify(value));
    }
    out[node.id] = plain;
  }
  return out;
}

function changedFields(before: Record<string, any>, after: Record<string, any>, id: string): string[] {
  const a = before[id] || {};
  const b = after[id] || {};
  return [...new Set([...Object.keys(a), ...Object.keys(b)])].filter(k => JSON.stringify(a[k]) !== JSON.stringify(b[k])).sort();
}

describe("spec sync apply (PR 11d)", () => {
  let dir: string;
  let sent: any[];
  let store: PlanStore;
  let hook: ((command: string, params: any) => Promise<any> | void) | null;

  beforeAll(() => resetVariableIndexesForTests());
  afterAll(() => {
    resetVariableIndexesForTests();
    (globalThis as any).figma = originalFigma;
  });
  beforeEach(() => {
    resetVariableIndexesForTests();
    freshFigma();
    dir = realpathSync(mkdtempSync(join(tmpdir(), "l2f-apply-")));
    sent = [];
    hook = null;
    store = new PlanStore(() => Date.parse("2026-11-12T10:00:00.000Z"));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  const send = async (command: string, params: any, timeoutMs?: number) => {
    sent.push({ command, params, timeoutMs });
    if (hook) {
      const hooked = await hook(command, params);
      if (hooked !== undefined) return hooked;
    }
    if (command === "export_spec") return exportSpec(params);
    if (command === "read_spec_nodes") return readSpecNodes(params);
    if (command === "apply_spec_ops") return applySpecOps(params);
    throw new Error("unexpected command " + command);
  };
  const opts = () => ({
    env: { L2F_SPEC_DIR: dir }, userFileKey: () => undefined, channel: () => "chan-1", planStore: store,
    now: () => new Date("2026-11-12T10:00:00.000Z"),
  });
  const readJson = (path: string) => JSON.parse(readFileSync(path, "utf8"));
  const specPath = () => join(dir, "card.l2f.json");
  const lockPath = () => join(dir, "card.l2f.lock.json");

  // An auto-layout card with a title (Roboto Bold), a body, a swatch with a
  // variable-bound stroke, a HUG row with two dots, and a group.
  async function seed() {
    const result: any = await createNodeTree({
      tree: {
        type: "frame", name: "Card", x: 40, y: 60, width: 320, height: 240, layoutMode: "VERTICAL", itemSpacing: 8, fillColor: "#FFFFFF",
        children: [
          { type: "text", name: "Title", text: "Hello", fontSize: 20, fontFamily: "Roboto", fontStyle: "Bold" },
          { type: "text", name: "Body", text: "Some words" },
          { type: "rectangle", name: "Swatch", width: 40, height: 40, fillColor: "#FF0000", strokeColor: "$var:Colors/Brand" },
          { type: "frame", name: "Row", layoutMode: "HORIZONTAL", layoutSizingHorizontal: "HUG", layoutSizingVertical: "HUG",
            children: [{ type: "text", name: "Label", text: "Row text" }, { type: "rectangle", name: "DotA", width: 4, height: 4 }, { type: "rectangle", name: "DotB", width: 4, height: 4 }] },
        ],
      },
    });
    expect(result.errors).toBeUndefined();
    const root = nodes.get(result.nodes[0].id);
    page.appendChild(root);
    const group = makeNode("GROUP", { name: "Logo" }, root);
    makeNode("RECTANGLE", { name: "LogoPart" }, group);
    const byName = (name: string) => [...nodes.values()].find(n => n.name === name && !n.removed);
    return { root, byName, group };
  }

  async function pull(root: any) {
    return pullSpec({ nodeId: root.id, path: "card.l2f.json" }, send as any, opts());
  }

  function editSpec(edit: (spec: any, find: (name: string) => any) => void) {
    const spec = readJson(specPath());
    const find = (name: string, node: any = spec.tree): any => {
      if (node.name === name) return node;
      for (const child of node.children || []) {
        const hit = find(name, child);
        if (hit) return hit;
      }
      return null;
    };
    edit(spec, n => find(n));
    writeFileSync(specPath(), JSON.stringify(spec, null, 2));
  }

  const plan = () => planSpec({ path: "card.l2f.json" }, send as any, opts());
  const apply = (planId: string, extra: any = {}) => applySpec({ planId, ...extra }, send as any, opts());
  const ids = () => [...nodes.keys()].sort();

  test("only listed properties are assigned; a text edit leaves its Roboto Bold font alone", async () => {
    const { root, byName } = await seed();
    await pull(root);
    editSpec((_s, find) => { find("Title").text = "Hello there"; });
    const planned = await plan();
    const before = snapshot();
    const result = await apply(planned.planId);
    const after = snapshot();
    const title = byName("Title");
    expect(result.applied.updated).toEqual([{ id: title.id, keys: ["text"] }]);
    expect(title.characters).toBe("Hello there");
    expect(title.fontName).toEqual({ family: "Roboto", style: "Bold" });
    expect(changedFields(before, after, title.id)).toEqual(["characters"]);
    for (const id of Object.keys(before)) if (id !== title.id) expect(changedFields(before, after, id)).toEqual([]);
    expect(result.undo).toContain("One undo");
    expect(undoCommits).toBe(2);
    expect(sent.find(s => s.command === "apply_spec_ops").timeoutMs).toBe(APPLY_TIMEOUT_MS);
  });

  test("a fill update on a node with a variable-bound stroke leaves the stroke binding", async () => {
    const { root, byName } = await seed();
    await pull(root);
    const swatch = byName("Swatch");
    const stroke = JSON.stringify(swatch.strokes);
    expect(swatch.strokes[0].boundVariables.color.id).toBe("v-brand");
    editSpec((_s, find) => { find("Swatch").fillColor = "#00FF00"; });
    const result = await apply((await plan()).planId);
    expect(result.counts).toMatchObject({ updated: 1, partial: 0, failed: 0 });
    expect(swatch.fills[0].color).toMatchObject({ r: 0, g: 1, b: 0 });
    expect(JSON.stringify(swatch.strokes)).toBe(stroke);
  });

  test("ids are unchanged, and apply then plan gives zero operations and zero drift (text edit under a HUG parent)", async () => {
    const { root, byName } = await seed();
    await pull(root);
    const before = ids();
    editSpec((_s, find) => { find("Label").text = "A much longer row label"; find("Body").fontSize = 16; });
    const result = await apply((await plan()).planId);
    expect(result.counts).toMatchObject({ updated: 2, partial: 0, failed: 0 });
    expect(byName("Label").characters).toBe("A much longer row label");
    expect(ids()).toEqual(before);
    const lock = readJson(lockPath());
    expect(lock.pendingApply).toBeNull();
    const again = await plan();
    expect(again.counts).toMatchObject({ operations: 0, drift: 0, conflicts: 0 });
  });

  test("creates, a reorder and a move land; the Spec gets the new ids; a re-plan is empty", async () => {
    const { root, byName } = await seed();
    await pull(root);
    editSpec((spec, find) => {
      find("Row").children.reverse(); // DotB, DotA, Label
      spec.tree.children.splice(1, 0, { type: "text", text: "New line" }, { type: "rectangle", name: "Bar", width: 10, height: 2, fillColor: "#123456" });
    });
    const result = await apply((await plan()).planId);
    expect(result.counts).toMatchObject({ created: 2, failed: 0, partial: 0 });
    const spec = readJson(specPath());
    const [newText, bar] = [spec.tree.children[1], spec.tree.children[2]];
    expect(Object.keys(newText)[0]).toBe("id");
    expect(nodes.get(newText.id).characters).toBe("New line");
    expect(nodes.get(newText.id).autoRename).toBe(true);
    expect(nodes.get(bar.id).name).toBe("Bar");
    expect(root.children.map((c: any) => c.name)).toEqual(["Title", "New line", "Bar", "Body", "Swatch", "Row", "Logo"]);
    expect(byName("Row").children.map((c: any) => c.name)).toEqual(["DotB", "DotA", "Label"]);
    const again = await plan();
    expect(again.counts).toMatchObject({ operations: 0, drift: 0, conflicts: 0 });
  });

  test("a create whose earlier sibling failed still gets the right id", async () => {
    const { root } = await seed();
    await pull(root);
    editSpec(spec => {
      spec.tree.children.push({ type: "instance", name: "Ghost", componentId: "99:99" }, { type: "rectangle", name: "After", width: 5, height: 5 });
    });
    const result = await apply((await plan()).planId);
    expect(result.failed).toEqual([expect.objectContaining({ op: "create", path: [5] })]);
    const spec = readJson(specPath());
    expect(spec.tree.children[5].id).toBeUndefined();
    expect(nodes.get(spec.tree.children[6].id).name).toBe("After");
    expect(root.children.map((c: any) => c.name).slice(-2)).toEqual(["Logo", "After"]);
    // The failed create is planned again; the made one is not.
    const again = await plan();
    expect(again.operations).toEqual([expect.objectContaining({ op: "create", path: [5] })]);
  });

  test("a node changed in Figma between plan and apply refuses the whole run with nothing written", async () => {
    const { root, byName } = await seed();
    await pull(root);
    editSpec((_s, find) => { find("Swatch").fillColor = "#00FF00"; find("Title").text = "Changed"; });
    const planned = await plan();
    byName("Swatch").opacity = 0.5;
    const before = snapshot();
    const lockBefore = readFileSync(lockPath(), "utf8");
    await expect(apply(planned.planId)).rejects.toThrow(/Figma changed since the plan.*Nothing was written/);
    expect(snapshot()).toEqual(before);
    expect(undoCommits).toBe(0);
    expect(readJson(lockPath())).toEqual(JSON.parse(lockBefore));
  });

  test("the Spec edited after the plan refuses before sending", async () => {
    const { root } = await seed();
    await pull(root);
    editSpec((_s, find) => { find("Title").text = "One"; });
    const planned = await plan();
    editSpec((_s, find) => { find("Title").text = "Two"; });
    await expect(apply(planned.planId)).rejects.toThrow(/changed since plan/);
    expect(sent.some(s => s.command === "apply_spec_ops")).toBe(false);
  });

  test("the wrong file name or page refuses with nothing written", async () => {
    const { root } = await seed();
    await pull(root);
    editSpec((_s, find) => { find("Title").text = "Elsewhere"; });
    const planned = await plan();
    (globalThis as any).figma.root.name = "A copy";
    const before = snapshot();
    await expect(apply(planned.planId)).rejects.toThrow(/Wrong file/);
    expect(snapshot()).toEqual(before);
    expect(readJson(lockPath()).pendingApply).toBeNull();

    (globalThis as any).figma.root.name = "Test file";
    const spec = readJson(specPath());
    const lock = readJson(lockPath());
    const wrongPage = { ...lock, pageId: "77:1" };
    const params = sent.find(s => s.command === "apply_spec_ops").params;
    const refused = await applySpecOps({ ...params, expect: { ...params.expect, pageId: wrongPage.pageId } });
    expect(refused.refused).toMatch(/page 77:1/);
    expect(spec.tree.children[0].text).toBe("Elsewhere");
  });

  test("a removal without allowRemovals is skipped; with it the node lands in l2f/superseded at the same place, out of a section, with its child", async () => {
    const section = makeNode("SECTION", { name: "Area", x: 500, y: 300 }, page);
    const { root, byName } = await seed();
    section.appendChild(root);
    const box = makeNode("FRAME", { name: "Box", x: 7, y: 9, layoutPositioning: "ABSOLUTE" }, root);
    const spinner = makeNode("RECTANGLE", { name: "Spinner", x: 3, y: 4 }, box);
    await pull(root);
    editSpec(spec => { spec.tree.children = spec.tree.children.filter((c: any) => c.name !== "Box"); });
    const skipped = await apply((await plan()).planId);
    expect(skipped.skipped).toEqual([expect.objectContaining({ op: "remove", id: box.id })]);
    expect(box.parent).toBe(root);
    expect(readJson(lockPath()).nodes[box.id]).toBeDefined();

    const boxAbs = JSON.stringify(box.absoluteTransform);
    const spinnerAbs = JSON.stringify(spinner.absoluteTransform);
    const result = await apply((await plan()).planId, { allowRemovals: true });
    expect(result.applied.removed).toEqual([box.id]);
    const holder = box.parent;
    expect(holder.name).toBe(SUPERSEDED_NAME);
    expect(holder.parent).toBe(page);
    expect(holder.visible).toBe(false);
    expect(box.name).toBe("Box (superseded 2026-11-12)");
    expect(JSON.stringify(box.absoluteTransform)).toBe(boxAbs);
    expect(JSON.stringify(spinner.absoluteTransform)).toBe(spinnerAbs);
    expect(spinner.parent).toBe(box);
    expect(removeCalls).toBe(0);
    expect(nodes.has(box.id)).toBe(true);
    const lock = readJson(lockPath());
    expect(lock.supersededFrameId).toBe(holder.id);
    expect(lock.nodes[box.id]).toBeUndefined();
    expect((await plan()).counts).toMatchObject({ operations: 0, drift: 0 });
    expect(byName("Title")).toBeDefined();
  });

  test("the plugin moves a node with a rotated OpaqueNode child aside without changing either absolute transform", async () => {
    // plan_spec refuses to remove a subtree holding an OpaqueNode (its content
    // was never read), so this drives apply_spec_ops directly.
    const { root } = await seed();
    const box = makeNode("FRAME", { name: "Box", x: 12, y: 18, layoutPositioning: "ABSOLUTE" }, root);
    const spinner = makeNode("RECTANGLE", { name: "Spinner", rotation: 30 }, box);
    spinner.relativeTransform = [[0.866, -0.5, 5], [0.5, 0.866, 6]];
    const boxAbs = JSON.stringify(box.absoluteTransform);
    const spinnerAbs = JSON.stringify(spinner.absoluteTransform);
    const result = await applySpecOps({
      rootId: root.id, expect: { fileName: "Test file", pageId: page.id }, allowRemovals: true, date: "2026-11-12",
      operations: [{ op: "remove", id: box.id, name: "Box", parentId: root.id }], expectedHashes: {}, orders: [],
    });
    expect(result.removed).toEqual([box.id]);
    expect(box.parent.name).toBe(SUPERSEDED_NAME);
    expect(JSON.stringify(box.absoluteTransform)).toBe(boxAbs);
    expect(JSON.stringify(spinner.absoluteTransform)).toBe(spinnerAbs);
    expect(removeCalls).toBe(0);
  });

  test("a hand-added sibling keeps its place through a reorder", async () => {
    const { root, byName } = await seed();
    await pull(root);
    const row = byName("Row");
    const hand = makeNode("RECTANGLE", { name: "Hand" }, null);
    row.insertChild(0, hand); // Hand, Label, DotA, DotB
    editSpec((_s, find) => { const kids = find("Row").children; kids.push(kids.shift()); }); // DotA, DotB, Label
    const result = await apply((await plan()).planId);
    expect(result.counts.failed).toBe(0);
    expect(row.children.map((c: any) => c.name)).toEqual(["Hand", "DotA", "DotB", "Label"]);
    const again = await plan();
    expect(again.counts).toMatchObject({ operations: 0, conflicts: 0 });
    expect(again.drift).toEqual([expect.objectContaining({ id: hand.id, kind: "added" })]);
  });

  test("a moved OpaqueNode keeps its subtree untouched; a reparent into a frame without auto-layout keeps the absolute position", async () => {
    const { root, byName, group } = await seed();
    const holder = makeNode("FRAME", { name: "Holder", x: 50, y: 70, layoutPositioning: "ABSOLUTE" }, root);
    await pull(root);
    const part = byName("LogoPart");
    const partBefore = JSON.stringify({ ...snapshot()[part.id] });
    const groupAbs = JSON.stringify(group.absoluteTransform);
    editSpec((spec, find) => {
      const logo = spec.tree.children.find((c: any) => c.name === "Logo");
      spec.tree.children = spec.tree.children.filter((c: any) => c !== logo);
      find("Holder").children = [logo];
    });
    const result = await apply((await plan()).planId);
    expect(result.applied.moved).toEqual([group.id]);
    expect(group.parent).toBe(holder);
    expect(JSON.stringify(group.absoluteTransform)).toBe(groupAbs);
    expect(JSON.stringify(snapshot()[part.id])).toBe(partBefore);
    expect(part.parent).toBe(group);
  });

  test("a resize the mock ignores is reported partial, and the next plan shows it again", async () => {
    const { root, byName } = await seed();
    await pull(root);
    byName("Swatch").ignoreResize = true;
    editSpec((_s, find) => { find("Swatch").width = 80; });
    const result = await apply((await plan()).planId);
    expect(result.partial).toEqual([{ id: byName("Swatch").id, keys: ["width"] }]);
    const again = await plan();
    expect(again.counts.operations + again.counts.conflicts).toBeGreaterThan(0);
  });

  test("a timeout leaves pendingApply set, and the next plan refuses until a pull", async () => {
    const { root } = await seed();
    await pull(root);
    editSpec((_s, find) => { find("Title").text = "Lost"; });
    const planned = await plan();
    hook = async command => { if (command === "apply_spec_ops") throw new FigmaCommandError("Request to Figma timed out", "no_reply"); };
    await expect(apply(planned.planId)).rejects.toThrow(/timed out/);
    expect(readJson(lockPath()).pendingApply).toBe(planned.planId);
    hook = null;
    await expect(plan()).rejects.toThrow(/did not finish/);
  });

  describe("a rejection where Figma was never written clears pendingApply (review M1)", () => {
    const cases: Array<[string, () => never]> = [
      ["the Dev Mode editor gate", () => {
        try { assertEditorAllowed("apply_spec_ops", "dev", {}); } catch (error: any) { throw new FigmaCommandError(error.message, "plugin_error"); }
        throw new Error("the gate let apply_spec_ops through in Dev Mode");
      }],
      ["no relay connection", () => { throw new FigmaCommandError("Not connected to the relay. Start it with `bun socket` in the llm2figma repo.", "not_sent"); }],
      ["an old plugin without the command", () => { throw new FigmaCommandError("Unknown command: apply_spec_ops", "plugin_error"); }],
    ];
    for (const [label, fail] of cases) {
      test(label, async () => {
        const { root } = await seed();
        await pull(root);
        editSpec((_s, find) => { find("Title").text = "X"; });
        const planned = await plan();
        hook = async command => { if (command === "apply_spec_ops") fail(); };
        const before = snapshot();
        await expect(apply(planned.planId)).rejects.toThrow(/Nothing was written/);
        expect(snapshot()).toEqual(before);
        expect(readJson(lockPath()).pendingApply).toBeNull();
        hook = null;
        expect((await plan()).counts.updates).toBe(1);
      });
    }
  });

  test("FILL on a frame reparented into an auto-layout parent is written against the new parent (review M2)", async () => {
    const { root } = await seed();
    const plain = makeNode("FRAME", { name: "Plain" }, root);
    const inner = makeNode("FRAME", { name: "Inner", width: 50, height: 30 }, plain);
    await pull(root);
    editSpec((spec, find) => {
      const kids = find("Plain").children;
      const [moved] = kids.splice(kids.findIndex((c: any) => c.name === "Inner"), 1);
      moved.layoutSizingHorizontal = "FILL";
      delete moved.x; delete moved.y; delete moved.width;
      spec.tree.children.unshift(moved);
    });
    const result = await apply((await plan()).planId);
    expect(result.failed).toEqual([]);
    expect(result.partial).toEqual([]);
    expect(inner.parent).toBe(root);
    expect(inner.layoutSizingHorizontal).toBe("FILL");
    expect((await plan()).counts).toMatchObject({ operations: 0, conflicts: 0 });
  });

  test("a recorded holder with auto-layout is left alone; a fresh hidden one is made (review M3)", async () => {
    const { root, byName } = await seed();
    const box = makeNode("FRAME", { name: "Box", x: 7, y: 9, layoutPositioning: "ABSOLUTE" }, root);
    await pull(root);
    const users = makeNode("FRAME", { name: SUPERSEDED_NAME, layoutMode: "VERTICAL" }, page);
    const lock = readJson(lockPath());
    writeFileSync(lockPath(), JSON.stringify({ ...lock, supersededFrameId: users.id }));
    editSpec(spec => { spec.tree.children = spec.tree.children.filter((c: any) => c.name !== "Box"); });
    const result = await apply((await plan()).planId, { allowRemovals: true });
    expect(result.applied.removed).toEqual([box.id]);
    expect(box.parent).not.toBe(users);
    expect(box.parent.name).toBe(`${SUPERSEDED_NAME} 2`);
    expect(box.parent.layoutMode).toBe("NONE");
    expect(users.children).toEqual([]);
    expect(users.layoutMode).toBe("VERTICAL");
    expect(readJson(lockPath()).supersededFrameId).toBe(box.parent.id);
    expect(byName("Title")).toBeDefined();
  });

  test("a move or removal whose position check fails after the node moved is partial, not failed (review L1)", async () => {
    const { root, byName } = await seed();
    const box = makeNode("FRAME", { name: "Box", x: 7, y: 9, layoutPositioning: "ABSOLUTE" }, root);
    const target = makeNode("FRAME", { name: "Target", x: 30, y: 40, layoutPositioning: "ABSOLUTE" }, root);
    const stuck = makeNode("RECTANGLE", { name: "Stuck", x: 5, y: 5, lockTransform: true }, box);
    await pull(root);
    box.lockTransform = true;
    // Stuck moves out of Box into Target (a reparent that keeps the absolute
    // position) and Box is removed; Figma refuses both transforms.
    editSpec((spec, find) => {
      const stuckSpec = find("Box").children[0];
      spec.tree.children = spec.tree.children.filter((c: any) => c.name !== "Box");
      find("Target").children = [stuckSpec];
    });
    const planned = await plan();
    const result = await apply(planned.planId, { allowRemovals: true });
    expect(stuck.parent).toBe(target);
    expect(box.parent.name).toBe(SUPERSEDED_NAME);
    expect(result.failed).toEqual([]);
    expect(result.applied.moved).toEqual([stuck.id]);
    expect(result.applied.removed).toEqual([box.id]);
    expect(result.partial).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: stuck.id, keys: ["parent"], detail: expect.stringContaining("absolute position not kept") }),
      expect.objectContaining({ id: box.id, keys: ["position"], detail: expect.stringContaining("absolute position not kept") }),
    ]));
    expect(byName("Title")).toBeDefined();
    expect(readJson(lockPath()).nodes[stuck.id].parentId).toBe(target.id);
  });

  test("a Spec edited while the apply ran names the created ids and warns against re-applying from the .bak (review L2)", async () => {
    const { root } = await seed();
    await pull(root);
    editSpec(spec => { spec.tree.children.push({ type: "rectangle", name: "Fresh", width: 5, height: 5 }); });
    const planned = await plan();
    hook = async (command, params) => {
      if (command !== "apply_spec_ops") return undefined;
      const out = await applySpecOps(params);
      editSpec((_s, find) => { find("Body").text = "Typed meanwhile"; });
      return out;
    };
    const fresh = () => [...nodes.values()].find(n => n.name === "Fresh");
    await expect(apply(planned.planId)).rejects.toThrow(/edited while the apply ran.*Created in Figma: \d+:1 at tree\.children\[5\].*\.bak/s);
    expect(fresh()).toBeDefined();
    expect(String(await apply(planned.planId).catch(e => e.message))).toContain("did not finish");
  });

  test("a Spec edited while the apply ran stops before writing the Spec or SpecLock", async () => {
    const { root } = await seed();
    await pull(root);
    editSpec((_s, find) => { find("Title").text = "First"; });
    const planned = await plan();
    hook = async (command, params) => {
      if (command !== "apply_spec_ops") return undefined;
      const out = await applySpecOps(params);
      editSpec((_s, find) => { find("Body").text = "Typed meanwhile"; });
      return out;
    };
    await expect(apply(planned.planId)).rejects.toThrow(/edited while the apply ran/);
    expect(readJson(lockPath()).pendingApply).toBe(planned.planId);
  });

  test("conflicts are skipped by default; onConflict spec writes the Spec's value", async () => {
    const { root, byName } = await seed();
    await pull(root);
    editSpec((_s, find) => { find("Swatch").fillColor = "#00FF00"; find("Title").text = "Mine"; });
    byName("Swatch").fills = solid(0, 0, 1);
    const skipped = await apply((await plan()).planId);
    expect(skipped.skipped).toEqual([expect.objectContaining({ id: byName("Swatch").id, kind: "property", keys: ["fillColor"] })]);
    expect(byName("Swatch").fills[0].color).toMatchObject({ r: 0, g: 0, b: 1 });
    // The conflict survives the relock: the next plan reports it again.
    const again = await plan();
    expect(again.conflicts).toEqual([expect.objectContaining({ id: byName("Swatch").id, keys: ["fillColor"] })]);
    const forced = await apply(again.planId, { onConflict: "spec" });
    expect(forced.skipped).toEqual([]);
    expect(byName("Swatch").fills[0].color).toMatchObject({ r: 0, g: 1, b: 0 });
    expect((await plan()).counts).toMatchObject({ operations: 0, drift: 0, conflicts: 0 });
  });

  test("drift is kept through an apply and never turned into an edit", async () => {
    const { root, byName } = await seed();
    await pull(root);
    byName("Body").opacity = 0.4;
    editSpec((_s, find) => { find("Title").text = "Edited"; });
    await apply((await plan()).planId);
    expect(byName("Body").opacity).toBe(0.4);
    const again = await plan();
    expect(again.counts.operations).toBe(0);
    expect(again.drift).toEqual([expect.objectContaining({ id: byName("Body").id, keys: ["opacity"] })]);
  });

  test("an applied plan cannot be applied twice, and apply_spec_ops is refused in Dev Mode", async () => {
    const { root } = await seed();
    await pull(root);
    editSpec((_s, find) => { find("Title").text = "Once"; });
    const planned = await plan();
    await apply(planned.planId);
    await expect(apply(planned.planId)).rejects.toThrow(/SpecLock .* changed since plan/);
    expect(allowedEditors("apply_spec_ops")).not.toContain("dev");
  });

  describe("prototype reactions (issue #40)", () => {
    // As Figma returns a reaction: the deprecated singular `action` beside
    // `actions`, and an undefined field.
    const navigate = (destinationId: string) => ({
      trigger: { type: "ON_CLICK" },
      action: { type: "NODE", destinationId, navigation: "NAVIGATE", transition: null, preserveScrollPosition: false },
      actions: [{ type: "NODE", destinationId, navigation: "NAVIGATE", transition: null, preserveScrollPosition: false, overlayRelativePosition: undefined }],
    });
    const canonical = (destinationId: string) => [{
      actions: [{ destinationId, navigation: "NAVIGATE", preserveScrollPosition: false, transition: null, type: "NODE" }],
      trigger: { type: "ON_CLICK" },
    }];
    // The SpecLock's (comparison) form: a NODE action's missing fields filled
    // with what Figma reads back for them.
    const locked = (destinationId: string) => [{
      actions: [{
        destinationId, navigation: "NAVIGATE", preserveScrollPosition: false, resetInteractiveComponents: false,
        resetScrollPosition: false, resetVideoPosition: false, transition: null, type: "NODE",
      }],
      trigger: { type: "ON_CLICK" },
    }];
    const lastDestinationIds = () => sent.filter(s => s.command === "read_spec_nodes").at(-1).params.destinationIds;
    async function linked() {
      const seeded = await seed();
      const screenB = makeNode("FRAME", { name: "Screen B", x: 500 }, page);
      const screenC = makeNode("FRAME", { name: "Screen C", x: 900 }, page);
      seeded.byName("Swatch").reactions = [navigate(screenB.id)];
      return { ...seeded, screenB, screenC };
    }

    test("pull: an ON_CLICK NAVIGATE reaction is in the Spec in canonical form", async () => {
      const { root, byName, screenB } = await linked();
      await pull(root);
      const swatch = readJson(specPath()).tree.children.find((c: any) => c.name === "Swatch");
      expect(swatch.reactions).toEqual(canonical(screenB.id));
      expect(JSON.stringify(swatch.reactions)).toBe(JSON.stringify(canonical(screenB.id)));
      expect(swatch.$unread).toBeUndefined();
      // A node without reactions has no key: [] is the default.
      expect(readJson(specPath()).tree.children.find((c: any) => c.name === "Title").reactions).toBeUndefined();
      expect(readJson(lockPath()).nodes[byName("Swatch").id].props.reactions).toEqual(locked(screenB.id));
    });

    test("retargeting destinationId is one update of reactions, written with setReactionsAsync; a re-plan is empty", async () => {
      const { root, byName, screenC } = await linked();
      await pull(root);
      editSpec((_s, find) => { find("Swatch").reactions[0].actions[0].destinationId = screenC.id; });
      const planned = await plan();
      expect(planned.counts).toMatchObject({ operations: 1, updates: 1, conflicts: 0, drift: 0 });
      expect(planned.operations).toEqual([{ op: "update", id: byName("Swatch").id, name: "Swatch", keys: ["reactions"] }]);
      const before = snapshot();
      const result = await apply(planned.planId);
      expect(result.counts).toMatchObject({ updated: 1, partial: 0, failed: 0 });
      // Cleared first (the mock, like Figma, refuses a replacement otherwise), then the plan's value exactly.
      expect(reactionWrites).toEqual([{ id: byName("Swatch").id, reactions: [] }, { id: byName("Swatch").id, reactions: canonical(screenC.id) }]);
      expect(changedFields(before, snapshot(), byName("Swatch").id)).toEqual(["reactions"]);
      expect(undoCommits).toBe(2);
      expect((await plan()).counts).toMatchObject({ operations: 0, drift: 0, conflicts: 0 });
    });

    test("deleting the reactions key plans an update to []", async () => {
      const { root, byName } = await linked();
      await pull(root);
      editSpec((_s, find) => { delete find("Swatch").reactions; });
      const planned = await plan();
      expect(planned.operations).toEqual([{ op: "update", id: byName("Swatch").id, name: "Swatch", keys: ["reactions"] }]);
      expect((store.get(planned.planId).operations[0] as any).set).toEqual({ reactions: [] });
      await apply(planned.planId);
      expect(byName("Swatch").reactions).toEqual([]);
      expect((await plan()).counts.operations).toBe(0);
    });

    test("a reaction the plugin cannot reproduce is listed in $unread, and an edit to it is refused", async () => {
      const { root, byName, screenB } = await linked();
      byName("Swatch").reactions = [{ trigger: { type: "ON_CLICK" }, actions: [{ type: "SET_VARIABLE", variableId: "v-brand", variableValue: { type: "BOOLEAN", resolvedType: "BOOLEAN", value: true } }] }];
      await pull(root);
      const swatch = readJson(specPath()).tree.children.find((c: any) => c.name === "Swatch");
      expect(swatch.$unread).toEqual(["reactions"]);
      expect(swatch.reactions).toBeUndefined();
      editSpec((_s, find) => { find("Swatch").reactions = canonical(screenB.id); });
      const planned = await plan();
      expect(planned.counts.updates).toBe(0);
      expect(planned.conflicts).toEqual([expect.objectContaining({ id: byName("Swatch").id, kind: "property", keys: ["reactions"] })]);
      await apply(planned.planId, { onConflict: "spec" });
      expect(reactionWrites).toEqual([]);
      expect(byName("Swatch").reactions[0].actions[0].type).toBe("SET_VARIABLE");
      // Written by hand in a Spec, an action type the Spec does not carry is an error.
      editSpec((_s, find) => { const s = find("Title"); s.reactions = [{ trigger: { type: "ON_CLICK" }, actions: [{ type: "SET_VARIABLE_MODE" }] }]; });
      await expect(plan()).rejects.toThrow(/reactions .* cannot be written/);
    });

    test("a destinationId that is not a node in the file is a plan error naming the node", async () => {
      const { root, byName } = await linked();
      await pull(root);
      editSpec((_s, find) => { find("Swatch").reactions[0].actions[0].destinationId = "404:1"; });
      await expect(plan()).rejects.toThrow(new RegExp(`tree\\.children\\[2\\] \\(${byName("Swatch").id}\\): reactions link to destinationId "404:1", which is not a node in this file`));
      expect(lastDestinationIds()).toEqual(["404:1"]);
    });

    test("NAVIGATE needs a top-level frame on the page; SCROLL_TO may target a node inside the Spec", async () => {
      const { root, byName } = await linked();
      await pull(root);
      const row = byName("Row");
      editSpec((_s, find) => { find("Swatch").reactions[0].actions[0].destinationId = row.id; });
      await expect(plan()).rejects.toThrow(/a NAVIGATE link needs a top-level frame on this page/);
      editSpec((_s, find) => { find("Swatch").reactions[0].actions[0].navigation = "SCROLL_TO"; });
      const planned = await plan();
      expect(planned.counts.updates).toBe(1);
      expect(lastDestinationIds()).toEqual([row.id]);
    });

    test("a link to a node this Spec removes is refused at plan", async () => {
      const { root, byName } = await linked();
      await pull(root);
      const row = byName("Row");
      editSpec((spec, find) => {
        Object.assign(find("Swatch").reactions[0].actions[0], { destinationId: row.id, navigation: "SCROLL_TO" });
        spec.tree.children = spec.tree.children.filter((c: any) => c.id !== row.id);
      });
      await expect(plan()).rejects.toThrow(`reactions link to "${row.id}", which this Spec removes`);
    });

    test("only links the Spec adds are checked: an untouched CHANGE_TO link to another page passes through", async () => {
      const { root, byName, screenB, screenC } = await linked();
      const otherPage = makeNode("PAGE", { name: "Page 2" });
      const variant = makeNode("FRAME", { name: "Variant" }, makeNode("FRAME", { name: "Set" }, otherPage));
      byName("Swatch").reactions = [
        navigate(screenB.id),
        { trigger: { type: "ON_HOVER" }, actions: [{ type: "NODE", destinationId: variant.id, navigation: "CHANGE_TO", transition: null }] },
      ];
      await pull(root);
      editSpec((_s, find) => { find("Swatch").reactions[0].actions[0].destinationId = screenC.id; });
      const planned = await plan();
      expect(planned.counts.updates).toBe(1);
      expect(lastDestinationIds()).toEqual([screenC.id]);
      expect((await apply(planned.planId)).counts).toMatchObject({ updated: 1, partial: 0, failed: 0 });
      expect((await plan()).counts.operations).toBe(0);
    });

    test("a hand-written link Figma reads back with defaults and float32 numbers is not partial, and a re-plan is empty", async () => {
      const { root, byName, screenB } = await linked();
      await pull(root);
      const written = [{
        trigger: { type: "ON_CLICK" },
        actions: [{ type: "NODE", destinationId: screenB.id, navigation: "NAVIGATE", transition: { type: "DISSOLVE", duration: 0.3, easing: { type: "EASE_OUT" } } }],
      }];
      editSpec((_s, find) => { find("Title").reactions = written; });
      const planned = await plan();
      expect(planned.operations).toEqual([{ op: "update", id: byName("Title").id, name: "Title", keys: ["reactions"] }]);
      const result = await apply(planned.planId);
      expect(result.counts).toMatchObject({ updated: 1, partial: 0, failed: 0 });
      // Written exactly as planned; Figma's read-back differs (defaults, float32).
      expect(reactionWrites.at(-1)!.reactions).toEqual((store.get(planned.planId).operations[0] as any).set.reactions);
      expect(reactionWrites.at(-1)!.reactions[0].actions[0].transition.duration).toBe(0.3);
      expect(byName("Title").reactions[0].actions[0]).toMatchObject({ resetScrollPosition: false, transition: { duration: Math.fround(0.3) } });
      expect(Math.fround(0.3)).not.toBe(0.3);
      expect((await plan()).counts).toMatchObject({ operations: 0, drift: 0, conflicts: 0 });
    });

    test("setReactionsAsync throwing fails that node with the error text and writes nothing else on it", async () => {
      const { root, byName, screenC } = await linked();
      await pull(root);
      const swatch = byName("Swatch");
      editSpec((_s, find) => { find("Swatch").reactions[0].actions[0].destinationId = screenC.id; find("Swatch").fillColor = "#00FF00"; });
      const planned = await plan();
      swatch.reactionError = "Unable to establish connection to Figma";
      const before = snapshot();
      const result = await apply(planned.planId);
      expect(result.failed).toEqual([expect.objectContaining({ op: "update", id: swatch.id, error: expect.stringContaining("Unable to establish connection to Figma") })]);
      expect(result.counts).toMatchObject({ updated: 0, partial: 0, failed: 1 });
      expect(changedFields(before, snapshot(), swatch.id)).toEqual([]);
      // The edit stays an edit: the next plan proposes it again.
      delete swatch.reactionError;
      expect((await plan()).operations).toEqual([expect.objectContaining({ id: swatch.id, keys: ["fillColor", "reactions"] })]);
    });

    test("a list Figma rejects after the clear is put back, and the node is reported failed", async () => {
      const { root, byName, screenB, screenC } = await linked();
      await pull(root);
      const swatch = byName("Swatch");
      const real = swatch.setReactionsAsync;
      swatch.setReactionsAsync = async function (this: any, list: any[]) {
        if (list.length && list[0].actions[0].destinationId === screenC.id) throw new Error("Reaction was invalid");
        return real.call(this, list);
      };
      editSpec((_s, find) => { find("Swatch").reactions[0].actions[0].destinationId = screenC.id; });
      const result = await apply((await plan()).planId);
      expect(result.failed).toEqual([expect.objectContaining({ id: swatch.id, error: "Reaction was invalid" })]);
      expect(swatch.reactions[0].actions[0].destinationId).toBe(screenB.id);
    });

    test("a node without setReactionsAsync is reported failed, never skipped or partial", async () => {
      const { root, byName, screenC } = await linked();
      await pull(root);
      const swatch = byName("Swatch");
      delete swatch.setReactionsAsync;
      editSpec((_s, find) => { find("Swatch").reactions[0].actions[0].destinationId = screenC.id; });
      const result = await apply((await plan()).planId);
      expect(result.failed).toEqual([expect.objectContaining({ id: swatch.id, error: expect.stringContaining("has no setReactionsAsync") })]);
      expect(result.partial).toEqual([]);
    });

    test("the canonical form and the hashes do not depend on the order Figma returns keys in", async () => {
      const { root, byName, screenB } = await linked();
      await pull(root);
      const lock = readJson(lockPath());
      const swatch = byName("Swatch");
      expect(lock.nodes[swatch.id].props.reactions).toEqual(locked(screenB.id));
      const reordered = navigate(screenB.id);
      swatch.reactions = [{
        actions: reordered.actions.map((a: any) => Object.fromEntries(Object.entries(a).reverse())),
        action: reordered.action, trigger: reordered.trigger,
      }];
      const live = await readSpecNodes({ rootId: root.id, baseHashes: {}, maxNodes: 100 });
      expect(live.nodes[swatch.id].propsHash).toBe(lock.nodes[swatch.id].propsHash);
      expect((await plan()).counts).toMatchObject({ operations: 0, drift: 0, conflicts: 0 });
    });

    test("Dev Mode refuses an apply that would write reactions, with nothing written", async () => {
      const { root, screenC } = await linked();
      await pull(root);
      editSpec((_s, find) => { find("Swatch").reactions[0].actions[0].destinationId = screenC.id; });
      const planned = await plan();
      (globalThis as any).figma.editorType = "dev";
      hook = async command => {
        if (command !== "apply_spec_ops") return;
        try { assertEditorAllowed(command, (globalThis as any).figma.editorType, {}); } catch (error: any) { throw new FigmaCommandError(error.message, "plugin_error"); }
      };
      await expect(apply(planned.planId)).rejects.toThrow(/not available in the dev editor/);
      expect(reactionWrites).toEqual([]);
      expect(readJson(lockPath()).pendingApply).toBeNull();
    });
  });

  test("apply_spec registers with the other spec tools only under L2F_SPEC_SYNC", () => {
    const names = (env: Record<string, string>) => {
      const tools: string[] = [];
      registerWhenEnabled("SPEC_SYNC", registerSpecTools, { tool: (name: string) => tools.push(name) } as any, send as any, env);
      return tools;
    };
    expect(names({})).toEqual([]);
    expect(names({ L2F_SPEC_SYNC: "1" })).toEqual(["pull_spec", "plan_spec", "apply_spec"]);
  });
});
