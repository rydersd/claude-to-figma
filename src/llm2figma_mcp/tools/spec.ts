import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { SendCommandFn } from "../types.js";
import { randomUUID } from "node:crypto";
import { commandDelivery, getChannelFileKey, getCurrentChannel } from "../connection.js";
import {
  SPEC_LOCK_VERSION, SPEC_VERSION, clip, lockNodesFromTree, showList, specHash, type SpecFile, type SpecLockFile,
} from "../../shared/spec.js";
import { WALK_LIMITS } from "../../shared/walk.js";
import { backUp, readExistingPair, readSpecPair, resolveSpecPaths, specBaseDir, writeFileAtomic, type SpecPaths } from "../spec-files.js";
import { checkDestinations, computePlan, prepareSpec, type LiveRead, type Plan, type PlanIssue, type PlanOperation } from "../spec-plan.js";
import { buildApply, findPartial, relock, withCreatedIds, type OnConflict, type PartialEntry, type ReadBack, type SkippedEntry } from "../spec-apply.js";

// Spec sync (L2F_SPEC_SYNC). pull_spec writes a subtree to a Spec file the model
// edits with ordinary file edits, and a SpecLock beside it recording what Figma
// held at the pull. Nodes are matched by id. See docs/Spec-Sync.md.

// export_spec reads up to 10,000 nodes and sends progress every 50; the default
// 30 s would cut a large pull off.
export const EXPORT_TIMEOUT_MS = 120_000;
// read_spec_nodes walks the same subtree, with the same progress updates.
export const READ_TIMEOUT_MS = 120_000;
// apply_spec_ops writes, then re-reads the whole subtree; progress every 50.
export const APPLY_TIMEOUT_MS = 120_000;

export interface SpecToolOptions {
  env?: Record<string, string | undefined>;
  // The file key the user gave through join_channel (L2F_FILE_KEY), if any.
  userFileKey?: () => string | undefined;
  cwd?: () => string;
  now?: () => Date;
  // The relay channel the plugin answers on; recorded in each Plan.
  channel?: () => string | null;
  planStore?: PlanStore;
}

export interface PullArgs {
  nodeId: string;
  path: string;
  maxNodes?: number;
  maxDepth?: number;
  replaceEdited?: boolean;
}

export interface PullResult {
  path: string;
  lockPath: string;
  nodeCount: number;
  opaqueCount: number;
  truncated: boolean;
  backups?: string[];
  note?: string;
}

const REPLACE_HINT = "Pass replaceEdited: true to rename the old pair to .bak files and pull fresh.";

// Why an existing pair must not be overwritten, or null when it may be.
function refusal(spec: SpecFile | null, lock: SpecLockFile | null, specPath: string): string | null {
  if (lock && lock.pendingApply) {
    return `Refusing to pull over ${specPath}: an apply (plan ${clip(String(lock.pendingApply))}) was started and did not finish, so Figma may hold part of it. ${REPLACE_HINT}`;
  }
  if (!spec) return null;
  if (!lock) return `Refusing to pull over ${specPath}: it has no SpecLock beside it, so unapplied edits cannot be ruled out. ${REPLACE_HINT}`;
  if (specHash(spec) !== lock.specHash) return `Refusing to pull over ${specPath}: it has edits that were never applied. ${REPLACE_HINT}`;
  return null;
}

function fileStamp(date: Date): string {
  return date.toISOString().replace(/[:.]/g, "-");
}

// Per-path in-process mutex: a pull holds its Spec path from reading the
// existing pair to writing the SpecLock, so two pulls to one path run one after
// the other and never leave a Spec from one and a SpecLock from the other.
const pathLocks = new Map<string, Promise<void>>();

export async function withPathLock<T>(key: string, run: () => Promise<T>): Promise<T> {
  const previous = pathLocks.get(key) ?? Promise.resolve();
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  const tail = previous.then(() => held);
  pathLocks.set(key, tail);
  await previous;
  try {
    return await run();
  } finally {
    release();
    if (pathLocks.get(key) === tail) pathLocks.delete(key);
  }
}

