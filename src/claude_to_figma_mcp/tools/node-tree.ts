import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { SendCommandFn } from "../types.js";
import { sendCommandWithRetry } from "../connection.js";
import { getOptimalChunkSize } from "../metrics.js";
import { logger } from "../helpers.js";
import { resolveImageToBase64 } from "./images.js";
import { resolveLibraryRef, loadLibraryIndex, type LibraryIndex } from "./library.js";

// --- Recursive node tree schema for batch creation ---
const ColorObjectSchema = z.object({
  r: z.number().min(0).max(1).describe("Red component (0-1)"),
  g: z.number().min(0).max(1).describe("Green component (0-1)"),
  b: z.number().min(0).max(1).describe("Blue component (0-1)"),
  a: z.number().min(0).max(1).optional().describe("Alpha component (0-1)"),
});

const GradientObjectSchema = z.object({
  type: z.enum(["GRADIENT_LINEAR", "GRADIENT_RADIAL", "GRADIENT_ANGULAR", "GRADIENT_DIAMOND"]).optional().describe("Gradient type (default GRADIENT_LINEAR)"),
  angle: z.number().optional().describe("CSS-convention angle in degrees for linear gradients: 0 = to top, 90 = to right, clockwise (default 180)"),
  stops: z.array(z.object({
    position: z.number().min(0).max(1).describe("Stop position (0-1)"),
    color: z.union([ColorObjectSchema, z.string().describe("Hex color")]),
  })).min(2).describe("Color stops (at least 2)"),
});

// Color fields accept RGBA object, hex string "#RRGGBB"/"#RGB", variable ref "$var:Collection/Name",
// a gradient object, or a CSS gradient string "linear-gradient(135deg, #667eea, #764ba2)"
const ColorSchema = z.union([
  ColorObjectSchema,
  GradientObjectSchema,
  z.string().describe("Hex color (#RGB, #RRGGBB, #RRGGBBAA), Figma variable reference ($var:Collection/TokenName), or CSS gradient string (linear-gradient(...)/radial-gradient(...))"),
]);

const EffectSchema = z.object({
  type: z.enum(["DROP_SHADOW", "INNER_SHADOW", "LAYER_BLUR", "BACKGROUND_BLUR"]),
  color: ColorSchema.optional().describe("Shadow color — RGBA object or hex string (default black at 25% alpha). Variable refs are not supported in effects."),
  offset: z.object({ x: z.number(), y: z.number() }).optional().describe("Shadow offset (default {x:0, y:4})"),
  radius: z.number().optional().describe("Blur radius (default 4)"),
  spread: z.number().optional().describe("Shadow spread (default 0)"),
  visible: z.boolean().optional().describe("Effect visibility (default true)"),
  blendMode: z.string().optional().describe("Blend mode for shadows (e.g. NORMAL, MULTIPLY)"),
});

const FillImageSchema = z.object({
  url: z.string().optional().describe("HTTP(S) URL — the server prefetches it before sending the tree to Figma"),
  filePath: z.string().optional().describe("Absolute local path to an image file"),
  base64: z.string().optional().describe("Raw base64 image data or data: URI"),
  scaleMode: z.enum(["FILL", "FIT", "CROP", "TILE"]).optional().describe("FILL = CSS cover (default), FIT = contain, TILE = repeat"),
  opacity: z.number().min(0).max(1).optional(),
});

// Shape/appearance fields shared by frames and rectangles
const AppearanceFields = {
  fillImage: FillImageSchema.optional().describe("Image fill from url/filePath/base64 — replaces fillColor (maps CSS background-image / <img>)"),
  effects: z.array(EffectSchema).optional().describe("Effects (shadows, blurs) — e.g. CSS box-shadow maps to one DROP_SHADOW"),
  topLeftRadius: z.number().optional().describe("Per-corner radius (overrides cornerRadius for this corner)"),
  topRightRadius: z.number().optional().describe("Per-corner radius"),
  bottomRightRadius: z.number().optional().describe("Per-corner radius"),
  bottomLeftRadius: z.number().optional().describe("Per-corner radius"),
  strokeAlign: z.enum(["INSIDE", "OUTSIDE", "CENTER"]).optional().describe("Stroke alignment relative to the node bounds"),
  layoutPositioning: z.enum(["AUTO", "ABSOLUTE"]).optional().describe("ABSOLUTE floats this node above auto-layout siblings at its x/y (CSS position:absolute); requires an auto-layout parent"),
};

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
  ...AppearanceFields,
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
  layoutPositioning: z.enum(["AUTO", "ABSOLUTE"]).optional().describe("ABSOLUTE floats this node above auto-layout siblings at its x/y; requires an auto-layout parent"),
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
  ...AppearanceFields,
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

