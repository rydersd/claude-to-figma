// Spec sync (L2F_SPEC_SYNC): apply_spec_ops carries out one Plan by node id.
// The server (tools/spec.ts, apply_spec) sends the Plan's operations, the live
// state the plan saw for every node they touch, and the Spec's child order for
// every parent that gains a node. In one plugin run this command:
//   1. checks it has the expected file and page, and that every touched node
//      still hashes, sits and orders its children as the plan saw; on any
//      difference it refuses the whole run and writes nothing;
//   2. commitUndo, then creates (onBindFailure "keep"), updates (only the
//      listed keys, never a key in the node's $unread), moves (minimal
//      insertChild, read back; a reparent keeps the absolute position) and
//      removals (into a page-level `l2f/superseded` frame at the same absolute
//      position, never remove()); one failure is recorded and the rest go on;
//   3. commitUndo, then re-reads the whole subtree for the server to relock.
// `figma` is a global provided by the Figma plugin runtime.

import { SPEC_DEFAULTS, UNREAD_KEY, type SpecType } from "../../shared/spec";
import { applyDeferredFill, createNode, createNodeTreeContext, resolveAndBind, updateNodeProperties } from "./node-tree";
import { forcedReasons, readLiveLock, readLockEntry, resolveSpecTarget, SpecReadCache } from "./spec";
import { appendOrInsertChild, sendProgressUpdate } from "./utils";

const COMMAND = "apply_spec_ops";
const PROGRESS_EVERY = 50;
export const SUPERSEDED_NAME = "l2f/superseded";
// How far an absolute position may drift through the transform arithmetic.
const POSITION_TOLERANCE = 0.5;
const MAX_STALE_LISTED = 10;

type Matrix = [[number, number, number], [number, number, number]];

function multiply(a: Matrix, b: Matrix): Matrix {
  return [
    [a[0][0] * b[0][0] + a[0][1] * b[1][0], a[0][0] * b[0][1] + a[0][1] * b[1][1], a[0][0] * b[0][2] + a[0][1] * b[1][2] + a[0][2]],
    [a[1][0] * b[0][0] + a[1][1] * b[1][0], a[1][0] * b[0][1] + a[1][1] * b[1][1], a[1][0] * b[0][2] + a[1][1] * b[1][2] + a[1][2]],
  ];
}

function invert(m: Matrix): Matrix {
  const [[a, c, e], [b, d, f]] = m;
  const det = a * d - b * c;
  if (!det) throw new Error("the parent's transform cannot be inverted");
  return [[d / det, -c / det, (c * f - d * e) / det], [-b / det, a / det, (b * e - a * f) / det]];
}

const IDENTITY: Matrix = [[1, 0, 0], [0, 1, 0]];
const absoluteOf = (node: any): Matrix => (node && node.type !== "PAGE" && node.absoluteTransform ? node.absoluteTransform : IDENTITY);

// Give `node` (already under its new parent) the absolute transform it had,
// then read it back. Throws when Figma did not keep it.
function keepAbsolute(node: any, absolute: Matrix) {
  node.relativeTransform = multiply(invert(absoluteOf(node.parent)), absolute);
  const now = absoluteOf(node);
  if (Math.abs(now[0][2] - absolute[0][2]) > POSITION_TOLERANCE || Math.abs(now[1][2] - absolute[1][2]) > POSITION_TOLERANCE) {
    throw new Error(`absolute position not kept (was ${absolute[0][2]}, ${absolute[1][2]}; now ${now[0][2]}, ${now[1][2]})`);
  }
}

const autoLayout = (node: any) => !!node && typeof node.layoutMode === "string" && node.layoutMode !== "NONE";

// Keys create leaves to Figma or to its own matching defaults; everything else
// absent from a created node is written as its SPEC_DEFAULTS value, so a new
// node is what "absent means default" says it is.
const CREATE_SKIPS = new Set(["x", "y", "width", "height", "layoutPositioning", "layoutSizingHorizontal", "layoutSizingVertical", "properties"]);
const AUTO_LAYOUT_KEYS = new Set([
  "layoutWrap", "paddingTop", "paddingRight", "paddingBottom", "paddingLeft",
  "primaryAxisAlignItems", "counterAxisAlignItems", "itemSpacing", "counterAxisSpacing", "itemReverseZIndex",
]);

