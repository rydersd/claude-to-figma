import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { SendCommandFn } from "../types.js";
import { randomUUID } from "node:crypto";
import { getChannelFileKey, getCurrentChannel } from "../connection.js";
import {
  SPEC_LOCK_VERSION, SPEC_VERSION, lockNodesFromTree, specHash, type SpecFile, type SpecLockFile,
} from "../../shared/spec.js";
import { WALK_LIMITS } from "../../shared/walk.js";
import { backUp, readExistingPair, readSpecPair, resolveSpecPaths, specBaseDir, writeFileAtomic } from "../spec-files.js";
import { computePlan, prepareSpec, type LiveRead, type Plan, type PlanIssue, type PlanOperation } from "../spec-plan.js";

// Spec sync (L2F_SPEC_SYNC). pull_spec writes a subtree to a Spec file the model
// edits with ordinary file edits, and a SpecLock beside it recording what Figma
// held at the pull. Nodes are matched by id. See docs/Spec-Sync.md.

// export_spec reads up to 10,000 nodes and sends progress every 50; the default
// 30 s would cut a large pull off.
export const EXPORT_TIMEOUT_MS = 120_000;
// read_spec_nodes walks the same subtree, with the same progress updates.
export const READ_TIMEOUT_MS = 120_000;

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
    return `Refusing to pull over ${specPath}: an apply (plan ${lock.pendingApply}) was started and did not finish, so Figma may hold part of it. ${REPLACE_HINT}`;
  }
  if (!spec) return null;
  if (!lock) return `Refusing to pull over ${specPath}: it has no SpecLock beside it, so unapplied edits cannot be ruled out. ${REPLACE_HINT}`;
  if (specHash(spec) !== lock.specHash) return `Refusing to pull over ${specPath}: it has edits that were never applied. ${REPLACE_HINT}`;
  return null;
}

function fileStamp(date: Date): string {
  return date.toISOString().replace(/[:.]/g, "-");
}

