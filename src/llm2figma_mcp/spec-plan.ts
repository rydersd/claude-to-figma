// Spec sync (L2F_SPEC_SYNC): the three-way comparison behind plan_spec. Pure
// functions, no I/O. For every node id and every property:
//   base    = the SpecLock (what Figma held at the last pull),
//   desired = the Spec (the model's edits),
//   live    = Figma now (read_spec_nodes).
// Desired differing from base is the user's edit; live differing from base is
// drift in Figma; both differing, and disagreeing, is a conflict. Structure
// (parent and child order) is compared the same three ways. See
// docs/Spec-Sync.md and the plan's "Spec sync" section for the tables.

import {
  OPAQUE_TYPE, SPEC_DEFAULTS, UNREAD_KEY, clip, lockProps, normalizeNode, normalizeSpecTree, showList, showValue,
  stableStringify, type ParentLayout, type SpecFile, type SpecLockFile, type SpecType,
} from "../shared/spec.js";

// What read_spec_nodes returns per live node. `props` only when propsHash
// differs from the base hash sent in; `size` only for the ids in sizeIds.
export interface LiveNode {
  propsHash: string;
  parentId: string | null;
  children: string[];
  props?: Record<string, unknown>;
  size?: { width: number; height: number };
}

export interface LiveRead {
  fileKey: string | null;
  fileName: string | null;
  pageId: string;
  rootId: string;
  rootParentId: string | null;
  rootParentLayoutMode: string | null;
  truncated: boolean;
  nodeCount: number;
  nodes: Record<string, LiveNode>;
}

export type PlanOperation =
  // Set exactly these properties (Spec vocabulary, canonical values). A key the
  // Spec deleted carries its SPEC_DEFAULTS value. `fromLive` names a dimension
  // added only because the resize branches need both (its live value).
  | { op: "update"; id: string; name: string; nodeType: SpecType; set: Record<string, unknown>; fromLive?: string[] }
  // A new Spec node (no id) whose parent exists; `node` is its whole canonical
  // subtree (none of it has ids). `path` is its index path in the Spec tree,
  // `index` its position in the parent's Spec child list, `after` the nearest
  // earlier sibling that has an id (null when none).
  | { op: "create"; path: number[]; parentId: string; index: number; after: string | null; name: string; node: Record<string, any> }
  // Reparent and/or reorder. `index` and `after` are as for create;
  // `fromParentId` is the parent Figma and the SpecLock agree on.
  | { op: "move"; id: string; name: string; fromParentId: string; parentId: string; index: number; after: string | null }
  // Topmost node of a subtree the Spec dropped; descendants travel with it.
  | { op: "remove"; id: string; name: string; parentId: string };

export type IssueKind = "property" | "structure" | "added" | "type" | "missing" | "remove" | "unread";

export interface PlanIssue {
  id: string;
  name: string;
  kind: IssueKind;
  keys?: string[];
  detail?: string;
}

// The live state plan_spec saw for a node an operation touches. 11d recomputes
// these inside the plugin, in the same run as its writes, and refuses on any
// difference.
export interface ExpectedNode {
  propsHash: string;
  parentId: string | null;
  children: string[];
}

export interface PlanCounts {
  operations: number;
  updates: number;
  properties: number;
  creates: number;
  moves: number;
  removes: number;
  drift: number;
  conflicts: number;
  converged: number;
  unread: number;
  liveNodes: number;
}

export interface PlanBody {
  operations: PlanOperation[];
  expectedHashes: Record<string, ExpectedNode>;
  drift: PlanIssue[];
  conflicts: PlanIssue[];
  counts: PlanCounts;
  liveTruncated: boolean;
}

export interface Plan extends PlanBody {
  l2fPlan: 1;
  planId: string;
  createdAt: string;
  specPath: string;
  lockPath: string;
  // specHash() of the Spec as read; 11d refuses if the file no longer matches.
  specHash: string;
  // specHash() of the whole SpecLock; a re-pull in between changes it.
  lockHash: string;
  // The relay channel the live read came through (the Figma file).
  channel: string | null;
  target: { fileKey: string | null; fileName: string | null; pageId: string; rootId: string };
}