export function withCreateDefaults(node: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = { ...node };
  const defaults = SPEC_DEFAULTS[node.type as SpecType] || {};
  for (const [key, value] of Object.entries(defaults)) {
    if (out[key] !== undefined || CREATE_SKIPS.has(key)) continue;
    if (AUTO_LAYOUT_KEYS.has(key) && !autoLayout(out)) continue;
    if (key === "counterAxisSpacing" && out.layoutWrap !== "WRAP") continue;
    out[key] = value;
  }
  if (Array.isArray(node.children)) out.children = node.children.map(withCreateDefaults);
  return out;
}

const pathKey = (path: number[]) => path.join(".");

function specAt(node: any, rest: number[]): any {
  let current = node;
  for (const i of rest) current = current && Array.isArray(current.children) ? current.children[i] : undefined;
  return current;
}

export async function applySpecOps(params: any) {
  const {
    rootId, expect, operations, expectedHashes, allowRemovals, orders, truncated, supersededFrameId, date, maxNodes, maxDepth, commandId,
  } = params || {};
  if (!rootId || typeof rootId !== "string") throw new Error("Missing rootId parameter");
  if (!Array.isArray(operations)) throw new Error("Missing operations parameter");
  const forced = forcedReasons(truncated);

  // --- 1. Right file and page, and nothing touched has changed. No writes. ---
  let page: any;
  try {
    page = (await resolveSpecTarget(rootId, expect || {})).page;
  } catch (error) {
    return { refused: error instanceof Error ? error.message : String(error) };
  }
  const cache = new SpecReadCache();
  const stale: string[] = [];
  const liveUnread = new Map<string, Set<string>>();
  for (const [id, want] of Object.entries((expectedHashes || {}) as Record<string, any>)) {
    const node: any = await figma.getNodeByIdAsync(id);
    if (!node) { stale.push(`${id} (gone)`); continue; }
    const entry = await readLockEntry(node, cache, forced);
    const what: string[] = [];
    if (entry.propsHash !== want.propsHash) what.push("properties");
    if (entry.parentId !== want.parentId) what.push("parent");
    if (entry.children.join("\n") !== (want.children || []).join("\n")) what.push("children");
    if (what.length) stale.push(`${id} (${what.join(", ")})`);
    if (Array.isArray(entry.props[UNREAD_KEY])) liveUnread.set(id, new Set(entry.props[UNREAD_KEY] as string[]));
  }
  if (stale.length) {
    const shown = stale.slice(0, MAX_STALE_LISTED).join(", ") + (stale.length > MAX_STALE_LISTED ? ` and ${stale.length - MAX_STALE_LISTED} more` : "");
    return { refused: `Figma changed since the plan: ${shown}. Nothing was written; run plan_spec again.`, stale: stale.length };
  }

  const created: Array<{ path: number[]; id: string; failed?: boolean }> = [];
  const updated: Array<{ id: string; keys: string[] }> = [];
  const moved: string[] = [];
  const removed: string[] = [];
  const failed: Array<Record<string, unknown>> = [];
  const total = operations.length;
  let done = 0;
  const step = async () => {
    done++;
    if (commandId && done % PROGRESS_EVERY === 0) {
      await sendProgressUpdate(commandId, COMMAND, "in_progress", Math.min(99, Math.round((done / Math.max(1, total)) * 100)), total, done, `Applied ${done}/${total} operations`);
    }
  };
  const message = (error: unknown) => (error instanceof Error ? error.message : String(error));
  if (commandId) await sendProgressUpdate(commandId, COMMAND, "started", 0, total, 0, `Applying ${total} operations`);

  if (typeof (figma as any).commitUndo === "function") (figma as any).commitUndo();

  // --- 2a. Creates: each a new subtree under an existing parent. ---
  const creates = operations.filter((op: any) => op.op === "create");
  const createdTop = new Map<string, string>(); // path key -> id of a created top node
  const ctx = createNodeTreeContext({ totalNodes: creates.length, firstOnTop: true, commandId, progressLabel: COMMAND, progressEvery: PROGRESS_EVERY });
  for (const op of creates) {
    const spec = withCreateDefaults(op.node);
    const before = ctx.errors.length;
    try {
      const made = await createNode(spec, op.parentId, 1, ctx, { onBindFailure: "keep", path: op.path });
      for (const entry of made) {
        created.push(entry);
        if (pathKey(entry.path) === pathKey(op.path)) createdTop.set(pathKey(op.path), entry.id);
        // A new text node without a name is named by its text, like a pulled one.
        const source = specAt(op.node, entry.path.slice(op.path.length));
        if (source && source.type === "text" && source.name === undefined) {
          const node: any = await figma.getNodeByIdAsync(entry.id);
          if (node && "autoRename" in node) node.autoRename = true;
        }
      }
    } catch (error) {
      failed.push({ op: "create", path: op.path, error: message(error) });
    }
    for (const error of ctx.errors.slice(before)) failed.push({ op: "create", path: error.path, error: error.error });
    await step();
  }

  // --- 2b. Updates: only the listed keys. ---
  const reparented = new Set<string>(operations.filter((op: any) => op.op === "move" && op.fromParentId !== op.parentId).map((op: any) => op.id));
  // x/y of a reparented node are relative to its new parent: set after the move.
  const afterMove = new Map<string, Record<string, unknown>>();
  for (const op of operations.filter((o: any) => o.op === "update")) {
    const unread = liveUnread.get(op.id) || new Set<string>();
    const set: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(op.set || {})) if (key !== UNREAD_KEY && !unread.has(key)) set[key] = value;
    if (reparented.has(op.id)) {
      const xy: Record<string, unknown> = {};
      for (const key of ["x", "y"]) if (key in set) { xy[key] = set[key]; delete set[key]; }
      if (Object.keys(xy).length) afterMove.set(op.id, xy);
    }
    const keys = Object.keys(set);
    if (keys.length) {
      try {
        const node: any = await figma.getNodeByIdAsync(op.id);
        if (!node) throw new Error("node not found");
        const written = await writeProps(node, set);
        if (written.length) failed.push({ op: "update", id: op.id, keys: written, error: "not written for this node type" });
        updated.push({ id: op.id, keys: keys.filter(k => !written.includes(k)) });
      } catch (error) {
        failed.push({ op: "update", id: op.id, keys, error: message(error) });
      }
    }
    await step();
  }

  // --- 2c. Moves and the place of created nodes, per parent in Spec order. ---
  const toPlace = new Map<string, Set<string>>(); // parent id -> ids to place
  const place = (parentId: string, id: string) => {
    if (!toPlace.has(parentId)) toPlace.set(parentId, new Set());
    toPlace.get(parentId)!.add(id);
  };
  for (const op of operations) {
    if (op.op === "move") place(op.parentId, op.id);
    if (op.op === "create" && createdTop.has(pathKey(op.path))) place(op.parentId, createdTop.get(pathKey(op.path))!);
  }
  const moveOps = new Map<string, any>(operations.filter((op: any) => op.op === "move").map((op: any) => [op.id, op]));
  for (const order of Array.isArray(orders) ? orders : []) {
    const wanted = toPlace.get(order.parentId);
    if (!wanted) continue;
    const ids = (order.children as Array<string | number[]>).map(entry => (typeof entry === "string" ? entry : createdTop.get(pathKey(entry)) ?? null));
    const inOrder = new Set(ids.filter((id): id is string => !!id));
    let previous: any = null;
    for (const id of ids) {
      if (!id) continue;
      const node: any = await figma.getNodeByIdAsync(id);
      if (!node) continue;
      if (!wanted.has(id)) {
        if (node.parent && node.parent.id === order.parentId) previous = node;
        continue;
      }
      try {
        const parent: any = await figma.getNodeByIdAsync(order.parentId);
        if (!parent || !Array.isArray(parent.children)) throw new Error(`parent ${order.parentId} not found`);
        const isReparent = !node.parent || node.parent.id !== parent.id;
        const absolute = isReparent ? absoluteOf(node) : null;
        // Right after the previous Spec sibling; with none, before the first
        // Spec sibling present. Nodes added by hand keep their places.
        const siblings = parent.children.filter((child: any) => child.id !== id);
        const first = siblings.findIndex((child: any) => inOrder.has(child.id));
        const target = previous ? siblings.indexOf(previous) + 1 : first >= 0 ? first : siblings.length;
        if (isReparent || parent.children.indexOf(node) !== target) {
          await appendOrInsertChild(node, parent.id, target);
          let at = parent.children.indexOf(node);
          // insertChild may count the index before taking the node out.
          if (at !== target && at >= 0) {
            parent.insertChild(at < target ? target + 1 : target, node);
            at = parent.children.indexOf(node);
          }
          if (at !== target) throw new Error(`placed at index ${at}, expected ${target}`);
          if (absolute && (!autoLayout(parent) || node.layoutPositioning === "ABSOLUTE")) keepAbsolute(node, absolute);
        }
        const xy = afterMove.get(id);
        if (xy) await writeProps(node, xy);
        if (moveOps.has(id)) moved.push(id);
        previous = node;
      } catch (error) {
        failed.push({ op: moveOps.has(id) ? "move" : "create", id, error: message(error) });
      }
      if (moveOps.has(id)) await step();
    }
  }

  // --- 2d. Removals, last: moved aside, never deleted. ---
  let holderId: string | null = typeof supersededFrameId === "string" ? supersededFrameId : null;
  const removals = operations.filter((op: any) => op.op === "remove");
  if (allowRemovals === true && removals.length) {
    let holder: any = holderId ? await figma.getNodeByIdAsync(holderId) : null;
    if (!holder || holder.type !== "FRAME" || holder.removed || holder.parent !== page) {
      holder = figma.createFrame();
      page.appendChild(holder);
      holder.name = SUPERSEDED_NAME;
      if (holder.layoutMode !== "NONE") holder.layoutMode = "NONE";
      holder.clipsContent = false;
      holder.fills = [];
      holder.resize(1, 1);
      // Superseded nodes keep their absolute place, so the holder is hidden to
      // take them out of view; show it in the layers panel to see them.
      holder.visible = false;
    }
    holderId = holder.id;
    for (const op of removals) {
      try {
        const node: any = await figma.getNodeByIdAsync(op.id);
        if (!node) throw new Error("node not found");
        const absolute = absoluteOf(node);
        holder.appendChild(node);
        keepAbsolute(node, absolute);
        node.name = `${node.name} (superseded ${typeof date === "string" ? date : new Date().toISOString().slice(0, 10)})`;
        removed.push(op.id);
      } catch (error) {
        failed.push({ op: "remove", id: op.id, error: message(error) });
      }
      await step();
    }
  }

  if (typeof (figma as any).commitUndo === "function") (figma as any).commitUndo();

  // --- 3. The whole subtree, read back. ---
  const readBack = await readLiveLock({ rootId, expect, truncated, maxNodes, maxDepth, commandId }, COMMAND);
  if (commandId) await sendProgressUpdate(commandId, COMMAND, "completed", 100, total, done, `Applied ${done} operations`);
  return { created, updated, moved, removed, failed, supersededFrameId: holderId, readBack };
}

// Write `set` (Spec vocabulary, canonical values) to `node`, touching only
// those keys. Returns the keys no setter took.
async function writeProps(node: any, set: Record<string, unknown>): Promise<string[]> {
  const only = new Set(Object.keys(set));
  const colors = await resolveAndBind(set, only);
  const result = await updateNodeProperties(node, colors.resolved, only);
  const filled = applyDeferredFill(node, colors.resolved, only, { checkParent: true });
  await colors.bind(node);
  // FILL a frame cannot take (no auto-layout parent) shows in the read-back.
  return result.unhandled.filter(key => !filled.includes(key) && !(node.type === "FRAME" && set[key] === "FILL"));
}
