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
export class PositionSnapshotStore {
  static readonly TTL_MS = 30 * 60 * 1000;
  static readonly MAX_ENTRIES = 64;
  private entries = new Map<string, { rootId: string; entries: PositionEntry[]; truncated: boolean; expiresAt: number; walk: WalkOptions }>();
  private counter = 0;
  constructor(private now: () => number = Date.now) {}
  private purge() {
    for (const [id, s] of this.entries) if (s.expiresAt <= this.now()) this.entries.delete(id);
  }
  add(rootId: string, entries: PositionEntry[], truncated: boolean, walk: WalkOptions) {
    this.purge();
    if (this.entries.size >= PositionSnapshotStore.MAX_ENTRIES) this.entries.delete(this.entries.keys().next().value!);
    const snapshotId = `snap-${++this.counter}-${this.now().toString(36)}`;
    const expiresAt = this.now() + PositionSnapshotStore.TTL_MS;
    this.entries.set(snapshotId, { rootId, entries, truncated, expiresAt, walk });
    return { snapshotId, expiresAt };
  }
  get(snapshotId: string) {
    this.purge();
    const snapshot = this.entries.get(snapshotId);
    if (!snapshot) {
      throw new Error(`Snapshot expired: ${snapshotId} is unknown or older than 30 minutes (snapshots are lost when the plugin reloads). Take a new snapshot with snapshot_positions.`);
    }
    return snapshot;
  }
}

export const snapshotStore = new PositionSnapshotStore();

async function requireNode(nodeId: string) {
  if (!nodeId) throw new Error("Missing nodeId parameter");
  const node: any = await figma.getNodeByIdAsync(nodeId);
  if (!node) throw new Error(`Node not found with ID: ${nodeId}`);
  return node;
}

function readSubtree(root: any, walk: WalkOptions) {
  const entries: PositionEntry[] = [];
  const result = walkTree<any>(root, node => { entries.push(positionEntry(node)); }, walk);
  return { entries, truncated: result.truncated };
}

export async function snapshotPositions(params: any) {
  const { nodeId, maxNodes, maxDepth } = params || {};
  const root = await requireNode(nodeId);
  const walk = { maxNodes, maxDepth };
  const { entries, truncated } = readSubtree(root, walk);
  const { snapshotId, expiresAt } = snapshotStore.add(root.id, entries, truncated, walk);
  return { snapshotId, rootId: root.id, count: entries.length, truncated, expiresAt };
}

export async function diffPositions(params: any) {
  const { snapshotId, tolerance = CONTAINMENT_TOLERANCE } = params || {};
  if (!snapshotId) throw new Error("Missing snapshotId parameter");
  const snapshot = snapshotStore.get(snapshotId);
  const root: any = await figma.getNodeByIdAsync(snapshot.rootId);
  const after: PositionEntry[] = [];
  let truncated = snapshot.truncated;
  if (root) {
    const now = readSubtree(root, snapshot.walk);
    after.push(...now.entries);
    truncated = truncated || now.truncated;
  }
  // A snapshot id outside the walk may have been reparented elsewhere; look it
  // up so it reads as moved, not missing. Only ids that are truly gone are missing.
  const seen = new Set(after.map(e => e.id));
  for (const old of snapshot.entries) {
    if (seen.has(old.id)) continue;
    const node: any = await figma.getNodeByIdAsync(old.id);
    if (node && !node.removed) after.push(positionEntry(node));
  }
  const diff = diffPositionEntries(snapshot.entries, after, tolerance);
  return {
    snapshotId,
    rootId: snapshot.rootId,
    rootMissing: !root,
    counts: { missing: diff.missing.length, added: diff.added.length, moved: diff.moved.length },
    ...diff,
    truncated,
  };
}

const LIST_CAP = 100;

export async function assertContained(params: any) {
  const { parentId, expected, tolerance = CONTAINMENT_TOLERANCE } = params || {};
  const parent = await requireNode(parentId);
  if (!("children" in parent) || !Array.isArray(parent.children)) throw new Error(`Node has no children: ${parentId}`);
  const parentBox = toBox(parent.absoluteBoundingBox);

  // Expected offsets from the parent's box origin, from a snapshot or a map.
  let expectedOffsets: Record<string, { x: number; y: number }> | null = null;
  let parentGrewSinceSnapshot: boolean | null = null;
  if (typeof expected === "string") {
    const snapshot = snapshotStore.get(expected);
    const byId = new Map(snapshot.entries.map(e => [e.id, e]));
    const parentThen = byId.get(parent.id);
    if (!parentThen || !parentThen.box) throw new Error(`Snapshot ${expected} does not hold a measurable box for parent ${parent.id}`);
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
  const childIds = new Set<string>();
  for (const child of parent.children) {
    childIds.add(child.id);
    const box: Box | null = toBox(child.absoluteBoundingBox);
    if (typeof child.rotation === "number" && Math.abs(child.rotation) > 0.01) {
      rotated.push({ id: child.id, name: child.name, rotation: child.rotation });
    }
    if (!box || !parentBox) { unmeasurable.push({ id: child.id, name: child.name }); continue; }
    const overflow = boxOverflow(parentBox, box, tolerance);
    if (overflow) outside.push({ id: child.id, name: child.name, box, overflow });
    if (expectedOffsets) {
      const want = expectedOffsets[child.id];
      const actual = { x: box.x - parentBox.x, y: box.y - parentBox.y };
      if (!want) notInExpected.push(child.id);
      else if (Math.abs(actual.x - want.x) > tolerance || Math.abs(actual.y - want.y) > tolerance) {
        displaced.push({ id: child.id, name: child.name, expected: want, actual });
      }
    }
  }
  const expectedNotFound = expectedOffsets ? Object.keys(expectedOffsets).filter(id => !childIds.has(id)) : [];
  const cap = <T>(list: T[]) => list.slice(0, LIST_CAP);
  const placementChecked = expectedOffsets !== null;
  return {
    parentId: parent.id,
    parentName: parent.name,
    parentBox,
    tolerance,
    childCount: parent.children.length,
    contained: !!parentBox && outside.length === 0 && unmeasurable.length === 0,
    placementChecked,
    placementOk: placementChecked ? displaced.length === 0 && expectedNotFound.length === 0 : null,
    parentGrewSinceSnapshot,
    counts: { outside: outside.length, unmeasurable: unmeasurable.length, rotated: rotated.length, displaced: displaced.length },
    outside: cap(outside),
    unmeasurable: cap(unmeasurable),
    rotated: cap(rotated),
    displaced: cap(displaced),
    notInExpected: cap(notInExpected),
    expectedNotFound: cap(expectedNotFound),
    listsTruncated: [outside, unmeasurable, rotated, displaced, notInExpected, expectedNotFound].some(l => l.length > LIST_CAP),
    note: !parentBox
      ? "The parent has no absoluteBoundingBox, so nothing could be measured."
      : placementChecked
        ? "Boxes are absoluteBoundingBox (shadows and other render bounds ignored); a rotated child is checked by its axis-aligned box."
        : "Containment alone does not prove placement: a section auto-grows around displaced children. Pass expected (a snapshot id or an offset map) to check positions.",
  };
}