export async function pullSpec(args: PullArgs, send: SendCommandFn, options: SpecToolOptions = {}): Promise<PullResult> {
  const env = options.env ?? process.env;
  const { nodeId, path, maxNodes, maxDepth, replaceEdited = false } = args;
  if (nodeId.includes(";")) throw new Error(`Cannot pull ${nodeId}: it is inside an instance. Instances are exported as leaves; pull a node outside the instance.`);

  const paths = await resolveSpecPaths(path, specBaseDir(env, options.cwd));
  const existing = await readExistingPair(paths);
  if (!replaceEdited) {
    const reason = refusal(existing.spec, existing.lock, paths.specPath);
    if (reason) throw new Error(reason);
  }

  // Re-pulling the same root: the plugin refuses a different file or page, so a
  // duplicated file (identical node ids) cannot silently replace the original.
  const previous = existing.spec && existing.spec.rootId === nodeId ? existing.spec : null;
  const expect = previous ? { fileKey: previous.fileKey, fileName: previous.fileName, pageId: previous.pageId } : {};
  const exported: any = await send("export_spec", { nodeId, expect, maxNodes, maxDepth }, EXPORT_TIMEOUT_MS);
  if (!exported || typeof exported !== "object" || !exported.tree || typeof exported.rootId !== "string" || typeof exported.pageId !== "string") {
    throw new Error("The Figma plugin returned no Spec tree. Rebuild and re-run the plugin (bun run build) so it knows export_spec.");
  }

  const userKey = (options.userFileKey ?? getChannelFileKey)();
  const fileKey: string | null = exported.fileKey ?? userKey ?? null;
  if (previous && previous.fileKey && fileKey && previous.fileKey !== fileKey) {
    throw new Error(`Wrong file: ${paths.specPath} is for file key ${previous.fileKey}, but the connected file's key is ${fileKey}.`);
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
    result.note = "The node budget cut some subtrees off. Each is an OpaqueNode with truncated: true and nothing inside it can be edited; pull again with a larger maxNodes or maxDepth to edit them.";
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
  const { spec, lock } = await readSpecPair(paths);
  if (lock.pendingApply) {
    throw new Error(`Refusing to plan ${paths.specPath}: an apply (plan ${lock.pendingApply}) was started and did not finish, so Figma may hold part of it. Pull again (pull_spec with replaceEdited: true backs up the Spec) and redo the edits.`);
  }
  // Validate before asking Figma: a bad Spec costs no round trip.
  const pre = prepareSpec(spec, lock);

  const live = await send("read_spec_nodes", {
    rootId: lock.rootId, expect: { fileKey: lock.fileKey, fileName: lock.fileName, pageId: lock.pageId },
    baseHashes: pre.baseHashes, truncatedIds: pre.truncatedIds, sizeIds: pre.sizeIds,
    maxNodes: WALK_LIMITS.maxNodes, maxDepth: WALK_LIMITS.maxDepth,
  }, READ_TIMEOUT_MS) as LiveRead;
  if (!live || typeof live !== "object" || !live.nodes || typeof live.nodes !== "object" || live.rootId !== lock.rootId) {
    throw new Error("The Figma plugin returned no node read. Rebuild and re-run the plugin (bun run build) so it knows read_spec_nodes.");
  }
  const connectedKey = live.fileKey ?? (options.userFileKey ?? getChannelFileKey)() ?? null;
  if (lock.fileKey && connectedKey && lock.fileKey !== connectedKey) {
    throw new Error(`Wrong file: ${paths.specPath} is for file key ${lock.fileKey}, but the connected file's key is ${connectedKey}.`);
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

export function registerTools(server: McpServer, sendCommandToFigma: SendCommandFn, options: SpecToolOptions = {}) {
  server.tool(
    "pull_spec",
    "Write a Figma subtree to a Spec file on disk (JSON, name ending .l2f.json) so a design can be edited in place by editing the file, plus a SpecLock beside it (<name>.l2f.lock.json, never edit it) recording what Figma held at the pull. The Spec uses create_node_tree's node format (text content is `text`, colours are hex or $var:Collection/Name) and every node carries its Figma `id`; a node without an id is one to create. Values equal to create_node_tree's defaults, and values Figma derives from layout (x/y inside auto-layout, width/height on HUG or FILL axes, text height), are left out. Nodes the format cannot express (groups, ellipses, lines, boolean operations, sections, components, rotated nodes, grid frames) are OpaqueNodes {type: \"$opaque\", id, name, nodeType} with no children; an instance is a leaf with componentKey (or componentId for a local component) and flattened properties. A subtree the node budget cut off is an OpaqueNode with truncated: true. Returns only paths and counts, never the tree: read the file. Refuses to overwrite a Spec with unapplied edits, a pair whose apply did not finish, or a file that is not a Spec; replaceEdited: true renames the old pair to .bak first. Re-pulling the same root checks it is the same file (by file key when known, else by file name: a copy renamed to the original's name is not detected) and page. Paths: relative to L2F_SPEC_DIR (or the server's working directory); absolute paths must be inside it; symlinked Spec files are refused.",
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
    "Compare a Spec (after your edits), its SpecLock (Figma at the last pull) and live Figma, property by property, and return the difference as a Plan. Writes nothing: not to Figma, not to the Spec or SpecLock. Per property: Spec changed and Figma did not -> an update; Figma changed and the Spec did not -> drift (kept as Figma has it); both changed to the same value -> nothing; both changed differently -> a conflict (skipped). Structure the same way: a node without an id -> create; a changed parent or sibling order -> move; an id deleted from the Spec -> remove (only if Figma did not change it; a subtree the node budget cut off never yields removals); a node gone from Figma -> missing; a node added in Figma by hand is left alone and reported as drift. Errors, naming the node, on a duplicate or unknown id, an id inside an instance (contains ';'), a changed node type, or an edit to an OpaqueNode other than moving or removing it. Refuses while the SpecLock records an unfinished apply. Returns {planId, counts, operations, drift, conflicts} with at most 100 entries per list (truncated: true when more; counts are complete) and the planId; the full Plan stays on the server for 30 minutes under that explicit id. Nothing applies a Plan yet.",
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
}