const InstanceNodeSchema = z.object({
  type: z.literal("instance"),
  component: z.string().describe(
    "Library component to place: \"$lib:<Name>\" (resolved against the configured team libraries — see search_library_components) or a raw published componentKey"
  ),
  x: z.number().optional().describe("X position (default 0)"),
  y: z.number().optional().describe("Y position (default 0)"),
  name: z.string().optional().describe("Rename the placed instance (default: component name)"),
  properties: z.record(z.union([z.string(), z.boolean()])).optional().describe(
    "Variant/component properties, e.g. {\"State\": \"Success\"} — also used to pick the variant for $lib: refs"
  ),
  textOverrides: z.record(z.string()).optional().describe("Text replacements keyed by child text-node name"),
  layoutSizingHorizontal: z.enum(["FIXED", "HUG", "FILL"]).optional(),
  layoutSizingVertical: z.enum(["FIXED", "HUG", "FILL"]).optional(),
  layoutPositioning: z.enum(["AUTO", "ABSOLUTE"]).optional().describe("ABSOLUTE floats this node above auto-layout siblings at its x/y; requires an auto-layout parent"),
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
  | z.infer<typeof VectorNodeSchema>
  | z.infer<typeof InstanceNodeSchema>;

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
  InstanceNodeSchema,
]);

/**
 * Prefetch all fillImage sources (url/filePath) in a tree to base64, in place.
 * The plugin has no network access beyond localhost, so images must arrive as bytes.
 * Failed fetches strip the fillImage and are returned as warnings instead of failing the tree.
 */
async function prefetchTreeImages(tree: any, warnings: string[]): Promise<void> {
  if (!tree || typeof tree !== "object") return;

  if (tree.$repeat) {
    await prefetchTreeImages(tree.$repeat.template, warnings);
    return;
  }

  const img = tree.fillImage;
  if (img && (img.url || img.filePath || img.base64)) {
    try {
      const base64 = await resolveImageToBase64(img);
      tree.fillImage = { base64, scaleMode: img.scaleMode, opacity: img.opacity };
    } catch (error) {
      warnings.push(
        `fillImage on "${tree.name || tree.type}" skipped: ${error instanceof Error ? error.message : String(error)}`
      );
      delete tree.fillImage;
    }
  }

  if (Array.isArray(tree.children)) {
    for (const child of tree.children) {
      await prefetchTreeImages(child, warnings);
    }
  }
}

/** True if any instance node in the tree (including $repeat templates) uses a $lib: ref. */
export function treeHasLibraryRefs(tree: any): boolean {
  if (!tree || typeof tree !== "object") return false;
  if (tree.$repeat) return treeHasLibraryRefs(tree.$repeat.template);
  if (tree.type === "instance" && typeof tree.component === "string" && tree.component.startsWith("$lib:")) {
    return true;
  }
  if (Array.isArray(tree.children)) {
    return tree.children.some((child: any) => treeHasLibraryRefs(child));
  }
  return false;
}

/**
 * Rewrite instance nodes in place: `component` ("$lib:Name" or raw key) → `componentKey`.
 * $lib: refs need a loaded index; ambiguous or unmatched refs throw (fail the whole
 * tree) so a wrong component is never silently placed. Runs before $repeat expansion,
 * so `component` must not contain $[N]/$key placeholders.
 *
 * `properties`, unlike `component`, MAY contain $repeat placeholders (e.g.
 * `{"State": "$[0]"}`) — this runs on the template before substitution, so a
 * placeholder won't match any variant and chooseVariant falls back to the set's
 * first variant, just to pick *a* valid componentKey for the import. The
 * `properties` object itself is left untouched (placeholders intact) and carried
 * through to the plugin, which applies the substituted per-row properties via
 * setProperties after $repeat expansion — swapping the instance to the correct
 * variant at that point. So the fallback here never reaches Figma as the wrong
 * variant; it's only a transient placeholder for the resolution pass itself.
 */
