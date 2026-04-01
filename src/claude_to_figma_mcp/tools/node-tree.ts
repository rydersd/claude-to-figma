import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { SendCommandFn } from "../types.js";
import { sendCommandWithRetry } from "../connection.js";
import { getOptimalChunkSize, recordOperation } from "../metrics.js";
import { logger } from "../helpers.js";

// --- Recursive node tree schema for batch creation ---
const ColorObjectSchema = z.object({
  r: z.number().min(0).max(1).describe("Red component (0-1)"),
  g: z.number().min(0).max(1).describe("Green component (0-1)"),
  b: z.number().min(0).max(1).describe("Blue component (0-1)"),
  a: z.number().min(0).max(1).optional().describe("Alpha component (0-1)"),
});

// Color fields accept RGBA object, hex string "#RRGGBB"/"#RGB", or variable ref "$var:Collection/Name"
const ColorSchema = z.union([
  ColorObjectSchema,
  z.string().describe("Hex color (#RGB, #RRGGBB, #RRGGBBAA) or Figma variable reference ($var:Collection/TokenName)"),
]);

const BaseFrameSchema = z.object({
  type: z.literal("frame"),
  x: z.number().optional().describe("X position (default 0)"),
  y: z.number().optional().describe("Y position (default 0)"),
  width: z.number().describe("Width of the frame"),
  height: z.number().describe("Height of the frame"),
  name: z.string().optional().describe("Name for the frame"),
  fillColor: ColorSchema.optional().describe("Fill color in RGBA format"),
  strokeColor: ColorSchema.optional().describe("Stroke color in RGBA format"),
  strokeWeight: z.number().positive().optional().describe("Stroke weight"),
  layoutMode: z.enum(["NONE", "HORIZONTAL", "VERTICAL"]).optional(),
  layoutWrap: z.enum(["NO_WRAP", "WRAP"]).optional(),
  paddingTop: z.number().optional(),
  paddingRight: z.number().optional(),
  paddingBottom: z.number().optional(),
  paddingLeft: z.number().optional(),
  primaryAxisAlignItems: z.enum(["MIN", "MAX", "CENTER", "SPACE_BETWEEN"]).optional(),
  counterAxisAlignItems: z.enum(["MIN", "MAX", "CENTER", "BASELINE"]).optional(),
  layoutSizingHorizontal: z.enum(["FIXED", "HUG", "FILL"]).optional(),
  layoutSizingVertical: z.enum(["FIXED", "HUG", "FILL"]).optional(),
  itemSpacing: z.number().optional(),
  cornerRadius: z.number().optional().describe("Uniform corner radius"),
  clipsContent: z.boolean().optional().describe("Clip content that overflows the frame bounds"),
  counterAxisSpacing: z.number().optional().describe("Spacing between wrapped rows/columns when layoutWrap is WRAP"),
  itemReverseZIndex: z.boolean().optional().describe("Reverse z-index order (first child on top)"),
  opacity: z.number().min(0).max(1).optional().describe("Node opacity (0-1)"),
});

const TextNodeSchema = z.object({
  type: z.literal("text"),
  x: z.number().optional().describe("X position (default 0)"),
  y: z.number().optional().describe("Y position (default 0)"),
  text: z.string().describe("Text content"),
  fontSize: z.number().optional(),
  fontWeight: z.number().optional(),
  fontColor: ColorSchema.optional(),
  name: z.string().optional(),
  width: z.number().optional().describe("Optional fixed width for the text node"),
  fontFamily: z.string().optional().describe("Font family name (default: Inter)"),
  fontStyle: z.string().optional().describe("Font style (default: derived from fontWeight, e.g. 'Bold', 'Medium')"),
  textAlignHorizontal: z.enum(["LEFT", "CENTER", "RIGHT", "JUSTIFIED"]).optional(),
  lineHeight: z.number().optional().describe("Line height in pixels"),
  letterSpacing: z.number().optional().describe("Letter spacing in pixels"),
  textCase: z.enum(["ORIGINAL", "UPPER", "LOWER", "TITLE"]).optional(),
  opacity: z.number().min(0).max(1).optional().describe("Node opacity (0-1)"),
});

