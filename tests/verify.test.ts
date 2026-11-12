/**
 * Verify A (L2F_VERIFY): resize read-back, assert_contained, snapshot_positions
 * and diff_positions, against a mocked `figma` global. No Figma or relay needed:
 *   bun test tests/verify.test.ts
 */
import { afterAll, beforeEach, describe, expect, test } from "bun:test";
import { walkTree } from "../src/shared/walk";
import { boxOverflow, diffPositionEntries, resizeReadBack } from "../src/shared/verify";
import { assertContained, diffPositions, PositionSnapshotStore, snapshotPositions } from "../src/llm2figma_plugin/src/verify";
import { resizeNode } from "../src/llm2figma_plugin/src/transforms";
import { batchMutate } from "../src/llm2figma_plugin/src/analysis";
import { allowedEditors, assertEditorAllowed } from "../src/llm2figma_plugin/src/editor-gate";
import { registerWhenEnabled } from "../src/shared/flags";
import { registerTools as registerVerifyTools } from "../src/llm2figma_mcp/tools/verify";
import { registerTools as registerLayoutTools } from "../src/llm2figma_mcp/tools/layout";
import { registerTools as registerBatchMutateTools } from "../src/llm2figma_mcp/tools/batch-mutate";

const ON = { L2F_VERIFY: "1" };
const originalFigma = (globalThis as any).figma;
let nodes = new Map<string, any>();
let nextId = 0;

// A node whose absoluteBoundingBox is its parent's box origin plus x/y, which is
// how section and frame children are positioned. `resize` honours minHeight by
// default; tests swap it to simulate other ways Figma applies less.
function makeNode(type: string, geometry: { x?: number; y?: number; width?: number; height?: number } = {}, parent: any = null): any {
  const node: any = {
    id: `${++nextId}:1`, type, name: `${type} ${nextId}`, children: [], rotation: 0,
    x: geometry.x ?? 0, y: geometry.y ?? 0, width: geometry.width ?? 100, height: geometry.height ?? 100,
    parent: null,
    resize(w: number, h: number) {
      this.width = w;
      this.height = typeof this.minHeight === "number" ? Math.max(h, this.minHeight) : h;
    },
    appendChild(child: any) {
      if (child.parent) child.parent.children = child.parent.children.filter((c: any) => c !== child);
      child.parent = this;
      this.children.push(child);
    },
    insertChild(index: number, child: any) { child.parent = this; this.children.splice(index, 0, child); },
    remove() { nodes.delete(this.id); if (this.parent) this.parent.children = this.parent.children.filter((c: any) => c !== this); },
  };
  Object.defineProperty(node, "absoluteBoundingBox", {
    get() {
      if (this.noBox) return null;
      const origin = this.parent && this.parent.absoluteBoundingBox ? this.parent.absoluteBoundingBox : { x: 0, y: 0 };
      return { x: origin.x + this.x, y: origin.y + this.y, width: this.width, height: this.height };
    },
    configurable: true,
  });
  nodes.set(node.id, node);
  if (parent) parent.appendChild(node);
  return node;
}

function capture(register: (server: any) => void) {
  const tools: Record<string, { schema: Record<string, unknown>; run: (args: any) => Promise<any> }> = {};
  register({ tool: (name: string, _description: string, schema: any, run: any) => { tools[name] = { schema, run }; } });
  return tools;
}

const text = (result: any) => result.content[0].text as string;

beforeEach(() => {
  nodes = new Map();
  (globalThis as any).figma = { mixed: Symbol("mixed"), getNodeByIdAsync: async (id: string) => nodes.get(id) || null };
});
afterAll(() => { (globalThis as any).figma = originalFigma; });

