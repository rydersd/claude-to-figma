// Spec sync (L2F_SPEC_SYNC): the pure parts of apply_spec. No I/O.
//   buildApply   - what to send to the plugin's apply_spec_ops for one Plan:
//                  the operations (removals only with allowRemovals; property
//                  conflicts only with onConflict "spec"), the expected live
//                  state, and the Spec's child order for every parent that
//                  gains a node;
//   withCreatedIds - the Spec with the ids of created nodes written in by
//                  index path;
//   findPartial  - touched properties whose read-back is not what was asked;
//   relock       - the SpecLock after the apply, from the read-back.
// See docs/Spec-Sync.md, "apply_spec".

import {
  SPEC_DEFAULTS, canonicalValue, comparableReactions, hashProps, hashString, lockProps, normalizeNode, stableStringify,
  type ParentLayout, type SpecFile, type SpecLockFile, type SpecLockNode, type SpecType,
} from "../shared/spec.js";
import type { ExpectedNode, Plan, PlanIssue, PlanOperation } from "./spec-plan.js";

const same = (a: unknown, b: unknown) => stableStringify(a) === stableStringify(b);
const RESIZABLE = new Set(["frame", "rectangle", "vector"]);

export type OnConflict = "skip" | "spec";

export interface SkippedEntry {
  op?: string;
  id: string;
  name: string;
  kind?: string;
  keys?: string[];
  reason: string;
}

export interface ApplyRequest {
  operations: PlanOperation[];
  expectedHashes: Record<string, ExpectedNode>;
  // Per parent that gains a node: its Spec children in order, an id or, for a
  // node to create, its index path.
  orders: Array<{ parentId: string; children: Array<string | number[]> }>;
  skipped: SkippedEntry[];
}

type Update = Extract<PlanOperation, { op: "update" }>;

// Which conflict keys an overwrite set covers ("properties.Label#1:2" by its
// key in set.properties; pathHash by pathData).
function covers(set: Record<string, unknown>, key: string): boolean {
  if (key.startsWith("properties.")) return !!set.properties && key.slice("properties.".length) in (set.properties as object);
  if (key === "pathHash") return "pathData" in set;
  return key in set;
}

export function buildApply(plan: Plan, spec: SpecFile, options: { allowRemovals: boolean; onConflict: OnConflict }): ApplyRequest {
  const skipped: SkippedEntry[] = [];
  const operations: PlanOperation[] = [];
  const expectedHashes: Record<string, ExpectedNode> = { ...plan.expectedHashes };
  const overwrites = new Map((options.onConflict === "spec" ? plan.overwrites ?? [] : []).map(o => [o.id, o]));
  const merged = new Set<string>();

  for (const op of plan.operations) {
    if (op.op === "remove" && !options.allowRemovals) {
      skipped.push({ op: "remove", id: op.id, name: op.name, reason: "removal needs allowRemovals: true" });
      continue;
    }
    if (op.op === "update" && overwrites.has(op.id)) {
      operations.push(mergeOverwrite(op, overwrites.get(op.id)!));
      merged.add(op.id);
      continue;
    }
    operations.push(op);
  }
  // Conflicts on nodes with no other update become updates of their own,
  // placed after the plan's updates (before its moves).
  const extra: Update[] = [];
  for (const [id, overwrite] of overwrites) {
    if (merged.has(id)) continue;
    extra.push(mergeOverwrite({ op: "update", id, name: overwrite.name, nodeType: overwrite.nodeType, set: {} }, overwrite));
    expectedHashes[id] = overwrite.expected;
  }
  if (extra.length) {
    const at = operations.findIndex(op => op.op === "move" || op.op === "remove");
    operations.splice(at < 0 ? operations.length : at, 0, ...extra);
  }

  for (const issue of plan.conflicts) {
    const overwrite = overwrites.get(issue.id);
    const keys = issue.kind === "property" && overwrite && issue.keys ? issue.keys.filter(k => !covers(overwrite.set, k)) : issue.keys;
    if (issue.kind === "property" && overwrite && keys && !keys.length) continue;
    skipped.push(conflictEntry(issue, keys));
  }

  return { operations, expectedHashes, orders: childOrders(spec, operations), skipped };
}