export async function pullSpec(args: PullArgs, send: SendCommandFn, options: SpecToolOptions = {}): Promise<PullResult> {
  const env = options.env ?? process.env;
  const { nodeId, path } = args;
  if (nodeId.includes(";")) throw new Error(`Cannot pull ${nodeId}: it is inside an instance. Instances are exported as leaves; pull a node outside the instance.`);
  const paths = await resolveSpecPaths(path, specBaseDir(env, options.cwd));
  return withPathLock(paths.specPath, () => pullLocked(args, paths, send, options));
}

async function pullLocked(args: PullArgs, paths: SpecPaths, send: SendCommandFn, options: SpecToolOptions): Promise<PullResult> {
  const { nodeId, maxNodes, maxDepth, replaceEdited = false } = args;
  const existing = await readExistingPair(paths);
  if (!replaceEdited) {
    const reason = refusal(existing.spec, existing.lock, paths.specPath);
    if (reason) throw new Error(reason);
  }

  // Re-pulling the same root: the plugin refuses a different file or page, so a
  // duplicated file (identical node ids) cannot silently replace the original.
  // With replaceEdited and a recorded file key, only the key is held to: the
  // file may have been renamed and the node moved to another page since.
  const previous = existing.spec && existing.spec.rootId === nodeId ? existing.spec : null;
  const keyOnly = !!(previous && replaceEdited && previous.fileKey);
  const expect = !previous ? {} : keyOnly ? { fileKey: previous.fileKey } : { fileKey: previous.fileKey, fileName: previous.fileName, pageId: previous.pageId };
  const exported: any = await send("export_spec", { nodeId, expect, maxNodes, maxDepth }, EXPORT_TIMEOUT_MS);
  if (!exported || typeof exported !== "object" || !exported.tree || typeof exported.rootId !== "string" || typeof exported.pageId !== "string") {
    throw new Error("The Figma plugin returned no Spec tree. Rebuild and re-run the plugin (bun run build) so it knows export_spec.");
  }

  const userKey = (options.userFileKey ?? getChannelFileKey)();
  const fileKey: string | null = exported.fileKey ?? userKey ?? null;
  if (previous && previous.fileKey && fileKey && previous.fileKey !== fileKey) {
    throw new Error(`Wrong file: ${paths.specPath} is for file key ${clip(String(previous.fileKey))}, but the connected file's key is ${clip(String(fileKey))}.`);
  }
  if (keyOnly && !fileKey) {
    throw new Error(`Cannot confirm the connected file is the one ${paths.specPath} was pulled from (file key ${clip(String(previous!.fileKey))}): it has no file key. Rejoin the channel with the file key, or pull to a new path.`);
  }

  const spec: SpecFile = {
    l2fSpec: SPEC_VERSION, fileKey, fileName: exported.fileName ?? null, pageId: exported.pageId, rootId: exported.rootId, tree: exported.tree,
  };
  const lock: SpecLockFile = {
    l2fLock: SPEC_LOCK_VERSION, fileKey, fileName: spec.fileName, pageId: spec.pageId, rootId: spec.rootId,
    pulledAt: (options.now ?? (() => new Date()))().toISOString(), specHash: specHash(spec),
    supersededFrameId: existing.lock && previous ? existing.lock.supersededFrameId ?? null : null,
    pendingApply: null,
    nodes: lockNodesFromTree(exported.tree, exported.rootParentId ?? null),
  };

  const backups: string[] = [];
  if (replaceEdited && (existing.spec || existing.lock)) {
    const stamp = fileStamp((options.now ?? (() => new Date()))());
    for (const file of [paths.specPath, paths.lockPath]) {
      const moved = await backUp(file, stamp);
      if (moved) backups.push(moved);
    }
  }
  // Spec first, then SpecLock: a crash between the two leaves a Spec whose hash
  // the old lock does not match, which the next pull refuses rather than trusts.
  await writeFileAtomic(paths.specPath, JSON.stringify(spec, null, 2) + "\n");
  await writeFileAtomic(paths.lockPath, JSON.stringify(lock, null, 2) + "\n");

  const result: PullResult = {
    path: paths.specPath, lockPath: paths.lockPath,
    nodeCount: exported.nodeCount, opaqueCount: exported.opaqueCount, truncated: !!exported.truncated,
  };
  if (backups.length) result.backups = backups;
  if (result.truncated) {
    result.note = "A budget (maxNodes, maxDepth or the 8 MB Spec size) stopped the read. Each node not read is an OpaqueNode with truncated: true and a reason, in its parent's children; it cannot be edited. Pull a smaller subtree, or again with a larger maxNodes or maxDepth, to edit them.";
  }
  return result;
}

