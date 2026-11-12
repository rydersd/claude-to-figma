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
  OPAQUE_TYPE, SPEC_DEFAULTS, SPEC_TYPES, SPEC_VOCABULARY, canonicalValue, isVarPaint, lockProps, normalizeNode, normalizeSpecTree,
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
const COLOR_KEYS = new Set(["fillColor", "strokeColor", "fontColor"]);

// Keys a Spec node may carry besides its type's writable vocabulary.
const STRUCTURAL_KEYS = new Set(["id", "type", "children"]);
// create_node_tree shorthands the normaliser resolves (fontWeight -> fontStyle).
const SHORTHANDS: Partial<Record<SpecType, readonly string[]>> = { text: ["fontWeight"] };
const OPAQUE_KEYS = new Set(["id", "type", "name", "nodeType", "truncated", "reason", "children"]);

// Keys in a raw Spec node that its type cannot write: a plan error, never a
// silent no-op.
function unknownKeys(raw: Record<string, any>): string[] {
  if (raw.type === OPAQUE_TYPE) return Object.keys(raw).filter(k => !OPAQUE_KEYS.has(k));
  if (!SPEC_TYPES.includes(raw.type)) return [];
  const allowed = new Set([...SPEC_VOCABULARY[raw.type as SpecType], ...(SHORTHANDS[raw.type as SpecType] ?? [])]);
  return Object.keys(raw).filter(k => !STRUCTURAL_KEYS.has(k) && !allowed.has(k));
}

// Values normalizeNode would drop as unwritable, which would otherwise read as
// "deleted" and reset the property to its default: a plan error instead.
function unwritableValues(raw: Record<string, any>): string[] {
  if (!SPEC_TYPES.includes(raw.type)) return [];
  const bad: string[] = [];
  for (const key of SPEC_VOCABULARY[raw.type as SpecType]) {
    const value = raw[key];
    if (value === undefined) continue;
    if (value === null) { bad.push(`${key} is null (delete the key to mean its default)`); continue; }
    if (COLOR_KEYS.has(key) && typeof value === "object" && !isVarPaint(value) && !("r" in (value as object))) {
      bad.push(`${key} ${JSON.stringify(value)} is not a colour`);
    } else if (canonicalValue(key, value) === undefined) {
      bad.push(`${key} ${JSON.stringify(value)} cannot be written`);
    } else if (key === "fontSize" && !Number.isInteger(canonicalValue(key, value))) {
      bad.push(`fontSize ${JSON.stringify(value)} must be a whole number of pixels`);
    }
  }
  return bad;
}
const layoutOf = (raw: Record<string, any>): ParentLayout => ({ layoutMode: typeof raw.layoutMode === "string" ? raw.layoutMode : "NONE" });
const where = (path: number[]) => (path.length ? `tree.children[${path.join("].children[")}]` : "tree");

