import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { SendCommandFn } from "../types.js";

export function registerTools(server: McpServer, sendCommandToFigma: SendCommandFn) {
  server.tool(
    "scan_node_styles",
    "Walk a frame tree and return style data (fills, strokes, fonts, layout, corner radius, component info) for every descendant in a single round-trip. Use this for design linting — the result includes a boundVariable flag on each fill/stroke so you can detect hardcoded colors vs token-bound ones. Returns bounded nodes and coverage metadata, or summary:true for compact validation counts and up to ten unbound-color node IDs. A truncated scan covers only part of the composition.",
    {
      nodeId: z.string().describe("Root node ID to scan"),
      maxDepth: z.number().int().min(1).max(50).optional().describe("Maximum tree depth to walk (default 10)"),
      maxNodes: z.number().int().min(1).max(1000).optional().describe("Maximum nodes to inspect (default 100); truncation is explicit"),
      summary: z.boolean().optional().describe("Return counts, font families and unbound-color examples instead of node data"),
      fields: z.array(z.string()).optional().describe("Whitelist of keys to keep per node (e.g. ['id','fills','font']). Omit for all fields — large scans are token-heavy."),
    },
    async (options: any) => {
      try {
        const result = await sendCommandToFigma("scan_node_styles", options, 60000) as any;
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