describe("walkTree", () => {
  const tree = { id: "a", children: [{ id: "b", children: [{ id: "c", children: [] }] }, { id: "d", children: [] }] };
  test("visits in pre-order with depth and parent", () => {
    const seen: string[] = [];
    const result = walkTree<any>(tree, (n, depth, parent) => { seen.push(`${n.id}${depth}${parent ? parent.id : "-"}`); });
    expect(seen).toEqual(["a0-", "b1a", "c2b", "d1a"]);
    expect(result).toMatchObject({ visited: 4, truncated: false });
  });
  test("the node budget and depth limit set truncated", () => {
    expect(walkTree(tree, () => {}, { maxNodes: 2 })).toMatchObject({ visited: 2, truncated: true });
    expect(walkTree(tree, () => {}, { maxDepth: 1 })).toMatchObject({ visited: 3, truncated: true });
  });
  test("truncatedParents names each node whose child list was cut off", () => {
    const ids = (r: any) => r.truncatedParents.map((n: any) => n.id);
    expect(ids(walkTree<any>(tree, () => {}))).toEqual([]);
    // Budget 2 visits a and b: c (under b) and d (under a) are still queued.
    expect(ids(walkTree<any>(tree, () => {}, { maxNodes: 2 })).sort()).toEqual(["a", "b"]);
    // Depth 1 stops below b, which has a child; d has none, so it is not cut off.
    expect(ids(walkTree<any>(tree, () => {}, { maxDepth: 1 }))).toEqual(["b"]);
    // A visit returning false is a choice, not a truncation.
    expect(ids(walkTree<any>(tree, n => n.id !== "b"))).toEqual([]);
  });
  test("a visit returning false skips children without truncating", () => {
    expect(walkTree<any>(tree, n => n.id !== "b")).toMatchObject({ visited: 3, truncated: false });
  });
});

describe("resize read-back", () => {
  test("a full resize is not partial", () => {
    expect(resizeReadBack({ width: 10, height: 20 }, { width: 10, height: 20 }, {})).toEqual({
      requested: { width: 10, height: 20 }, applied: { width: 10, height: 20 }, partial: false, cause: null,
    });
  });
  test("each cause is named, and an unexplained partial says so", () => {
    expect(resizeReadBack({ width: 10, height: 20 }, { width: 10, height: 50 }, { minHeight: 50 }).cause).toBe("height: minHeight is 50");
    expect(resizeReadBack({ width: 900, height: 20 }, { width: 400, height: 20 }, { maxWidth: 400 }).cause).toBe("width: maxWidth is 400");
    expect(resizeReadBack({ width: 10, height: 20 }, { width: 64, height: 20 }, { layoutSizingHorizontal: "HUG" }).cause).toBe("width: layoutSizingHorizontal is HUG");
    expect(resizeReadBack({ width: 10, height: 20 }, { width: 10, height: 30 }, { layoutSizingVertical: "FILL" }).cause).toBe("height: layoutSizingVertical is FILL");
    expect(resizeReadBack({ width: 10, height: 20 }, { width: 10, height: 18 }, { type: "TEXT", textAutoResize: "HEIGHT" }).cause).toBe("height: textAutoResize is HEIGHT");
    expect(resizeReadBack({ width: 10, height: 20 }, { width: 10, height: 100 }, {}).cause).toContain("height: unexplained");
  });

  test("resize_node reports a height Figma ignored (minHeight)", async () => {
    const node = makeNode("FRAME", { width: 100, height: 200 });
    node.minHeight = 200;
    const result: any = await resizeNode({ nodeId: node.id, width: 300, height: 80 });
    expect(result).toMatchObject({ id: node.id, name: node.name, width: 300, height: 200 });
    expect(result.requested).toEqual({ width: 300, height: 80 });
    expect(result.applied).toEqual({ width: 300, height: 200 });
    expect(result.partial).toBe(true);
    expect(result.cause).toBe("height: minHeight is 200");
  });

  test("a mock that drops the height with no explanation is reported unexplained", async () => {
    const node = makeNode("FRAME", { width: 100, height: 100 });
    node.resize = function (w: number) { this.width = w; };
    const result: any = await resizeNode({ nodeId: node.id, width: 50, height: 60 });
    expect(result.partial).toBe(true);
    expect(result.cause).toContain("height: unexplained");
  });

  test("a HUG axis explains the difference", async () => {
    const node = makeNode("FRAME", { width: 100, height: 40 });
    node.layoutSizingVertical = "HUG";
    node.resize = function (w: number) { this.width = w; };
    const result: any = await resizeNode({ nodeId: node.id, width: 120, height: 90 });
    expect(result.cause).toBe("height: layoutSizingVertical is HUG");
  });

  test("batch_mutate resize keeps its keys and adds the read-back", async () => {
    const ok = makeNode("FRAME");
    const blocked = makeNode("FRAME", { height: 120 });
    blocked.minHeight = 120;
    const result: any = await batchMutate({ operations: [
      { op: "resize", nodeId: ok.id, width: 40, height: 50 },
      { op: "resize", nodeId: blocked.id, width: 40, height: 50 },
    ] });
    expect(result.results[0]).toMatchObject({ success: true, op: "resize", nodeId: ok.id, name: ok.name, width: 40, height: 50, partial: false, cause: null });
    // `width`/`height` stay the requested values, as before; `applied` is what Figma did.
    expect(result.results[1]).toMatchObject({ width: 40, height: 50, applied: { width: 40, height: 120 }, partial: true, cause: "height: minHeight is 120" });
  });
});