// One node of the Spec as the model left it, normalised.
interface DesiredNode {
  id: string;
  props: Record<string, unknown>;
  // lockProps(props): the SpecLock's form (pathHash for pathData), for comparison.
  compare: Record<string, unknown>;
  parentId: string | null;
  parentLayout: ParentLayout;
  path: number[];
  raw: Record<string, any>;
}

export interface PreparedSpec {
  desired: Map<string, DesiredNode>;
  // Spec child order per parent id, ids only (new nodes are in `creates`).
  desiredChildren: Map<string, string[]>;
  creates: Array<Extract<PlanOperation, { op: "create" }>>;
  baseHashes: Record<string, string>;
  // SpecLock nodes recorded as cut off by a budget, with their recorded reason:
  // the live read reads them as the same placeholders.
  truncated: Record<string, string>;
  // Nodes whose Spec width or height differs from the base: the read returns
  // their live size, since an update naming one dimension needs the other.
  sizeIds: string[];
}

const MAX_LISTED_ERRORS = 10;
const RESIZABLE = new Set(["frame", "rectangle", "vector"]);
// Figma keeps a node's geometry when its context changes; never implied.
const GEOMETRY = new Set(["x", "y", "width", "height"]);

// Every value on both sides has been through normalizeNode (canonicalValue), so
// "$var:Name" and {"$var": "Name", "opacity": 1} are already one form.
const same = (a: unknown, b: unknown) => stableStringify(a) === stableStringify(b);
// Stands for a value Figma holds that the format cannot express (a key in the
// node's $unread): equal only to itself.
const UNREADABLE = { $unreadable: true } as const;
const STRICT = { strict: true };
const unreadKeys = (props: Record<string, unknown>): Set<string> =>
  new Set(Array.isArray(props[UNREAD_KEY]) ? (props[UNREAD_KEY] as string[]) : []);
const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const layoutOf = (raw: Record<string, any>): ParentLayout => ({ layoutMode: typeof raw.layoutMode === "string" ? raw.layoutMode : "NONE" });
const where = (path: number[]) => (path.length ? `tree.children[${path.join("].children[")}]` : "tree");

function nameOf(props: Record<string, unknown> | undefined, fallback: string): string {
  return clip(props && typeof props.name === "string" ? props.name : fallback);
}

function failWith(errors: string[]): never {
  const shown = errors.slice(0, MAX_LISTED_ERRORS).map(e => "- " + e).join("\n");
  const more = errors.length > MAX_LISTED_ERRORS ? `\n- ...and ${errors.length - MAX_LISTED_ERRORS} more` : "";
  throw new Error(`The Spec cannot be planned:\n${shown}${more}`);
}