export function resolveTreeLibraryRefs(tree: any, index: LibraryIndex | null): void {
  if (!tree || typeof tree !== "object") return;
  if (tree.$repeat) {
    resolveTreeLibraryRefs(tree.$repeat.template, index);
    return;
  }
  if (tree.type === "instance" && typeof tree.component === "string") {
    if (tree.component.startsWith("$lib:")) {
      if (!index) throw new Error("Library index not loaded for $lib: resolution");
      const resolved = resolveLibraryRef(tree.component, index, tree.properties);
      tree.componentKey = resolved.componentKey;
      logger.info(`Resolved ${tree.component} → ${resolved.setName} / ${resolved.variantName}`);
    } else {
      tree.componentKey = tree.component;
    }
    delete tree.component;
  }
  if (Array.isArray(tree.children)) {
    for (const child of tree.children) {
      resolveTreeLibraryRefs(child, index);
    }
  }
}

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

/**
 * Collapse a plugin create/sync result to a compact summary unless verbose.
 * The per-node `nodes` array is the bulk of the payload and is rarely read — we
 * keep the counts, the root node id (what callers actually act on), and errors.
 */
function summarizeTreeResult(result: any, verbose: boolean): any {
  if (verbose || !result || !Array.isArray(result.nodes)) return result;
  const { nodes, ...rest } = result;
  return { ...rest, rootId: nodes[0]?.id, nodeCount: nodes.length };
}

export function registerTools(server: McpServer, sendCommandToFigma: SendCommandFn) {
  // Create Node Tree Tool - batch recursive node creation
  server.tool(
    "create_node_tree",
    "Create (or sync) an entire node hierarchy in one call from a nested JSON tree of frames, text, rectangles, vectors, and library component instances. Supports $repeat, $var: variable binding, $lib: library component refs, hex/gradient/image fills, effects, per-corner radii, and absolute positioning. Pass rootId (instead of parentId) to reconcile an existing tree in place. Returns a compact summary; pass verbose:true for the full node map. For the full spec format, call the 'node_tree_guide' prompt.",
    {
      tree: NodeTreeSchema.describe("The root node of the tree to create or sync"),
      parentId: z.string().optional().describe("Parent node ID for create mode"),
      rootId: z.string().optional().describe("Existing root node ID for sync/reconcile mode (matches children by name+type, updates in place, preserves node IDs)"),
      prune: z.boolean().optional().describe("In sync mode, remove existing children not present in the spec. Default false."),
      verbose: z.boolean().optional().describe("Include the full per-node id/name map in the response. Default false (returns counts + rootId + errors only)."),
    },
    async ({ tree, parentId, rootId, prune, verbose }: any) => {
      if (rootId && parentId) {
        return { content: [{ type: "text", text: JSON.stringify({ error: "Cannot specify both rootId (sync mode) and parentId (create mode). Use rootId for sync/reconciliation or parentId for creating new nodes." }) }] };
      }

      try {
        // Resolve $lib: component refs to concrete keys before anything crosses the WebSocket
        const libIndex = treeHasLibraryRefs(tree) ? await loadLibraryIndex() : null;
        resolveTreeLibraryRefs(tree, libIndex);

        // Resolve fillImage urls/paths to base64 before anything crosses the WebSocket
        const imageWarnings: string[] = [];
        await prefetchTreeImages(tree, imageWarnings);
        if (imageWarnings.length > 0) {
          logger.warn(`create_node_tree image warnings: ${imageWarnings.join("; ")}`);
        }

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
          // sendCommandWithRetry already records metrics — don't double-count (NEW-H1 fix)
          const summary = summarizeTreeResult(result, !!verbose);
          const payload = imageWarnings.length > 0 ? { ...summary, imageWarnings } : summary;
          return {
            content: [{ type: "text", text: JSON.stringify(payload) }],
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

            // Extract the created parent frame's ID for subsequent chunks.
            // The plugin returns the root as nodes[0], so prefer that.
            if (result && Array.isArray(result.nodes) && result.nodes[0]?.id) {
              createdParentId = result.nodes[0].id;
            } else if (result && result.id) {
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

        // Aggregate results. Full per-chunk node arrays are large — only include
        // them when verbose; otherwise return counts and the root id.
        const createdTotal = allResults.reduce(
          (sum: number, r: any) => sum + (typeof r?.createdCount === "number" ? r.createdCount : (Array.isArray(r?.nodes) ? r.nodes.length : 0)),
          0
        );
        const errorTotal = allResults.reduce((sum: number, r: any) => sum + (r?.errorCount || 0), 0);
        const aggregated: any = {
          chunked: true,
          totalChunks: chunks.length,
          totalNodes: nodeCount,
          createdCount: createdTotal,
          errorCount: errorTotal,
          durationMs: overallDuration,
          rootId: createdParentId,
          ...(imageWarnings.length > 0 ? { imageWarnings } : {}),
          ...(verbose ? { chunkResults: allResults } : {}),
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