describe("resize read-back on the server", () => {
  const partial = { id: "1:1", name: "Card", width: 300, height: 200, requested: { width: 300, height: 80 }, applied: { width: 300, height: 200 }, partial: true, cause: "height: minHeight is 200" };

  test("resize_node output is unchanged with VERIFY off and reports the partial with it on", async () => {
    const send = async () => partial;
    const off = capture(server => registerLayoutTools(server, send as any, {}));
    // The whole tool result is what leaves the server: no read-back key or text when off.
    expect(await off.resize_node.run({ nodeId: "1:1", width: 300, height: 80 }))
      .toEqual({ content: [{ type: "text", text: 'Resized node "Card" to width 300 and height 80' }] });
    const on = capture(server => registerLayoutTools(server, send as any, ON));
    expect(text(await on.resize_node.run({ nodeId: "1:1", width: 300, height: 80 })))
      .toBe('Resized node "Card": requested 300x80, Figma applied 300x200 (partial: height: minHeight is 200)');
    expect(Object.keys(on.resize_node.schema)).toEqual(Object.keys(off.resize_node.schema));
  });

  test("batch_mutate output is unchanged with VERIFY off and lists partial resizes with it on", async () => {
    const send = async () => ({ totalOperations: 1, successCount: 1, failureCount: 0, results: [{ success: true, op: "resize", nodeId: "1:1", ...partial }] });
    const off = capture(server => registerBatchMutateTools(server, send as any, {}));
    const ops = { operations: [{ op: "resize", nodeId: "1:1", width: 300, height: 80 }] };
    expect(await off.batch_mutate.run(ops)).toEqual({ content: [{ type: "text", text: "Batch mutate: 1/1 succeeded" }] });
    const on = capture(server => registerBatchMutateTools(server, send as any, ON));
    expect(text(await on.batch_mutate.run(ops))).toBe(
      'Batch mutate: 1/1 succeeded\n\nResize read-back: 0/1 applied as requested\nPartial:\n- 1:1 "Card": requested 300x80, Figma applied 300x200 (partial: height: minHeight is 200)',
    );
  });

  test("the verify tools register only when L2F_VERIFY is on", () => {
    const names: string[] = [];
    const server = { tool: (name: string) => names.push(name) };
    expect(registerWhenEnabled("VERIFY", registerVerifyTools, server as any, null as any, {})).toBe(false);
    expect(names).toEqual([]);
    expect(registerWhenEnabled("VERIFY", registerVerifyTools, server as any, null as any, ON)).toBe(true);
    expect(names).toEqual(["assert_contained", "snapshot_positions", "diff_positions"]);
  });

  test("a plugin error comes back as a tool error", async () => {
    const tools = capture(server => registerVerifyTools(server, (async () => { throw new Error("Snapshot expired: x"); }) as any));
    const result = await tools.diff_positions.run({ snapshotId: "x" });
    expect(result.isError).toBe(true);
    expect(text(result)).toContain("Snapshot expired");
  });
});