function conflictEntry(issue: PlanIssue, keys?: string[]): SkippedEntry {
  const entry: SkippedEntry = { id: issue.id, name: issue.name, kind: issue.kind, reason: issue.detail ?? "changed in both the Spec and Figma" };
  if (keys && keys.length) entry.keys = keys;
  return entry;
}

// The plan's update with the conflict values on top (the Spec wins), width and
// height kept together.
function mergeOverwrite(op: Update, overwrite: NonNullable<Plan["overwrites"]>[number]): Update {
  const set: Record<string, unknown> = { ...op.set };
  let fromLive = (op.fromLive ?? []).filter(k => !(k in overwrite.set));
  for (const [key, value] of Object.entries(overwrite.set)) {
    set[key] = key === "properties" ? { ...(set.properties as object ?? {}), ...(value as object) } : value;
  }
  if (RESIZABLE.has(op.nodeType) && ("width" in set) !== ("height" in set) && overwrite.size) {
    const other = "width" in set ? "height" : "width";
    set[other] = overwrite.size[other];
    fromLive = [...fromLive, other];
  }
  const out: Update = { op: "update", id: op.id, name: op.name, nodeType: op.nodeType, set };
  if (fromLive.length) out.fromLive = fromLive;
  return out;
}

// Raw Spec nodes by id, with their index paths.
function indexSpec(tree: Record<string, any>): Map<string, { node: Record<string, any>; path: number[] }> {
  const out = new Map<string, { node: Record<string, any>; path: number[] }>();
  const visit = (node: any, path: number[]) => {
    if (!node || typeof node !== "object") return;
    if (typeof node.id === "string") out.set(node.id, { node, path });
    (Array.isArray(node.children) ? node.children : []).forEach((child: any, i: number) => visit(child, [...path, i]));
  };
  visit(tree, []);
  return out;
}

function childOrders(spec: SpecFile, operations: PlanOperation[]): ApplyRequest["orders"] {
  const parents: string[] = [];
  for (const op of operations) {
    if ((op.op === "create" || op.op === "move") && !parents.includes(op.parentId)) parents.push(op.parentId);
  }
  const index = indexSpec(spec.tree);
  const orders: ApplyRequest["orders"] = [];
  for (const parentId of parents) {
    const hit = index.get(parentId);
    if (!hit) continue;
    const kids: any[] = Array.isArray(hit.node.children) ? hit.node.children : [];
    orders.push({ parentId, children: kids.map((child, i) => (child && typeof child.id === "string" ? child.id : [...hit.path, i])) });
  }
  return orders;
}

// A copy of the Spec with each created node's id written at its index path,
// first among its keys. A path that does not lead to an id-less node is left.
export function withCreatedIds(spec: SpecFile, created: Array<{ path: number[]; id: string }>): SpecFile {
  const copy: SpecFile = JSON.parse(JSON.stringify(spec));
  for (const { path, id } of created) {
    if (!path.length) continue;
    let parent: any = copy.tree;
    for (const i of path.slice(0, -1)) parent = parent && Array.isArray(parent.children) ? parent.children[i] : undefined;
    const last = path[path.length - 1];
    const node = parent && Array.isArray(parent.children) ? parent.children[last] : undefined;
    if (!node || typeof node !== "object" || node.id !== undefined) continue;
    parent.children[last] = { id, ...node };
  }
  return copy;
}

interface Desired {
  props: Record<string, unknown>;
  parentId: string | null;
  children: string[];
  type: SpecType;
}

