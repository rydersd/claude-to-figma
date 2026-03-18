import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { SendCommandFn } from "../types.js";

export function registerTools(server: McpServer, sendCommandToFigma: SendCommandFn) {
  server.tool("set_fill_color", "Set the fill color of a node in Figma can be TextNode or FrameNode", {
    nodeId: z.string().describe("The ID of the node to modify"),
    r: z.number().min(0).max(1).describe("Red component (0-1)"),
    g: z.number().min(0).max(1).describe("Green component (0-1)"),
    b: z.number().min(0).max(1).describe("Blue component (0-1)"),
    a: z.number().min(0).max(1).optional().describe("Alpha component (0-1)"),
  }, async ({ nodeId, r, g, b, a }: any) => {
    try {
      const result = await sendCommandToFigma("set_fill_color", { nodeId, color: { r, g, b, a: a || 1 } });
      const typedResult = result as { name: string };
      return { content: [{ type: "text", text: `Set fill color of node "${typedResult.name}" to RGBA(${r}, ${g}, ${b}, ${a || 1})` }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error setting fill color: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  });

  server.tool("set_stroke_color", "Set the stroke color of a node in Figma", {
    nodeId: z.string().describe("The ID of the node to modify"),
    r: z.number().min(0).max(1).describe("Red component (0-1)"),
    g: z.number().min(0).max(1).describe("Green component (0-1)"),
    b: z.number().min(0).max(1).describe("Blue component (0-1)"),
    a: z.number().min(0).max(1).optional().describe("Alpha component (0-1)"),
    weight: z.number().positive().optional().describe("Stroke weight"),
  }, async ({ nodeId, r, g, b, a, weight }: any) => {
    try {
      const result = await sendCommandToFigma("set_stroke_color", { nodeId, color: { r, g, b, a: a || 1 }, weight: weight || 1 });
      const typedResult = result as { name: string };
      return { content: [{ type: "text", text: `Set stroke color of node "${typedResult.name}" to RGBA(${r}, ${g}, ${b}, ${a || 1}) with weight ${weight || 1}` }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error setting stroke color: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  });

  server.tool("set_corner_radius", "Set the corner radius of a node in Figma", {
    nodeId: z.string().describe("The ID of the node to modify"),
    radius: z.number().min(0).describe("Corner radius value"),
    corners: z.array(z.boolean()).length(4).optional().describe("Optional array of 4 booleans to specify which corners to round [topLeft, topRight, bottomRight, bottomLeft]"),
  }, async ({ nodeId, radius, corners }: any) => {
    try {
      const result = await sendCommandToFigma("set_corner_radius", { nodeId, radius, corners });
      const typedResult = result as { name: string };
      return { content: [{ type: "text", text: `Set corner radius of node "${typedResult.name}" to ${radius}px` }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error setting corner radius: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  });

  server.tool("set_stroke_dash", "Set stroke dash pattern on a node (solid, dashed, dotted, or custom)", {
    nodeId: z.string().describe("The ID of the node"),
    dashPattern: z.array(z.number()).describe("Dash pattern array. Empty [] for solid, [10, 5] for dashed, [2, 2] for dotted, or custom values"),
  }, async ({ nodeId, dashPattern }: any) => {
    try {
      const result = await sendCommandToFigma("set_stroke_dash", { nodeId, dashPattern });
      const typedResult = result as { name: string; id: string };
      const patternDesc = dashPattern.length === 0 ? "solid" : `[${dashPattern.join(", ")}]`;
      return { content: [{ type: "text", text: `Set stroke dash pattern of "${typedResult.name}" to ${patternDesc}` }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error setting stroke dash: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  });

  server.tool("set_stroke_properties", "Set stroke properties (weight, cap, join, align, dashPattern) on a node without requiring a color change", {
    nodeId: z.string().describe("The ID of the node"),
    weight: z.number().positive().optional().describe("Stroke weight"),
    cap: z.enum(["NONE", "ROUND", "SQUARE", "ARROW_LINES", "ARROW_EQUILATERAL", "TRIANGLE_FILLED", "DIAMOND_FILLED", "CIRCLE_FILLED"]).optional().describe("Stroke cap style"),
    join: z.enum(["MITER", "BEVEL", "ROUND"]).optional().describe("Stroke join style"),
    align: z.enum(["INSIDE", "OUTSIDE", "CENTER"]).optional().describe("Stroke alignment relative to the node boundary"),
    dashPattern: z.array(z.number()).optional().describe("Dash pattern array. Empty [] for solid, [10, 5] for dashed, [2, 2] for dotted"),
  }, async ({ nodeId, weight, cap, join, align, dashPattern }: any) => {
    if (weight === undefined && cap === undefined && join === undefined && align === undefined && dashPattern === undefined) {
      return { content: [{ type: "text", text: "Error: At least one stroke property (weight, cap, join, align, dashPattern) must be provided" }] };
    }
    try {
      const result = await sendCommandToFigma("set_stroke_properties", { nodeId, weight, cap, join, align, dashPattern });
      const typedResult = result as { name: string; id: string; strokeWeight: number; strokeCap: string; strokeJoin: string; strokeAlign: string; dashPattern: number[] };
      const updated: string[] = [];
      if (weight !== undefined) updated.push(`weight=${typedResult.strokeWeight}`);
      if (cap !== undefined) updated.push(`cap=${typedResult.strokeCap}`);
      if (join !== undefined) updated.push(`join=${typedResult.strokeJoin}`);
      if (align !== undefined) updated.push(`align=${typedResult.strokeAlign}`);
      if (dashPattern !== undefined) updated.push(`dashPattern=[${typedResult.dashPattern.join(", ")}]`);
      return { content: [{ type: "text", text: `Set stroke properties on "${typedResult.name}": ${updated.join(", ")}` }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error setting stroke properties: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  });

  server.tool("remove_fill", "Remove all fills from a node (makes it transparent/no-fill)", {
    nodeId: z.string().describe("The ID of the node to remove fills from"),
  }, async ({ nodeId }: any) => {
    try {
      const result = await sendCommandToFigma("remove_fill", { nodeId });
      const typedResult = result as { name: string; id: string };
      return { content: [{ type: "text", text: `Removed all fills from "${typedResult.name}"` }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error removing fill: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  });

  server.tool("set_text_decoration", "Set text decoration (underline, strikethrough) on a text node", {
    nodeId: z.string().describe("The ID of the text node"),
    decoration: z.enum(["NONE", "UNDERLINE", "STRIKETHROUGH"]).describe("Text decoration type"),
  }, async ({ nodeId, decoration }: any) => {
    try {
      const result = await sendCommandToFigma("set_text_decoration", { nodeId, decoration });
      const typedResult = result as { name: string; id: string };
      return { content: [{ type: "text", text: `Set text decoration of "${typedResult.name}" to ${decoration}` }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error setting text decoration: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  });
}
