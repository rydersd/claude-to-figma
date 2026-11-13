// Verification commands (L2F_VERIFY): resize read-back, containment and
// position snapshots. `figma` is a global provided by the Figma plugin runtime.
// The pure comparisons live in src/shared/verify.ts so the server and later
// spec-sync commands use the same rules.

import { walkTree, type WalkOptions } from "../../shared/walk";
import {
  boxOverflow, CONTAINMENT_TOLERANCE, diffPositionEntries, resizeReadBack, toBox,
  type Box, type PositionEntry, type ResizeReadBack,
} from "../../shared/verify";

// Calls resize (or resizeWithoutConstraints) and reads the size back. Figma
// applies what it can without throwing, so the caller gets requested vs applied.
export function resizeWithReadBack(node: any, width: number, height: number): ResizeReadBack {
  if ("resize" in node) node.resize(width, height);
  else node.resizeWithoutConstraints(width, height);
  return resizeReadBack({ width, height }, { width: node.width, height: node.height }, {
    type: node.type,
    layoutSizingHorizontal: node.layoutSizingHorizontal,
    layoutSizingVertical: node.layoutSizingVertical,
    minWidth: node.minWidth, maxWidth: node.maxWidth,
    minHeight: node.minHeight, maxHeight: node.maxHeight,
    textAutoResize: node.textAutoResize,
  });
}

export function positionEntry(node: any): PositionEntry {
  return {
    id: node.id,
    name: node.name,
    parentId: node.parent ? node.parent.id : null,
    box: "absoluteBoundingBox" in node ? toBox(node.absoluteBoundingBox) : null,
  };
}

// Bounded plugin-side store, like reference_cache: entries expire after 30
// minutes, at most 64 are kept and the oldest is evicted. It is lost when the
// plugin reloads, so an unknown id is an error, never an empty result.
export interface PositionSnapshot {
  rootId: string;
  entries: PositionEntry[];
  truncated: boolean;
  // Ids of snapshotted nodes whose child list the walk cut off (see walkTree).
  truncatedParentIds: string[];
  expiresAt: number;
  walk: WalkOptions;
}

export class PositionSnapshotStore {
  static readonly TTL_MS = 30 * 60 * 1000;
  static readonly MAX_ENTRIES = 64;
  private entries = new Map<string, PositionSnapshot>();
  private counter = 0;
  constructor(private now: () => number = Date.now) {}
  private purge() {
    for (const [id, s] of this.entries) if (s.expiresAt <= this.now()) this.entries.delete(id);
  }
  add(rootId: string, entries: PositionEntry[], truncated: boolean, walk: WalkOptions, truncatedParentIds: string[] = []) {
    this.purge();
    if (this.entries.size >= PositionSnapshotStore.MAX_ENTRIES) this.entries.delete(this.entries.keys().next().value!);
    const snapshotId = `snap-${++this.counter}-${this.now().toString(36)}`;
    const expiresAt = this.now() + PositionSnapshotStore.TTL_MS;
    this.entries.set(snapshotId, { rootId, entries, truncated, truncatedParentIds, expiresAt, walk });
    return { snapshotId, expiresAt };
  }
  get(snapshotId: string): PositionSnapshot {
    this.purge();
    const snapshot = this.entries.get(snapshotId);
    if (!snapshot) {
      throw new Error(`Snapshot expired: ${snapshotId} is unknown or older than 30 minutes (snapshots are lost when the plugin reloads). Take a new snapshot with snapshot_positions.`);
    }
    return snapshot;
  }
}

export const snapshotStore = new PositionSnapshotStore();

// Every list in a verify result is capped at this many items; the full sizes
// are in `counts` and `listsTruncated` says when any list was cut.
const LIST_CAP = 100;
const cap = <T>(list: T[]) => list.slice(0, LIST_CAP);

async function requireNode(nodeId: string) {
  if (!nodeId) throw new Error("Missing nodeId parameter");
  const node: any = await figma.getNodeByIdAsync(nodeId);
  if (!node) throw new Error(`Node not found with ID: ${nodeId}`);
  return node;
}

function readSubtree(root: any, walk: WalkOptions) {
  const entries: PositionEntry[] = [];
  const result = walkTree<any>(root, node => { entries.push(positionEntry(node)); }, walk);
  return { entries, truncated: result.truncated, truncatedParentIds: result.truncatedParents.map(n => n.id as string) };
}

export async function snapshotPositions(params: any) {
  const { nodeId, maxNodes, maxDepth } = params || {};
  const root = await requireNode(nodeId);
  const walk = { maxNodes, maxDepth };
  const { entries, truncated, truncatedParentIds } = readSubtree(root, walk);
  const { snapshotId, expiresAt } = snapshotStore.add(root.id, entries, truncated, walk, truncatedParentIds);
  return { snapshotId, rootId: root.id, count: entries.length, truncated, expiresAt };
}