// --- plan_spec ---

// Plans live server-side under an explicit planId, never "latest". Bounded:
// 8 plans, 30 minutes each, 4 MB of JSON each (a 2,000-node Plan exceeds the
// reference cache's 64 KB entries, so it has its own store).
export const PLAN_LIMITS = { maxPlans: 8, ttlMs: 30 * 60_000, maxBytes: 4 * 1024 * 1024 };

export class PlanStore {
  private plans = new Map<string, { plan: Plan; expiresAt: number }>();
  constructor(private clock: () => number = Date.now, private limits = PLAN_LIMITS) {}

  private prune(): void {
    const now = this.clock();
    for (const [id, entry] of this.plans) if (entry.expiresAt <= now) this.plans.delete(id);
  }

  // Stores the plan under plan.planId; evicts the oldest when full. Returns the expiry (ms).
  put(plan: Plan): number {
    const bytes = Buffer.byteLength(JSON.stringify(plan), "utf8");
    if (bytes > this.limits.maxBytes) {
      throw new Error(`The plan is ${Math.ceil(bytes / 1024)} KB, over the ${this.limits.maxBytes / (1024 * 1024)} MB limit. Pull a smaller subtree.`);
    }
    this.prune();
    while (this.plans.size >= this.limits.maxPlans) this.plans.delete(this.plans.keys().next().value!);
    const expiresAt = this.clock() + this.limits.ttlMs;
    this.plans.set(plan.planId, { plan, expiresAt });
    return expiresAt;
  }

  // The plan with this id. An unknown or expired id is an error, never an empty plan.
  get(planId: string): Plan {
    const entry = this.plans.get(planId);
    if (entry && entry.expiresAt > this.clock()) return entry.plan;
    if (entry) this.plans.delete(planId);
    throw new Error(`Plan ${planId} has expired or is unknown (plans last ${this.limits.ttlMs / 60_000} minutes, and only the ${this.limits.maxPlans} newest are kept). Run plan_spec again.`);
  }

  get size(): number {
    this.prune();
    return this.plans.size;
  }
}

const defaultPlanStore = new PlanStore();
export function getPlanStore(options: SpecToolOptions = {}): PlanStore {
  return options.planStore ?? defaultPlanStore;
}

// At most this many entries of each list go back to the model; counts are always complete.
export const PLAN_LIST_LIMIT = 100;

export interface PlanSummary {
  planId: string;
  path: string;
  counts: Plan["counts"];
  operations: Array<Record<string, unknown>>;
  drift: PlanIssue[];
  conflicts: PlanIssue[];
  truncated: boolean;
  expiresAt: string;
  note?: string;
}

function summarise(op: PlanOperation): Record<string, unknown> {
  switch (op.op) {
    case "update": return { op: op.op, id: op.id, name: op.name, keys: Object.keys(op.set).filter(k => !op.fromLive?.includes(k)) };
    case "create": return { op: op.op, path: op.path, parentId: op.parentId, index: op.index, type: op.node.type, name: op.name };
    case "move": return op.fromParentId === op.parentId
      ? { op: op.op, id: op.id, name: op.name, parentId: op.parentId, index: op.index }
      : { op: op.op, id: op.id, name: op.name, fromParentId: op.fromParentId, parentId: op.parentId, index: op.index };
    case "remove": return { op: op.op, id: op.id, name: op.name };
  }
}