const RectangleNodeSchema = z.object({
  type: z.literal("rectangle"),
  x: z.number().optional().describe("X position (default 0)"),
  y: z.number().optional().describe("Y position (default 0)"),
  width: z.number().describe("Width"),
  height: z.number().describe("Height"),
  name: z.string().optional(),
  fillColor: ColorSchema.optional(),
  strokeColor: ColorSchema.optional(),
  strokeWeight: z.number().positive().optional(),
  cornerRadius: z.number().optional().describe("Uniform corner radius"),
  opacity: z.number().min(0).max(1).optional().describe("Node opacity (0-1)"),
});

const VectorNodeSchema = z.object({
  type: z.literal("vector"),
  pathData: z.string().describe("SVG path data string"),
  x: z.number().optional().describe("X position (default 0)"),
  y: z.number().optional().describe("Y position (default 0)"),
  width: z.number().describe("Width"),
  height: z.number().describe("Height"),
  name: z.string().optional(),
  fillColor: ColorSchema.optional(),
  strokeColor: ColorSchema.optional().describe("Stroke color — hex, RGBA, or $var:Collection/Token"),
  strokeWeight: z.number().positive().optional().describe("Stroke weight (default 1 when strokeColor is set)"),
  strokeCap: z.enum(["NONE", "ROUND", "SQUARE", "ARROW_LINES", "ARROW_EQUILATERAL", "TRIANGLE_FILLED", "DIAMOND_FILLED", "CIRCLE_FILLED"]).optional().describe("Stroke cap applied to all vector vertices"),
  strokeDash: z.array(z.number()).optional().describe("Dash pattern array, e.g. [10, 5] for dashed, [] for solid"),
  opacity: z.number().min(0).max(1).optional().describe("Node opacity (0-1)"),
});

const RepeatDirectiveSchema = z.object({
  $repeat: z.object({
    data: z.array(z.union([z.array(z.any()), z.record(z.any())])).describe(
      "Array of rows. Each row is either an array (use $[0], $[1], ... in template) or an object (use $key in template)."
    ),
    template: z.lazy(() => NodeTreeSchema).describe("Node template. String values containing $[N] or $key are substituted per row."),
  }),
});

type RepeatDirective = {
  $repeat: {
    data: (any[] | Record<string, any>)[];
    template: NodeTree;
  };
};

type NodeTreeChild = NodeTree | RepeatDirective;

type NodeTree =
  | (z.infer<typeof BaseFrameSchema> & { children?: NodeTreeChild[] })
  | z.infer<typeof TextNodeSchema>
  | z.infer<typeof RectangleNodeSchema>
  | z.infer<typeof VectorNodeSchema>;

const NodeTreeChildSchema = z.lazy(() =>
  z.union([NodeTreeSchema, RepeatDirectiveSchema])
) as z.ZodType<NodeTreeChild>;

const NodeTreeSchema: z.ZodType<NodeTree> = z.discriminatedUnion("type", [
  BaseFrameSchema.extend({
    children: z.lazy(() => z.array(NodeTreeChildSchema)).optional(),
  }),
  TextNodeSchema,
  RectangleNodeSchema,
  VectorNodeSchema,
]);

/**
 * Count total nodes in a tree spec, expanding $repeat directives.
 */
function countTreeNodes(tree: any): number {
  if (!tree) return 0;

  // Handle $repeat directive
  if (tree.$repeat) {
    const dataLength = Array.isArray(tree.$repeat.data) ? tree.$repeat.data.length : 0;
    const templateCount = countTreeNodes(tree.$repeat.template);
    return templateCount * dataLength;
  }

  // Count this node
  let count = 1;

  // If it's a frame with children, recursively count each child
  if (tree.type === "frame" && Array.isArray(tree.children)) {
    for (const child of tree.children) {
      count += countTreeNodes(child);
    }
  }

  return count;
}