function nameOf(props: Record<string, unknown> | undefined, fallback: string): string {
  const name = props && typeof props.name === "string" ? props.name : fallback;
  return name.length > 80 ? name.slice(0, 77) + "..." : name;
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
      errors.push(`header ${key} is ${JSON.stringify(spec[key])} but the SpecLock has ${JSON.stringify(lock[key])}; the header is not editable`);
    }
  }
  if (spec.tree.id !== lock.rootId) errors.push(`tree: the root must keep id ${lock.rootId} (found ${JSON.stringify(spec.tree.id)})`);

  const desired = new Map<string, DesiredNode>();
  const desiredChildren = new Map<string, string[]>();
  const creates: PreparedSpec["creates"] = [];
  const seen = new Set<string>();

  const visit = (raw: any, path: number[], parentId: string | null, parentLayout: ParentLayout, underNew: boolean) => {
    const at = where(path);
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) { errors.push(`${at}: not a node object`); return; }
    const id = raw.id;
    if (id !== undefined && (typeof id !== "string" || !id)) { errors.push(`${at}: id must be a non-empty string`); return; }
    const stray = unknownKeys(raw);
    if (stray.length) {
      errors.push(`${at}${id ? ` (${id})` : ""}: ${stray.join(", ")} cannot be written on a ${String(raw.type)} node`);
      return;
    }
    const unwritable = unwritableValues(raw);
    if (unwritable.length) {
      errors.push(`${at}${id ? ` (${id})` : ""}: ${unwritable.join("; ")}`);
      return;
    }
    let props: Record<string, unknown>;
    try {
      props = normalizeNode(raw, parentLayout);
    } catch (error) {
      errors.push(`${at}${id ? ` (${id})` : ""}: ${error instanceof Error ? error.message : String(error)}`);
      return;
    }
    const kids = raw.children;
    if (kids !== undefined && !Array.isArray(kids)) errors.push(`${at}: children must be an array`);
    const childList: any[] = Array.isArray(kids) ? kids : [];
    if (childList.length && props.type !== "frame") {
      errors.push(`${at}${id ? ` (${id})` : ""}: only a frame can have children (this node is ${String(props.type)}${props.type === OPAQUE_TYPE ? "; an OpaqueNode's subtree is never in the Spec" : ""})`);
    }

    if (id !== undefined) {
      if (id.includes(";")) errors.push(`${at} (${id}): nodes inside an instance cannot be edited, moved or removed; instances are leaves`);
      else if (seen.has(id)) errors.push(`${at} (${id}): duplicate id`);
      else if (!lock.nodes[id]) errors.push(`${at} (${id}): the SpecLock does not know this id; a new node has no id`);
      else if (underNew) errors.push(`${at} (${id}): an existing node cannot be placed under a new node in one plan; apply the new parent first, pull, then move this node into it`);
      else {
        const base = lock.nodes[id];
        if (base.props.type !== props.type) {
          errors.push(`${at} (${id}): type changed from ${String(base.props.type)} to ${String(props.type)}; delete the node and add a new one without an id instead`);
        } else if (props.type === OPAQUE_TYPE && !same(props, base.props)) {
          errors.push(`${at} (${id}): "${nameOf(base.props, id)}" is an OpaqueNode; it can only be moved or reordered, not edited`);
        }
      }
      seen.add(id);
      desired.set(id, { id, props, compare: lockProps(props), parentId, parentLayout, path, raw });
    } else {
      if (props.type === OPAQUE_TYPE) errors.push(`${at}: an OpaqueNode cannot be created`);
      if (!underNew && parentId !== null) {
        const siblings = desiredChildren.get(parentId) ?? [];
        creates.push({
          op: "create", path, parentId, index: path[path.length - 1], after: siblings.length ? siblings[siblings.length - 1] : null,
          name: nameOf(props, String(props.type)), node: stripIds(normalizeSpecTree(raw, parentLayout)),
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
    const keys = new Set([...Object.keys(was.props), ...Object.keys(wanted), ...Object.keys(now)]);
    keys.delete("type");
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
      const b = was.props[key];
      const d = key in implied ? implied[key] : wanted[key];
      const l = now[key];
      // Left out of the Spec because Figma derives it there: not a reset. A
      // vector's path is compared as pathHash and always applicable.
      if (d === undefined && b !== undefined && key !== "pathHash" && !applicable(want.props, key, b, want.parentLayout)) continue;
      const desiredChanged = !same(d, b);
      const liveChanged = !same(l, b);
      if (!desiredChanged && !liveChanged) continue;
      if (desiredChanged && !liveChanged) {
        let value = d;
        if (value === undefined) {
          value = SPEC_DEFAULTS[type][key];
          if (value === undefined) {
            const shown = key === "pathHash" ? "pathData" : key;
            const hint = type === "text" && key === "name" ? " (a text node is named by its text only while Figma's auto-rename is on; rename it in Figma)" : "";
            errors.push(`${where(want.path)} (${id}): ${shown} cannot be removed; set the value you want instead${hint}`);
            continue;
          }
        }
        // A path compared by hash is written as the Spec's pathData.
        if (key === "pathHash") set.pathData = want.props.pathData;
        else set[key] = value;
      } else if (!desiredChanged) {
        drifted.push(key);
      } else if (same(d, l)) {
        converged++;
      } else {
        conflicted.push(key);
      }
    }
    if (drifted.length) drift.push({ id, name: label(id), kind: "property", keys: drifted });
    if (conflicted.length) conflicts.push({ id, name: label(id), kind: "property", keys: conflicted });
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
  const liveUnder = (id: string, out: Set<string>) => {
    for (const child of liveKids(id)) { out.add(child); liveUnder(child, out); }
    return out;
  };
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
    const handAdded = [...liveUnder(id, new Set())].some(d => !base[d]);
    const changed = liveNodes[id].propsHash !== base[id].propsHash || liveNodes[id].parentId !== bp
      || dropped.some(d => liveNodes[d] && (liveNodes[d].propsHash !== base[d].propsHash || liveNodes[d].parentId !== base[d].parentId));
    if (changed || handAdded) {
      conflicts.push({ id, name: label(id), kind: "remove", detail: handAdded ? "not removed: nodes were added inside it in Figma" : "not removed: it changed in Figma since the pull" });
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

function sameProps(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
  for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) if (!same(a[key], b[key])) return false;
  return true;
}

function diffKeys(a: Record<string, unknown>, b: Record<string, unknown>): string[] {
  return [...new Set([...Object.keys(a), ...Object.keys(b)])].filter(k => !same(a[k], b[k])).sort();
}