describe("assert_contained", () => {
  test("children inside the parent pass", async () => {
    const parent = makeNode("FRAME", { x: 100, y: 100, width: 400, height: 300 });
    makeNode("RECTANGLE", { x: 10, y: 10, width: 50, height: 50 }, parent);
    const result: any = await assertContained({ parentId: parent.id });
    expect(result).toMatchObject({ contained: true, childCount: 1, placementChecked: false, placementOk: null, parentGrewSinceSnapshot: null });
    expect(result.note).toContain("does not prove placement");
  });

  test("a child outside the parent fails with its overflow", async () => {
    const parent = makeNode("FRAME", { width: 400, height: 300 });
    const child = makeNode("RECTANGLE", { x: 380, y: 10, width: 50, height: 50 }, parent);
    const result: any = await assertContained({ parentId: parent.id });
    expect(result.contained).toBe(false);
    expect(result.outside).toEqual([{ id: child.id, name: child.name, box: { x: 380, y: 10, width: 50, height: 50 }, overflow: { left: -380, top: -10, right: 30, bottom: -240 } }]);
  });

  test("a child with no box is unmeasurable, not passed", async () => {
    const parent = makeNode("FRAME", { width: 400, height: 300 });
    const child = makeNode("GROUP", {}, parent);
    child.noBox = true;
    const result: any = await assertContained({ parentId: parent.id });
    expect(result.contained).toBe(false);
    expect(result.unmeasurable).toEqual([{ id: child.id, name: child.name }]);
  });

  test("rotated children are noted", async () => {
    const parent = makeNode("FRAME", { width: 400, height: 300 });
    const child = makeNode("RECTANGLE", { x: 10, y: 10, width: 20, height: 20 }, parent);
    child.rotation = 45;
    const result: any = await assertContained({ parentId: parent.id });
    expect(result.contained).toBe(true);
    expect(result.rotated).toEqual([{ id: child.id, name: child.name, rotation: 45 }]);
  });

  test("the 0.5px tolerance edge", () => {
    const parent = { x: 0, y: 0, width: 100, height: 100 };
    expect(boxOverflow(parent, { x: -0.5, y: 0, width: 100.5, height: 100 })).toBeNull();
    expect(boxOverflow(parent, { x: 0, y: 0, width: 100.6, height: 100 })).not.toBeNull();
  });

  test("an offset map catches a section child placed at sec.x + offset even when the section grew to contain it", async () => {
    const section = makeNode("SECTION", { x: 2000, y: 0, width: 4400, height: 600 });
    // Intended bare offset 160; the bug assigned 2000 + 160, and the section auto-grew.
    const slide = makeNode("FRAME", { x: 2160, y: 40, width: 1920, height: 500 }, section);
    const result: any = await assertContained({ parentId: section.id, expected: { [slide.id]: { x: 160, y: 40 } } });
    expect(result.contained).toBe(true);
    expect(result.placementOk).toBe(false);
    expect(result.displaced).toEqual([{ id: slide.id, name: slide.name, expected: { x: 160, y: 40 }, actual: { x: 2160, y: 40 } }]);
  });

  test("a snapshot as expected reports displacement and parentGrewSinceSnapshot", async () => {
    const section = makeNode("SECTION", { width: 1000, height: 600 });
    const a = makeNode("FRAME", { x: 100, y: 100, width: 200, height: 200 }, section);
    const b = makeNode("FRAME", { x: 400, y: 100, width: 200, height: 200 }, section);
    const { snapshotId } = await snapshotPositions({ nodeId: section.id });
    b.x = 1400;
    section.width = 1700;
    const result: any = await assertContained({ parentId: section.id, expected: snapshotId });
    expect(result.contained).toBe(true);
    expect(result.parentGrewSinceSnapshot).toBe(true);
    expect(result.displaced.map((d: any) => d.id)).toEqual([b.id]);
    expect(result.displaced.some((d: any) => d.id === a.id)).toBe(false);
  });

  test("a parent with no box gives placementOk null, never true", async () => {
    const page = makeNode("PAGE");
    page.noBox = true;
    const child = makeNode("FRAME", { x: 2160, y: 40 }, page);
    const result: any = await assertContained({ parentId: page.id, expected: { [child.id]: { x: 160, y: 40 } } });
    expect(result).toMatchObject({ contained: false, placementChecked: true, placementOk: null });
    expect(result.counts.unmeasurable).toBe(1);
  });

  test("an expected child with no box fails placement and is listed", async () => {
    const parent = makeNode("FRAME", { width: 400, height: 400 });
    const group = makeNode("GROUP", { x: 300 }, parent);
    group.noBox = true;
    const result: any = await assertContained({ parentId: parent.id, expected: { [group.id]: { x: 0, y: 0 } } });
    expect(result.placementOk).toBe(false);
    expect(result.displaced).toEqual([{ id: group.id, name: group.name, expected: { x: 0, y: 0 }, actual: null }]);
  });

  test("with a snapshot, a child added since (sec.x + 160, section grown) fails placement", async () => {
    const section = makeNode("SECTION", { x: 2000, width: 1000, height: 600 });
    makeNode("FRAME", { x: 10, y: 10, width: 10, height: 10 }, section);
    const { snapshotId } = await snapshotPositions({ nodeId: section.id });
    const bad = makeNode("FRAME", { x: 2160, y: 40, width: 100, height: 100 }, section);
    section.width = 2400;
    const result: any = await assertContained({ parentId: section.id, expected: snapshotId });
    expect(result).toMatchObject({ contained: true, placementOk: false, parentGrewSinceSnapshot: true, snapshotTruncated: false });
    expect(result.notInExpected).toEqual([bad.id]);
  });

  test("a snapshot that cut off the parent's children makes placement unknown and says so", async () => {
    const section = makeNode("SECTION", { width: 1000, height: 600 });
    const kids = Array.from({ length: 5 }, (_, i) => makeNode("FRAME", { x: i * 50, width: 10, height: 10 }, section));
    const { snapshotId, truncated } = await snapshotPositions({ nodeId: section.id, maxNodes: 2 });
    expect(truncated).toBe(true);
    kids[4].x = 900;
    kids[4].y = 500;
    const result: any = await assertContained({ parentId: section.id, expected: snapshotId });
    expect(result).toMatchObject({ placementOk: null, snapshotTruncated: true });
    expect(result.counts.notInExpected).toBe(4);
    expect(result.note).toContain("did not read all of this parent's children");
  });

  test("a snapshot truncated elsewhere still decides placement for a parent it read fully", async () => {
    const root = makeNode("FRAME", { width: 2000, height: 2000 });
    const section = makeNode("SECTION", { width: 1000, height: 600 }, root);
    makeNode("FRAME", { x: 10, y: 10, width: 10, height: 10 }, section);
    const other = makeNode("FRAME", { x: 1200 }, root);
    for (let i = 0; i < 3; i++) makeNode("RECTANGLE", { width: 1, height: 1 }, other);
    // Budget 4: root, section, a, other; other's children are cut off, section's are not.
    const { snapshotId, truncated } = await snapshotPositions({ nodeId: root.id, maxNodes: 4 });
    expect(truncated).toBe(true);
    expect((await assertContained({ parentId: section.id, expected: snapshotId })).placementOk).toBe(true);
    const added = makeNode("FRAME", { x: 20, y: 20, width: 10, height: 10 }, section);
    const result: any = await assertContained({ parentId: section.id, expected: snapshotId });
    expect(result).toMatchObject({ placementOk: false, snapshotTruncated: true, notInExpected: [added.id] });
  });

  test("a rotated child is flagged, not compared, and placement is unknown", async () => {
    const parent = makeNode("FRAME", { width: 400, height: 400 });
    const child = makeNode("RECTANGLE", { x: 10, y: 10, width: 20, height: 20 }, parent);
    child.rotation = 30;
    const result: any = await assertContained({ parentId: parent.id, expected: { [child.id]: { x: 999, y: 999 } } });
    expect(result).toMatchObject({ placementOk: null, displaced: [], placementUnchecked: [child.id] });
    expect(result.rotated).toEqual([{ id: child.id, name: child.name, rotation: 30 }]);
  });

  test("a rotated parent makes containment unknown unless a child is clearly outside", async () => {
    const parent = makeNode("FRAME", { width: 400, height: 400 });
    parent.rotation = 15;
    const inside = makeNode("RECTANGLE", { x: 10, y: 10, width: 20, height: 20 }, parent);
    let result: any = await assertContained({ parentId: parent.id, expected: { [inside.id]: { x: 10, y: 10 } } });
    expect(result).toMatchObject({ parentRotated: true, contained: null, placementOk: null, placementUnchecked: [inside.id] });
    makeNode("RECTANGLE", { x: 500, y: 10, width: 20, height: 20 }, parent);
    result = await assertContained({ parentId: parent.id });
    expect(result.contained).toBe(false);
  });

  test("offsets come from absolute boxes, so a GROUP's children (x/y relative to the group's parent) compare correctly", async () => {
    const frame = makeNode("FRAME", { x: 100, y: 100, width: 800, height: 800 });
    const group = makeNode("GROUP", { x: 200, y: 200, width: 300, height: 300 }, frame);
    const child = makeNode("RECTANGLE", { x: 250, y: 260, width: 10, height: 10 }, frame);
    // Group child: its x/y are in the frame's space, as Figma reports them.
    group.children.push(child);
    frame.children = frame.children.filter((c: any) => c !== child);
    Object.defineProperty(child, "absoluteBoundingBox", { get: () => ({ x: 100 + 250, y: 100 + 260, width: 10, height: 10 }) });
    // Box offset from the group's box (300, 300) is (50, 60); x/y would give (250, 260).
    expect((await assertContained({ parentId: group.id, expected: { [child.id]: { x: 50, y: 60 } } })).placementOk).toBe(true);
    expect((await assertContained({ parentId: group.id, expected: { [child.id]: { x: 250, y: 260 } } })).placementOk).toBe(false);
  });

  test("every list is capped with full counts", async () => {
    const parent = makeNode("FRAME", { width: 10, height: 10 });
    for (let i = 0; i < 150; i++) makeNode("RECTANGLE", { x: 100 }, parent);
    const result: any = await assertContained({ parentId: parent.id });
    expect(result.outside).toHaveLength(100);
    expect(result.counts.outside).toBe(150);
    expect(result.listsTruncated).toBe(true);
  });
});