/**
 * Split a tree's children into chunks for incremental creation.
 * The first chunk creates the parent frame with its first batch of children.
 * Subsequent chunks contain only the remaining children to be appended.
 */
function splitTreeIntoChunks(tree: any, maxNodesPerChunk: number): any[] {
  // Only frames with children can be split
  if (tree.type !== "frame" || !Array.isArray(tree.children) || tree.children.length === 0) {
    return [tree];
  }

  const totalNodes = countTreeNodes(tree);
  if (totalNodes <= maxNodesPerChunk) {
    return [tree];
  }

  const chunks: any[] = [];
  let currentChildren: any[] = [];
  let currentNodeCount = 1; // Count the root frame itself in the first chunk

  for (const child of tree.children) {
    const childNodeCount = countTreeNodes(child);

    // H4 fix: warn if a single child exceeds the chunk limit (can't split it further)
    if (childNodeCount > maxNodesPerChunk) {
      logger.warn(
        `Single child node (${childNodeCount} nodes) exceeds chunk limit (${maxNodesPerChunk}). ` +
        `Including it unsplit — consider reducing child complexity.`
      );
    }

    // If adding this child would exceed the chunk limit and we already have children,
    // finalize the current chunk and start a new one
    if (currentNodeCount + childNodeCount > maxNodesPerChunk && currentChildren.length > 0) {
      if (chunks.length === 0) {
        // First chunk: full root frame with subset of children
        const { children: _, ...rootProps } = tree;
        chunks.push({ ...rootProps, children: currentChildren });
      } else {
        // Subsequent chunks: just the children array (parent ID will be set at execution time)
        chunks.push({ children: currentChildren });
      }
      currentChildren = [];
      currentNodeCount = 0;
    }

    currentChildren.push(child);
    currentNodeCount += childNodeCount;
  }

  // Push the final batch of children
  if (currentChildren.length > 0) {
    if (chunks.length === 0) {
      // All children fit in one chunk — shouldn't normally reach here, but handle gracefully
      chunks.push(tree);
    } else {
      chunks.push({ children: currentChildren });
    }
  }

  return chunks;
}

