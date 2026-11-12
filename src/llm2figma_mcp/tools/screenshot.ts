import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { SendCommandFn } from "../types.js";

export function registerTools(server: McpServer, sendCommandToFigma: SendCommandFn) {
  server.tool(
    "screenshot_region",
    "Capture a screenshot of a canvas region by coordinates. Useful for visually verifying sections of large designs (e.g., sitemap swimlanes) without needing a wrapping frame. Returns a PNG image.",
    {
      x: z.number().describe("X coordinate of the top-left corner of the region"),
      y: z.number().describe("Y coordinate of the top-left corner of the region"),
      width: z.number().positive().describe("Width of the region to capture"),
      height: z.number().positive().describe("Height of the region to capture"),
      scale: z.number().positive().optional().describe("Export scale (default 1). Use 0.5 for large regions, 0.25 for very large regions."),
    },
    async ({ x, y, width, height, scale }: any) => {
      try {
        const result = await sendCommandToFigma("screenshot_region", {
          x, y, width, height, scale: scale || 1,
        });
        const typedResult = result as { imageData: string; mimeType: string; region: { x: number; y: number; width: number; height: number }; scale: number };
        return {
          content: [
            {
              type: "image",
              data: typedResult.imageData,
              mimeType: typedResult.mimeType || "image/png",
            },
            {
              type: "text",
              text: `Screenshot captured: region (${typedResult.region.x}, ${typedResult.region.y}) ${typedResult.region.width}×${typedResult.region.height} at ${typedResult.scale}x scale`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error capturing screenshot: ${error instanceof Error ? error.message : String(error)}` }],
        };
      }
    }
  );
}
