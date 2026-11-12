// Pure verification logic (L2F_VERIFY), shared by the plugin and the server:
// resize read-back causes, box containment and position diffs. No Figma access
// here; the plugin reads nodes and passes plain values in.

export interface Box { x: number; y: number; width: number; height: number }

// A node's position record: what a snapshot keeps and what a diff compares.
export interface PositionEntry { id: string; name: string; parentId: string | null; box: Box | null }

export const CONTAINMENT_TOLERANCE = 0.5;
// Read-back slack for resize: Figma stores sizes as floats, so equal is "within 0.01".
const SIZE_EPSILON = 0.01;

export function toBox(value: any): Box | null {
  if (!value || typeof value !== "object") return null;
  const { x, y, width, height } = value;
  return [x, y, width, height].every(n => typeof n === "number" && isFinite(n)) ? { x, y, width, height } : null;
}

// How far `child` sticks out of `parent` on each side, or null when it fits
// within the tolerance on every side.
export function boxOverflow(parent: Box, child: Box, tolerance = CONTAINMENT_TOLERANCE) {
  const overflow = {
    left: parent.x - child.x,
    top: parent.y - child.y,
    right: child.x + child.width - (parent.x + parent.width),
    bottom: child.y + child.height - (parent.y + parent.height),
  };
  return Object.values(overflow).some(v => v > tolerance) ? overflow : null;
}

// The sizing state that can make Figma apply a different size than requested.
export interface SizingState {
  type?: string;
  layoutSizingHorizontal?: string;
  layoutSizingVertical?: string;
  minWidth?: number | null;
  maxWidth?: number | null;
  minHeight?: number | null;
  maxHeight?: number | null;
  textAutoResize?: string;
}

export interface ResizeReadBack {
  requested: { width: number; height: number };
  applied: { width: number; height: number };
  partial: boolean;
  cause: string | null;
}

function axisCause(axis: "width" | "height", requested: number, applied: number, s: SizingState): string {
  const horizontal = axis === "width";
  const sizing = horizontal ? s.layoutSizingHorizontal : s.layoutSizingVertical;
  const min = horizontal ? s.minWidth : s.minHeight;
  const max = horizontal ? s.maxWidth : s.maxHeight;
  const minName = horizontal ? "minWidth" : "minHeight";
  const maxName = horizontal ? "maxWidth" : "maxHeight";
  if (sizing === "HUG" || sizing === "FILL") return `${axis}: ${horizontal ? "layoutSizingHorizontal" : "layoutSizingVertical"} is ${sizing}`;
  if (typeof min === "number" && requested < min - SIZE_EPSILON) return `${axis}: ${minName} is ${min}`;
  if (typeof max === "number" && requested > max + SIZE_EPSILON) return `${axis}: ${maxName} is ${max}`;
  if (s.type === "TEXT" && (s.textAutoResize === "WIDTH_AND_HEIGHT" || (!horizontal && s.textAutoResize === "HEIGHT"))) {
    return `${axis}: textAutoResize is ${s.textAutoResize}`;
  }
  return `${axis}: unexplained (requested ${requested}, Figma applied ${applied}; no sizing mode, min/max or text auto-resize accounts for it)`;
}

// Compares what was asked for with what the node reports after resize(). Figma
// applies what it can and throws nothing, so this is the only evidence.
export function resizeReadBack(requested: { width: number; height: number }, applied: { width: number; height: number }, state: SizingState): ResizeReadBack {
  const causes: string[] = [];
  if (Math.abs(applied.width - requested.width) > SIZE_EPSILON) causes.push(axisCause("width", requested.width, applied.width, state));
  if (Math.abs(applied.height - requested.height) > SIZE_EPSILON) causes.push(axisCause("height", requested.height, applied.height, state));
  return {
    requested: { width: requested.width, height: requested.height },
    applied: { width: applied.width, height: applied.height },
    partial: causes.length > 0,
    cause: causes.length ? causes.join("; ") : null,
  };
}

function boxMoved(a: Box | null, b: Box | null, tolerance: number): boolean {
  if (!a || !b) return a !== b;
  return Math.abs(a.x - b.x) > tolerance || Math.abs(a.y - b.y) > tolerance
    || Math.abs(a.width - b.width) > tolerance || Math.abs(a.height - b.height) > tolerance;
}

export interface PositionMove {
  id: string;
  name: string;
  reparented: boolean;
  boxChanged: boolean;
  from: { parentId: string | null; box: Box | null };
  to: { parentId: string | null; box: Box | null };
}

// `before` is a snapshot; `after` holds the same subtree read now, plus any
// snapshot id that still exists elsewhere in the document (a reparent out of the
// subtree). An id absent from `after` no longer exists (deleted or absorbed).
export function diffPositionEntries(before: PositionEntry[], after: PositionEntry[], tolerance = CONTAINMENT_TOLERANCE) {
  const now = new Map(after.map(e => [e.id, e]));
  const then = new Set(before.map(e => e.id));
  const missing: string[] = [];
  const moved: PositionMove[] = [];
  for (const old of before) {
    const cur = now.get(old.id);
    if (!cur) { missing.push(old.id); continue; }
    const reparented = old.parentId !== cur.parentId;
    const boxChanged = boxMoved(old.box, cur.box, tolerance);
    if (reparented || boxChanged) {
      moved.push({ id: old.id, name: cur.name, reparented, boxChanged, from: { parentId: old.parentId, box: old.box }, to: { parentId: cur.parentId, box: cur.box } });
    }
  }
  const added = after.filter(e => !then.has(e.id)).map(e => e.id);
  return { missing, added, moved };
}