// Validate the Spec against its SpecLock and normalise it. Throws, naming each
// offending node, on: a duplicate id, an id the SpecLock does not know, an id
// inside an instance (`;`), a changed root, a changed node type, an edit to an
// OpaqueNode other than its place, children under a node that is not a frame,
// a new OpaqueNode, and an existing node placed under a new one (v1: apply the
// new parent first, pull, then move into it).
export function prepareSpec(spec: SpecFile, lock: SpecLockFile, rootParentLayout: ParentLayout = {}): PreparedSpec {
  const errors: string[] = [];
  for (const key of ["fileKey", "fileName", "pageId", "rootId"] as const) {
    if ((spec[key] ?? null) !== (lock[key] ?? null)) {
      errors.push(`header ${key} is ${showValue(spec[key])} but the SpecLock has ${showValue(lock[key])}; the header is not editable`);
    }
  }
  if (spec.tree.id !== lock.rootId) errors.push(`tree: the root must keep id ${clip(String(lock.rootId))} (found ${showValue(spec.tree.id)})`);

  const desired = new Map<string, DesiredNode>();
  const desiredChildren = new Map<string, string[]>();
  const creates: PreparedSpec["creates"] = [];
  const seen = new Set<string>();

  const visit = (raw: any, path: number[], parentId: string | null, parentLayout: ParentLayout, underNew: boolean) => {
    const at = where(path);
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) { errors.push(`${at}: not a node object`); return; }
    const id = raw.id;
    if (id !== undefined && (typeof id !== "string" || !id)) { errors.push(`${at}: id must be a non-empty string`); return; }
    const named = `${at}${id ? ` (${clip(id)})` : ""}`;
    // Strict: a key the type cannot write, or a value the write path cannot
    // take, is an error, never a silent reset to the default.
    let props: Record<string, unknown>;
    try {
      props = normalizeNode(raw, parentLayout, STRICT);
    } catch (error) {
      errors.push(`${named}: ${error instanceof Error ? error.message : String(error)}`);
      return;
    }
    const kids = raw.children;
    if (kids !== undefined && !Array.isArray(kids)) errors.push(`${at}: children must be an array`);
    const childList: any[] = Array.isArray(kids) ? kids : [];
    if (childList.length && props.type !== "frame") {
      errors.push(`${named}: only a frame can have children (this node is ${String(props.type)}${props.type === OPAQUE_TYPE ? "; an OpaqueNode's subtree is never in the Spec" : ""})`);
    }

    if (id !== undefined) {
      if (id.includes(";")) errors.push(`${named}: nodes inside an instance cannot be edited, moved or removed; instances are leaves`);
      else if (seen.has(id)) errors.push(`${named}: duplicate id`);
      else if (!lock.nodes[id]) errors.push(`${named}: the SpecLock does not know this id; a new node has no id`);
      else if (underNew) errors.push(`${named}: an existing node cannot be placed under a new node in one plan; apply the new parent first, pull, then move this node into it`);
      else {
        const base = lock.nodes[id];
        if (base.props.type !== props.type) {
          errors.push(`${named}: type changed from ${clip(String(base.props.type))} to ${clip(String(props.type))}; delete the node and add a new one without an id instead`);
        } else if (props.type === OPAQUE_TYPE && !same(props, base.props)) {
          errors.push(`${named}: "${nameOf(base.props, id)}" is an OpaqueNode; it can only be moved or reordered, not edited`);
        } else if (!same(props[UNREAD_KEY], base.props[UNREAD_KEY])) {
          errors.push(`${named}: ${UNREAD_KEY} cannot be edited or removed (the SpecLock has ${showValue(base.props[UNREAD_KEY] ?? [])}); it lists what Figma holds that the Spec cannot express. Restore it; to change one of those properties, set its key`);
        }
      }
      seen.add(id);
      desired.set(id, { id, props, compare: lockProps(props), parentId, parentLayout, path, raw });
    } else {
      if (props.type === OPAQUE_TYPE) errors.push(`${at}: an OpaqueNode cannot be created`);
      if (props[UNREAD_KEY] !== undefined) errors.push(`${at}: a new node cannot carry ${UNREAD_KEY}; only a pull writes it`);
      if (!underNew && parentId !== null) {
        const siblings = desiredChildren.get(parentId) ?? [];
        creates.push({
          op: "create", path, parentId, index: path[path.length - 1], after: siblings.length ? siblings[siblings.length - 1] : null,
          name: nameOf(props, String(props.type)), node: stripIds(normalizeSpecTree(raw, parentLayout, STRICT)),
        });
      }
    }

    const ownId = id !== undefined && !underNew ? id : null;
    if (ownId) desiredChildren.set(ownId, []);
    const layout = layoutOf(raw);
    childList.forEach((child, i) => {
      visit(child, [...path, i], ownId, layout, underNew || id === undefined);
      if (ownId && child && typeof child === "object" && typeof child.id === "string" && desired.has(child.id) && desired.get(child.id)!.parentId === ownId) {
        desiredChildren.get(ownId)!.push(child.id);
      }
    });
  };
  visit(spec.tree, [], lock.nodes[lock.rootId]?.parentId ?? null, rootParentLayout, false);
  if (errors.length) failWith(errors);

  const baseHashes: Record<string, string> = {};
  const truncated: Record<string, string> = {};
  for (const [id, node] of Object.entries(lock.nodes)) {
    baseHashes[id] = node.propsHash;
    if (node.props.truncated === true) truncated[id] = typeof node.props.reason === "string" ? node.props.reason : "node budget";
  }
  const sizeIds: string[] = [];
  for (const [id, node] of desired) {
    const base = lock.nodes[id].props;
    if (RESIZABLE.has(String(node.props.type)) && (!same(node.props.width, base.width) || !same(node.props.height, base.height))) sizeIds.push(id);
  }
  return { desired, desiredChildren, creates, baseHashes, truncated, sizeIds };
}

