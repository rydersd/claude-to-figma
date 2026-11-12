import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { SendCommandFn } from "../types.js";

export function registerTools(server: McpServer, sendCommandToFigma: SendCommandFn) {
  server.tool("create_vector", "Create a vector node from SVG path data in Figma. Supports inline strokeColor/strokeWeight/strokeCap to avoid a separate set_stroke_color call.", {
    pathData: z.string().describe("SVG path data string (the 'd' attribute value)"),
    x: z.number().describe("X position"),
    y: z.number().describe("Y position"),
    width: z.number().describe("Width to scale the vector to"),
    height: z.number().describe("Height to scale the vector to"),
    name: z.string().optional().describe("Optional name for the vector node"),
    parentId: z.string().optional().describe("Optional parent node ID"),
    fillColor: z.object({
      r: z.number().min(0).max(1).describe("Red (0-1)"),
      g: z.number().min(0).max(1).describe("Green (0-1)"),
      b: z.number().min(0).max(1).describe("Blue (0-1)"),
      a: z.number().min(0).max(1).optional().describe("Alpha (0-1)"),
    }).optional().describe("Fill color in RGBA format"),
    strokeColor: z.object({
      r: z.number().min(0).max(1).describe("Red (0-1)"),
      g: z.number().min(0).max(1).describe("Green (0-1)"),
      b: z.number().min(0).max(1).describe("Blue (0-1)"),
      a: z.number().min(0).max(1).optional().describe("Alpha (0-1)"),
    }).optional().describe("Stroke color in RGBA format — eliminates the need for a separate set_stroke_color call"),
    strokeWeight: z.number().positive().optional().describe("Stroke weight in pixels"),
    strokeCap: z.enum(["NONE", "ROUND", "SQUARE", "ARROW_LINES", "ARROW_EQUILATERAL", "TRIANGLE_FILLED", "DIAMOND_FILLED", "CIRCLE_FILLED"]).optional().describe("Stroke cap style (e.g., ARROW_EQUILATERAL for arrowheads)"),
  }, async ({ pathData, x, y, width, height, name, parentId, fillColor, strokeColor, strokeWeight, strokeCap }: any) => {
    try {
      const result = await sendCommandToFigma("create_vector", { pathData, x, y, width, height, name: name || "Vector", parentId, fillColor, strokeColor, strokeWeight, strokeCap });
      const typedResult = result as { name: string; id: string };
      return { content: [{ type: "text", text: `Created vector "${typedResult.name}" with ID: ${typedResult.id}` }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error creating vector: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  });

  server.tool("set_vector_path", "Update the SVG path data of an existing vector node in place. Avoids the delete-recreate-restroke pattern when changing a line's route (e.g., straight to L-shaped).", {
    nodeId: z.string().describe("The ID of the vector node to update"),
    pathData: z.string().describe("New SVG path data string (the 'd' attribute value)"),
    width: z.number().optional().describe("New width to resize the vector to (required if path changes shape)"),
    height: z.number().optional().describe("New height to resize the vector to (required if path changes shape)"),
  }, async ({ nodeId, pathData, width, height }: any) => {
    try {
      const result = await sendCommandToFigma("set_vector_path", { nodeId, pathData, width, height });
      const typedResult = result as { id: string; name: string; width: number; height: number };
      return { content: [{ type: "text", text: `Updated vector path of "${typedResult.name}" (${typedResult.id}), size: ${typedResult.width}×${typedResult.height}` }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error updating vector path: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  });

  server.tool("get_vector_network", "Read the vector network (vertices, segments, regions) of a vector node. Returns point positions, stroke caps, tangent handles, and topology. Use this to inspect existing vectors before modifying them.", {
    nodeId: z.string().describe("The ID of the vector node to read"),
  }, async ({ nodeId }: any) => {
    try {
      const result = await sendCommandToFigma("get_vector_network", { nodeId });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error reading vector network: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  });

  server.tool("set_vector_network", "Update the vector network of an existing vector node. Set vertices (with optional strokeCap per point), segments (with optional bezier tangents), and regions. Use this for L-shaped routes, adding/removing points, or changing point positions on existing vectors.", {
    nodeId: z.string().describe("The ID of the vector node to update"),
    vertices: z.array(z.object({
      x: z.number().describe("X position in local vector coordinates"),
      y: z.number().describe("Y position in local vector coordinates"),
      strokeCap: z.enum(["NONE", "ROUND", "SQUARE", "ARROW_LINES", "ARROW_EQUILATERAL", "TRIANGLE_FILLED", "DIAMOND_FILLED", "CIRCLE_FILLED"]).optional().describe("Stroke cap at this vertex"),
      cornerRadius: z.number().optional().describe("Corner radius at this vertex for rounded bends"),
    })).describe("Array of vertex positions"),
    segments: z.array(z.object({
      start: z.number().describe("Index of start vertex"),
      end: z.number().describe("Index of end vertex"),
      tangentStart: z.object({ x: z.number(), y: z.number() }).optional().describe("Bezier tangent handle at start vertex"),
      tangentEnd: z.object({ x: z.number(), y: z.number() }).optional().describe("Bezier tangent handle at end vertex"),
    })).describe("Array of segments connecting vertices"),
    regions: z.array(z.object({
      windingRule: z.enum(["NONZERO", "EVENODD"]).optional().describe("Winding rule for fill"),
      loops: z.array(z.array(z.number())).describe("Arrays of segment indices forming closed loops"),
    })).optional().describe("Regions for filled shapes (not needed for open paths/lines)"),
  }, async ({ nodeId, vertices, segments, regions }: any) => {
    try {
      const result = await sendCommandToFigma("set_vector_network", { nodeId, vertices, segments, regions: regions || [] });
      const typedResult = result as { id: string; name: string; vertexCount: number; segmentCount: number; regionCount: number };
      return { content: [{ type: "text", text: `Updated vector network of "${typedResult.name}" (${typedResult.id}): ${typedResult.vertexCount} vertices, ${typedResult.segmentCount} segments, ${typedResult.regionCount} regions` }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error updating vector network: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  });
}