function planNote(plan: Plan): string | undefined {
  const notes: string[] = [];
  if (!plan.counts.operations && !plan.counts.drift && !plan.counts.conflicts) notes.push("Figma matches the Spec: nothing to apply.");
  if (plan.counts.drift) notes.push("Drift is what changed in Figma since the pull; it is kept as Figma has it. To take it into the Spec, pull_spec again (replaceEdited: true if the Spec has unapplied edits; it backs them up as .bak).");
  if (plan.counts.conflicts) notes.push("Conflicts changed on both sides, or cannot be done safely; they are listed and skipped.");
  if (plan.counts.unread) notes.push(`${plan.counts.unread} node(s) could not be read within the node budget; nothing in them is planned.`);
  return notes.length ? notes.join(" ") : undefined;
}

export async function planSpec(args: { path: string }, send: SendCommandFn, options: SpecToolOptions = {}): Promise<PlanSummary> {
  const env = options.env ?? process.env;
  const paths = await resolveSpecPaths(args.path, specBaseDir(env, options.cwd));
  // Under the pull's path lock, so a pull in progress never pairs one Spec with another's SpecLock.
  const { spec, lock } = await withPathLock(paths.specPath, () => readSpecPair(paths));
  if (lock.pendingApply) {
    throw new Error(`Refusing to plan ${paths.specPath}: an apply (plan ${clip(String(lock.pendingApply))}) was started and did not finish, so Figma may hold part of it. Pull again (pull_spec with replaceEdited: true backs up the Spec) and redo the edits.`);
  }
  // Validate before asking Figma: a bad Spec costs no round trip.
  const pre = prepareSpec(spec, lock);

  const live = await send("read_spec_nodes", {
    rootId: lock.rootId, expect: { fileKey: lock.fileKey, fileName: lock.fileName, pageId: lock.pageId },
    baseHashes: pre.baseHashes, truncated: pre.truncated, sizeIds: pre.sizeIds, destinationIds: [...pre.destinations.keys()],
    maxNodes: WALK_LIMITS.maxNodes, maxDepth: WALK_LIMITS.maxDepth,
  }, READ_TIMEOUT_MS) as LiveRead;
  if (!live || typeof live !== "object" || !live.nodes || typeof live.nodes !== "object" || live.rootId !== lock.rootId) {
    throw new Error("The Figma plugin returned no node read. Rebuild and re-run the plugin (bun run build) so it knows read_spec_nodes.");
  }
  if (pre.destinations.size && !Array.isArray(live.missingDestinations)) {
    throw new Error("The Figma plugin did not check the Spec's prototype destinations. Rebuild and re-run the plugin (bun run build).");
  }
  checkDestinations(pre, live.missingDestinations ?? []);
  const connectedKey = live.fileKey ?? (options.userFileKey ?? getChannelFileKey)() ?? null;
  if (lock.fileKey && connectedKey && lock.fileKey !== connectedKey) {
    throw new Error(`Wrong file: ${paths.specPath} is for file key ${clip(String(lock.fileKey))}, but the connected file's key is ${clip(String(connectedKey))}.`);
  }

  // Normalise again with the root's real parent layout (it decides the root's x/y).
  const prepared = prepareSpec(spec, lock, { layoutMode: live.rootParentLayoutMode ?? undefined });
  const body = computePlan({ spec, lock, live, prepared });
  const now = (options.now ?? (() => new Date()))();
  const plan: Plan = {
    l2fPlan: 1, planId: `plan-${randomUUID()}`, createdAt: now.toISOString(),
    specPath: paths.specPath, lockPath: paths.lockPath, specHash: specHash(spec), lockHash: specHash(lock),
    channel: (options.channel ?? getCurrentChannel)(),
    target: { fileKey: lock.fileKey, fileName: lock.fileName, pageId: lock.pageId, rootId: lock.rootId },
    ...body,
  };
  const expiresAt = getPlanStore(options).put(plan);

  const truncated = plan.operations.length > PLAN_LIST_LIMIT || plan.drift.length > PLAN_LIST_LIMIT || plan.conflicts.length > PLAN_LIST_LIMIT;
  const summary: PlanSummary = {
    planId: plan.planId, path: paths.specPath, counts: plan.counts,
    operations: plan.operations.slice(0, PLAN_LIST_LIMIT).map(summarise),
    drift: plan.drift.slice(0, PLAN_LIST_LIMIT), conflicts: plan.conflicts.slice(0, PLAN_LIST_LIMIT),
    truncated, expiresAt: new Date(expiresAt).toISOString(),
  };
  const note = planNote(plan);
  if (note) summary.note = note;
  return summary;
}