function stripIds(node: Record<string, any>): Record<string, any> {
  const { id: _id, children, ...rest } = node;
  return children ? { ...rest, children: children.map(stripIds) } : rest;
}

// Members of the longest common subsequence of two orderings of the same set:
// the nodes that kept their relative order. Everything else moved. Computed as
// the longest increasing run of positions (O(n log n)), deterministic for
// equal inputs.
function keptOrder(a: string[], b: string[]): Set<string> {
  const pos = new Map(b.map((id, i) => [id, i]));
  const seq = a.map(id => pos.get(id)!);
  const tails: number[] = [];
  const prev: number[] = new Array(seq.length).fill(-1);
  for (let i = 0; i < seq.length; i++) {
    let lo = 0;
    let hi = tails.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (seq[tails[mid]] < seq[i]) lo = mid + 1; else hi = mid;
    }
    if (lo > 0) prev[i] = tails[lo - 1];
    tails[lo] = i;
  }
  const kept = new Set<string>();
  for (let i = tails.length ? tails[tails.length - 1] : -1; i >= 0; i = prev[i]) kept.add(a[i]);
  return kept;
}

// Would `key` survive normalisation on this node? False when Figma derives it
// in the node's (desired) context, e.g. width on a FILL axis or x inside
// auto-layout: then the Spec leaving it out is not a request to reset it.
function applicable(props: Record<string, unknown>, key: string, value: unknown, parentLayout: ParentLayout): boolean {
  if (value === undefined) return false;
  return key in normalizeNode({ ...props, [key]: value }, parentLayout);
}

export interface PlanInput {
  spec: SpecFile;
  lock: SpecLockFile;
  live: LiveRead;
  prepared: PreparedSpec;
}