// Every Spec node with an id, normalised in its parent's layout, in SpecLock form.
function desiredNodes(spec: SpecFile, rootParentId: string | null, rootParentLayout: ParentLayout): Map<string, Desired> {
  const out = new Map<string, Desired>();
  const visit = (raw: any, parentId: string | null, layout: ParentLayout) => {
    if (!raw || typeof raw !== "object") return;
    const id = typeof raw.id === "string" ? raw.id : null;
    const kids: any[] = Array.isArray(raw.children) ? raw.children : [];
    if (id) {
      out.set(id, {
        props: lockProps(normalizeNode(raw, layout)), parentId, type: raw.type,
        children: kids.filter(k => k && typeof k.id === "string").map(k => k.id),
      });
    }
    const own = { layoutMode: typeof raw.layoutMode === "string" ? raw.layoutMode : "NONE" };
    // Children of a node not created stay unknown: they have no ids either.
    if (id) for (const kid of kids) visit(kid, id, own);
  };
  visit(spec.tree, rootParentId, rootParentLayout);
  return out;
}

export interface ReadBack {
  rootParentId: string | null;
  rootParentLayoutMode: string | null;
  truncated?: boolean;
  nodes: Record<string, SpecLockNode>;
}

export interface PartialEntry {
  id: string;
  keys: string[];
  // What happened, when a move or removal did move the node but not all as asked.
  detail?: string;
}

// A key's value for comparison: absent means the type's default.
const orDefault = (type: SpecType, key: string, value: unknown) => (value !== undefined ? value : SPEC_DEFAULTS[type]?.[key]);

// Touched properties whose read-back differs from what was asked: each update's
// keys (not the dimension added from live, not keys that failed), and every
// property of a created node. A key Figma now derives (absent with no default)
// cannot be compared and is not reported.
export function findPartial(sent: PlanOperation[], failed: Array<Record<string, any>>, created: Array<{ id: string; failed?: boolean }>, readBack: ReadBack, spec: SpecFile): PartialEntry[] {
  const out: PartialEntry[] = [];
  const failedKeys = new Map<string, Set<string>>();
  for (const f of failed) {
    if (f.op !== "update" || typeof f.id !== "string") continue;
    const set = failedKeys.get(f.id) ?? new Set<string>();
    for (const k of Array.isArray(f.keys) ? f.keys : []) set.add(k);
    failedKeys.set(f.id, set);
  }
  for (const op of sent) {
    if (op.op !== "update") continue;
    const live = readBack.nodes[op.id];
    if (!live) continue;
    const skip = failedKeys.get(op.id) ?? new Set();
    const keys: string[] = [];
    for (const [key, raw] of Object.entries(op.set)) {
      if (op.fromLive?.includes(key) || skip.has(key)) continue;
      if (key === "pathData") {
        const want = canonicalValue("pathData", raw);
        if (typeof want === "string" && live.props.pathHash !== hashString(want)) keys.push(key);
        continue;
      }
      if (key === "properties") {
        const got = (live.props.properties ?? {}) as Record<string, unknown>;
        for (const [name, value] of Object.entries((raw ?? {}) as Record<string, unknown>)) if (!same(value, got[name])) keys.push(`properties.${name}`);
        continue;
      }
      const got = orDefault(op.nodeType, key, live.props[key]);
      if (got === undefined) continue;
      const want = canonicalValue(key, raw);
      // The read-back is in the SpecLock's form (lockProps): compare in it.
      if (!same(key === "reactions" ? comparableReactions(want) : want, got)) keys.push(key);
    }
    if (keys.length) out.push({ id: op.id, keys });
  }
  const desired = desiredNodes(spec, readBack.rootParentId, { layoutMode: readBack.rootParentLayoutMode ?? undefined });
  for (const { id, failed: bindFailed } of created) {
    const want = desired.get(id);
    const live = readBack.nodes[id];
    if (!want || !live) continue;
    const keys = [...new Set([...Object.keys(want.props), ...Object.keys(live.props)])]
      .filter(key => !same(orDefault(want.type, key, want.props[key]), orDefault(want.type, key, live.props[key])))
      // A node whose colour binding failed keeps its "(failed)" name; reported under failed.
      .filter(key => !(bindFailed && key === "name"));
    if (keys.length) out.push({ id, keys: keys.sort() });
  }
  return out;
}

