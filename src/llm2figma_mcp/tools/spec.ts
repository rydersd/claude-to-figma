import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { SendCommandFn } from "../types.js";
import { getChannelFileKey } from "../connection.js";
import {
  SPEC_LOCK_VERSION, SPEC_VERSION, lockNodesFromTree, specHash, type SpecFile, type SpecLockFile,
} from "../../shared/spec.js";
import { backUp, readExistingPair, resolveSpecPaths, specBaseDir, writeFileAtomic, type SpecPaths } from "../spec-files.js";

// Spec sync (L2F_SPEC_SYNC). pull_spec writes a subtree to a Spec file the model
// edits with ordinary file edits, and a SpecLock beside it recording what Figma
// held at the pull. Nodes are matched by id. See docs/Spec-Sync.md.

// export_spec reads up to 10,000 nodes and sends progress every 50; the default
// 30 s would cut a large pull off.
export const EXPORT_TIMEOUT_MS = 120_000;

export interface SpecToolOptions {
  env?: Record<string, string | undefined>;
  // The file key the user gave through join_channel (L2F_FILE_KEY), if any.
  userFileKey?: () => string | undefined;
  cwd?: () => string;
  now?: () => Date;
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
    throw new Error(`Wrong file: ${paths.specPath} is for file key ${previous.fileKey}, but the connected file's key is ${fileKey}.`);
  }
  if (keyOnly && !fileKey) {
    throw new Error(`Cannot confirm the connected file is the one ${paths.specPath} was pulled from (file key ${previous!.fileKey}): it has no file key. Rejoin the channel with the file key, or pull to a new path.`);
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
}