export function computePlan({ lock, live, prepared }: PlanInput): PlanBody {
  const base = lock.nodes;
  const errors: string[] = [];
  const operations: { create: PlanOperation[]; update: PlanOperation[]; move: PlanOperation[]; remove: PlanOperation[] } = {
    create: [], update: [], move: [], remove: [],
  };
  const drift: PlanIssue[] = [];
  const conflicts: PlanIssue[] = [];
  const expected: Record<string, ExpectedNode> = {};
  let converged = 0;

  const liveNodes = live.nodes;
  const liveProps = (id: string): Record<string, unknown> | undefined => {
    const node = liveNodes[id];
    if (!node) return undefined;
    if (node.props) return node.props;
    return base[id] && base[id].propsHash === node.propsHash ? base[id].props : undefined;
  };
  const touch = (id: string | null) => {
    if (!id || expected[id] || !liveNodes[id]) return;
    const { propsHash, parentId, children } = liveNodes[id];
    expected[id] = { propsHash, parentId, children };
  };
  const label = (id: string) => nameOf(prepared.desired.get(id)?.props ?? base[id]?.props ?? liveProps(id), id);

  // Nodes this read could not see. A live node the budget newly cut off (an
  // OpaqueNode with truncated: true that the SpecLock has as an ordinary node)
  // and every base node below it are unread: nothing about them is compared,
  // and nothing in them is ever planned for removal or reported missing.
  const unread = new Set<string>();
  const addUnread = (id: string) => {
    if (unread.has(id)) return;
    unread.add(id);
    for (const child of base[id]?.children ?? []) addUnread(child);
  };
  for (const id of Object.keys(liveNodes)) {
    const props = liveProps(id);
    if (props && props.type === OPAQUE_TYPE && props.truncated === true && base[id] && base[id].props.truncated !== true) addUnread(id);
  }

  // --- Properties ---
  for (const [id, want] of prepared.desired) {
    const was = base[id];
    const wanted = want.compare;
    if (unread.has(id)) {
      if (!sameProps(wanted, was.props) || want.parentId !== was.parentId) {
        conflicts.push({ id, name: label(id), kind: "unread", detail: "Figma has more nodes here than this read could see; pull with a larger maxNodes" });
      }
      continue;
    }
    // Untouched on both sides: the common case, decided without a key walk.
    if (liveNodes[id] && liveNodes[id].propsHash === was.propsHash && sameProps(wanted, was.props)) continue;
    const now = liveProps(id);
    if (!liveNodes[id] || !now) {
      conflicts.push({ id, name: label(id), kind: "missing", detail: "no longer in the live subtree (deleted, or moved out of it, in Figma)" });
      continue;
    }
    if (now.type !== was.props.type) {
      const edited = !sameProps(wanted, was.props);
      (edited ? conflicts : drift).push({ id, name: label(id), kind: "type", detail: `Figma now has ${String(now.type)}${now.nodeType ? ` (${String(now.nodeType)})` : ""}` });
      continue;
    }
    if (was.props.type === OPAQUE_TYPE) {
      // A placeholder the live read cut off for another budget than the pull did
      // is the same unread node: its reason is not drift.
      const ignore = was.props.truncated === true && now.truncated === true ? ["reason"] : [];
      const keys = diffKeys(was.props, now).filter(k => !ignore.includes(k));
      if (keys.length) drift.push({ id, name: label(id), kind: "property", keys });
      continue;
    }
    const type = want.props.type as SpecType;
    const set: Record<string, unknown> = {};
    const drifted: string[] = [];
    const conflicted: string[] = [];
    // Keys Figma holds a value for that the Spec cannot express: setting one
    // is a conflict, never an update (the Spec never saw what it replaces).
    const unexpressed: string[] = [];
    const baseUnread = unreadKeys(was.props);
    const liveUnread = unreadKeys(now);
    const keys = new Set([...Object.keys(was.props), ...Object.keys(wanted), ...Object.keys(now), ...baseUnread, ...liveUnread]);
    keys.delete("type");
    // Compared through its members: a key entering or leaving the live $unread
    // is drift on that key. prepareSpec refuses any edit to it.
    keys.delete(UNREAD_KEY);
    // Auto-layout keys absent from base, Spec and Figma that the Spec's new
    // context requires (turning layoutMode on, or layoutWrap to WRAP): absent
    // means the create default (padding 10, itemReverseZIndex true), while
    // Figma would derive its own (padding 0), so the default is written.
    const implied: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(SPEC_DEFAULTS[type])) {
      if (keys.has(key) || GEOMETRY.has(key) || !applicable(want.props, key, value, want.parentLayout)) continue;
      implied[key] = value;
      keys.add(key);
    }
    for (const key of [...keys].sort()) {
      if (key === "properties") {
        const result = compareProperties(was.props.properties, wanted.properties, now.properties);
        if (result.removed) {
          errors.push(`${where(want.path)} (${clip(id)}): ${result.removed} cannot be removed; set the value you want instead`);
          continue;
        }
        if (result.set) set.properties = result.set;
        drifted.push(...result.drifted);
        conflicted.push(...result.conflicted);
        converged += result.converged;
        continue;
      }
      const b = baseUnread.has(key) ? UNREADABLE : was.props[key];
      const l = liveUnread.has(key) ? UNREADABLE : now[key];
      // A Spec that leaves an unread key out says nothing about it.
      let d = key in implied ? implied[key] : wanted[key];
      if (d === undefined && b === UNREADABLE) d = UNREADABLE;
      // Left out of the Spec because Figma derives it there: not a reset. A
      // vector's path is compared as pathHash and always applicable.
      if (d === undefined && b !== undefined && b !== UNREADABLE && key !== "pathHash" && !applicable(want.props, key, b, want.parentLayout)) continue;
      // A key deleted from the Spec means its default: deleting one whose base
      // value already is the default (x: 0, a FIXED width of 100) changes nothing.
      const fallback = SPEC_DEFAULTS[type][key];
      const deleted = d === undefined && b !== undefined;
      const value = deleted && fallback !== undefined ? fallback : d;
      const desiredChanged = !same(value, b);
      const liveChanged = !same(l, b);
      if (!desiredChanged && !liveChanged) continue;
      if (desiredChanged && !liveChanged) {
        if (b === UNREADABLE) { unexpressed.push(key); continue; }
        if (value === undefined) {
          const shown = key === "pathHash" ? "pathData" : key;
          const hint = type === "text" && key === "name" ? " (a text node is named by its text only while Figma's auto-rename is on; rename it in Figma)" : "";
          errors.push(`${where(want.path)} (${clip(id)}): ${shown} cannot be removed; set the value you want instead${hint}`);
          continue;
        }
        // A path compared by hash is written as the Spec's pathData.
        if (key === "pathHash") set.pathData = want.props.pathData;
        else set[key] = value;
      } else if (!desiredChanged) {
        drifted.push(key);
      } else if (same(value, l) || (d === undefined && l === undefined)) {
        converged++;
      } else {
        conflicted.push(key);
      }
    }
    if (drifted.length) drift.push({ id, name: label(id), kind: "property", keys: drifted });
    if (conflicted.length) conflicts.push({ id, name: label(id), kind: "property", keys: conflicted });
    if (unexpressed.length) {
      conflicts.push({
        id, name: label(id), kind: "property", keys: unexpressed,
        detail: `Figma holds a value the Spec cannot express (listed in ${UNREAD_KEY}), so it is not overwritten; change it in Figma, or remove it there and pull`,
      });
    }
    if (Object.keys(set).length) {
      const op: Extract<PlanOperation, { op: "update" }> = { op: "update", id, name: label(id), nodeType: type, set };
      if (RESIZABLE.has(type) && ("width" in set) !== ("height" in set)) {
        const other = "width" in set ? "height" : "width";
        const size = liveNodes[id].size;
        const value = size ? size[other] : now[other] ?? SPEC_DEFAULTS[type][other];
        if (value !== undefined) { set[other] = value; op.fromLive = [other]; }
      }
      operations.update.push(op);
      touch(id);
    }
  }

  // --- Structure: parent and order, per node ---
  const desiredParent = (id: string) => prepared.desired.get(id)?.parentId;
  const keptCache = new Map<string, Set<string>>();
  // Members of `parent`'s children in both orderings, in each one's order, and
  // which of them kept their relative order.
  const kept = (cacheKey: string, a: string[], b: string[]) => {
    let hit = keptCache.get(cacheKey);
    if (!hit) {
      const inB = new Set(b);
      const inA = new Set(a);
      hit = keptOrder(a.filter(id => inB.has(id)), b.filter(id => inA.has(id)));
      keptCache.set(cacheKey, hit);
    }
    return hit;
  };
  const liveKids = (id: string) => (liveNodes[id] ? liveNodes[id].children : []);
  const baseKids = (id: string) => base[id]?.children ?? [];
  const wantKids = (id: string) => prepared.desiredChildren.get(id) ?? [];

  for (const [id, want] of prepared.desired) {
    if (unread.has(id) || !liveNodes[id]) continue;
    const bp = base[id].parentId;
    const lp = liveNodes[id].parentId;
    if (id === lock.rootId) {
      if (lp !== bp) drift.push({ id, name: label(id), kind: "structure", detail: `the root moved in Figma (parent ${bp} -> ${lp})` });
      continue;
    }
    const dp = want.parentId!;
    const desiredMoved = dp !== bp || !kept(`d:${bp}`, baseKids(bp!), wantKids(bp!)).has(id);
    const liveMoved = lp !== bp || !kept(`l:${bp}`, baseKids(bp!), liveKids(bp!)).has(id);
    if (!desiredMoved && !liveMoved) continue;
    if (!desiredMoved) {
      drift.push({ id, name: label(id), kind: "structure", detail: lp !== bp ? `moved in Figma to parent ${lp}` : "reordered in Figma" });
      continue;
    }
    if (liveMoved) {
      if (dp === lp && kept(`dl:${dp}`, wantKids(dp), liveKids(dp)).has(id)) converged++;
      else conflicts.push({ id, name: label(id), kind: "structure", detail: "moved in both the Spec and Figma, to different places" });
      continue;
    }
    if (unread.has(dp) || !liveNodes[dp]) {
      conflicts.push({ id, name: label(id), kind: "structure", detail: `its new parent ${dp} is not in the live subtree` });
      continue;
    }
    const siblings = wantKids(dp);
    const index = want.path[want.path.length - 1];
    const at = siblings.indexOf(id);
    operations.move.push({ op: "move", id, name: label(id), fromParentId: bp!, parentId: dp, index, after: at > 0 ? siblings[at - 1] : null });
    touch(id); touch(bp); touch(dp);
  }

  // --- Creates: the parent must still be there ---
  for (const create of prepared.creates) {
    if (unread.has(create.parentId) || !liveNodes[create.parentId]) {
      conflicts.push({ id: create.parentId, name: create.name, kind: "missing", detail: `cannot create ${where(create.path)}: its parent is not in the live subtree` });
      continue;
    }
    operations.create.push(create);
    touch(create.parentId);
  }

  // --- Removals: ids the Spec dropped, topmost only ---
  const movedOut = new Set(operations.move.map(op => (op as Extract<PlanOperation, { op: "move" }>).id));
  const baseUnder = (id: string, out: string[]) => {
    for (const child of baseKids(id)) { out.push(child); baseUnder(child, out); }
    return out;
  };
  for (const id of Object.keys(base)) {
    if (prepared.desired.has(id)) continue;
    const bp = base[id].parentId;
    if (bp !== null && !prepared.desired.has(bp)) continue; // travels with its removed ancestor
    const dropped = baseUnder(id, []).filter(d => !prepared.desired.has(d));
    const cutOff = (n: string) => unread.has(n) || base[n].props.truncated === true;
    if (cutOff(id) || dropped.some(cutOff)) {
      conflicts.push({ id, name: label(id), kind: "unread", detail: "not removed: part of its subtree could not be read; pull with a larger maxNodes" });
      continue;
    }
    // An OpaqueNode's own subtree was never read, so removing it, or anything
    // that contains one, could delete content the Spec never showed.
    const opaque = [id, ...dropped].find(n => base[n].props.type === OPAQUE_TYPE);
    if (opaque) {
      conflicts.push({
        id, name: label(id), kind: "remove",
        detail: `not removed: ${opaque === id ? "it is" : `it contains ${opaque}, which is`} an OpaqueNode (${String(base[opaque].props.reason ?? base[opaque].props.nodeType)}); delete it in Figma`,
      });
      continue;
    }
    if (!liveNodes[id]) { converged++; continue; }
    // Every live node a removal would take with it must be one the Spec drops
    // too. Anything else (added by hand, moved in from elsewhere, a kept node,
    // an OpaqueNode or a node the read cut off) would be lost. A node a planned
    // move takes out first, with its subtree, is not lost.
    const goes = new Set([id, ...dropped]);
    const lost: string[] = [];
    const walk = (n: string) => {
      for (const child of liveKids(n)) {
        if (movedOut.has(child)) continue;
        if (!goes.has(child) || unread.has(child)) lost.push(child);
        walk(child);
      }
    };
    walk(id);
    if (lost.length) {
      conflicts.push({
        id, name: label(id), kind: "remove",
        detail: `not removed: it now holds ${lost.length} node(s) the Spec does not remove (added, moved in or unread in Figma), which would be lost: ${showList(lost.map(n => `${nameOf(liveProps(n) ?? base[n]?.props, n)} (${n})`))}`,
      });
      continue;
    }
    const changed = liveNodes[id].propsHash !== base[id].propsHash || liveNodes[id].parentId !== bp
      || dropped.some(d => liveNodes[d] && (liveNodes[d].propsHash !== base[d].propsHash || liveNodes[d].parentId !== base[d].parentId));
    if (changed) {
      conflicts.push({ id, name: label(id), kind: "remove", detail: "not removed: it changed in Figma since the pull" });
      continue;
    }
    operations.remove.push({ op: "remove", id, name: label(id), parentId: bp! });
    touch(id); touch(bp);
    for (const d of dropped) touch(d);
  }

  // --- Nodes added in Figma by hand: left alone, reported ---
  for (const id of Object.keys(liveNodes)) {
    if (base[id] || unread.has(id)) continue;
    drift.push({ id, name: nameOf(liveProps(id), id), kind: "added", detail: `added in Figma under ${liveNodes[id].parentId}` });
  }

  if (errors.length) failWith(errors);
  const ordered = [...operations.create, ...operations.update, ...operations.move, ...operations.remove];
  return {
    operations: ordered,
    expectedHashes: expected,
    drift,
    conflicts,
    liveTruncated: !!live.truncated,
    counts: {
      operations: ordered.length,
      updates: operations.update.length,
      properties: operations.update.reduce((n, op: any) => n + Object.keys(op.set).length - (op.fromLive ? op.fromLive.length : 0), 0),
      creates: operations.create.length,
      moves: operations.move.length,
      removes: operations.remove.length,
      drift: drift.length,
      conflicts: conflicts.length,
      converged,
      unread: unread.size,
      liveNodes: Object.keys(liveNodes).length,
    },
  };
}