// Whether a node outside a truncated snapshot could have existed unseen when
// the snapshot was taken: follow its current ancestors up to the first one the
// snapshot recorded. If that one's child list was cut off (or no recorded
// ancestor is found), the snapshot cannot say the node is new.
function unseenBySnapshot(entry: PositionEntry, nowById: Map<string, PositionEntry>, snapshotIds: Set<string>, cutOff: Set<string>) {
  let parentId = entry.parentId;
  const guard = new Set<string>();
  while (parentId && !snapshotIds.has(parentId) && !guard.has(parentId)) {
    guard.add(parentId);
    const parent = nowById.get(parentId);
    if (!parent) return true;
    parentId = parent.parentId;
  }
  return !parentId || !snapshotIds.has(parentId) || cutOff.has(parentId);
}

export async function diffPositions(params: any) {
  const { snapshotId, tolerance = CONTAINMENT_TOLERANCE, includeCarried = false } = params || {};
  if (!snapshotId) throw new Error("Missing snapshotId parameter");
  const snapshot = snapshotStore.get(snapshotId);
  const root: any = await figma.getNodeByIdAsync(snapshot.rootId);
  const after: PositionEntry[] = [];
  let rewalkTruncated = false;
  if (root) {
    const now = readSubtree(root, snapshot.walk);
    after.push(...now.entries);
    rewalkTruncated = now.truncated;
  }
  // A snapshot id the re-walk did not reach may have been reparented elsewhere,
  // or sit beyond a budget the re-walk hit earlier; look it up so it reads as
  // moved or unchanged, not missing. Only ids that are truly gone are missing.
  const seen = new Set(after.map(e => e.id));
  for (const old of snapshot.entries) {
    if (seen.has(old.id)) continue;
    const node: any = await figma.getNodeByIdAsync(old.id);
    if (node && !node.removed) after.push(positionEntry(node));
  }
  const diff = diffPositionEntries(snapshot.entries, after, tolerance, { includeCarried });

  // A node new to the walk is `added` only when the snapshot saw its whole
  // neighbourhood; after a truncated snapshot it may simply never have been read.
  let added = diff.added;
  const unsnapshotted: string[] = [];
  if (snapshot.truncated) {
    const nowById = new Map(after.map(e => [e.id, e]));
    const snapshotIds = new Set(snapshot.entries.map(e => e.id));
    const cutOff = new Set(snapshot.truncatedParentIds);
    added = [];
    for (const id of diff.added) {
      if (unseenBySnapshot(nowById.get(id)!, nowById, snapshotIds, cutOff)) unsnapshotted.push(id);
      else added.push(id);
    }
  }

  const notes: string[] = [];
  if (snapshot.truncated) notes.push("The snapshot was truncated: nodes under a parent whose children it did not finish reading are listed as unsnapshotted, not added, because they may have existed then.");
  if (rewalkTruncated) notes.push("The re-walk hit its budget: snapshot nodes it did not reach were looked up by id (so missing still means gone), but new nodes past the budget are not listed in added.");
  return {
    snapshotId,
    rootId: snapshot.rootId,
    rootMissing: !root,
    counts: { missing: diff.missing.length, added: added.length, moved: diff.movedTotal, movedWithParent: diff.movedWithParent, unsnapshotted: unsnapshotted.length },
    missing: cap(diff.missing),
    added: cap(added),
    moved: cap(diff.moved),
    unsnapshotted: cap(unsnapshotted),
    listsTruncated: [diff.missing, added, diff.moved, unsnapshotted].some(l => l.length > LIST_CAP),
    truncated: snapshot.truncated || rewalkTruncated,
    snapshotTruncated: snapshot.truncated,
    rewalkTruncated,
    ...(notes.length ? { note: notes.join(" ") } : {}),
  };
}

const isRotated = (node: any) => typeof node.rotation === "number" && Math.abs(node.rotation) > 0.01;