export function registerTools(server: McpServer, sendCommandToFigma: SendCommandFn) {
  // Create Node Tree Tool - batch recursive node creation
  server.tool(
    "create_node_tree",
    "Create an entire node hierarchy in Figma in one call. Accepts a nested JSON tree of frames, text, rectangles, and vectors. Only frames may have children. Features: (1) $repeat directives in children arrays for data-driven repetition: {\"$repeat\": {\"data\": [[\"a\",\"b\"]], \"template\": {\"type\": \"text\", \"text\": \"$[0]\"}}}. Array rows use $[0],$[1]; object rows use $key. (2) All color fields accept RGBA objects, hex strings (\"#3d6daa\"), or Figma variable references (\"$var:Colors/Primary\") which bind as real Figma variables. Call get_styles or get_local_variables first to discover available tokens. Performance: progress updates fire every 5 nodes, resetting the 60s inactivity timeout — there is no hard node limit. ~30 nodes per call is a soft guideline for simple layouts; data tables and $repeat structures up to ~150+ nodes work reliably. Response includes stats (durationMs, maxDepth, nodesByType) for performance analysis. Sync mode: pass rootId to reconcile an existing tree instead of creating. Matches nodes by name+type, updates changed properties in place, creates new nodes, preserves unmatched existing nodes (or removes them with prune:true). Node IDs are preserved — prototype connections survive updates. Sync mode limitations: child ordering is not reconciled (existing visual order is preserved); duplicate name+type siblings are matched FIFO.",
    {
      tree: NodeTreeSchema.describe("The root node of the tree to create or sync"),
      parentId: z.string().optional().describe("Parent node ID for create mode"),
      rootId: z.string().optional().describe("Existing root node ID for sync/reconcile mode. When provided, matches existing children by name+type and updates in place instead of creating new nodes. Node IDs are preserved."),
      prune: z.boolean().optional().describe("In sync mode, remove existing children not present in the spec. Default false (preserve unmatched nodes)."),
    },
    async ({ tree, parentId, rootId, prune }: any) => {
      if (rootId && parentId) {
        return { content: [{ type: "text", text: JSON.stringify({ error: "Cannot specify both rootId (sync mode) and parentId (create mode). Use rootId for sync/reconciliation or parentId for creating new nodes." }) }] };
      }

      try {
        const nodeCount = countTreeNodes(tree);
        const optimalChunkSize = getOptimalChunkSize();

        // For sync mode, chunking is not supported — send the full tree
        if (rootId || nodeCount <= optimalChunkSize) {
          const startTime = Date.now();
          const result = await sendCommandWithRetry(
            "create_node_tree",
            { tree, parentId, rootId, prune },
            { timeoutMs: 60000 }
          );
          const durationMs = Date.now() - startTime;
          recordOperation("create_node_tree", durationMs, true, nodeCount);
          return {
            content: [{ type: "text", text: JSON.stringify(result) }],
          };
        }

        // Auto-chunking: split the tree and execute incrementally
        logger.info(
          `Auto-chunking create_node_tree: ${nodeCount} nodes into chunks of ~${optimalChunkSize}`
        );
        const chunks = splitTreeIntoChunks(tree, optimalChunkSize);
        logger.info(`Split into ${chunks.length} chunks`);

        const allResults: any[] = [];
        let createdParentId: string | undefined;
        const overallStart = Date.now();

        for (let i = 0; i < chunks.length; i++) {
          const chunk = chunks[i];
          const chunkStart = Date.now();

          if (i === 0) {
            // First chunk: create the parent frame with its first batch of children
            const result = await sendCommandWithRetry(
              "create_node_tree",
              { tree: chunk, parentId },
              { timeoutMs: 60000 }
            ) as any;

            // Skip recordOperation here — sendCommandWithRetry already records (H5 fix)
            allResults.push(result);

            // Extract the created parent frame's ID for subsequent chunks
            if (result && result.id) {
              createdParentId = result.id;
            } else if (result && result.nodeId) {
              createdParentId = result.nodeId;
            }

            if (!createdParentId) {
              logger.warn(
                "Could not extract parent ID from first chunk result; " +
                "remaining chunks will be skipped"
              );
              break;
            }
          } else {
            // Subsequent chunks: add each child directly to the parent
            // instead of wrapping in a dummy frame (C1 fix: no ghost wrappers)
            const children = chunk.children || [];
            for (const child of children) {
              const result = await sendCommandWithRetry(
                "create_node_tree",
                { tree: child, parentId: createdParentId },
                { timeoutMs: 60000 }
              ) as any;
              allResults.push(result);
            }

            const chunkDuration = Date.now() - chunkStart;
            const chunkNodeCount = children.reduce(
              (sum: number, c: any) => sum + countTreeNodes(c), 0
            );
            // Skip recordOperation here — sendCommandWithRetry already records (H5 fix)
          }

          logger.info(`Chunk ${i + 1}/${chunks.length} completed`);
        }

        const overallDuration = Date.now() - overallStart;

        // Aggregate results
        const aggregated = {
          chunked: true,
          totalChunks: chunks.length,
          totalNodes: nodeCount,
          durationMs: overallDuration,
          parentId: createdParentId,
          chunkResults: allResults,
        };

        return {
          content: [{ type: "text", text: JSON.stringify(aggregated) }],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error creating node tree: ${error instanceof Error ? error.message : String(error)}` }],
        };
      }
    }
  );
}
