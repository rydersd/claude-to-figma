import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { SendCommandFn } from "../types.js";

export function registerTools(server: McpServer, sendCommandToFigma: SendCommandFn) {
  server.tool(
    "create_rectangle",
    "Create a new rectangle in Figma",
    {
      x: z.number().describe("X position"),
      y: z.number().describe("Y position"),
      width: z.number().describe("Width of the rectangle"),
      height: z.number().describe("Height of the rectangle"),
      name: z.string().optional().describe("Optional name for the rectangle"),
      parentId: z.string().optional().describe("Optional parent node ID to append the rectangle to"),
    },
    async ({ x, y, width, height, name, parentId }: any) => {
      try {
        const result = await sendCommandToFigma("create_rectangle", { x, y, width, height, name: name || "Rectangle", parentId });
        return { content: [{ type: "text", text: `Created rectangle "${JSON.stringify(result)}"` }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Error creating rectangle: ${error instanceof Error ? error.message : String(error)}` }] };
      }
    }
  );

  server.tool(
    "create_frame",
    "Create a new frame in Figma",
    {
      x: z.number().describe("X position"),
      y: z.number().describe("Y position"),
      width: z.number().describe("Width of the frame"),
      height: z.number().describe("Height of the frame"),
      name: z.string().optional().describe("Optional name for the frame"),
      parentId: z.string().optional().describe("Optional parent node ID to append the frame to"),
      fillColor: z.object({
        r: z.number().min(0).max(1).describe("Red component (0-1)"),
        g: z.number().min(0).max(1).describe("Green component (0-1)"),
        b: z.number().min(0).max(1).describe("Blue component (0-1)"),
        a: z.number().min(0).max(1).optional().describe("Alpha component (0-1)"),
      }).optional().describe("Fill color in RGBA format"),
      strokeColor: z.object({
        r: z.number().min(0).max(1).describe("Red component (0-1)"),
        g: z.number().min(0).max(1).describe("Green component (0-1)"),
        b: z.number().min(0).max(1).describe("Blue component (0-1)"),
        a: z.number().min(0).max(1).optional().describe("Alpha component (0-1)"),
      }).optional().describe("Stroke color in RGBA format"),
      strokeWeight: z.number().positive().optional().describe("Stroke weight"),
      layoutMode: z.enum(["NONE", "HORIZONTAL", "VERTICAL"]).optional().describe("Auto-layout mode for the frame"),
      layoutWrap: z.enum(["NO_WRAP", "WRAP"]).optional().describe("Whether the auto-layout frame wraps its children"),
      paddingTop: z.number().optional().describe("Top padding for auto-layout frame"),
      paddingRight: z.number().optional().describe("Right padding for auto-layout frame"),
      paddingBottom: z.number().optional().describe("Bottom padding for auto-layout frame"),
      paddingLeft: z.number().optional().describe("Left padding for auto-layout frame"),
      primaryAxisAlignItems: z.enum(["MIN", "MAX", "CENTER", "SPACE_BETWEEN"]).optional().describe("Primary axis alignment for auto-layout frame. Note: When set to SPACE_BETWEEN, itemSpacing will be ignored as children will be evenly spaced."),
      counterAxisAlignItems: z.enum(["MIN", "MAX", "CENTER", "BASELINE"]).optional().describe("Counter axis alignment for auto-layout frame"),
      layoutSizingHorizontal: z.enum(["FIXED", "HUG", "FILL"]).optional().describe("Horizontal sizing mode for auto-layout frame"),
      layoutSizingVertical: z.enum(["FIXED", "HUG", "FILL"]).optional().describe("Vertical sizing mode for auto-layout frame"),
      itemSpacing: z.number().optional().describe("Distance between children in auto-layout frame. Note: This value will be ignored if primaryAxisAlignItems is set to SPACE_BETWEEN.")
    },
    async ({ x, y, width, height, name, parentId, fillColor, strokeColor, strokeWeight, layoutMode, layoutWrap, paddingTop, paddingRight, paddingBottom, paddingLeft, primaryAxisAlignItems, counterAxisAlignItems, layoutSizingHorizontal, layoutSizingVertical, itemSpacing }: any) => {
      try {
        const result = await sendCommandToFigma("create_frame", {
          x, y, width, height, name: name || "Frame", parentId,
          fillColor: fillColor || { r: 1, g: 1, b: 1, a: 1 },
          strokeColor, strokeWeight, layoutMode, layoutWrap,
          paddingTop, paddingRight, paddingBottom, paddingLeft,
          primaryAxisAlignItems, counterAxisAlignItems,
          layoutSizingHorizontal, layoutSizingVertical, itemSpacing
        });
        const typedResult = result as { name: string; id: string };
        return { content: [{ type: "text", text: `Created frame "${typedResult.name}" with ID: ${typedResult.id}. Use the ID as the parentId to appendChild inside this frame.` }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Error creating frame: ${error instanceof Error ? error.message : String(error)}` }] };
      }
    }
  );

  server.tool(
    "create_text",
    "Create a new text element in Figma",
    {
      x: z.number().describe("X position"),
      y: z.number().describe("Y position"),
      text: z.string().describe("Text content"),
      fontSize: z.number().optional().describe("Font size (default: 14)"),
      fontWeight: z.number().optional().describe("Font weight (e.g., 400 for Regular, 700 for Bold)"),
      fontColor: z.object({
        r: z.number().min(0).max(1).describe("Red component (0-1)"),
        g: z.number().min(0).max(1).describe("Green component (0-1)"),
        b: z.number().min(0).max(1).describe("Blue component (0-1)"),
        a: z.number().min(0).max(1).optional().describe("Alpha component (0-1)"),
      }).optional().describe("Font color in RGBA format"),
      name: z.string().optional().describe("Semantic layer name for the text node"),
      parentId: z.string().optional().describe("Optional parent node ID to append the text to"),
      width: z.number().positive().optional().describe("Fixed width for the text node. When set, textAutoResize is set to HEIGHT so text wraps at this width. Useful for table cells and fixed-width columns."),
    },
    async ({ x, y, text, fontSize, fontWeight, fontColor, name, parentId, width }: any) => {
      try {
        const result = await sendCommandToFigma("create_text", {
          x, y, text, fontSize: fontSize || 14, fontWeight: fontWeight || 400,
          fontColor: fontColor || { r: 0, g: 0, b: 0, a: 1 }, name: name || "Text", parentId, width,
        });
        const typedResult = result as { name: string; id: string };
        return { content: [{ type: "text", text: `Created text "${typedResult.name}" with ID: ${typedResult.id}` }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Error creating text: ${error instanceof Error ? error.message : String(error)}` }] };
      }
    }
  );

  server.tool(
    "create_line",
    "Create a line or arrow between two points in Figma. Uses a vector node with per-vertex stroke caps, so each end can have a different cap (e.g., one end arrow, other end none).",
    {
      startX: z.number().describe("X position of the start point"),
      startY: z.number().describe("Y position of the start point"),
      endX: z.number().describe("X position of the end point"),
      endY: z.number().describe("Y position of the end point"),
      strokeWeight: z.number().positive().optional().describe("Stroke weight (default 2)"),
      strokeColor: z.union([
        z.object({
          r: z.number().min(0).max(1).describe("Red (0-1)"),
          g: z.number().min(0).max(1).describe("Green (0-1)"),
          b: z.number().min(0).max(1).describe("Blue (0-1)"),
          a: z.number().min(0).max(1).optional().describe("Alpha (0-1)"),
        }),
        z.string().describe("Hex color string (e.g. '#FF0000') or variable ref ('$var:Collection/Name')"),
      ]).optional().describe("Stroke color as RGBA object, hex string, or variable reference"),
      startCap: z.enum(["NONE", "ROUND", "SQUARE", "ARROW_LINES", "ARROW_EQUILATERAL", "TRIANGLE_FILLED", "DIAMOND_FILLED", "CIRCLE_FILLED"]).optional().describe("Cap style for the start vertex (default NONE)"),
      endCap: z.enum(["NONE", "ROUND", "SQUARE", "ARROW_LINES", "ARROW_EQUILATERAL", "TRIANGLE_FILLED", "DIAMOND_FILLED", "CIRCLE_FILLED"]).optional().describe("Cap style for the end vertex (default NONE)"),
      name: z.string().optional().describe("Optional name for the line node"),
      parentId: z.string().optional().describe("Optional parent node ID to append the line to"),
    },
    async ({ startX, startY, endX, endY, strokeWeight, strokeColor, startCap, endCap, name, parentId }: any) => {
      try {
        const result = await sendCommandToFigma("create_line", {
          startX, startY, endX, endY, strokeWeight: strokeWeight || 2,
          strokeColor, startCap: startCap || "NONE", endCap: endCap || "NONE",
          name: name || "Line", parentId,
        });
        const typedResult = result as { name: string; id: string };
        return { content: [{ type: "text", text: `Created line "${typedResult.name}" with ID: ${typedResult.id}` }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Error creating line: ${error instanceof Error ? error.message : String(error)}` }] };
      }
    }
  );

  server.tool(
    "create_section",
    "Create a Figma Section node to organize frames on the canvas",
    {
      name: z.string().describe("Name for the section"),
      x: z.number().describe("X position"),
      y: z.number().describe("Y position"),
      width: z.number().describe("Width of the section"),
      height: z.number().describe("Height of the section"),
      childIds: z.array(z.string()).optional().describe("Optional array of node IDs to move into the section"),
    },
    async ({ name, x, y, width, height, childIds }: any) => {
      try {
        const result = await sendCommandToFigma("create_section", { name, x, y, width, height, childIds });
        const typedResult = result as { name: string; id: string; childCount: number };
        return { content: [{ type: "text", text: `Created section "${typedResult.name}" with ID: ${typedResult.id}${typedResult.childCount ? ` containing ${typedResult.childCount} children` : ""}` }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Error creating section: ${error instanceof Error ? error.message : String(error)}` }] };
      }
    }
  );
}