// Every offset here is absolute-box minus absolute-box: the child's
// absoluteBoundingBox origin minus the parent's. Node x/y are never used,
// because they are relative to different things (a GROUP's children are
// positioned relative to the group's parent, not the group).
export async function assertContained(params: any) {
  const { parentId, expected, tolerance = CONTAINMENT_TOLERANCE } = params || {};
  const parent = await requireNode(parentId);
  if (!("children" in parent) || !Array.isArray(parent.children)) throw new Error(`Node has no children: ${parentId}`);
  const parentBox = toBox(parent.absoluteBoundingBox);
  const parentRotated = isRotated(parent);

  // Expected offsets from the parent's box origin, from a snapshot or a map.
  let expectedOffsets: Record<string, { x: number; y: number }> | null = null;
  let parentGrewSinceSnapshot: boolean | null = null;
  let snapshotTruncated: boolean | null = null;
  let snapshotCutChildren = false;
  const fromSnapshot = typeof expected === "string";
  if (fromSnapshot) {
    const snapshot = snapshotStore.get(expected);
    const byId = new Map(snapshot.entries.map(e => [e.id, e]));
    const parentThen = byId.get(parent.id);
    if (!parentThen || !parentThen.box) throw new Error(`Snapshot ${expected} does not hold a measurable box for parent ${parent.id}`);
    snapshotTruncated = snapshot.truncated;
    snapshotCutChildren = snapshot.truncatedParentIds.includes(parent.id);
    expectedOffsets = {};
    for (const entry of snapshot.entries) {
      if (entry.parentId === parent.id && entry.box) {
        expectedOffsets[entry.id] = { x: entry.box.x - parentThen.box.x, y: entry.box.y - parentThen.box.y };
      }
    }
    parentGrewSinceSnapshot = parentBox
      ? parentBox.width > parentThen.box.width + tolerance || parentBox.height > parentThen.box.height + tolerance
      : null;
  } else if (expected && typeof expected === "object") {
    expectedOffsets = expected;
  }

  const outside: any[] = [];
  const unmeasurable: any[] = [];
  const rotated: any[] = [];
  const displaced: any[] = [];
  const notInExpected: string[] = [];
  const placementUnchecked: string[] = [];
  const childIds = new Set<string>();
  for (const child of parent.children) {
    childIds.add(child.id);
    const box: Box | null = toBox(child.absoluteBoundingBox);
    const childRotated = isRotated(child);
    if (childRotated) rotated.push({ id: child.id, name: child.name, rotation: child.rotation });
    const want = expectedOffsets ? expectedOffsets[child.id] : undefined;
    if (expectedOffsets && !want) notInExpected.push(child.id);
    if (!box || !parentBox) {
      unmeasurable.push({ id: child.id, name: child.name });
      // An expectation that cannot be measured is a failure, not a pass.
      if (want && parentBox) displaced.push({ id: child.id, name: child.name, expected: want, actual: null });
      continue;
    }
    const overflow = boxOverflow(parentBox, box, tolerance);
    if (overflow) outside.push({ id: child.id, name: child.name, box, overflow });
    if (!want) continue;
    // A rotated box's origin is not the node's origin; flag it, do not compare it.
    if (childRotated || parentRotated) { placementUnchecked.push(child.id); continue; }
    const actual = { x: box.x - parentBox.x, y: box.y - parentBox.y };
    if (Math.abs(actual.x - want.x) > tolerance || Math.abs(actual.y - want.y) > tolerance) {
      displaced.push({ id: child.id, name: child.name, expected: want, actual });
    }
  }
  const expectedNotFound = expectedOffsets ? Object.keys(expectedOffsets).filter(id => !childIds.has(id)) : [];
  const placementChecked = expectedOffsets !== null;

  // placementOk is true only when every child was actually compared and passed.
  let placementOk: boolean | null = null;
  if (placementChecked && parentBox) {
    if (displaced.length || expectedNotFound.length) placementOk = false;
    else if (fromSnapshot && notInExpected.length) placementOk = snapshotCutChildren ? null : false;
    else if (placementUnchecked.length) placementOk = null;
    else placementOk = true;
  }
  // A rotated parent's box is the axis-aligned bound of its rotated rectangle,
  // so a child inside that box may still be outside the parent itself.
  const anyFailure = outside.length > 0 || unmeasurable.length > 0;
  const contained = !parentBox ? false : anyFailure ? false : parentRotated ? null : true;

  const notes: string[] = [];
  if (!parentBox) notes.push("The parent has no absoluteBoundingBox, so nothing could be measured.");
  else if (!placementChecked) notes.push("Containment alone does not prove placement: a section auto-grows around displaced children. Pass expected (a snapshot id or an offset map) to check positions.");
  else notes.push("Offsets are absoluteBoundingBox origin minus the parent's (shadows and other render bounds ignored), never node x/y: a GROUP's children are positioned relative to the group's parent.");
  if (parentRotated) notes.push("The parent is rotated: containment is only known to fail, and placement is not compared.");
  if (placementUnchecked.length && !parentRotated) notes.push("Rotated children are listed in placementUnchecked and not compared.");
  if (fromSnapshot && snapshotCutChildren && notInExpected.length) notes.push("The snapshot did not read all of this parent's children, so children not in it may have existed then; placement is unknown.");
  else if (fromSnapshot && notInExpected.length) notes.push("Children not in the snapshot were added since it was taken; their placement was never checked.");

  return {
    parentId: parent.id,
    parentName: parent.name,
    parentBox,
    parentRotated,
    tolerance,
    childCount: parent.children.length,
    contained,
    placementChecked,
    placementOk,
    parentGrewSinceSnapshot,
    ...(fromSnapshot ? { snapshotTruncated } : {}),
    counts: { outside: outside.length, unmeasurable: unmeasurable.length, rotated: rotated.length, displaced: displaced.length, notInExpected: notInExpected.length, expectedNotFound: expectedNotFound.length, placementUnchecked: placementUnchecked.length },
    outside: cap(outside),
    unmeasurable: cap(unmeasurable),
    rotated: cap(rotated),
    displaced: cap(displaced),
    notInExpected: cap(notInExpected),
    expectedNotFound: cap(expectedNotFound),
    placementUnchecked: cap(placementUnchecked),
    listsTruncated: [outside, unmeasurable, rotated, displaced, notInExpected, expectedNotFound, placementUnchecked].some(l => l.length > LIST_CAP),
    note: notes.join(" "),
  };
}
