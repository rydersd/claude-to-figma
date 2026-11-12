/**
 * Spec sync, PR 11c (L2F_SPEC_SYNC): plan_spec and the plugin's read_spec_nodes,
 * against a mocked `figma` global and temp directories. Each designed case is
 * pulled with the real pull_spec, edited on disk the way a model would, and/or
 * changed "in Figma" through the mock, then planned. No Figma or relay needed:
 *   bun test tests/spec-plan.test.ts
 *
 * Resets the plugin's variable indexes before and after, as tests/spec-sync.test.ts
 * does (see wiki/concepts/spec-sync.md).
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { exportSpec, readSpecNodes } from "../src/llm2figma_plugin/src/spec";
import { createNodeTree } from "../src/llm2figma_plugin/src/node-tree";
import { resetVariableIndexesForTests } from "../src/llm2figma_plugin/src/utils";
import { allowedEditors, assertEditorAllowed } from "../src/llm2figma_plugin/src/editor-gate";
import {
  PLAN_LIMITS, PLAN_LIST_LIMIT, PlanStore, READ_TIMEOUT_MS, planSpec, pullSpec, registerTools as registerSpecTools,
} from "../src/llm2figma_mcp/tools/spec";
import { registerWhenEnabled } from "../src/shared/flags";
import { hashProps, hashString, lockNodesFromTree, normalizeSpecTree, specHash } from "../src/shared/spec";
import { computePlan, prepareSpec } from "../src/llm2figma_mcp/spec-plan";

const originalFigma = (globalThis as any).figma;
let nextId = 0;
let nodes = new Map<string, any>();
let page: any;

function detach(child: any) {
  if (child.parent) child.parent.children = child.parent.children.filter((c: any) => c !== child);
}

function makeNode(type: string, extra: any = {}, parent: any = null): any {
  const node: any = {
    id: `${++nextId}:1`, type, name: type, parent: null, children: [], rotation: 0,
    x: 0, y: 0, width: 100, height: 100, opacity: 1, fills: [], strokes: [], effects: [],
    strokeWeight: 1, strokeAlign: type === "VECTOR" ? "CENTER" : "INSIDE", layoutMode: "NONE", layoutWrap: "NO_WRAP",
    layoutPositioning: "AUTO", layoutSizingHorizontal: "FIXED", layoutSizingVertical: "FIXED",
    clipsContent: true, itemReverseZIndex: false, itemSpacing: 0, counterAxisSpacing: 0,
    paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, primaryAxisAlignItems: "MIN", counterAxisAlignItems: "MIN",
    cornerRadius: 0,
    resize(w: number, h: number) { this.width = w; this.height = h; },
    appendChild(child: any) { detach(child); child.parent = this; this.children.push(child); },
    insertChild(index: number, child: any) { detach(child); child.parent = this; this.children.splice(index, 0, child); },
    remove() { detach(this); nodes.delete(this.id); this.removed = true; },
    ...extra,
  };
  if (type === "TEXT") {
    Object.assign(node, {
      fontName: { family: "Inter", style: "Regular" }, fontSize: 12, characters: "", textAutoResize: "WIDTH_AND_HEIGHT",
      textAlignHorizontal: "LEFT", lineHeight: { unit: "AUTO" }, letterSpacing: { unit: "PERCENT", value: 0 }, textCase: "ORIGINAL",
      fills: [{ type: "SOLID", color: { r: 0, g: 0, b: 0 }, opacity: 1 }], height: 20, ...extra,
    });
  }
  if (type === "INSTANCE") {
    Object.assign(node, {
      async getMainComponentAsync() { return this.main ?? null; },
      componentProperties: {},
      ...extra,
    });
  }
  nodes.set(node.id, node);
  if (parent) parent.appendChild(node);
  return node;
}

function freshFigma() {
  nextId = 0;
  nodes = new Map();
  page = makeNode("PAGE", { name: "Page 1", async loadAsync() { this.loaded = true; } });
  (globalThis as any).figma = {
    mixed: Symbol("mixed"),
    editorType: "figma",
    fileKey: undefined,
    root: { name: "Test file" },
    currentPage: page,
    ui: { postMessage: () => {} },
    getNodeByIdAsync: async (id: string) => nodes.get(id) || null,
    loadFontAsync: async () => {},
    createFrame: () => makeNode("FRAME"),
    createRectangle: () => makeNode("RECTANGLE"),
    createText: () => makeNode("TEXT"),
    variables: {
      getLocalVariableCollectionsAsync: async () => [],
      getVariableByIdAsync: async () => null,
      getVariableCollectionByIdAsync: async () => null,
    },
    teamLibrary: { getAvailableLibraryVariableCollectionsAsync: async () => [] },
  };
}

const solid = (r: number, g: number, b: number) => [{ type: "SOLID", color: { r, g, b }, opacity: 1 }];

// Everything a plugin command could have changed, as plain data.
function snapshotFigma(): string {
  const out: any[] = [];
  for (const node of nodes.values()) {
    const plain: any = {};
    for (const [key, value] of Object.entries(node)) {
      if (typeof value === "function" || key === "parent") continue;
      plain[key] = key === "children" ? (value as any[]).map(c => c.id) : value;
    }
    out.push(plain);
  }
  return JSON.stringify(out);
}

describe("spec sync plan (PR 11c)", () => {
  let dir: string;
  let sent: any[];
  let store: PlanStore;
  let clock: number;

  beforeAll(() => resetVariableIndexesForTests());
  afterAll(() => {
    resetVariableIndexesForTests();
    (globalThis as any).figma = originalFigma;
  });
  beforeEach(() => {
    freshFigma();
    dir = realpathSync(mkdtempSync(join(tmpdir(), "l2f-plan-")));
    sent = [];
    clock = Date.parse("2026-11-12T10:00:00.000Z");
    store = new PlanStore(() => clock);
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  const send = async (command: string, params: any, timeoutMs?: number) => {
    sent.push({ command, params, timeoutMs });
    if (command === "export_spec") return exportSpec(params);
    if (command === "read_spec_nodes") return readSpecNodes(params);
    throw new Error("unexpected command " + command);
  };
  const opts = (extra: any = {}) => ({
    env: { L2F_SPEC_DIR: dir }, userFileKey: () => undefined, channel: () => "chan-1", planStore: store,
    now: () => new Date(clock), ...extra,
  });
  const readJson = (path: string) => JSON.parse(readFileSync(path, "utf8"));

  // A small design: an auto-layout card holding a title, a body text, a swatch,
  // a nested HUG row with two dots, and a group.
  async function seed() {
    const result: any = await createNodeTree({
      tree: {
        type: "frame", name: "Card", width: 320, height: 240, layoutMode: "VERTICAL", itemSpacing: 8, fillColor: "#FFFFFF",
        children: [
          { type: "text", name: "Title", text: "Hello", fontSize: 20 },
          { type: "text", name: "Body", text: "Some words" },
          { type: "rectangle", name: "Swatch", width: 40, height: 40, fillColor: "#FF0000" },
          { type: "frame", name: "Row", layoutMode: "HORIZONTAL", layoutSizingHorizontal: "HUG", layoutSizingVertical: "HUG",
            children: [{ type: "rectangle", name: "DotA", width: 4, height: 4 }, { type: "rectangle", name: "DotB", width: 4, height: 4 }] },
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

  async function pull(root: any, extra: any = {}) {
    return pullSpec({ nodeId: root.id, path: "card.l2f.json", ...extra }, send as any, opts());
  }

  // Edit the Spec on disk: `edit` receives the parsed file and a finder by name.
  function editSpec(path: string, edit: (spec: any, find: (name: string) => any) => void) {
    const spec = readJson(path);
    const find = (name: string, node: any = spec.tree): any => {
      if (node.name === name) return node;
      for (const child of node.children || []) {
        const hit = find(name, child);
        if (hit) return hit;
      }
      return null;
    };
    edit(spec, n => find(n));
    writeFileSync(path, JSON.stringify(spec, null, 2));
  }

  const plan = (path = "card.l2f.json", extra: any = {}) => planSpec({ path }, send as any, opts(extra));

  describe("properties, three ways (one test per row)", () => {
    test("same | same: unchanged, nothing planned", async () => {
      const { root } = await seed();
      await pull(root);
      const result = await plan();
      expect(result.counts).toMatchObject({ operations: 0, drift: 0, conflicts: 0, converged: 0 });
      expect(result.note).toContain("nothing to apply");
    });

    test("Spec differs | Figma same: an update of that property only", async () => {
      const { root, byName } = await seed();
      const { path } = await pull(root);
      editSpec(path, (_s, find) => { find("Swatch").fillColor = "#00ff00"; });
      const result = await plan();
      expect(result.operations).toEqual([{ op: "update", id: byName("Swatch").id, name: "Swatch", keys: ["fillColor"] }]);
      expect(store.get(result.planId).operations[0]).toMatchObject({ op: "update", nodeType: "rectangle", set: { fillColor: "#00FF00" } });
      expect(result.counts).toMatchObject({ operations: 1, updates: 1, properties: 1, drift: 0, conflicts: 0 });
    });

    test("Spec same | Figma differs: drift, kept as Figma has it, and the note says to pull", async () => {
      const { root, byName } = await seed();
      await pull(root);
      byName("Swatch").fills = solid(0, 0, 1);
      const result = await plan();
      expect(result.operations).toEqual([]);
      expect(result.drift).toEqual([{ id: byName("Swatch").id, name: "Swatch", kind: "property", keys: ["fillColor"] }]);
      expect(result.note).toContain("pull_spec again");
    });

    test("both differ, Figma equal to the Spec: converged, no operation", async () => {
      const { root, byName } = await seed();
      const { path } = await pull(root);
      editSpec(path, (_s, find) => { find("Swatch").fillColor = "#0000FF"; });
      byName("Swatch").fills = solid(0, 0, 1);
      const result = await plan();
      expect(result.counts).toMatchObject({ operations: 0, drift: 0, conflicts: 0, converged: 1 });
    });

    test("both differ otherwise: a conflict on that property, while other edits on the node still plan", async () => {
      const { root, byName } = await seed();
      const { path } = await pull(root);
      editSpec(path, (_s, find) => { find("Swatch").fillColor = "#00FF00"; find("Swatch").opacity = 0.5; });
      byName("Swatch").fills = solid(0, 0, 1);
      const result = await plan();
      expect(result.conflicts).toEqual([{ id: byName("Swatch").id, name: "Swatch", kind: "property", keys: ["fillColor"] }]);
      expect(store.get(result.planId).operations).toEqual([
        { op: "update", id: byName("Swatch").id, name: "Swatch", nodeType: "rectangle", set: { opacity: 0.5 } },
      ]);
    });
  });

  describe("structure, three ways (one test per row)", () => {
    test("a Spec node with no id: create, carrying its index path and its whole subtree", async () => {
      const { root, byName } = await seed();
      const { path } = await pull(root);
      editSpec(path, (_s, find) => {
        find("Row").children.splice(1, 0, { type: "frame", name: "New", children: [{ type: "text", text: "Inner" }] });
      });
      const result = await plan();
      const row = byName("Row");
      expect(result.operations).toEqual([{ op: "create", path: [3, 1], parentId: row.id, index: 1, type: "frame", name: "New" }]);
      const op: any = store.get(result.planId).operations[0];
      expect(op.after).toBe(byName("DotA").id);
      expect(op.node).toEqual({ type: "frame", name: "New", children: [{ type: "text", text: "Inner", textAutoResize: "WIDTH_AND_HEIGHT" }] });
      expect(store.get(result.planId).expectedHashes[row.id]).toBeDefined();
    });

    test("Spec reparents a node, Figma matches the base: move", async () => {
      const { root, byName } = await seed();
      const { path } = await pull(root);
      editSpec(path, (spec, find) => {
        const swatch = spec.tree.children.splice(2, 1)[0];
        find("Row").children.push(swatch);
      });
      const result = await plan();
      expect(result.operations).toEqual([
        { op: "move", id: byName("Swatch").id, name: "Swatch", fromParentId: root.id, parentId: byName("Row").id, index: 2 },
      ]);
      const stored = store.get(result.planId);
      expect(Object.keys(stored.expectedHashes).sort()).toEqual([root.id, byName("Swatch").id, byName("Row").id].sort());
    });

    test("Figma reordered, the Spec did not: drift", async () => {
      const { root, byName } = await seed();
      await pull(root);
      root.insertChild(0, byName("Body"));
      const result = await plan();
      expect(result.operations).toEqual([]);
      // Either sibling is a minimal account of the swap; exactly one is reported.
      expect(result.drift).toEqual([expect.objectContaining({ kind: "structure", detail: "reordered in Figma" })]);
      expect([byName("Title").id, byName("Body").id]).toContain(result.drift[0].id);
    });

    test("both moved the node, to different places: conflict", async () => {
      const { root, byName } = await seed();
      const { path } = await pull(root);
      editSpec(path, (spec, find) => { find("Row").children.push(spec.tree.children.splice(2, 1)[0]); });
      root.insertChild(0, byName("Swatch"));
      const result = await plan();
      expect(result.operations).toEqual([]);
      expect(result.conflicts).toEqual([{ id: byName("Swatch").id, name: "Swatch", kind: "structure", detail: "moved in both the Spec and Figma, to different places" }]);
    });

    test("both moved the node to the same place: converged", async () => {
      const { root, byName } = await seed();
      const { path } = await pull(root);
      editSpec(path, (spec, find) => { find("Row").children.push(spec.tree.children.splice(2, 1)[0]); });
      byName("Row").appendChild(byName("Swatch"));
      const result = await plan();
      expect(result.counts).toMatchObject({ operations: 0, conflicts: 0, converged: 1 });
    });

    test("id deleted from the Spec, unchanged in Figma: remove (topmost only)", async () => {
      const { root, byName } = await seed();
      const { path } = await pull(root);
      editSpec(path, (_s, find) => { const row = find("Row"); row.children = []; });
      editSpec(path, (spec) => { spec.tree.children = spec.tree.children.filter((c: any) => c.name !== "Row"); });
      const result = await plan();
      expect(result.operations).toEqual([{ op: "remove", id: byName("Row").id, name: "Row" }]);
      const stored: any = store.get(result.planId);
      expect(stored.operations[0].parentId).toBe(root.id);
      // The dots travel with Row; their live state is recorded for the staleness check.
      expect(Object.keys(stored.expectedHashes).sort()).toEqual([root.id, byName("Row").id, byName("DotA").id, byName("DotB").id].sort());
    });

    test("id deleted from the Spec, changed in Figma since the pull: conflict, not removed", async () => {
      const { root, byName } = await seed();
      const { path } = await pull(root);
      editSpec(path, (spec) => { spec.tree.children = spec.tree.children.filter((c: any) => c.name !== "Swatch"); });
      byName("Swatch").opacity = 0.3;
      const result = await plan();
      expect(result.operations).toEqual([]);
      expect(result.conflicts).toEqual([{ id: byName("Swatch").id, name: "Swatch", kind: "remove", detail: "not removed: it changed in Figma since the pull" }]);
    });

    test("id deleted from the Spec, a descendant changed or a node added inside it in Figma: conflict", async () => {
      const { root, byName } = await seed();
      const { path } = await pull(root);
      editSpec(path, (spec) => { spec.tree.children = spec.tree.children.filter((c: any) => c.name !== "Row"); });
      makeNode("RECTANGLE", { name: "Added" }, byName("Row"));
      const result = await plan();
      expect(result.operations).toEqual([]);
      expect(result.conflicts[0]).toMatchObject({ id: byName("Row").id, kind: "remove", detail: "not removed: nodes were added inside it in Figma" });
    });

    test("id deleted from the Spec, already gone from Figma: converged", async () => {
      const { root, byName } = await seed();
      const { path } = await pull(root);
      editSpec(path, (spec) => { spec.tree.children = spec.tree.children.filter((c: any) => c.name !== "Swatch"); });
      byName("Swatch").remove();
      const result = await plan();
      expect(result.counts).toMatchObject({ operations: 0, conflicts: 0, drift: 0, converged: 1 });
    });

    test("id in the Spec, gone from Figma: missing, reported as a conflict", async () => {
      const { root, byName } = await seed();
      await pull(root);
      const id = byName("Body").id;
      byName("Body").remove();
      const result = await plan();
      expect(result.operations).toEqual([]);
      expect(result.conflicts).toEqual([{ id, name: "Body", kind: "missing", detail: "no longer in the live subtree (deleted, or moved out of it, in Figma)" }]);
    });

    test("a node added in Figma by hand: left alone, reported as drift; positions are counted against live children", async () => {
      const { root, byName } = await seed();
      const { path } = await pull(root);
      const added = makeNode("RECTANGLE", { name: "Hand" }, null);
      root.insertChild(0, added);
      editSpec(path, (_s, find) => { find("Title").text = "Hi"; });
      const result = await plan();
      expect(result.operations).toEqual([{ op: "update", id: byName("Title").id, name: "Title", keys: ["text"] }]);
      expect(result.drift).toEqual([{ id: added.id, name: "Hand", kind: "added", detail: `added in Figma under ${root.id}` }]);
      // The hand-added sibling shifts every index but is no reorder of the known ones.
      expect(result.drift.filter(d => d.kind === "structure")).toEqual([]);
    });

    test("an edit to an OpaqueNode other than its place is an error naming the node", async () => {
      const { root, group } = await seed();
      const { path } = await pull(root);
      editSpec(path, (_s, find) => { find("Logo").name = "Renamed"; });
      await expect(plan()).rejects.toThrow(`(${group.id}): "Logo" is an OpaqueNode`);
      editSpec(path, (_s, find) => { find("Renamed").name = "Logo"; find("Logo").children = [{ type: "rectangle" }]; });
      await expect(plan()).rejects.toThrow("only a frame can have children");
      expect(sent.filter(s => s.command === "read_spec_nodes")).toEqual([]);
    });

    test("an OpaqueNode can be moved, but removing it is a conflict, never an operation", async () => {
      const { root, byName, group } = await seed();
      const { path } = await pull(root);
      editSpec(path, (spec, find) => { find("Row").children.unshift(spec.tree.children.pop()); });
      let result = await plan();
      expect(result.operations).toEqual([{ op: "move", id: group.id, name: "Logo", fromParentId: root.id, parentId: byName("Row").id, index: 0 }]);
      editSpec(path, (_s, find) => { find("Row").children.shift(); });
      result = await plan();
      expect(result.operations).toEqual([]);
      expect(result.counts.removes).toBe(0);
      expect(result.conflicts).toEqual([expect.objectContaining({ id: group.id, kind: "remove", detail: expect.stringContaining("it is an OpaqueNode (unsupported type)") })]);
    });

    test("any operation on an id containing ';' is an error", async () => {
      const { root } = await seed();
      const { path, lockPath } = await pull(root);
      const lock = readJson(lockPath);
      // Even if a lock somehow knew such an id, the Spec may not carry it.
      lock.nodes["I5:1;2:3"] = { props: { type: "rectangle", name: "Inner" }, propsHash: "x", parentId: root.id, children: [] };
      writeFileSync(lockPath, JSON.stringify(lock));
      editSpec(path, (spec) => { spec.tree.children.push({ id: "I5:1;2:3", type: "rectangle", name: "Inner" }); });
      await expect(plan()).rejects.toThrow("(I5:1;2:3): nodes inside an instance cannot be edited");
    });
  });

  describe("rejections before Figma is asked", () => {
    test("duplicate id, unknown id, changed type and changed header are each named", async () => {
      const { root, byName } = await seed();
      const { path } = await pull(root);
      const pristine = readFileSync(path, "utf8");
      editSpec(path, (spec, find) => { spec.tree.children.push({ ...find("Swatch") }); });
      await expect(plan()).rejects.toThrow(`(${byName("Swatch").id}): duplicate id`);
      writeFileSync(path, pristine);
      editSpec(path, (spec) => { spec.tree.children.push({ id: "99:99", type: "rectangle" }); });
      await expect(plan()).rejects.toThrow("(99:99): the SpecLock does not know this id");
      writeFileSync(path, pristine);
      editSpec(path, (_s, find) => { find("Swatch").type = "frame"; });
      await expect(plan()).rejects.toThrow("type changed from rectangle to frame");
      writeFileSync(path, pristine);
      editSpec(path, (spec) => { spec.pageId = "7:7"; });
      await expect(plan()).rejects.toThrow("header pageId");
      expect(sent.filter(s => s.command === "read_spec_nodes")).toEqual([]);
    });

    test("a key the node type cannot write is an error, not a silent no-op", async () => {
      const { root, byName, group } = await seed();
      const { path } = await pull(root);
      const pristine = readFileSync(path, "utf8");
      editSpec(path, (_s, find) => { find("Swatch").bogus = 1; find("Swatch").fontSize = 12; });
      await expect(plan()).rejects.toThrow(`(${byName("Swatch").id}): bogus, fontSize cannot be written on a rectangle node`);
      writeFileSync(path, pristine);
      editSpec(path, (_s, find) => { find("Logo").fillColor = "#FF0000"; });
      await expect(plan()).rejects.toThrow(`(${group.id}): fillColor cannot be written on a $opaque node`);
    });

    test("an unfinished apply (pendingApply) refuses and says to pull", async () => {
      const { root } = await seed();
      const { lockPath } = await pull(root);
      writeFileSync(lockPath, JSON.stringify({ ...readJson(lockPath), pendingApply: "plan-old" }));
      await expect(plan()).rejects.toThrow(/plan plan-old.*Pull again/);
    });

    test("a missing SpecLock or a broken Spec is a clear error", async () => {
      const { root } = await seed();
      const { path, lockPath } = await pull(root);
      const pristine = readFileSync(path, "utf8");
      writeFileSync(path, "{ not json");
      await expect(plan()).rejects.toThrow("is not valid JSON");
      writeFileSync(path, pristine);
      rmSync(lockPath);
      await expect(plan()).rejects.toThrow("does not exist. Run pull_spec first");
    });

    test("a different connected file is refused", async () => {
      const { root } = await seed();
      await pull(root);
      (globalThis as any).figma.root = { name: "Copy of Test file" };
      await expect(plan()).rejects.toThrow("Wrong file");
    });
  });

  describe("truncation never produces deletions", () => {
    async function wide() {
      const root = makeNode("FRAME", { name: "Root" }, page);
      const kids = [0, 1].map(i => makeNode("FRAME", { name: `K${i}` }, root));
      kids.forEach((k, i) => [0, 1, 2].forEach(j => makeNode("RECTANGLE", { name: `K${i}R${j}` }, k)));
      return { root, kids };
    }

    test("a node the pull cut off stays opaque in the read, even though plan reads with the largest budget", async () => {
      const { root, kids } = await wide();
      // Breadth-first: Root, K0, K1 and K0's three children are read; K1's children are cut off.
      const { lockPath } = await pullSpec({ nodeId: root.id, path: "w.l2f.json", maxNodes: 6 }, send as any, opts());
      const cut = kids[1].children.map((c: any) => c.id);
      for (const id of cut) expect(readJson(lockPath).nodes[id].props).toMatchObject({ truncated: true, reason: "node budget" });
      const result = await plan("w.l2f.json");
      expect(result.counts).toMatchObject({ operations: 0, drift: 0, conflicts: 0 });
      const read = sent.find(s => s.command === "read_spec_nodes");
      expect(read.params).toMatchObject({ truncated: Object.fromEntries(cut.map((id: string) => [id, "node budget"])), maxNodes: 10000, maxDepth: 100 });
      expect(read.timeoutMs).toBe(READ_TIMEOUT_MS);
    });

    test("a truncated OpaqueNode deleted from the Spec is never removed", async () => {
      const { root, kids } = await wide();
      const { path } = await pullSpec({ nodeId: root.id, path: "w.l2f.json", maxNodes: 6 }, send as any, opts());
      editSpec(path, (spec) => { spec.tree.children[1].children.pop(); }); // a truncated placeholder
      let result = await plan("w.l2f.json");
      expect(result.counts.removes).toBe(0);
      expect(result.conflicts).toEqual([expect.objectContaining({ id: kids[1].children[2].id, kind: "unread" })]);
      editSpec(path, (spec) => { spec.tree.children.pop(); }); // K1, which holds the other placeholders
      result = await plan("w.l2f.json");
      expect(result.counts.removes).toBe(0);
      expect(result.conflicts).toEqual([expect.objectContaining({ id: kids[1].id, kind: "unread" })]);
    });

    test("a node the read newly cut off: nothing below it is removed or missing, and deleting it is refused", async () => {
      const { root, kids } = await wide();
      const { path } = await pullSpec({ nodeId: root.id, path: "w.l2f.json" }, send as any, opts());
      // Plan's read uses the largest budget; simulate the budget running out under K1.
      const realSend = send;
      const tight = async (command: string, params: any, timeoutMs?: number) =>
        realSend(command, command === "read_spec_nodes" ? { ...params, maxNodes: 6 } : params, timeoutMs);
      editSpec(path, (spec) => { spec.tree.children[1].children = []; });
      let result = await planSpec({ path: "w.l2f.json" }, tight as any, opts());
      expect(result.operations).toEqual([]);
      expect(result.counts.removes).toBe(0);
      expect(result.counts.unread).toBe(3); // K1's three children: breadth-first reads K1 itself
      expect(result.conflicts.every(c => c.kind === "unread")).toBe(true);
      expect(result.conflicts.map(c => c.kind)).not.toContain("missing");
      editSpec(path, (spec) => { spec.tree.children.pop(); });
      result = await planSpec({ path: "w.l2f.json" }, tight as any, opts());
      expect(result.operations).toEqual([]);
      expect(result.conflicts).toEqual([expect.objectContaining({ id: kids[1].id, kind: "unread" })]);
    });
  });

  describe("named cases", () => {
    test("reordering siblings yields one move and no update on the parent", async () => {
      const { root, byName } = await seed();
      const { path } = await pull(root);
      editSpec(path, (spec) => { const [a, b] = spec.tree.children; spec.tree.children[0] = b; spec.tree.children[1] = a; });
      const result = await plan();
      expect(result.counts).toMatchObject({ operations: 1, moves: 1, updates: 0, drift: 0 });
      expect(result.operations[0]).toMatchObject({ op: "move", parentId: root.id });
      expect([byName("Title").id, byName("Body").id]).toContain(result.operations[0].id as string);
    });

    test("a text edit under a HUG parent yields one update and no drift on its ancestors", async () => {
      const result: any = await createNodeTree({
        tree: { type: "frame", name: "Outer", layoutMode: "VERTICAL", layoutSizingVertical: "HUG", children: [
          { type: "frame", name: "Chip", layoutMode: "HORIZONTAL", layoutSizingHorizontal: "HUG", layoutSizingVertical: "HUG",
            children: [{ type: "text", name: "Label", text: "Short" }] },
        ] },
      });
      const root = nodes.get(result.nodes[0].id);
      page.appendChild(root);
      const { path } = await pull(root);
      editSpec(path, (_s, find) => { find("Label").text = "A much longer label"; });
      // Figma's HUG reflow already happened, as it would after a hand edit elsewhere: sizes are derived, not compared.
      // Only HUG axes grow: Chip's width and height, Outer's height.
      nodes.forEach(n => {
        if (n.name === "Chip") { n.width += 50; n.height += 20; }
        if (n.name === "Outer") n.height += 20;
      });
      const planned = await plan();
      expect(planned.operations).toEqual([{ op: "update", id: expect.any(String), name: "Label", keys: ["text"] }]);
      expect(planned.counts).toMatchObject({ operations: 1, drift: 0, conflicts: 0 });
    });

    test("an update naming width alone is completed with the live height", async () => {
      const { root, byName } = await seed();
      const { path } = await pull(root);
      editSpec(path, (_s, find) => { find("Swatch").width = 64; });
      const result = await plan();
      expect(result.operations).toEqual([{ op: "update", id: byName("Swatch").id, name: "Swatch", keys: ["width"] }]);
      expect(store.get(result.planId).operations[0]).toMatchObject({ set: { width: 64, height: 40 }, fromLive: ["height"] });
      expect(result.counts.properties).toBe(1);
      expect(sent.find(s => s.command === "read_spec_nodes").params.sizeIds).toEqual([byName("Swatch").id]);
    });

    test("a property deleted from the Spec is written back to its default; one left out because it is now derived is not", async () => {
      const { root, byName } = await seed();
      const { path } = await pull(root);
      editSpec(path, (_s, find) => {
        delete find("Swatch").fillColor;             // base had #FF0000 -> back to a new rectangle's #D9D9D9
        find("Card").layoutSizingHorizontal = "HUG"; // makes the base width derived
        delete find("Card").width;
      });
      const result = await plan();
      const ops = store.get(result.planId).operations;
      expect(ops).toContainEqual(expect.objectContaining({ id: byName("Swatch").id, set: { fillColor: "#D9D9D9" } }));
      expect(ops).toContainEqual(expect.objectContaining({ id: root.id, set: { layoutSizingHorizontal: "HUG" } }));
    });

    test("an expired or unknown planId is an error, never an empty plan", async () => {
      const { root } = await seed();
      await pull(root);
      const result = await plan();
      expect(store.get(result.planId).planId).toBe(result.planId);
      clock += PLAN_LIMITS.ttlMs + 1;
      expect(() => store.get(result.planId)).toThrow(`Plan ${result.planId} has expired or is unknown`);
      expect(() => store.get("plan-nope")).toThrow("has expired or is unknown");
      expect(result.expiresAt).toBe(new Date(Date.parse("2026-11-12T10:00:00.000Z") + PLAN_LIMITS.ttlMs).toISOString());
    });
  });

  describe("value forms", () => {
    test("a bound colour compares equal as \"$var:Name\" or {\"$var\": Name} at full opacity", () => {
      const tree = { id: "1:1", type: "frame", name: "F", fillColor: "$var:Colors/Primary", children: [] };
      const lock: any = { l2fLock: 1, fileKey: null, fileName: "f", pageId: "0:1", rootId: "1:1", pulledAt: "", specHash: "", supersededFrameId: null, pendingApply: null, nodes: lockNodesFromTree(tree, "0:1") };
      const spec: any = { l2fSpec: 1, fileKey: null, fileName: "f", pageId: "0:1", rootId: "1:1", tree: { ...tree, fillColor: { $var: "Colors/Primary", opacity: 1 } } };
      const live: any = { rootId: "1:1", rootParentId: "0:1", rootParentLayoutMode: null, truncated: false, nodes: { "1:1": { propsHash: lock.nodes["1:1"].propsHash, parentId: "0:1", children: [] } } };
      const body = computePlan({ spec, lock, live, prepared: prepareSpec(spec, lock) });
      expect(body.counts).toMatchObject({ operations: 0, drift: 0, conflicts: 0 });
    });

    test("a SpecLock that records pathHash compares the Spec's pathData by hash, and the update carries pathData", async () => {
      const root = makeNode("FRAME", { name: "Icons" }, page);
      const icon = makeNode("VECTOR", { name: "Icon", vectorPaths: [{ windingRule: "NONZERO", data: "M 0 0 L 10 10" }], vectorNetwork: { vertices: [{}], segments: [] } }, root);
      const { path, lockPath } = await pullSpec({ nodeId: root.id, path: "v.l2f.json" }, send as any, opts());
      // The SpecLock stores lockProps(props): pathHash, never the path.
      const stored = readJson(lockPath).nodes[icon.id];
      expect(stored.props.pathData).toBeUndefined();
      expect(stored.props.pathHash).toBe(hashString(readJson(path).tree.children[0].pathData));
      expect(stored.propsHash).toBe(hashProps(stored.props));
      let result = await plan("v.l2f.json");
      expect(result.counts).toMatchObject({ operations: 0, drift: 0, conflicts: 0 });
      editSpec(path, (_s, find) => { find("Icon").pathData = "M 0 0 L 20 20"; });
      result = await plan("v.l2f.json");
      expect(result.operations).toEqual([{ op: "update", id: icon.id, name: "Icon", keys: ["pathData"] }]);
      expect(store.get(result.planId).operations[0]).toMatchObject({ set: { pathData: "M 0 0 L 20 20" } });
    });
  });

  // PR 11b's final Spec format, checked through computePlan directly: base,
  // Spec and live are written as Spec trees and turned into a SpecLock and a
  // live read the way pull_spec and read_spec_nodes build them.
  describe("PR 11b's Spec format", () => {
    const header = { fileKey: null, fileName: "f", pageId: "0:1", rootId: "1:1" };
    const lockOf = (tree: any): any => ({
      l2fLock: 1, ...header, pulledAt: "", specHash: "", supersededFrameId: null, pendingApply: null,
      nodes: lockNodesFromTree(normalizeSpecTree(tree), "0:1"),
    });
    const liveOf = (tree: any): any => {
      const entries = lockNodesFromTree(normalizeSpecTree(tree), "0:1");
      const out: any = {};
      for (const [id, e] of Object.entries(entries)) out[id] = { propsHash: e.propsHash, parentId: e.parentId, children: e.children, props: e.props };
      return { ...header, rootParentId: "0:1", rootParentLayoutMode: null, truncated: false, nodeCount: Object.keys(out).length, nodes: out };
    };
    const clone = (t: any) => JSON.parse(JSON.stringify(t));
    // Plan `spec` against `base`, with Figma at `live` (default: unchanged since the pull).
    const threeWay = (base: any, spec: any, live: any = base) => {
      const lock = lockOf(base);
      const file: any = { l2fSpec: 1, ...header, tree: spec };
      return computePlan({ spec: file, lock, live: liveOf(live), prepared: prepareSpec(file, lock) });
    };
    const card = () => ({
      id: "1:1", type: "frame", name: "Card", x: 0, y: 0, width: 300, height: 200, children: [
        { id: "2:1", type: "rectangle", name: "Swatch", x: 10, y: 10, width: 40, height: 40 },
        { id: "3:1", type: "text", text: "Hello", x: 10, y: 60, textAutoResize: "WIDTH_AND_HEIGHT" },
      ],
    });

    test("keys are checked against SPEC_VOCABULARY per type; visible is in every type's", () => {
      const spec = clone(card());
      spec.children[0].visible = false;
      expect(threeWay(card(), spec).operations).toEqual([{ op: "update", id: "2:1", name: "Swatch", nodeType: "rectangle", set: { visible: false } }]);
      spec.children[0].fontSize = 12;
      expect(() => threeWay(card(), spec)).toThrow("tree.children[0] (2:1): fontSize cannot be written on a rectangle node");
      const instance = { id: "1:1", type: "instance", name: "Btn", componentKey: "k", x: 0, y: 0, width: 80, height: 40 };
      expect(() => threeWay(instance, { ...instance, fillColor: "#FF0000" })).toThrow("fillColor cannot be written on a instance node");
    });

    test("a value the write path cannot take is a plan error, never a silent reset to the default", () => {
      const base = card();
      base.children[0].fillColor = "#FF0000";
      for (const [value, message] of [[{ foo: 1 }, "is not a colour"], [null, "is null"]] as const) {
        const spec = clone(base);
        spec.children[0].fillColor = value;
        expect(() => threeWay(base, spec)).toThrow(message);
      }
      const spec = clone(base);
      spec.children[1].fontSize = 13.5;
      expect(() => threeWay(base, spec)).toThrow("fontSize 13.5 must be a whole number of pixels");
    });

    test("bound paints use 11b's canonical forms, opacity included", () => {
      const base = card();
      base.children[0].fillColor = { $var: "Colors/Primary", opacity: 0.5 };
      const same = clone(base);
      same.children[0].fillColor = { $var: "$var:Colors/Primary", opacity: 0.5 };
      expect(threeWay(base, same).counts).toMatchObject({ operations: 0, drift: 0, conflicts: 0 });
      const full = clone(base);
      full.children[0].fillColor = { $var: "Colors/Primary", opacity: 1 };
      expect(threeWay(base, full).operations).toEqual([expect.objectContaining({ id: "2:1", set: { fillColor: "$var:Colors/Primary" } })]);
      const lighter = clone(base);
      lighter.children[0].fillColor = { $var: "Colors/Primary", opacity: 0.3 };
      expect(threeWay(base, lighter).operations).toEqual([expect.objectContaining({ id: "2:1", set: { fillColor: { $var: "Colors/Primary", opacity: 0.3 } } })]);
    });

    test("a variant instance: a VARIANT value is a property update; its componentSetKey cannot be deleted", () => {
      const base = {
        id: "1:1", type: "frame", name: "Card", x: 0, y: 0, width: 300, height: 200, children: [
          { id: "4:1", type: "instance", name: "Pay", componentSetKey: "set-key", x: 0, y: 0, width: 120, height: 48, properties: { Size: "Large", "Label#4:1": "Pay" } },
        ],
      };
      const spec = clone(base);
      spec.children[0].properties.Size = "Small";
      expect(threeWay(base, spec).operations).toEqual([
        expect.objectContaining({ op: "update", id: "4:1", nodeType: "instance", set: { properties: { Size: "Small", "Label#4:1": "Pay" } } }),
      ]);
      delete spec.children[0].componentSetKey;
      expect(() => threeWay(base, spec)).toThrow("(4:1): componentSetKey cannot be removed");
      const local = clone(base);
      delete local.children[0].componentSetKey;
      (local.children[0] as any).componentSetId = "7:1";
      expect(threeWay(local, clone(local)).counts.operations).toBe(0);
    });

    test("OpaqueNodes carry reason: editing it is an error; removing one, or a subtree holding one, is a conflict", () => {
      const base = card();
      base.children.push({ id: "5:1", type: "frame", name: "Holder", x: 0, y: 100, width: 50, height: 50, children: [
        { id: "6:1", type: "$opaque", name: "Logo", nodeType: "GROUP", reason: "unsupported type" },
      ] } as any);
      expect(threeWay(base, clone(base)).counts).toMatchObject({ operations: 0, drift: 0, conflicts: 0 });
      const edited = clone(base);
      edited.children[2].children[0].reason = "rotated";
      expect(() => threeWay(base, edited)).toThrow('(6:1): "Logo" is an OpaqueNode; it can only be moved or reordered');
      const dropHolder = clone(base);
      dropHolder.children.pop();
      let body = threeWay(base, dropHolder);
      expect(body.operations).toEqual([]);
      expect(body.conflicts).toEqual([expect.objectContaining({ id: "5:1", kind: "remove", detail: expect.stringContaining("it contains 6:1, which is an OpaqueNode") })]);
      const dropLogo = clone(base);
      dropLogo.children[2].children = [];
      body = threeWay(base, dropLogo);
      expect(body.operations).toEqual([]);
      expect(body.conflicts).toEqual([expect.objectContaining({ id: "6:1", kind: "remove" })]);
    });

    test("a truncated placeholder the live read cut off for another budget is not drift", () => {
      const base = card();
      base.children.push({ id: "7:1", type: "$opaque", name: "Deep", nodeType: "FRAME", truncated: true, reason: "node budget" } as any);
      const live = clone(base);
      live.children[2].reason = "byte budget";
      expect(threeWay(base, clone(base), live).counts).toMatchObject({ operations: 0, drift: 0, conflicts: 0 });
      live.children[2].name = "Renamed";
      expect(threeWay(base, clone(base), live).drift).toEqual([expect.objectContaining({ id: "7:1", keys: ["name"] })]);
    });

    test("text named by its text (no name) is not a 'no default' error; deleting a real name is", () => {
      const base = card();
      expect(threeWay(base, clone(base)).counts).toMatchObject({ operations: 0, drift: 0, conflicts: 0 });
      const renamed = clone(base);
      renamed.children[1].name = "Greeting";
      const drifted = threeWay(base, clone(base), renamed);
      expect(drifted.operations).toEqual([]);
      expect(drifted.drift).toEqual([expect.objectContaining({ id: "3:1", kind: "property", keys: ["name"] })]);
      const edited = clone(base);
      edited.children[1].text = "Hi";
      expect(threeWay(base, edited).operations).toEqual([expect.objectContaining({ id: "3:1", set: { text: "Hi" } })]);
      expect(() => threeWay(renamed, clone(base))).toThrow("(3:1): name cannot be removed; set the value you want instead (a text node is named by its text");
    });

    test("SPEC_DEFAULTS and NEVER_DROPPED: no spurious resets, and turning auto-layout on writes create's padding", () => {
      // White frame, #D9D9D9 rectangle, visible: all absent, all defaults; an
      // unrelated edit plans nothing else.
      const spec = clone(card());
      spec.children[0].cornerRadius = 4;
      expect(threeWay(card(), spec).operations).toEqual([expect.objectContaining({ id: "2:1", set: { cornerRadius: 4 } })]);
      // x/y kept at 0 (NEVER_DROPPED) compare equal to a Spec that keeps them.
      expect(threeWay(card(), clone(card())).counts.operations).toBe(0);
      // Turning auto-layout on: the children's x/y become derived (not reset),
      // and padding/spacing absent from the Spec mean create's defaults, which
      // Figma would not give (it keeps padding 0), so they are written.
      const auto = clone(card());
      auto.layoutMode = "VERTICAL";
      const body = threeWay(card(), auto);
      expect(body.operations).toEqual([expect.objectContaining({
        id: "1:1", set: { layoutMode: "VERTICAL", paddingTop: 10, paddingRight: 10, paddingBottom: 10, paddingLeft: 10, itemSpacing: 0, itemReverseZIndex: true },
      })]);
      // Deleting a non-default fill writes the type's default, not "no paint".
      const base = card();
      (base as any).fillColor = "#F7F7F7";
      const noFill = clone(base);
      delete noFill.fillColor;
      expect(threeWay(base, noFill).operations).toEqual([expect.objectContaining({ id: "1:1", set: { fillColor: "#FFFFFF" } })]);
    });
  });

  describe("the Plan", () => {
    test("records an explicit planId, the Spec hash, the channel, the target and the live hashes of touched nodes", async () => {
      const { root, byName } = await seed();
      const { path } = await pull(root);
      editSpec(path, (_s, find) => { find("Title").text = "Changed"; });
      const first = await plan();
      const second = await plan();
      expect(first.planId).toMatch(/^plan-[0-9a-f-]{36}$/);
      expect(second.planId).not.toBe(first.planId);
      const stored = store.get(first.planId);
      expect(stored).toMatchObject({
        l2fPlan: 1, specPath: path, specHash: specHash(readJson(path)), channel: "chan-1",
        target: { fileKey: null, fileName: "Test file", pageId: page.id, rootId: root.id },
      });
      const title = byName("Title");
      const lock = readJson(path.replace(".l2f.json", ".l2f.lock.json"));
      expect(stored.expectedHashes).toEqual({ [title.id]: { propsHash: lock.nodes[title.id].propsHash, parentId: root.id, children: [] } });
      expect(stored.lockHash).toBe(specHash(lock));
    });

    test("the store keeps 8 plans, evicting the oldest, and refuses one over 4 MB", async () => {
      const { root } = await seed();
      await pull(root);
      const ids: string[] = [];
      for (let i = 0; i < 9; i++) ids.push((await plan()).planId);
      expect(store.size).toBe(PLAN_LIMITS.maxPlans);
      expect(() => store.get(ids[0])).toThrow("expired or is unknown");
      expect(store.get(ids[8]).planId).toBe(ids[8]);
      const small = new PlanStore(() => clock, { ...PLAN_LIMITS, maxBytes: 100 });
      await expect(plan("card.l2f.json", { planStore: small })).rejects.toThrow("over the");
      expect(PLAN_LIMITS).toEqual({ maxPlans: 8, ttlMs: 1_800_000, maxBytes: 4 * 1024 * 1024 });
    });

    test("output stays small: at most 100 entries per list, counts complete, the tree never returned", async () => {
      const root = makeNode("FRAME", { name: "Big" }, page);
      for (let i = 0; i < 130; i++) makeNode("RECTANGLE", { name: `R${i}` }, root);
      const { path } = await pullSpec({ nodeId: root.id, path: "big.l2f.json" }, send as any, opts());
      editSpec(path, (spec) => { spec.tree.children.forEach((c: any) => { c.opacity = 0.5; }); });
      const tools: Record<string, any> = {};
      registerSpecTools({ tool: (name: string, _d: string, _s: any, run: any) => { tools[name] = run; } } as any, send as any, opts());
      const response = await tools.plan_spec({ path: "big.l2f.json" });
      const parsed = JSON.parse(response.content[0].text);
      expect(Object.keys(parsed).sort()).toEqual(["conflicts", "counts", "drift", "expiresAt", "operations", "path", "planId", "truncated"]);
      expect(parsed.operations).toHaveLength(PLAN_LIST_LIMIT);
      expect(parsed.counts.updates).toBe(130);
      expect(parsed.truncated).toBe(true);
      expect(store.get(parsed.planId).operations).toHaveLength(130);
      expect(response.content[0].text).not.toContain("\"set\"");
      const failed = await tools.plan_spec({ path: "nowhere.l2f.json" });
      expect(failed.isError).toBe(true);
    });
  });

  describe("writes nothing", () => {
    test("neither Figma nor the Spec directory changes, whatever the plan holds", async () => {
      const { root } = await seed();
      const { path } = await pull(root);
      editSpec(path, (spec, find) => {
        find("Title").text = "New";
        spec.tree.children.reverse();
        spec.tree.children.push({ type: "rectangle", name: "Fresh" });
        spec.tree.children = spec.tree.children.filter((c: any) => c.name !== "Body");
      });
      const files = () => readdirSync(dir).sort().map(f => [f, readFileSync(join(dir, f), "utf8"), statSync(join(dir, f)).mtimeMs]);
      const beforeFiles = files();
      const beforeFigma = snapshotFigma();
      const result = await plan();
      expect(result.counts.operations).toBeGreaterThan(2);
      expect(files()).toEqual(beforeFiles);
      expect(snapshotFigma()).toBe(beforeFigma);
      expect(sent.at(-1).command).toBe("read_spec_nodes");
    });
  });

  describe("read_spec_nodes", () => {
    test("props only for nodes whose hash differs from the base sent in; every node gets hash, parent and children", async () => {
      const { root, byName } = await seed();
      const { lockPath } = await pull(root);
      const lock = readJson(lockPath);
      const baseHashes = Object.fromEntries(Object.entries(lock.nodes).map(([id, n]: any) => [id, n.propsHash]));
      byName("Body").characters = "Edited in Figma";
      const read: any = await readSpecNodes({ rootId: root.id, expect: { fileName: "Test file", pageId: page.id }, baseHashes });
      expect(Object.keys(read.nodes).sort()).toEqual(Object.keys(lock.nodes).sort());
      const withProps = Object.entries(read.nodes).filter(([, n]: any) => n.props).map(([id]) => id);
      expect(withProps).toEqual([byName("Body").id]);
      expect(read.nodes[byName("Body").id].props.text).toBe("Edited in Figma");
      expect(read.nodes[byName("Body").id].propsHash).toBe(hashProps(read.nodes[byName("Body").id].props));
      expect(read.nodes[root.id]).toEqual({ propsHash: lock.nodes[root.id].propsHash, parentId: page.id, children: lock.nodes[root.id].children });
      expect(read).toMatchObject({ rootId: root.id, rootParentId: page.id, rootParentLayoutMode: null, pageId: page.id, truncated: false });
      // No base hashes: every node carries props.
      const all: any = await readSpecNodes({ rootId: root.id, baseHashes: {} });
      expect(Object.values(all.nodes).every((n: any) => n.props)).toBe(true);
    });

    test("is a read in the editor gate, and main.ts routes it", () => {
      expect(() => assertEditorAllowed("read_spec_nodes", "dev")).not.toThrow();
      expect(allowedEditors("read_spec_nodes")).toContain("dev");
      const main = readFileSync("src/llm2figma_plugin/src/main.ts", "utf8");
      expect(main).toMatch(/case "read_spec_nodes":\s*\n\s*return await readSpecNodes\(params\);/);
    });

    test("plan_spec is registered only with L2F_SPEC_SYNC", () => {
      const names = (env: Record<string, string>) => {
        const tools: string[] = [];
        registerWhenEnabled("SPEC_SYNC", registerSpecTools, { tool: (name: string) => tools.push(name) } as any, send as any, env);
        return tools;
      };
      expect(names({})).toEqual([]);
      expect(names({ L2F_SPEC_SYNC: "1" })).toEqual(["pull_spec", "plan_spec"]);
    });
  });

  describe("live done-when, mocked: a larger design with auto-layout, instances and a group", () => {
    test("untouched: zero operations and zero drift; one text and one fill edit: exactly two updates", async () => {
      const main = { id: "comp-btn", key: "btnkey", remote: true, type: "COMPONENT", name: "Button" };
      const root = makeNode("FRAME", { name: "Screen", layoutMode: "VERTICAL", fills: solid(1, 1, 1) }, page);
      for (let s = 0; s < 20; s++) {
        const section = makeNode("FRAME", { name: `Section ${s}`, layoutMode: "HORIZONTAL", layoutSizingVertical: "HUG", itemSpacing: 4 }, root);
        for (let i = 0; i < 4; i++) makeNode("TEXT", { name: `T${s}.${i}`, characters: `Text ${s}.${i}` }, section);
        makeNode("RECTANGLE", { name: `Fill ${s}`, fills: solid(0.2, 0.4, 0.6) }, section);
        makeNode("INSTANCE", { name: `Btn ${s}`, main, componentProperties: { "Label#1:1": { type: "TEXT", value: "Go" } } }, section);
        const group = makeNode("GROUP", { name: `Icon ${s}` }, section);
        makeNode("VECTOR", { name: "Glyph" }, group);
        for (let k = 0; k < 3; k++) makeNode("RECTANGLE", { name: `Pad ${s}.${k}` }, section);
      }
      expect(nodes.size).toBeGreaterThan(200);
      const pulled = await pullSpec({ nodeId: root.id, path: "screen.l2f.json" }, send as any, opts());
      let result = await plan("screen.l2f.json");
      expect(result.counts).toMatchObject({ operations: 0, drift: 0, conflicts: 0 });
      editSpec(pulled.path, (_s, find) => { find("T7.2").text = "Edited"; find("Fill 3").fillColor = "#112233"; });
      result = await plan("screen.l2f.json");
      expect(result.counts).toMatchObject({ operations: 2, updates: 2, properties: 2, drift: 0, conflicts: 0 });
      expect(result.operations.map(o => [o.name, o.keys])).toEqual([["Fill 3", ["fillColor"]], ["T7.2", ["text"]]]);
    });
  });
});
