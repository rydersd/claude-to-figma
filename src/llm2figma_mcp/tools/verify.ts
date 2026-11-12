import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { SendCommandFn } from "../types.js";

// Keys the plugin adds to resize results (resize_node, batch_mutate "resize").
// Removed server-side when L2F_VERIFY is off, so those tools' output is
// unchanged; existing keys are never touched.
const READ_BACK_KEYS = ["requested", "applied", "partial", "cause"] as const;

export function stripReadBack<T>(result: T, enabled: boolean): T {
  if (enabled || !result || typeof result !== "object" || Array.isArray(result)) return result;
  const copy: Record<string, unknown> = { ...(result as Record<string, unknown>) };
  for (const key of READ_BACK_KEYS) delete copy[key];
  return copy as T;
}

interface ReadBack {
  requested?: { width: number; height: number };
  applied?: { width: number; height: number };
  partial?: boolean;
  cause?: string | null;
}

const size = (s: { width: number; height: number }) => `${s.width}x${s.height}`;

// One line describing a resize read-back, or null when the plugin sent none
// (an older plugin build).
export function describeReadBack(r: ReadBack): string | null {
  if (!r.requested || !r.applied || typeof r.partial !== "boolean") return null;
  return r.partial
    ? `requested ${size(r.requested)}, Figma applied ${size(r.applied)} (partial: ${r.cause})`
    : `applied ${size(r.applied)} as requested`;
}

const Offset = z.object({ x: z.number(), y: z.number() });

export function registerTools(server: McpServer, sendCommandToFigma: SendCommandFn) {
  server.tool(
    "assert_contained",
    "Check that every direct child of a node sits inside the parent, comparing each child's absoluteBoundingBox to the parent's (0.5px tolerance by default; shadows and other render bounds are ignored). A child with no box is reported unmeasurable, never passed; rotated children are listed. A bare containment pass does NOT prove placement: a section auto-grows around children that were placed at the wrong offset (for example sec.x + 160 instead of 160, since section children are positioned relative to the section). Pass `expected` to check positions too: a snapshotId from snapshot_positions (taken on the parent or an ancestor; also reports parentGrewSinceSnapshot) or a map of child id to {x, y} offset from the parent's top-left.",
    {
      parentId: z.string().describe("The node whose direct children are checked"),
      expected: z.union([z.string(), z.record(Offset)]).optional()
        .describe("A snapshotId, or {childId: {x, y}} offsets from the parent's top-left"),
      tolerance: z.number().min(0).max(10).optional().describe("Allowed overshoot in px (default 0.5)"),
    },
    async ({ parentId, expected, tolerance }: any) => {
      try {
        const result = await sendCommandToFigma("assert_contained", { parentId, expected, tolerance });
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      } catch (error) {
        return { isError: true, content: [{ type: "text", text: `Error checking containment: ${error instanceof Error ? error.message : String(error)}` }] };
      }
    },
  );

  server.tool(
    "snapshot_positions",
    "Record the id, name, parentId and absoluteBoundingBox of a node and its descendants in a plugin-side store, and return its snapshotId. Use before a reparent, auto-layout change or bulk edit, then call diff_positions with that id. Bounded walk (default 2000 nodes, depth 30) with an explicit truncated flag. Snapshots expire after 30 minutes, at most 64 are kept, and all are lost when the plugin reloads.",
    {
      nodeId: z.string().describe("Root of the subtree to record"),
      maxNodes: z.number().int().min(1).max(10000).optional().describe("Node budget including the root (default 2000)"),
      maxDepth: z.number().int().min(0).max(100).optional().describe("Maximum depth below the root (default 30)"),
    },
    async ({ nodeId, maxNodes, maxDepth }: any) => {
      try {
        const result = await sendCommandToFigma("snapshot_positions", { nodeId, maxNodes, maxDepth }, 60000);
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      } catch (error) {
        return { isError: true, content: [{ type: "text", text: `Error taking snapshot: ${error instanceof Error ? error.message : String(error)}` }] };
      }
    },
  );

  server.tool(
    "diff_positions",
    "Compare a snapshot from snapshot_positions with the document now. Returns missing ids (no longer exist: deleted, or absorbed into a wrapper by suggest-auto-layout), added ids (new in the subtree, such as auto-generated wrapper frames), and moved nodes (absoluteBoundingBox changed beyond the tolerance, or reparented; a reparent with boxChanged false is a zero-drift move). Pass the explicit snapshotId; an unknown or expired id is an error, never an empty diff.",
    {
      snapshotId: z.string().describe("The id snapshot_positions returned"),
      tolerance: z.number().min(0).max(10).optional().describe("Box change ignored below this many px (default 0.5)"),
    },
    async ({ snapshotId, tolerance }: any) => {
      try {
        const result = await sendCommandToFigma("diff_positions", { snapshotId, tolerance }, 60000);
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      } catch (error) {
        return { isError: true, content: [{ type: "text", text: `Error diffing positions: ${error instanceof Error ? error.message : String(error)}` }] };
      }
    },
  );
}
