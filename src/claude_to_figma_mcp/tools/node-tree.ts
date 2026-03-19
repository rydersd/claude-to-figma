import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { SendCommandFn } from "../types.js";

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

export function registerTools(server: McpServer, sendCommandToFigma: SendCommandFn) {
  // Create Node Tree Tool - batch recursive node creation
  server.tool(
    "create_node_tree",
    "Create an entire node hierarchy in Figma in one call. Accepts a nested JSON tree of frames, text, rectangles, and vectors. Only frames may have children. Features: (1) $repeat directives in children arrays for data-driven repetition: {\"$repeat\": {\"data\": [[\"a\",\"b\"]], \"template\": {\"type\": \"text\", \"text\": \"$[0]\"}}}. Array rows use $[0],$[1]; object rows use $key. (2) All color fields accept RGBA objects, hex strings (\"#3d6daa\"), or Figma variable references (\"$var:Colors/Primary\") which bind as real Figma variables. Call get_styles or get_local_variables first to discover available tokens. Performance: progress updates fire every 5 nodes, resetting the 60s inactivity timeout — there is no hard node limit. ~30 nodes per call is a soft guideline for simple layouts; data tables and $repeat structures up to ~150+ nodes work reliably. Response includes stats (durationMs, maxDepth, nodesByType) for performance analysis.",
    {
      tree: NodeTreeSchema.describe("The root node of the tree to create"),
      parentId: z.string().optional().describe("Optional parent node ID to append the tree root to"),
    },
    async ({ tree, parentId }: any) => {
      try {
        const result = await sendCommandToFigma("create_node_tree", { tree, parentId }, 60000);
        return {
          content: [{ type: "text", text: JSON.stringify(result) }],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error creating node tree: ${error instanceof Error ? error.message : String(error)}` }],
        };
      }
    }
  );
}