// --- apply_spec ---

export interface ApplyArgs {
  planId: string;
  allowRemovals?: boolean;
  onConflict?: OnConflict;
}

export interface ApplyResult {
  planId: string;
  path: string;
  applied: {
    created: Array<{ path: number[]; id: string }>;
    updated: Array<{ id: string; keys: string[] }>;
    moved: string[];
    removed: string[];
  };
  counts: { created: number; updated: number; moved: number; removed: number; skipped: number; partial: number; failed: number };
  skipped: SkippedEntry[];
  partial: PartialEntry[];
  failed: Array<Record<string, unknown>>;
  undo: string;
  truncated: boolean;
  note?: string;
}

const UNDO_NOTE = "One undo in Figma (Cmd/Ctrl+Z) reverts this apply, together with anything changed by hand in the file while it ran. apply_spec never undoes anything itself.";

const isoDay = (date: Date) => date.toISOString().slice(0, 10);

// Carries out one Plan. Under the Spec's path lock: refuses when the Spec or
// SpecLock changed since the plan, marks the SpecLock pendingApply, sends the
// operations, then (unless the Spec was edited meanwhile) writes the created
// ids into the Spec and the SpecLock from the read-back. A run the plugin
// refuses wrote nothing, so pendingApply is cleared; a timeout or any other
// failure leaves it set, and plan_spec refuses until a pull.
export async function applySpec(args: ApplyArgs, send: SendCommandFn, options: SpecToolOptions = {}): Promise<ApplyResult> {
  const { planId, allowRemovals = false, onConflict = "skip" } = args;
  if (onConflict !== "skip" && onConflict !== "spec") throw new Error(`onConflict must be "skip" or "spec", got ${clip(String(onConflict))}.`);
  const plan = getPlanStore(options).get(planId);
  const channel = (options.channel ?? getCurrentChannel)();
  if (plan.channel && channel && plan.channel !== channel) {
    throw new Error(`Plan ${planId} was made on channel ${clip(plan.channel)}, but the server is now on ${clip(channel)}. Run plan_spec again on this channel.`);
  }
  const paths: SpecPaths = { specPath: plan.specPath, lockPath: plan.lockPath, baseDir: "" };
  return withPathLock(plan.specPath, async () => {
    const { spec, lock } = await readSpecPair(paths);
    if (lock.pendingApply) {
      throw new Error(`Refusing to apply: an earlier apply (plan ${clip(String(lock.pendingApply))}) did not finish, so Figma may hold part of it. Pull again (pull_spec with replaceEdited: true backs up the Spec) and redo the edits.`);
    }
    if (specHash(spec) !== plan.specHash) throw new Error(`Refusing to apply: ${plan.specPath} changed since plan ${planId}. Run plan_spec again.`);
    if (specHash(lock) !== plan.lockHash) throw new Error(`Refusing to apply: the SpecLock beside ${plan.specPath} changed since plan ${planId} (pulled or applied again). Run plan_spec again.`);

    const request = buildApply(plan, spec, { allowRemovals, onConflict });
    const truncated: Record<string, string> = {};
    for (const [id, node] of Object.entries(lock.nodes)) {
      if (node.props.truncated === true) truncated[id] = typeof node.props.reason === "string" ? node.props.reason : "node budget";
    }
    const now = (options.now ?? (() => new Date()))();

    // Marked before sending: if the run never reports back, Figma may hold part of it.
    await writeFileAtomic(plan.lockPath, JSON.stringify({ ...lock, pendingApply: planId }, null, 2) + "\n");
    const unmark = () => writeFileAtomic(plan.lockPath, JSON.stringify(lock, null, 2) + "\n");
    let result: any;
    try {
      result = await send("apply_spec_ops", {
        rootId: lock.rootId, expect: { fileKey: lock.fileKey, fileName: lock.fileName, pageId: lock.pageId },
        operations: request.operations, expectedHashes: request.expectedHashes, orders: request.orders,
        allowRemovals, truncated, supersededFrameId: lock.supersededFrameId ?? null, date: isoDay(now),
        maxNodes: WALK_LIMITS.maxNodes, maxDepth: WALK_LIMITS.maxDepth,
      }, APPLY_TIMEOUT_MS);
    } catch (error) {
      // Never sent (no relay, no channel), or the plugin threw: apply_spec_ops
      // only throws before its first write (the editor gate, an unknown command
      // from an old plugin, bad parameters), so Figma is untouched. Only a
      // timeout or a connection lost after sending may have written.
      const delivery = commandDelivery(error);
      if (delivery === "not_sent" || delivery === "plugin_error") {
        await unmark();
        throw new Error(`${error instanceof Error ? error.message : String(error)} Nothing was written to Figma.`);
      }
      throw error;
    }
    if (result && typeof result === "object" && typeof result.refused === "string") {
      // Refused before any write: nothing to record.
      await unmark();
      throw new Error(`Refusing to apply: ${result.refused}`);
    }
    const created: Array<{ path: number[]; id: string; failed?: boolean }> = result && Array.isArray(result.created) ? result.created : [];
    const createdNote = created.length
      ? ` Created in Figma: ${showList(created.map(c => `${c.id} at tree.children[${c.path.join("].children[")}]`))}. Do not re-apply these edits from a .bak copy of the Spec: the nodes would be created twice; pull (it reads them) and redo only the other edits.`
      : "";
    if (!result || typeof result !== "object" || typeof result.writeError === "string" || !result.readBack || !result.readBack.nodes) {
      const why = result && typeof result.writeError === "string" ? `The apply stopped part-way: ${result.writeError}.` : "The Figma plugin returned no apply result (rebuild and re-run the plugin with bun run build so it knows apply_spec_ops).";
      throw new Error(`${why} Figma may hold part of the plan, so the SpecLock keeps pendingApply; pull again before planning.${createdNote}`);
    }

    const { spec: current } = await readSpecPair(paths);
    if (specHash(current) !== plan.specHash) {
      throw new Error(`${plan.specPath} was edited while the apply ran, so the Spec and SpecLock were not updated and the SpecLock keeps pendingApply. Figma holds the applied plan. Pull again (pull_spec with replaceEdited: true backs up your edits) and redo them.${createdNote}`);
    }
    const failed: Array<Record<string, unknown>> = Array.isArray(result.failed) ? result.failed : [];
    const readBack = result.readBack as ReadBack;
    const nextSpec = created.length ? withCreatedIds(spec, created) : spec;
    const nextLock = relock(lock, nextSpec, readBack, result.supersededFrameId ?? lock.supersededFrameId ?? null, specHash(nextSpec));
    const partial: PartialEntry[] = [...(Array.isArray(result.partial) ? result.partial : []), ...findPartial(request.operations, failed as any, created, readBack, nextSpec)];
    // Spec first, then SpecLock: a crash between leaves pendingApply set.
    if (nextSpec !== spec) await writeFileAtomic(plan.specPath, JSON.stringify(nextSpec, null, 2) + "\n");
    await writeFileAtomic(plan.lockPath, JSON.stringify(nextLock, null, 2) + "\n");

    const updated: Array<{ id: string; keys: string[] }> = Array.isArray(result.updated) ? result.updated : [];
    const moved: string[] = Array.isArray(result.moved) ? result.moved : [];
    const removed: string[] = Array.isArray(result.removed) ? result.removed : [];
    const cut = <T>(list: T[]) => list.slice(0, PLAN_LIST_LIMIT);
    const lists = [created, updated, moved, removed, request.skipped, partial, failed];
    const out: ApplyResult = {
      planId, path: plan.specPath,
      applied: { created: cut(created.filter(c => !c.failed).map(({ path, id }) => ({ path, id }))), updated: cut(updated), moved: cut(moved), removed: cut(removed) },
      counts: {
        created: created.filter(c => !c.failed).length, updated: updated.length, moved: moved.length, removed: removed.length,
        skipped: request.skipped.length, partial: partial.length, failed: failed.length,
      },
      skipped: cut(request.skipped), partial: cut(partial), failed: cut(failed), undo: UNDO_NOTE,
      truncated: lists.some(list => list.length > PLAN_LIST_LIMIT),
    };
    const notes: string[] = [];
    if (partial.length) notes.push("partial: Figma did not take these values as asked (a size it constrained, a font it substituted...); the SpecLock keeps the old value, so the next plan shows them again.");
    if (failed.length) notes.push("failed operations wrote nothing (or, for a create whose colour binding failed, a node named \"(failed)\"); plan again to retry.");
    if (removed.length) notes.push(`removed nodes were moved, at the same place, into the hidden page-level frame "l2f/superseded" (renamed "(superseded ${isoDay(now)})"); nothing was deleted.`);
    if (request.skipped.some(s => s.op === "remove")) notes.push("removals were skipped: pass allowRemovals: true to move them into l2f/superseded.");
    if (notes.length) out.note = notes.join(" ");
    return out;
  });
}

