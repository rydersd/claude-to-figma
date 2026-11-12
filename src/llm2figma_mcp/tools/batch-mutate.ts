import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { SendCommandFn } from "../types.js";

const OperationSchema = z.discriminatedUnion("op", [
  z.object({
    op: z.literal("rename"),
    nodeId: z.string().describe("Node ID"),
    name: z.string().describe("New name"),
  }),
  z.object({
    op: z.literal("set_fill"),
    nodeId: z.string().describe("Node ID"),
    color: z.object({
      r: z.number().min(0).max(1), g: z.number().min(0).max(1),
      b: z.number().min(0).max(1), a: z.number().min(0).max(1).optional(),
    }).describe("RGBA color (0-1)"),
  }),
  z.object({
    op: z.literal("set_stroke"),
    nodeId: z.string().describe("Node ID"),
    color: z.object({
      r: z.number().min(0).max(1), g: z.number().min(0).max(1),
      b: z.number().min(0).max(1), a: z.number().min(0).max(1).optional(),
    }).describe("RGBA color (0-1)"),
    weight: z.number().positive().optional().describe("Stroke weight"),
  }),
  z.object({
    op: z.literal("move"),
    nodeId: z.string().describe("Node ID"),
    x: z.number().optional().describe("New X position"),
    y: z.number().optional().describe("New Y position"),
  }),
  z.object({
    op: z.literal("resize"),
    nodeId: z.string().describe("Node ID"),
    width: z.number().positive().describe("New width"),
    height: z.number().positive().describe("New height"),
  }),
  z.object({
    op: z.literal("delete"),
    nodeId: z.string().describe("Node ID"),
  }),
  z.object({
    op: z.literal("set_text"),
    nodeId: z.string().describe("Node ID of a TEXT node"),
    text: z.string().describe("New text content"),
  }),
  z.object({
    op: z.literal("set_visible"),
    nodeId: z.string().describe("Node ID"),
    visible: z.boolean().describe("Whether the node should be visible"),
  }),
  z.object({
    op: z.literal("set_font"),
    nodeId: z.string().describe("Node ID of a TEXT node"),
    fontFamily: z.string().optional().describe("Font family name (default: Inter)"),
    fontStyle: z.string().optional().describe("Font style (default: Regular)"),
  }),
  z.object({
    op: z.literal("set_text_align"),
    nodeId: z.string().describe("Node ID of a TEXT node"),
    horizontal: z.enum(["LEFT", "CENTER", "RIGHT", "JUSTIFIED"]).optional().describe("Horizontal alignment"),
    vertical: z.enum(["TOP", "CENTER", "BOTTOM"]).optional().describe("Vertical alignment"),
  }),
  z.object({
    op: z.literal("set_vector_path"),
    nodeId: z.string().describe("Node ID of a VECTOR node"),
    pathData: z.string().describe("New SVG path data string"),
    width: z.number().positive().optional().describe("New width (must pair with height)"),
    height: z.number().positive().optional().describe("New height (must pair with width)"),
  }),
  z.object({
    op: z.literal("set_opacity"),
    nodeId: z.string().describe("Node ID"),
    opacity: z.number().min(0).max(1).describe("Opacity 0-1"),
  }),
  z.object({
    op: z.literal("set_rotation"),
    nodeId: z.string().describe("Node ID"),
    rotation: z.number().describe("Rotation in degrees (-180 to 180)"),
  }),
  z.object({
    op: z.literal("set_blend_mode"),
    nodeId: z.string().describe("Node ID"),
    blendMode: z.string().describe("Blend mode (NORMAL, MULTIPLY, SCREEN, OVERLAY, etc.)"),
  }),
  z.object({
    op: z.literal("set_corner_radius"),
    nodeId: z.string().describe("Node ID"),
    radius: z.number().describe("Corner radius"),
    corners: z.array(z.boolean()).length(4).optional().describe("Per-corner mask [TL, TR, BR, BL]"),
  }),
  z.object({
    op: z.literal("set_effects"),
    nodeId: z.string().describe("Node ID"),
    effects: z.array(z.object({
      type: z.enum(["DROP_SHADOW", "INNER_SHADOW", "LAYER_BLUR", "BACKGROUND_BLUR"]),
      color: z.union([z.object({ r: z.number(), g: z.number(), b: z.number(), a: z.number().optional() }), z.string()]).optional(),
      offset: z.object({ x: z.number(), y: z.number() }).optional(),
      radius: z.number().optional(),
      spread: z.number().optional(),
      visible: z.boolean().optional(),
    })).describe("Effects array (replaces all existing effects)"),
  }),
  z.object({
    op: z.literal("set_padding"),
    nodeId: z.string().describe("Node ID of an auto-layout frame"),
    paddingTop: z.number().optional(),
    paddingRight: z.number().optional(),
    paddingBottom: z.number().optional(),
    paddingLeft: z.number().optional(),
  }),
  z.object({
    op: z.literal("set_item_spacing"),
    nodeId: z.string().describe("Node ID of an auto-layout frame"),
    itemSpacing: z.number().optional().describe("Gap between children"),
    counterAxisSpacing: z.number().optional().describe("Gap between wrapped rows/columns"),
  }),
  z.object({
    op: z.literal("set_text_decoration"),
    nodeId: z.string().describe("Node ID of a TEXT node"),
    decoration: z.enum(["NONE", "UNDERLINE", "STRIKETHROUGH"]).describe("Text decoration"),
  }),
]);

export function registerTools(server: McpServer, sendCommandToFigma: SendCommandFn) {
  server.tool(
    "batch_mutate",
    "Execute multiple mixed operations in a single round-trip — the primary tool for tweaking existing nodes. Supports: rename, set_fill, set_stroke, move, resize, delete, set_text, set_visible, set_font, set_text_align, set_vector_path, set_opacity, set_rotation, set_blend_mode, set_corner_radius, set_effects, set_padding, set_item_spacing, set_text_decoration. Operations run sequentially — later operations can depend on earlier ones. Dramatically reduces MCP call count for bulk updates.",
    {
      operations: z.array(OperationSchema).min(1).max(100).describe("Array of operations to execute. Each must have an 'op' field plus operation-specific params."),
    },
    async ({ operations }: any) => {
      try {
        const result = await sendCommandToFigma("batch_mutate", { operations }, 60000);
        const typedResult = result as {
          totalOperations: number;
          successCount: number;
          failureCount: number;
          results: Array<{ success: boolean; op: string; nodeId: string; error?: string; [key: string]: any }>;
        };

        const failedResults = typedResult.results.filter(r => !r.success);
        let responseText = `Batch mutate: ${typedResult.successCount}/${typedResult.totalOperations} succeeded`;
        if (failedResults.length > 0) {
          responseText += `\n\nFailed:\n${failedResults.map(r => `- ${r.op} ${r.nodeId}: ${r.error}`).join("\n")}`;
        }

        return {
          content: [{ type: "text", text: responseText }],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error in batch mutate: ${error instanceof Error ? error.message : String(error)}` }],
        };
      }
    }
  );
}
