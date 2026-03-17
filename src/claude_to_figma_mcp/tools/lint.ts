import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { SendCommandFn } from "../types.js";

export function registerTools(server: McpServer, sendCommandToFigma: SendCommandFn) {
  server.tool(
    "scan_node_styles",
    "Walk a frame tree and return style data (fills, strokes, fonts, layout, corner radius, component info) for every descendant in a single round-trip. Use this for design linting — the result includes a boundVariable flag on each fill/stroke so you can detect hardcoded colors vs token-bound ones. Returns: { rootId, totalNodes, nodes[] }.",
    {
      nodeId: z.string().describe("Root node ID to scan"),
      maxDepth: z.number().int().min(1).max(50).optional().describe("Maximum tree depth to walk (default 10)"),
    },
    async ({ nodeId, maxDepth }: { nodeId: string; maxDepth?: number }) => {
      try {
        const result = await sendCommandToFigma("scan_node_styles", { nodeId, maxDepth }, 60000);
        return {
          content: [{ type: "text", text: JSON.stringify(result) }],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error scanning node styles: ${error instanceof Error ? error.message : String(error)}` }],
        };
      }
    }
  );
}