export function registerTools(server: McpServer, sendCommandToFigma: SendCommandFn, options: SpecToolOptions = {}) {
  server.tool(
    "pull_spec",
    "Write a Figma subtree to a Spec file on disk (JSON, name ending .l2f.json) so a design can be edited in place by editing the file, plus a SpecLock beside it (<name>.l2f.lock.json, never edit it) recording what Figma held at the pull. The Spec uses create_node_tree's node format (text content is `text`, colours are hex or $var:Collection/Name) and every node carries its Figma `id`; a node without an id is one to create. An absent key means its default (what create_node_tree leaves); values Figma derives from layout (x/y inside auto-layout, width/height on HUG or FILL axes, text height unless the box is fixed) are left out, while x/y outside auto-layout, FIXED width/height and auto-layout padding/spacing are always written. Nodes the format cannot express (groups, ellipses, lines, boolean operations, sections, components, rotated nodes, grid frames, text with mixed styles) are OpaqueNodes {type: \"$opaque\", id, name, nodeType, reason} with no children; an instance is a leaf with componentSetKey/componentSetId for a variant (properties pick the variant), else componentKey/componentId, and flattened properties. The walk is breadth-first; nodes a budget (maxNodes, maxDepth, 8 MB) left unread are OpaqueNodes with truncated: true in their parent's children. Returns only paths and counts, never the tree: read the file. Refuses to overwrite a Spec with unapplied edits, a pair whose apply did not finish, or a file that is not a Spec; replaceEdited: true renames the old pair to .bak first. Re-pulling the same root checks it is the same file (by file key when known, else by file name: a copy renamed to the original's name is not detected) and page; with replaceEdited and a known file key only the key is checked. Paths: relative to L2F_SPEC_DIR (or the server's working directory); absolute paths must be inside it; symlinked Spec files are refused.",
    {
      nodeId: z.string().min(1).describe("Root of the subtree: a frame, text, rectangle, vector or instance"),
      path: z.string().min(1).describe("Spec file path ending in .l2f.json; relative to L2F_SPEC_DIR or the server's working directory. The directory must exist"),
      maxNodes: z.number().int().min(1).max(10000).optional().describe("Node budget including the root (default 2000)"),
      maxDepth: z.number().int().min(0).max(100).optional().describe("Maximum depth below the root (default 30)"),
      replaceEdited: z.boolean().optional().describe("Back up an edited or half-applied pair as .bak files and pull anyway (default false)"),
    },
    async (args: any) => {
      try {
        const result = await pullSpec(args, sendCommandToFigma, options);
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      } catch (error) {
        return { isError: true, content: [{ type: "text", text: `Error pulling spec: ${error instanceof Error ? error.message : String(error)}` }] };
      }
    },
  );

  server.tool(
    "plan_spec",
    "Compare a Spec (after your edits), its SpecLock (Figma at the last pull) and live Figma, property by property, and return the difference as a Plan. Writes nothing: not to Figma, not to the Spec or SpecLock. Per property: Spec changed and Figma did not -> an update; Figma changed and the Spec did not -> drift (kept as Figma has it); both changed to the same value -> nothing; both changed differently -> a conflict (skipped). Structure the same way: a node without an id -> create; a changed parent or sibling order -> move; an id deleted from the Spec -> remove (only if Figma did not change it; a subtree the node budget cut off never yields removals); a node gone from Figma -> missing; a node added in Figma by hand is left alone and reported as drift. Errors, naming the node, on a duplicate or unknown id, an id inside an instance (contains ';'), a changed node type, or an edit to an OpaqueNode other than moving or removing it. Refuses while the SpecLock records an unfinished apply. Returns {planId, counts, operations, drift, conflicts} with at most 100 entries per list (truncated: true when more; counts are complete) and the planId; the full Plan stays on the server for 30 minutes under that explicit id. Apply it with apply_spec {planId}.",
    {
      path: z.string().min(1).describe("The Spec file (.l2f.json) written by pull_spec, after your edits"),
    },
    async (args: any) => {
      try {
        const result = await planSpec(args, sendCommandToFigma, options);
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      } catch (error) {
        return { isError: true, content: [{ type: "text", text: `Error planning spec: ${error instanceof Error ? error.message : String(error)}` }] };
      }
    },
  );

  server.tool(
    "apply_spec",
    "Carry out one Plan from plan_spec in Figma, by node id, then update the Spec and SpecLock. Refuses, writing nothing, when the Spec or SpecLock changed since the plan, when an earlier apply did not finish, or when any node the plan touches changed in Figma since (checked inside the plugin in the same run as the writes; plan again). Order: creates (parents first; a node whose colour variable cannot be bound is kept, renamed \"(failed)\"), updates (only the listed properties; never a key in a node's $unread), moves (only the nodes that moved; nodes added by hand keep their places; a reparent keeps the absolute position), removals last: moved into a hidden page-level frame \"l2f/superseded\" at the same absolute position and renamed \"(superseded YYYY-MM-DD)\", never deleted, and only with allowRemovals: true. One failed operation does not stop the rest. Conflicts are skipped unless onConflict: \"spec\" (property conflicts only: the Spec's value wins). Then the whole subtree is read back: created ids are written into the Spec, the SpecLock is rewritten from the read-back, and touched properties Figma did not take as asked are listed as partial (they and failed ones keep their old base, so the next plan shows them again). Returns {applied: {created, updated, moved, removed}, counts, skipped, partial, failed, undo} with at most 100 entries per list. One undo in Figma reverts the apply (and anything done by hand while it ran); this tool never undoes. If the run times out or the plugin reloads, the SpecLock keeps pendingApply and plan_spec refuses until a pull.",
    {
      planId: z.string().min(1).describe("The planId plan_spec returned"),
      allowRemovals: z.boolean().optional().describe("Move removed nodes into l2f/superseded (default false: removals are listed under skipped)"),
      onConflict: z.enum(["skip", "spec"]).optional().describe('"skip" (default) leaves conflicts as Figma has them; "spec" writes the Spec\'s value for property conflicts'),
    },
    async (args: any) => {
      try {
        const result = await applySpec(args, sendCommandToFigma, options);
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      } catch (error) {
        return { isError: true, content: [{ type: "text", text: `Error applying spec: ${error instanceof Error ? error.message : String(error)}` }] };
      }
    },
  );
}
