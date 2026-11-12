import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { SendCommandFn } from "../types.js";
import { getChannelFileKey } from "../connection.js";
import {
  SPEC_LOCK_VERSION, SPEC_VERSION, lockNodesFromTree, specHash, type SpecFile, type SpecLockFile,
} from "../../shared/spec.js";
import { backUp, readExistingPair, resolveSpecPaths, specBaseDir, writeFileAtomic } from "../spec-files.js";

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
}
