import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { SendCommandFn } from "../types.js";
const InspectionSchema = {
  fields: z.array(z.string()).max(30).optional().describe("Only return these fields, recursively. Include children to inspect descendants; omit for all supported fields."),
  maxNodes: z.number().int().min(1).max(1000).optional().describe("Total node budget, including roots (default 100). Truncation is reported."),
  maxDepth: z.number().int().min(0).max(50).optional().describe("Maximum descendant depth (default 2; 0 = roots only)."),
  maxTextLength: z.number().int().min(1).max(10000).optional().describe("Maximum characters per text node (default 2000)."),
};

export function registerTools(server: McpServer, sendCommandToFigma: SendCommandFn) {
  // Document Info Tool
  server.tool(
    "get_document_info",
    "Get detailed information about the current Figma document",
    {},
    async () => {
      try {
        const result = await sendCommandToFigma("get_document_info");
        return {
          content: [{ type: "text", text: JSON.stringify(result) }]
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error getting document info: ${error instanceof Error ? error.message : String(error)}` }],
        };
      }
    }
  );

  // Selection Tool
  server.tool(
    "get_selection",
    "Get information about the current selection in Figma",
    {},
    async () => {
      try {
        const result = await sendCommandToFigma("get_selection");
        return {
          content: [{ type: "text", text: JSON.stringify(result) }]
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error getting selection: ${error instanceof Error ? error.message : String(error)}` }],
        };
      }
    }
  );

  // Read My Design Tool
  server.tool(
    "read_my_design",
    "Inspect the selected Figma nodes with a shared node budget and explicit truncation metadata.",
    InspectionSchema,
    async (options: any) => {
      try {
        const result = await sendCommandToFigma("read_my_design", options);
        return {
          content: [{ type: "text", text: JSON.stringify(result) }]
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error getting node info: ${error instanceof Error ? error.message : String(error)}` }],
        };
      }
    }
  );

  // Node Info Tool
  server.tool(
    "get_node_info",
    "Get detailed information about a specific node in Figma",
    {
      nodeId: z.string().describe("The ID of the node to get information about"),
      ...InspectionSchema,
    },
    async ({ nodeId, ...options }: any) => {
      try {
        const result = await sendCommandToFigma("get_node_info", { nodeId, ...options });
        return {
          content: [{ type: "text", text: JSON.stringify(result) }]
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error getting node info: ${error instanceof Error ? error.message : String(error)}` }],
        };
      }
    }
  );

  // Nodes Info Tool
  server.tool(
    "get_nodes_info",
    "Get detailed information about multiple nodes in Figma",
    {
      nodeIds: z.array(z.string()).min(1).max(100).describe("Root IDs to inspect in one round-trip with a shared node budget"),
      ...InspectionSchema,
    },
    async ({ nodeIds, ...options }: any) => {
      try {
        const results = await sendCommandToFigma("get_nodes_info", { nodeIds, ...options }) as any[];
        return {
          content: [{ type: "text", text: JSON.stringify(results.map(result => result.skipped ? result : result.document)) }]
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error getting nodes info: ${error instanceof Error ? error.message : String(error)}` }],
        };
      }
    }
  );
}