describe("snapshot_positions and diff_positions", () => {
  test("a snapshot records the subtree and respects the node budget", async () => {
    const root = makeNode("FRAME", { width: 500, height: 500 });
    for (let i = 0; i < 5; i++) makeNode("RECTANGLE", { x: i * 10 }, root);
    expect(await snapshotPositions({ nodeId: root.id })).toMatchObject({ rootId: root.id, count: 6, truncated: false });
    const small: any = await snapshotPositions({ nodeId: root.id, maxNodes: 3 });
    expect(small).toMatchObject({ count: 3, truncated: true });
    expect(small.snapshotId).toMatch(/^snap-/);
  });

  test("an unknown snapshot id is 'snapshot expired', never an empty diff", async () => {
    await expect(diffPositions({ snapshotId: "snap-999-x" })).rejects.toThrow("Snapshot expired");
    await expect(assertContained({ parentId: makeNode("FRAME").id, expected: "snap-999-x" })).rejects.toThrow("Snapshot expired");
  });

  test("snapshots expire after 30 minutes and the store keeps at most 64", () => {
    let now = 1000;
    const store = new PositionSnapshotStore(() => now);
    const first = store.add("1:1", [], false, {});
    now += PositionSnapshotStore.TTL_MS - 1;
    expect(store.get(first.snapshotId).rootId).toBe("1:1");
    now += 1;
    expect(() => store.get(first.snapshotId)).toThrow("Snapshot expired");
    const ids = Array.from({ length: 65 }, () => store.add("1:1", [], false, {}).snapshotId);
    expect(() => store.get(ids[0])).toThrow("Snapshot expired");
    expect(store.get(ids[64]).rootId).toBe("1:1");
  });

  test("an untouched subtree diffs clean", async () => {
    const root = makeNode("FRAME");
    makeNode("RECTANGLE", {}, root);
    const { snapshotId } = await snapshotPositions({ nodeId: root.id });
    expect(await diffPositions({ snapshotId })).toMatchObject({ counts: { missing: 0, added: 0, moved: 0, unsnapshotted: 0 }, truncated: false, rootMissing: false, listsTruncated: false });
  });

  test("a reparent with zero drift is moved with boxChanged false", async () => {
    const page = makeNode("PAGE", { width: 0, height: 0 });
    const from = makeNode("FRAME", { x: 0, y: 0, width: 500, height: 500 }, page);
    const to = makeNode("FRAME", { x: 0, y: 0, width: 500, height: 500 }, page);
    const card = makeNode("FRAME", { x: 50, y: 60, width: 10, height: 10 }, from);
    const { snapshotId } = await snapshotPositions({ nodeId: from.id });
    to.appendChild(card);
    const diff: any = await diffPositions({ snapshotId });
    expect(diff.missing).toEqual([]);
    expect(diff.moved).toEqual([{ id: card.id, name: card.name, reparented: true, boxChanged: false,
      from: { parentId: from.id, box: { x: 50, y: 60, width: 10, height: 10 } },
      to: { parentId: to.id, box: { x: 50, y: 60, width: 10, height: 10 } } }]);
  });

  test("a reparent that drifts reports the box change", async () => {
    const page = makeNode("PAGE", { width: 0, height: 0 });
    const from = makeNode("FRAME", { x: 0, y: 0 }, page);
    const to = makeNode("SECTION", { x: 300, y: 0 }, page);
    const card = makeNode("FRAME", { x: 20, y: 20, width: 10, height: 10 }, from);
    const { snapshotId } = await snapshotPositions({ nodeId: page.id });
    to.appendChild(card); // x/y kept as numbers, so the absolute box shifts by the section origin
    const diff: any = await diffPositions({ snapshotId });
    expect(diff.moved).toEqual([expect.objectContaining({ id: card.id, reparented: true, boxChanged: true })]);
    expect(diff.moved[0].to.box.x - diff.moved[0].from.box.x).toBe(300);
  });

  test("an absorbed node is missing and its wrapper is added", async () => {
    const root = makeNode("FRAME", { width: 400, height: 400 });
    const bus = makeNode("RECTANGLE", { x: 10, y: 10, width: 2, height: 300 }, root);
    const { snapshotId } = await snapshotPositions({ nodeId: root.id });
    bus.remove();
    const wrapper = makeNode("FRAME", { x: 10, y: 10, width: 200, height: 300 }, root);
    wrapper.name = "Frame 1";
    const diff: any = await diffPositions({ snapshotId });
    expect(diff.missing).toEqual([bus.id]);
    expect(diff.added).toEqual([wrapper.id]);
    expect(diff.counts).toEqual({ missing: 1, added: 1, moved: 0, unsnapshotted: 0 });
  });

  test("after a truncated snapshot, a pre-existing node is unsnapshotted, not added", async () => {
    const root = makeNode("FRAME", { width: 1000, height: 1000 });
    const kids = Array.from({ length: 5 }, (_, i) => makeNode("RECTANGLE", { x: i * 10, width: 5, height: 5 }, root));
    const { snapshotId } = await snapshotPositions({ nodeId: root.id, maxNodes: 3 });
    kids[0].remove();
    const diff: any = await diffPositions({ snapshotId });
    expect(diff.missing).toEqual([kids[0].id]);
    expect(diff.added).toEqual([]);
    expect(diff.unsnapshotted).toEqual([kids[2].id]);
    expect(diff).toMatchObject({ snapshotTruncated: true, truncated: true });
    expect(diff.note).toContain("unsnapshotted");
  });

  test("after a truncated snapshot, a new child of a fully read parent is still added", async () => {
    const root = makeNode("FRAME", { width: 1000, height: 1000 });
    const full = makeNode("FRAME", {}, root);
    makeNode("RECTANGLE", {}, full);
    const cut = makeNode("FRAME", {}, root);
    for (let i = 0; i < 3; i++) makeNode("RECTANGLE", {}, cut);
    // Budget 4: root, full, its child, cut; cut's children are not read.
    const { snapshotId } = await snapshotPositions({ nodeId: root.id, maxNodes: 4 });
    const wrapper = makeNode("FRAME", {}, full);
    makeNode("RECTANGLE", {}, wrapper);
    // The re-walk (same budget) reads root, full, its old child and the new wrapper.
    const diff: any = await diffPositions({ snapshotId });
    expect(diff.added).toEqual([wrapper.id]);
    expect(diff.unsnapshotted).toEqual([]);
    expect(diff.missing).toEqual([]);
  });

  test("a snapshot node the re-walk no longer reaches is not missing", async () => {
    const root = makeNode("FRAME", { width: 1000, height: 1000 });
    for (let i = 0; i < 5; i++) makeNode("RECTANGLE", { x: i * 10, width: 5, height: 5 }, root);
    const { snapshotId } = await snapshotPositions({ nodeId: root.id, maxNodes: 3 });
    // Two new first children use up the re-walk's budget before kids[0] and kids[1].
    root.insertChild(0, makeNode("RECTANGLE", { width: 5, height: 5 }));
    root.insertChild(0, makeNode("RECTANGLE", { width: 5, height: 5 }));
    const diff: any = await diffPositions({ snapshotId });
    expect(diff.missing).toEqual([]);
    expect(diff.moved).toEqual([]);
    expect(diff.added).toEqual([]);
    expect(diff.counts.unsnapshotted).toBe(2);
    expect(diff.rewalkTruncated).toBe(true);
  });

  test("diff output is bounded: every list capped, counts full", async () => {
    const root = makeNode("FRAME", { width: 5000, height: 5000 });
    for (let i = 0; i < 9999; i++) makeNode("RECTANGLE", { x: i % 100, y: Math.floor(i / 100), width: 1, height: 1 }, root);
    const { snapshotId } = await snapshotPositions({ nodeId: root.id, maxNodes: 10000 });
    root.x += 10;
    const diff: any = await diffPositions({ snapshotId });
    expect(diff.counts.moved).toBe(10000);
    expect(diff.moved).toHaveLength(100);
    expect(diff.listsTruncated).toBe(true);
    expect(JSON.stringify(diff).length).toBeLessThan(50000);
  });

  test("diffPositionEntries compares boxes within the tolerance", () => {
    const box = { x: 0, y: 0, width: 10, height: 10 };
    const before = [{ id: "a", name: "a", parentId: "p", box }];
    expect(diffPositionEntries(before, [{ id: "a", name: "a", parentId: "p", box: { ...box, x: 0.4 } }]).moved).toEqual([]);
    expect(diffPositionEntries(before, [{ id: "a", name: "a", parentId: "p", box: { ...box, x: 0.6 } }]).moved).toHaveLength(1);
    expect(diffPositionEntries(before, [{ id: "a", name: "a", parentId: "p", box: null }]).moved).toHaveLength(1);
  });
});

describe("editor gate", () => {
  test("the verify commands are reads and run in Dev Mode; resize stays refused there", () => {
    for (const command of ["assert_contained", "snapshot_positions", "diff_positions"]) {
      expect(allowedEditors(command)).toContain("dev");
      expect(() => assertEditorAllowed(command, "dev", {})).not.toThrow();
    }
    expect(() => assertEditorAllowed("resize_node", "dev", {})).toThrow("not available in the dev editor");
    expect(() => assertEditorAllowed("batch_mutate", "dev", {})).toThrow("not available in the dev editor");
  });
});