// An instance's component properties, compared key by key: a Spec edit to one
// and a Figma edit to another are an update and a drift, not a conflict. `set`
// holds only the keys to write (setProperties takes a subset), so a value that
// drifted in Figma is never written back. Removing `properties`, or one of its
// keys, has no meaning for setProperties: `removed` names it for an error.
function compareProperties(base: unknown, desired: unknown, live: unknown) {
  const b = record(base);
  const l = record(live);
  const out = { set: undefined as Record<string, unknown> | undefined, drifted: [] as string[], conflicted: [] as string[], converged: 0, removed: "" };
  if (desired === undefined) {
    if (Object.keys(b).length) out.removed = "properties";
    return out;
  }
  const d = record(desired);
  const gone = Object.keys(b).filter(k => !(k in d)).sort();
  if (gone.length) { out.removed = `properties key ${showList(gone.map(k => JSON.stringify(k)))}`; return out; }
  const set: Record<string, unknown> = {};
  for (const key of [...new Set([...Object.keys(b), ...Object.keys(d), ...Object.keys(l)])].sort()) {
    const desiredChanged = !same(d[key], b[key]);
    const liveChanged = !same(l[key], b[key]);
    if (!desiredChanged && !liveChanged) continue;
    if (desiredChanged && !liveChanged) set[key] = d[key];
    else if (!desiredChanged) out.drifted.push(`properties.${key}`);
    else if (same(d[key], l[key])) out.converged++;
    else out.conflicted.push(`properties.${key}`);
  }
  if (Object.keys(set).length) out.set = set;
  return out;
}

function sameProps(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
  for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) if (!same(a[key], b[key])) return false;
  return true;
}

function diffKeys(a: Record<string, unknown>, b: Record<string, unknown>): string[] {
  return [...new Set([...Object.keys(a), ...Object.keys(b)])].filter(k => !same(a[k], b[k])).sort();
}
