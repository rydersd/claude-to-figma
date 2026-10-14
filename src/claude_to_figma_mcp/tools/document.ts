import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { SendCommandFn } from "../types.js";
import { filterFigmaNode } from "../helpers.js";

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
    "Get detailed information about the current selection in Figma, including all node details",
    {},
    async () => {
      try {
        const result = await sendCommandToFigma("read_my_design", {});
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
      fields: z.array(z.string()).optional().describe("Optional whitelist of fields to return (e.g. ['id','name','absoluteBoundingBox']). Projection is applied recursively to children. Omit to get the full filtered node."),
    },
    async ({ nodeId, fields }: any) => {
      try {
        const result = await sendCommandToFigma("get_node_info", { nodeId, fields });
        return {
          content: [{ type: "text", text: JSON.stringify(filterFigmaNode(result, fields)) }]
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
      nodeIds: z.array(z.string()).describe("Array of node IDs to get information about"),
      fields: z.array(z.string()).optional().describe("Optional whitelist of fields to return per node (e.g. ['id','name','absoluteBoundingBox']). Projection is applied recursively to children. Omit to get the full filtered nodes."),
    },
    async ({ nodeIds, fields }: any) => {
      try {
        const results = await Promise.all(
          nodeIds.map(async (nodeId: any) => {
            const result = await sendCommandToFigma('get_node_info', { nodeId, fields });
            return { nodeId, info: result };
          })
        );
        return {
          content: [{ type: "text", text: JSON.stringify(results.map((result) => filterFigmaNode(result.info, fields))) }]
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error getting nodes info: ${error instanceof Error ? error.message : String(error)}` }],
        };
      }
    }
  );
}