// The SpecLock after an apply. Per node and per property, the read-back is the
// new base where it agrees with the Spec (the edit landed, or nothing changed);
// where they disagree the old base is kept, so whatever the next plan saw
// before (an edit not applied: skipped, partial or failed; drift; a conflict)
// it sees again, and drift is never turned into an edit that reverts it.
// - A node still in the Spec but not read back (gone from Figma, or past the
//   read budget) keeps its old entry; the next plan reports it.
// - A node the Spec dropped that is still in Figma (a removal skipped) keeps
//   its old entry, so the next plan proposes the removal again.
// - A node added by hand stays out, so it is still reported as added.
// - Child order is the read-back's where it matches the Spec; otherwise the
//   old order, with nodes that arrived (moved or created) placed after their
//   nearest earlier sibling in Figma.
export function relock(oldLock: SpecLockFile, spec: SpecFile, readBack: ReadBack, supersededFrameId: string | null, newSpecHash: string): SpecLockFile {
  const desired = desiredNodes(spec, oldLock.nodes[oldLock.rootId]?.parentId ?? readBack.rootParentId, { layoutMode: readBack.rootParentLayoutMode ?? undefined });
  const nodes: Record<string, SpecLockNode> = {};
  const fresh = new Set<string>();
  const ids = new Set([...desired.keys(), ...Object.keys(oldLock.nodes)]);
  for (const id of ids) {
    const live = readBack.nodes[id];
    const old = oldLock.nodes[id];
    const want = desired.get(id);
    const newlyCut = !!(live && old && live.props.truncated === true && old.props.truncated !== true);
    if (!live || newlyCut) {
      if (want && old) nodes[id] = { ...old };
      continue;
    }
    if (!want) {
      if (old) nodes[id] = { ...old };
      continue;
    }
    if (!old) {
      nodes[id] = { props: live.props, propsHash: live.propsHash, parentId: live.parentId, children: [] };
      fresh.add(id);
      continue;
    }
    const props = mergeProps(old.props, want.props, live.props);
    nodes[id] = { props, propsHash: hashProps(props), parentId: same(want.parentId, live.parentId) ? live.parentId : old.parentId, children: [] };
    fresh.add(id);
  }
  for (const [id, node] of Object.entries(nodes)) {
    const live = readBack.nodes[id];
    const old = oldLock.nodes[id];
    const mine = (c: string) => !!nodes[c] && nodes[c].parentId === id;
    if (!fresh.has(id) || !live) {
      node.children = (old?.children ?? []).filter(c => !!nodes[c]);
      continue;
    }
    const liveKids = live.children.filter(mine);
    const want = desired.get(id);
    const wantKids = (want?.children ?? []).filter(mine);
    if (!old || same(liveKids, wantKids)) { node.children = liveKids; continue; }
    const kids = old.children.filter(mine);
    for (let i = 0; i < liveKids.length; i++) {
      const c = liveKids[i];
      if (kids.includes(c)) continue;
      let at = 0;
      for (let j = i - 1; j >= 0; j--) {
        const k = kids.indexOf(liveKids[j]);
        if (k >= 0) { at = k + 1; break; }
      }
      kids.splice(at, 0, c);
    }
    node.children = kids;
  }
  return { ...oldLock, specHash: newSpecHash, pendingApply: null, supersededFrameId, nodes };
}

function mergeProps(old: Record<string, unknown>, want: Record<string, unknown>, live: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of new Set([...Object.keys(live), ...Object.keys(old), ...Object.keys(want)])) {
    let value: unknown;
    if (key === "properties" && (old.properties !== undefined || live.properties !== undefined)) {
      const merged = mergeProps((old.properties ?? {}) as Record<string, unknown>, (want.properties ?? {}) as Record<string, unknown>, (live.properties ?? {}) as Record<string, unknown>);
      value = Object.keys(merged).length || live.properties !== undefined ? merged : undefined;
    } else {
      value = same(live[key], want[key]) ? live[key] : old[key];
    }
    if (value !== undefined) out[key] = value;
  }
  return out;
}
